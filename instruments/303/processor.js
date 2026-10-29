/*!
License

First of all, if you use this software and make a hit song, buy me some coffee!

Copyright (C) 2014 Emil Loer

This program is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software Foundation,
either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.
If not, see http://www.gnu.org/licenses/.
*/

// Port of designerzen/audiobus, branch ts2wp2es6pug, commit 5f65dc9.
// Uses the original wavetable and DSP; runs in an AudioWorklet at the actual device rate.
export default function registerSynth303Processor(definitions) {
	const anti_denormal = 1e-20
	const tau = 2 * Math.PI
	const LOG_OF_TWO = Math.log(2)
	const sinh = (x) => {
		return (Math.exp(x) - Math.exp(-x)) * 0.5
	}
	const _coeff_integrator = (decaytime, sampleRate) => {
		return Math.exp(-1.0 / (sampleRate * 0.001 * decaytime))
	}
	const coeff_highpass = (cutoff, sampleRate) => {
		const x = Math.exp(-tau * cutoff * (1 / sampleRate))
		return [0, 0, 0.5 * (1 + x), -0.5 * (1 + x), x]
	}
	const coeff_allpass = (cutoff, sampleRate) => {
		const t = Math.tan(Math.PI * cutoff * (1 / sampleRate))
		const x = (t - 1) / (1 + 1)
		return [0, 0, x, 1, -x]
	}
	const coeff_biquad_lowpass12db = (freq, gain, sampleRate) => {
		const w = (tau * freq) / sampleRate
		const s = Math.sin(w)
		const c = Math.cos(w)
		const q = gain
		const alpha = s / (2 * q)
		const scale = 1 / (1 + alpha)
		const a1 = 2 * c * scale
		const a2 = (alpha - 1) * scale
		const b1 = (1 - c) * scale
		const b0 = 0.5 * b1
		const b2 = b0
		return [0, 0, 0, 0, b0, b1, b2, a1, a2]
	}
	const coeff_biquad_notch = function (freq, bandwidth, sampleRate) {
		const w = (tau * freq) / sampleRate
		const s = Math.sin(w)
		const c = Math.cos(w)
		const alpha = s * sinh((0.5 * LOG_OF_TWO * bandwidth * w) / s)
		const scale = 1 / (1 + alpha)
		const a1 = 2 * c * scale
		const a2 = (alpha - 1) * scale
		const b0 = 1 * scale
		const b1 = -2 * c * scale
		const b2 = 1 * scale
		return [0, 0, 0, 0, b0, b1, b2, a1, a2]
	}
	class Legacy303 {
		running = true
		justPlayed = false
		tuningValue = 0
		waveform = 0
		cutOffValue = 240
		resonanceValue = 1
		envmod = 0
		decayValue = 1
		thresholdValue = 100
		accentValue = 0
		dist_shape = 0
		dist_threshold = 1
		delay_feedback = 0
		delay_send = 0
		delay_length = 20000
		onepole = []
		biquad = []
		tbfilter = [0, 0, 0, 0, 0]
		resonance_skewed = 0
		tbf_b0 = 0
		tbf_k = 0
		tbf_g = 1.0
		samplepos = 1000000
		pos = -1
		slidestep = 0
		table = 0
		oscpos = 0
		oscdelta = 0
		ampenv = 0
		filterenv = 0
		slide = 0
		filtermult = 0
		ampmult = 0
		accentgain = 0
		envscaler = 0
		envoffset = 0
		dist_gain = 1 / this.dist_threshold
		delaybuffer
		delaypos = 0
		sampleRate
		wavetable
		set accent(value) {
			this.accentValue = value
		}
		get accent() {
			return this.accentValue
		}
		set shape(value) {
			this.dist_shape = value
		}
		get shape() {
			return this.dist_shape
		}
		set tuning(value) {
			this.tuningValue = value
		}
		get tuning() {
			return this.tuningValue
		}
		set cutOff(value) {
			this.cutOffValue = value
			this.envelopeModulation = this.envmod
		}
		get cutOff() {
			return this.cutOffValue
		}
		set resonance(value) {
			this.resonanceValue = value
			this.resonance_skewed = (1 - Math.exp(-3 * value)) / (1 - Math.exp(-3))
		}
		get resonance() {
			return this.resonanceValue
		}
		set envelopeModulation(value) {
			const c0 = 3.138152786059267e2
			const c1 = 2.394411986817546e3
			const c = Math.log(this.cutOffValue / c0) / Math.log(c1 / c0)
			const slo = 3.773996325111173 * value + 0.736965594166206
			const shi = 4.194548788411135 * value + 0.864344900642434
			this.envmod = value
			this.envscaler = (1.0 - c) * slo + c * shi
			this.envoffset = 0.048292930943553 * c + 0.294391201442418
		}
		get envelopeModulation() {
			return this.envmod
		}
		set threshold(value) {
			this.thresholdValue = value
			this.dist_threshold = 1 - 0.9 * value
			this.dist_gain = 1 / this.dist_threshold
		}
		get threshold() {
			return this.thresholdValue
		}
		get hasFinished() {
			return this.ampenv === 0
		}
		constructor(sampleRate, wavetable) {
			this.sampleRate = sampleRate
			this.wavetable = wavetable
			this.delaybuffer = new Float32Array(2 * sampleRate)
			this.thresholdValue = 0.5
			this.reset()
		}
		reset() {
			const sampleRate = this.sampleRate
			this.onepole = [
				coeff_highpass(44.486, sampleRate),
				coeff_highpass(150.0, sampleRate),
				coeff_allpass(14.008, sampleRate),
				coeff_highpass(24.167, sampleRate)
			]
			this.biquad = [
				coeff_biquad_lowpass12db(200.0, Math.sqrt(0.5), sampleRate),
				coeff_biquad_notch(7.5164, 4.7, sampleRate)
			]
			this.tbfilter = [0, 0, 0, 0, 0]
			this.threshold = this.thresholdValue
			this.resonance = this.resonanceValue
			this.envelopeModulation = this.envmod
			this.samplepos = 1000000
			this.pos = -1
			this.oscpos = 0
		}
		start(noteNumber = 16, length = 1000, accent = false, slide = true, gate = false) {
			this.play(noteNumber, length, accent, slide, gate)
			return this.running
		}
		stop(_time) {
			this.ampenv = 0.0
			return true
		}
		play(noteNumber = 16, length = 1000, accent = false, slide = true, gate = false) {
			if (this.running) {
				const frequency = 440 * Math.pow(2, (noteNumber + this.tuningValue - 69) / 12)
				const _accentFlag = accent ? 1 : 0
				const _slideFlag = slide ? 1 : 0
				const gateFlag = gate ? 0 : 1
				this.decayValue = length
				this.ampmult = Math.exp(-1.0 / (0.001 * this.decayValue * this.sampleRate))
				if (accent) {
					this.filtermult = Math.exp(-1.0 / (0.001 * 200 * this.sampleRate))
					this.accentgain = this.accentValue
				} else {
					this.filtermult = this.ampmult
					this.accentgain = 0.0
				}
				this.ampenv = (1 / this.ampmult) * gateFlag
				if (slide) {
					this.slide = (this.oscdelta - (frequency * 4096) / this.sampleRate) / 64
					this.slidestep = 0
				} else {
					this.filterenv = 1 / this.filtermult
					this.oscpos = 0
					this.slide = 0
					this.slidestep = 64
					this.oscdelta = (frequency * 4096) / this.sampleRate
					this.table =
						this.waveform * 524288 +
						(Math.max(0, Math.min(127, Math.round(noteNumber + this.tuningValue))) <<
							12)
				}
				this.justPlayed = true
			} else {
				this.ampenv = 0.0
			}
			this.samplepos = 0
		}
		render(_flush = false) {
			if (this.justPlayed) {
				this.justPlayed = false
			}
			this.samplepos++
			this.ampenv = this.ampenv * this.ampmult + anti_denormal
			this.filterenv = this.filterenv * this.filtermult + anti_denormal
			const idx = Math.floor(this.oscpos) & 4095
			const r = this.oscpos - idx
			let sample =
				(1 - r) * this.wavetable[this.table + idx] +
				r * this.wavetable[this.table + ((idx + 1) & 4095)]
			this.oscpos += this.oscdelta
			if (this.oscpos >= 4096) {
				this.oscpos %= 4096
			}
			if ((this.samplepos & 63) === 0) {
				if (this.slidestep++ < 64) {
					this.oscdelta -= this.slide
				}
				const tmp1 = this.envscaler * (this.filterenv - this.envoffset)
				const tmp2 = this.accentgain * this.filterenv
				const effectivecutoff = Math.min(
					this.cutOffValue * Math.pow(2, tmp1 + tmp2),
					Math.min(20000, this.sampleRate * 0.4)
				)
				const wc = (tau / this.sampleRate) * effectivecutoff
				const r = this.resonance_skewed
				const fx = wc * 0.11253953951963826
				this.tbf_b0 =
					(0.00045522346 + 6.1922189 * fx) / (1 + 12.358354 * fx + 4.4156345 * (fx * fx))
				const k =
					fx *
						(fx *
							(fx * (fx * (fx * (fx + 7198.6997) - 5837.7917) - 476.47308) +
								614.95611) +
							213.87126) +
					16.998792
				this.tbf_g = ((k * 0.058823529411764705 - 1.0) * r + 1.0) * (1.0 + r)
				this.tbf_k = k * r
			}
			let flt = this.onepole[0]
			flt[1] = flt[2] * sample + flt[3] * flt[0] + flt[4] * flt[1] + anti_denormal
			flt[0] = sample
			sample = flt[1]
			const tbf = this.tbfilter
			const tbfb0 = this.tbf_b0
			let fbhp = this.tbf_k * tbf[4]
			flt = this.onepole[1]
			flt[1] = flt[2] * fbhp + flt[3] * flt[0] + flt[4] * flt[1] + anti_denormal
			flt[0] = fbhp
			fbhp = flt[1]
			tbf[0] = sample - fbhp
			tbf[1] += 2 * tbfb0 * (tbf[0] - tbf[1] + tbf[2])
			tbf[2] += tbfb0 * (tbf[1] - 2 * tbf[2] + tbf[3])
			tbf[3] += tbfb0 * (tbf[2] - 2 * tbf[3] + tbf[4])
			tbf[4] += tbfb0 * (tbf[3] - 2 * tbf[4])
			sample = 2 * this.tbf_g * tbf[4]
			flt = this.onepole[2]
			flt[1] = flt[2] * sample + flt[3] * flt[0] + flt[4] * flt[1] + anti_denormal
			flt[0] = sample
			sample = flt[1]
			flt = this.onepole[3]
			flt[1] = flt[2] * sample + flt[3] * flt[0] + flt[4] * flt[1] + anti_denormal
			flt[0] = sample
			sample = flt[1]
			flt = this.biquad[1]
			let biquady =
				flt[4] * sample +
				flt[5] * flt[0] +
				flt[6] * flt[1] +
				flt[7] * flt[2] +
				flt[8] * flt[3] +
				anti_denormal
			flt[1] = flt[0]
			flt[0] = sample
			flt[3] = flt[2]
			flt[2] = biquady
			sample = biquady
			let outputgain = (this.accentgain * 4.0 + 1.0) * this.ampenv
			flt = this.biquad[0]
			biquady =
				flt[4] * outputgain +
				flt[5] * flt[0] +
				flt[6] * flt[1] +
				flt[7] * flt[2] +
				flt[8] * flt[3] +
				anti_denormal
			flt[1] = flt[0]
			flt[0] = outputgain
			flt[3] = flt[2]
			flt[2] = biquady
			outputgain = biquady
			sample *= outputgain
			if (sample > this.dist_threshold || sample < -this.dist_threshold) {
				const clipped = (sample > 0 ? 1 : -1) * this.dist_threshold
				sample =
					Math.abs(
						Math.abs(
							((1 - this.dist_shape) * clipped +
								this.dist_shape * sample -
								this.dist_threshold) %
								(this.dist_threshold * 4)
						) -
							this.dist_threshold * 2
					) - this.dist_threshold
			}
			sample *= this.dist_gain
			const prev = this.delaybuffer[this.delaypos]
			this.delaybuffer[this.delaypos] =
				this.delay_send * sample + this.delay_feedback * prev + anti_denormal
			this.delaypos++
			if (this.delaypos > this.delay_length) {
				this.delaypos = 0
			}
			sample += prev
			return sample
		}
	}

	class Synth303Processor extends globalThis.AudioWorkletProcessor {
		static get parameterDescriptors() {
			return Object.entries(definitions).map(([name, config]) => ({
				name,
				defaultValue: config.defaultValue,
				minValue: config.minValue,
				maxValue: config.maxValue,
				automationRate: "k-rate"
			}))
		}
		constructor(options) {
			super()
			const table = options.processorOptions.wavetable
			if (!(table instanceof Float32Array) || table.length !== 1048576) {
				throw new Error("Invalid 303 wavetable")
			}
			this.engine = new Legacy303(globalThis.sampleRate, table)
			this.held = []
			this.bends = new Float32Array(16)
			this.sustain = new Uint8Array(16)
			this.active = null
			this.disposed = false
			this.port.onmessage = ({ data }) => {
				if (data.type === "destroy") {
					this.silence()
					this.disposed = true
				} else if (data.type === "panic") {
					this.silence()
				} else if (data.type === "midi") {
					this.midi(data.bytes)
				}
			}
		}
		silence() {
			this.held = []
			this.active = null
			this.sustain.fill(0)
			this.engine.stop()
			this.engine.filterenv = 0
			this.engine.tbfilter.fill(0)
			for (const filter of this.engine.onepole) {
				filter[0] = 0
				filter[1] = 0
			}
			for (const filter of this.engine.biquad) {
				filter.fill(0, 0, 4)
			}
			this.engine.delaybuffer.fill(0)
		}
		select(note, slide) {
			this.active = note
			if (!note) {
				this.engine.stop()
				return
			}
			this.engine.play(
				note.number + this.bends[note.channel],
				this.decay ?? 1000,
				note.velocity >= 100,
				slide,
				false
			)
		}
		midi(bytes) {
			const [status, number, value] = bytes
			const channel = status & 15,
				kind = status & 0xf0
			if (kind === 0x90 && value > 0) {
				const slide = !!this.active
				this.held = this.held.filter(
					(note) => note.channel !== channel || note.number !== number
				)
				const note = { number, velocity: value, channel, down: true }
				this.held.push(note)
				this.select(note, slide)
			} else if (kind === 0x80 || kind === 0x90) {
				const note = this.held.find(
					(note) => note.channel === channel && note.number === number
				)
				if (!note) {
					return
				}
				note.down = false
				if (this.sustain[channel]) {
					return
				}
				this.held = this.held.filter((item) => item !== note)
				if (note === this.active) {
					this.select(this.held.at(-1) ?? null, true)
				}
			} else if (kind === 0xe0) {
				this.bends[channel] = (((number | (value << 7)) - 8192) / 8192) * 2
				if (this.active?.channel === channel) {
					this.select(this.active, true)
				}
			} else if (kind === 0xb0) {
				if (number === 64) {
					this.sustain[channel] = value >= 64 ? 1 : 0
				}
				if (number === 121) {
					this.sustain[channel] = 0
					this.bends[channel] = 0
				}
				if (
					number === 120 ||
					number === 123 ||
					((number === 64 || number === 121) && !this.sustain[channel])
				) {
					const panic = number === 120 || number === 123
					this.held = this.held.filter(
						(note) => note.channel !== channel || (!panic && note.down)
					)
					if (this.active?.channel === channel && !this.held.includes(this.active)) {
						this.select(this.held.at(-1) ?? null, true)
						if (!this.active && panic) {
							this.silence()
						}
					}
				}
			}
		}
		process(_inputs, outputs, parameters) {
			if (this.disposed) {
				return false
			}
			const channels = outputs[0]
			if (!channels?.length) {
				return true
			}
			const value = (key) => parameters[key]?.[0] ?? definitions[key].defaultValue
			const engine = this.engine
			const tuning = value("tuning")
			if (engine.tuning !== tuning && this.active) {
				engine.oscdelta =
					(440 *
						2 **
							((this.active.number + this.bends[this.active.channel] + tuning - 69) /
								12) *
						4096) /
					globalThis.sampleRate
				engine.slide = 0
			}
			engine.tuning = tuning
			engine.shape = value("shape")
			engine.threshold = value("threshold")
			engine.cutOff = value("cutoff")
			engine.resonance = value("resonance")
			engine.envelopeModulation = value("envMod")
			engine.accent = value("accent")
			engine.accentgain = this.active?.velocity >= 100 ? engine.accent : 0
			engine.waveform = Math.round(value("waveform"))
			engine.table = engine.waveform * 524288 + (engine.table % 524288)
			this.decay = value("decay")
			engine.ampmult = Math.exp(-1 / (0.001 * this.decay * globalThis.sampleRate))
			engine.filtermult = Math.exp(
				-1 /
					(0.001 *
						(this.active?.velocity >= 100 ? 200 : this.decay) *
						globalThis.sampleRate)
			)
			engine.delay_send = value("delaySend")
			engine.delay_feedback = value("delayFeedback")
			engine.delay_length = Math.max(
				1,
				Math.round(value("delayTime") * globalThis.sampleRate) - 1
			)
			if (engine.delaypos > engine.delay_length) {
				engine.delaypos = 0
			}
			const volume = value("volume")
			for (let i = 0; i < channels[0].length; i++) {
				const sample = engine.render() * volume
				if (!Number.isFinite(sample)) {
					this.silence()
					for (const channel of channels) {
						channel.fill(0, i)
					}
					break
				}
				for (const channel of channels) {
					channel[i] = Math.max(-1, Math.min(1, sample))
				}
			}
			return true
		}
	}
	globalThis.registerProcessor("303", Synth303Processor)
}