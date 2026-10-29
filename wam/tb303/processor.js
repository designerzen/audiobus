/**
 * TB-303 virtual analogue voice. Self-contained for WAM's addFunctionModule.
 * Circuit references:
 * https://synthfool.com/docs/Roland/TB303/tb303a.jpg
 * https://www.timstinchcombe.co.uk/synth/Moog_ladder_tf.pdf (section 3)
 * https://www.timstinchcombe.co.uk/index.php?pge=diode2
 * https://www.firstpr.com.au/rwi/dfish/303-unique.html
 *
 * The diode ladder has bidirectional interstage loading, NOT four isolated
 * one-poles. With C1=C/2 its linear denominator is
 * s^4 + 2^(11/4)s^3 + 10sqrt(2)s^2 + 2^(13/4)s + 1.
 * tanh differential currents limit the large-signal response. Trapezoidal
 * integration and bounded Newton iterations solve the instantaneous feedback.
 * The surrounding RC network matches Stinchcombe's small-signal pole/zero
 * model; grouping its sections around the nonlinear core is an approximation.
 * Control tapers, oscillator shaping and VCA scaling need hardware calibration.
 */
export default function registerTB303Processor(moduleId, definitions) {
	const { WamProcessor, WamParameterInfo } = globalThis.webAudioModules.getModuleScope(moduleId)
	const rate = globalThis.sampleRate
	const oversampling = 4
	const internalRate = rate * oversampling
	const dt = 1 / internalRate
	const approach = (time) => -Math.expm1(-dt / time)
	const slideCoefficient = approach(100000 * 0.22e-6) // DAC impedance and C35
	const attackCoefficient = approach(0.0008)
	const releaseCoefficient = Math.exp(-dt / 0.003)
	const volumeDecay = Math.exp(-dt / 1.2)
	const accentCoefficient = approach(47000 * 0.033e-6) // R119/C36
	const controlCoefficient = approach(0.003)
	const blep = (phase, step) => {
		if (phase < step) {
			const t = phase / step
			return t + t - t * t - 1
		}
		if (phase > 1 - step) {
			const t = (phase - 1) / step
			return t * t + t + t + 1
		}
		return 0
	}
	// H(s)=(s+zero)/(s+pole), pole/zero in radians/sec. TPT state.
	const section = (pole, zero) => {
		const g = Math.tan((pole * dt) / 2)
		return { g: g / (1 + g), mix: zero / pole - 1, state: 0 }
	}
	const tick = (filter, input) => {
		const v = (input - filter.state) * filter.g
		const low = v + filter.state
		filter.state = low + v
		return input + filter.mix * low
	}
	class TB303Processor extends WamProcessor {
		constructor(options) {
			super(options)
			this.held = []
			this.bend = new Float64Array(16)
			this.portamento = new Uint8Array(16)
			this.sustain = new Uint8Array(16)
			this.active = null
			this.voiceChannel = 0
			this.gate = false
			this.sliding = false
			this.accented = false
			this.pitch = 36
			this.targetPitch = 36
			this.phase = 0
			this.mainEnvelope = 0
			this.volumeEnvelope = 0
			this.volumePeak = 0
			this.accentVca = 0
			this.accentCapacitor = 0
			this.envelopeAttack = 0
			this.state = new Float64Array(4)
			this.solution = new Float64Array(4)
			this.controls = Object.fromEntries(
				Object.entries(definitions).map(([id, p]) => [id, p.defaultValue])
			)
			// Forward path: 1.06*s^3*(s+109.9)*(s+34)/
			// [(s+97.5)*(s+38.5)*(s+4.45)*(s+578.1)*(s+20)].
			this.inputCoupling = [section(97.5, 0), section(38.5, 109.9), section(4.45, 34)]
			this.outputCoupling = [section(578.1, 0), section(20, 0)]
			this.vcaCoupling = section(1 / (47000 * 1e-6), 0) // output DC blocking, C59/R155
			this.feedbackCoupling = [
				section(97.5, 0),
				section(38.5, 0),
				section(578.1, 0),
				section(20, 0),
				section(4.45, 46.5),
				section(7.41, 4.4)
			]
			this.feedbackA = 1
			for (const f of this.feedbackCoupling) {
				this.feedbackA *= 1 + f.mix * f.g
			}
			// Blackman-windowed sinc, evaluated once per output sample. Averaging
			// four samples alone would alias the nonlinear ladder's harmonics.
			this.fir = new Float64Array(127)
			this.history = new Float64Array(128)
			this.historyPosition = 0
			let sum = 0
			for (let i = 0; i < this.fir.length; i++) {
				const n = i - 63,
					cutoff = 0.1125
				const sinc =
					n === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * n) / (Math.PI * n)
				this.fir[i] =
					sinc *
					(0.42 -
						0.5 * Math.cos((2 * Math.PI * i) / 126) +
						0.08 * Math.cos((4 * Math.PI * i) / 126))
				sum += this.fir[i]
			}
			for (let i = 0; i < this.fir.length; i++) {
				this.fir[i] /= sum
			}
		}
		_generateWamParameterInfo() {
			return Object.fromEntries(
				Object.entries(definitions).map(([id, p]) => [id, new WamParameterInfo(id, p)])
			)
		}
		_select(note, tie) {
			this.active = note
			if (!note) {
				this.gate = false
				return
			}
			this.voiceChannel = note.channel
			this.targetPitch = note.note + this.bend[note.channel]
			this.sliding = tie || !!this.portamento[note.channel]
			if (!this.sliding) {
				this.pitch = this.targetPitch
			}
			this.accented = note.velocity >= 100
			if (!tie) {
				this.mainEnvelope = 1
				this.envelopeAttack = Math.round(0.002 * internalRate)
				this.volumePeak = 1
			}
			this.gate = true
		}
		_releaseChannel(channel, immediate) {
			this.held = this.held.filter((n) => n.channel !== channel)
			if (!this.active && immediate && this.voiceChannel === channel) {
				this._silence()
			}
			if (this.active?.channel !== channel) {
				return
			}
			this._select(this.held[this.held.length - 1] ?? null, true)
			if (immediate && !this.active) {
				this._silence()
			}
		}
		_silence() {
			this.gate = false
			this.mainEnvelope = this.volumeEnvelope = this.volumePeak = 0
			this.accentCapacitor = this.accentVca = 0
			this.envelopeAttack = 0
			this.state.fill(0)
			this.solution.fill(0)
			this.history.fill(0)
			for (const f of this.inputCoupling) {
				f.state = 0
			}
			for (const f of this.outputCoupling) {
				f.state = 0
			}
			for (const f of this.feedbackCoupling) {
				f.state = 0
			}
			this.vcaCoupling.state = 0
		}
		_onMidi({ bytes }) {
			const [status, number, value] = bytes
			const channel = status & 15,
				kind = status & 0xf0
			if (kind === 0x90 && value > 0) {
				const tie = this.gate
				this.held = this.held.filter((n) => n.channel !== channel || n.note !== number)
				const note = { note: number, channel, velocity: value, down: true }
				this.held.push(note)
				this._select(note, tie)
			} else if (kind === 0x80 || kind === 0x90) {
				const note = this.held.find((n) => n.channel === channel && n.note === number)
				if (!note) {
					return
				}
				note.down = false
				if (this.sustain[channel]) {
					return
				}
				this.held = this.held.filter((n) => n !== note)
				if (this.active === note) {
					this._select(this.held[this.held.length - 1] ?? null, true)
				}
			} else if (kind === 0xe0) {
				this.bend[channel] = (((number | (value << 7)) - 8192) / 8192) * 2
				if (this.active?.channel === channel) {
					this.targetPitch = this.active.note + this.bend[channel]
				}
			} else if (kind === 0xb0) {
				if (number === 64) {
					this.sustain[channel] = value >= 64 ? 1 : 0
					if (!this.sustain[channel]) {
						this.held = this.held.filter((n) => n.channel !== channel || n.down)
						if (this.active && !this.held.includes(this.active)) {
							this._select(this.held[this.held.length - 1] ?? null, true)
						}
					}
				} else if (number === 65) {
					this.portamento[channel] = value >= 64 ? 1 : 0
				} else if (number === 120 || number === 123) {
					this._releaseChannel(channel, number === 120)
				} else if (number === 121) {
					this.bend[channel] = this.sustain[channel] = this.portamento[channel] = 0
					this.held = this.held.filter((n) => n.channel !== channel || n.down)
					if (this.active && !this.held.includes(this.active)) {
						this._select(this.held[this.held.length - 1] ?? null, true)
					}
					if (this.active?.channel === channel) {
						this.targetPitch = this.active.note
					}
				}
			}
		}
		_accentSweep(source, resonance) {
			// D24, R46=47k, second gang of VR4=100k, C13=1uF,
			// and R72=100k to the filter-current summing node. The diode
			// disconnects the source on discharge; charge is NOT reset per note.
			const ra = 47000 + 100000 * resonance
			const rb = 100000 * (1 - resonance)
			const load = 100000
			const conducting = source > (this.accentCapacitor * load) / (load + rb)
			const target = conducting ? (source * load) / (ra + load) : 0
			const resistance = rb + (conducting ? (ra * load) / (ra + load) : load)
			this.accentCapacitor += (target - this.accentCapacitor) * approach(resistance * 1e-6)
			return conducting
				? (source * rb * load + this.accentCapacitor * ra * load) /
						(ra * rb + ra * load + rb * load)
				: (this.accentCapacitor * load) / (load + rb)
		}
		_oscillatorSample(hz, waveform) {
			const step = Math.min(0.45, hz / internalRate),
				phase = this.phase
			const saw = 2 * phase - 1 - blep(phase, step)
			// Q8's saw-to-pulse converter changes pulse width with pitch. This
			// CV-domain fit approximates the reported 71% low / 45% high duty
			// range; it is a hardware-calibration target, not a PWM control.
			// https://acidlab.de/ProductAssets/Modular/Module_Overview.pdf
			// Waveform comparison: https://olney.ai/ct-modular-book/tb-303.html
			const note = 69 + 12 * Math.log2(hz / 440)
			const duty = 0.45 + 0.26 * Math.max(0, Math.min(1, (72 - note) / 48))
			const square =
				(phase < duty ? 1 : -1) + blep(phase, step) - blep((phase + 1 - duty) % 1, step)
			this.phase = (phase + step) % 1
			return (saw * (1 - waveform) + square * waveform) * 0.65
		}
		_filterSample(input, frequency, resonance) {
			for (const f of this.inputCoupling) {
				input = tick(f, input)
			}
			// Feedback chain is linear: express its current output as A*y4+B
			// before Newton, then advance its states only after convergence.
			let feedbackB = 0
			for (const f of this.feedbackCoupling) {
				feedbackB = (1 + f.mix * f.g) * feedbackB + f.mix * (1 - f.g) * f.state
			}
			const k = 18.7 * resonance
			const g =
				Math.tan(
					(Math.PI * Math.min(internalRate * 0.12, Math.max(10, frequency))) /
						internalRate
				) *
				2 ** 0.75
			const h = g / 2,
				z = this.state,
				x = this.solution
			let x0 = x[0],
				x1 = x[1],
				x2 = x[2],
				x3 = x[3]
			for (let iteration = 0; iteration < 5; iteration++) {
				const t0 = Math.tanh(input - k * (this.feedbackA * x3 + feedbackB))
				const t1 = Math.tanh(x0 - x1),
					t2 = Math.tanh(x1 - x2)
				const t3 = Math.tanh(x2 - x3),
					t4 = Math.tanh(x3)
				const d0 = 1 - t0 * t0,
					d1 = 1 - t1 * t1,
					d2 = 1 - t2 * t2
				const d3 = 1 - t3 * t3,
					d4 = 1 - t4 * t4
				const r0 = x0 - z[0] - g * (t0 - t1)
				const r1 = x1 - z[1] - h * (t1 - t2)
				const r2 = x2 - z[2] - h * (t2 - t3)
				const r3 = x3 - z[3] - h * (t3 - t4)
				// Backward tridiagonal elimination, retaining the row-0/col-3
				// resonance term. No matrix allocation in the audio callback.
				const a3 = (h * d3) / (1 + h * (d3 + d4))
				const b3 = r3 / (1 + h * (d3 + d4))
				const j2 = 1 + h * (d2 + d3) - h * d3 * a3
				const a2 = (h * d2) / j2,
					b2 = (r2 + h * d3 * b3) / j2
				const j1 = 1 + h * (d1 + d2) - h * d2 * a2
				const a1 = (h * d1) / j1,
					b1 = (r1 + h * d2 * b2) / j1
				const corner = g * k * d0 * this.feedbackA
				let delta0 =
					(r0 + g * d1 * b1 - corner * (a3 * (a2 * b1 + b2) + b3)) /
					(1 + g * d1 - g * d1 * a1 + corner * a3 * a2 * a1)
				// Damping keeps a large automation jump inside Newton's basin.
				delta0 = Math.max(-1, Math.min(1, delta0))
				const delta1 = a1 * delta0 + b1,
					delta2 = a2 * delta1 + b2,
					delta3 = a3 * delta2 + b3
				x0 -= delta0
				x1 -= delta1
				x2 -= delta2
				x3 -= delta3
				if (
					Math.max(
						Math.abs(delta0),
						Math.abs(delta1),
						Math.abs(delta2),
						Math.abs(delta3)
					) < 1e-7
				) {
					break
				}
			}
			x[0] = x0
			x[1] = x1
			x[2] = x2
			x[3] = x3
			z[0] = 2 * x0 - z[0]
			z[1] = 2 * x1 - z[1]
			z[2] = 2 * x2 - z[2]
			z[3] = 2 * x3 - z[3]
			let feedback = x3
			for (const f of this.feedbackCoupling) {
				feedback = tick(f, feedback)
			}
			let output = x3 * 1.06
			for (const f of this.outputCoupling) {
				output = tick(f, output)
			}
			return output
		}
		_process(start, end, _inputs, outputs) {
			const channels = outputs[0]
			if (!channels?.length) {
				return
			}
			const p = this._parameterInterpolators,
				c = this.controls
			for (let i = start; i < end; i++) {
				for (let sub = 0; sub < oversampling; sub++) {
					for (const id in c) {
						const values = p[id].values
						const value = values.length === 1 ? values[0] : values[i]
						c[id] += (value - c[id]) * controlCoefficient
					}
					this.pitch +=
						(this.targetPitch - this.pitch) * (this.sliding ? slideCoefficient : 1)
					const hz = 440 * 2 ** ((this.pitch - 69 + c.tuning / 100) / 12)
					const oscillator = this._oscillatorSample(hz, c.waveform)
					// Service notes specify time to 10%, not an RC time constant.
					const decay = this.accented ? 0.2 : c.decay
					if (this.envelopeAttack > 0) {
						this.envelopeAttack--
					} else {
						this.mainEnvelope *= Math.exp((-Math.LN10 * dt) / decay)
					}
					this.volumePeak *= this.gate ? volumeDecay : releaseCoefficient
					this.volumeEnvelope +=
						(this.volumePeak - this.volumeEnvelope) * attackCoefficient
					const accentSource = this.accented ? this.mainEnvelope * c.accent : 0
					this.accentVca += (accentSource - this.accentVca) * accentCoefficient
					const sweep = this._accentSweep(accentSource, c.resonance)
					// The stock Env Mod pot has nonzero depth at minimum and
					// shifts the resting cutoff as well as the envelope peak.
					const depth = 0.35 + 4.6 * c.envMod
					const cutoff = c.cutoff * 2 ** (depth * (this.mainEnvelope - 0.18) + 5 * sweep)
					const filtered = this._filterSample(oscillator, cutoff, c.resonance)
					// BA662 gain-control current sums VEG and smoothed accent.
					const vca = 0.55 * this.volumeEnvelope + 1.1 * this.accentVca
					// Calibrate the circuit's low VCA level to the other built-in
					// instruments. Soft saturation bounds extreme accent settings.
					const sample =
						Math.tanh(tick(this.vcaCoupling, Math.tanh(filtered * vca * 1.8)) * 4) *
						c.volume
					this.history[this.historyPosition] = sample
					this.historyPosition = (this.historyPosition + 1) & 127
				}
				let sample = 0
				for (let tap = 0; tap < this.fir.length; tap++) {
					sample += this.fir[tap] * this.history[(this.historyPosition - 1 - tap) & 127]
				}
				for (const channel of channels) {
					channel[i] = sample
				}
			}
		}
	}
	globalThis.registerProcessor(moduleId, TB303Processor)
}