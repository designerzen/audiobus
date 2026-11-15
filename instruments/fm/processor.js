// Port of the PhotoSYNTH FM engine (fm-engine.js) and its AudioWorklet processor.
// Everything the worklet needs lives inside this one function, so the output can ship it as
// source text through loadCaptureWorklet without any bundler-specific worker import.
export default function registerFMProcessor(config) {
	// DX7 algorithm topology, operator numbers 1..6. Each row lists the inputs
	// to operators 1..6; a backward edge is the algorithm's delayed feedback path.
	const FM_ALGORITHMS = [
		["2", "", "4", "5", "6", "6"],
		["2", "2", "4", "5", "6", ""],
		["2", "3", "", "5", "6", "6"],
		["2", "3", "", "5", "6", "4"],
		["2", "", "4", "", "6", "6"],
		["2", "", "4", "", "6", "5"],
		["2", "", "45", "", "6", "6"],
		["2", "", "45", "4", "6", ""],
		["2", "2", "45", "", "6", ""],
		["2", "3", "3", "56", "", ""],
		["2", "3", "", "56", "", "6"],
		["2", "2", "456", "", "", ""],
		["2", "", "456", "", "", "6"],
		["2", "", "4", "56", "", "6"],
		["2", "2", "4", "56", "", ""],
		["235", "", "4", "", "6", "6"],
		["235", "2", "4", "", "6", ""],
		["234", "", "3", "5", "6", ""],
		["2", "3", "", "6", "6", "6"],
		["3", "3", "3", "56", "", ""],
		["3", "3", "3", "6", "6", ""],
		["2", "", "6", "6", "6", "6"],
		["", "3", "", "6", "6", "6"],
		["", "", "6", "6", "6", "6"],
		["", "", "", "6", "6", "6"],
		["", "3", "", "56", "", "6"],
		["", "3", "3", "56", "", ""],
		["2", "", "4", "5", "5", ""],
		["", "", "4", "", "6", "6"],
		["", "", "4", "5", "5", ""],
		["", "", "", "", "6", "6"],
		["", "", "", "", "", "6"]
	].map((inputs) => {
		const matrix = inputs.map((row) => [...row].map((value) => Number(value) - 1))
		const modulators = new Set(
			matrix.flatMap((row, target) => row.filter((source) => source > target))
		)
		return { matrix, carriers: [0, 1, 2, 3, 4, 5].filter((op) => !modulators.has(op)) }
	})

	const TAU = Math.PI * 2
	const amplitude = (level) => (level <= 0 ? 0 : 2 ** ((level - 99) / 8))

	// Continuous approximations of DX7 envelope timing and level curves. This is
	// a compatible FM voice renderer, not a bit-exact emulation of the DX7 DAC.
	class Envelope {
		constructor(rates, levels, sampleRate, scaling = 0, pitch = false) {
			this.rates = rates
			this.levels = levels.map((level) => (pitch ? (level - 50) * 0.96 : amplitude(level)))
			this.sampleRate = sampleRate
			this.scaling = scaling
			this.value = this.levels[3]
			this.stage = -1
			this.advance()
		}
		advance() {
			this.stage++
			if (this.stage > 3) {
				return
			}
			this.target = this.levels[this.stage]
			this.remaining = Math.max(
				1,
				Math.round(
					this.sampleRate *
						0.004 *
						2 ** ((99 - this.rates[this.stage] - this.scaling) / 8)
				)
			)
			this.step = (this.target - this.value) / this.remaining
		}
		release() {
			if (this.stage < 3) {
				this.stage = 2
				this.advance()
			}
		}
		next() {
			if (this.remaining > 0) {
				this.value += this.step
				if (--this.remaining === 0) {
					this.value = this.target
					if (this.stage < 2) {
						this.advance()
					}
				}
			}
			return this.value
		}
	}

	// Time-based envelopes are used only by the original GM bank. Imported DX7
	// operators continue through the rate/level envelope above.
	class GMEnvelope {
		constructor(settings, sampleRate) {
			this.settings = settings
			this.sampleRate = sampleRate
			this.value = 0
			this.stage = 0
			this.start(settings.attack, 1)
		}
		start(seconds, target) {
			this.target = target
			this.remaining = Math.max(1, Math.round(seconds * this.sampleRate))
			this.step = (target - this.value) / this.remaining
			this.multiplier = Math.exp(
				Math.log(Math.max(0.00001, target) / Math.max(0.00001, this.value)) / this.remaining
			)
		}
		release() {
			if (this.stage === 3) {
				return
			}
			this.stage = 3
			this.start(this.settings.release, 0)
		}
		next() {
			if (this.remaining > 0) {
				this.value =
					this.stage === 0 ? this.value + this.step : this.value * this.multiplier
				if (--this.remaining === 0) {
					this.value = this.target
					if (this.stage === 0) {
						this.stage = 1
						this.start(this.settings.decay, this.settings.sustain)
					}
				}
			}
			return this.value
		}
	}

	class FMVoice {
		constructor(patch, note, velocity, sampleRate, time = 0) {
			this.patch = patch
			this.note = note
			this.velocity = velocity
			this.sampleRate = sampleRate
			this.age = 0
			this.released = false
			this.algorithm = FM_ALGORITHMS[patch.algorithm]
			this.lfoStep = this.lfoFrequency / sampleRate
			this.feedback = patch.feedback ? 2 ** (patch.feedback - 7) * TAU : 0
			this.pitchEnvelope = new Envelope(
				patch.pitchRates,
				patch.pitchLevels,
				sampleRate,
				0,
				true
			)
			const fundamental = 440 * 2 ** ((note + patch.transpose - 69) / 12)
			if (patch.noise) {
				this.noiseEnvelope = new GMEnvelope(patch.noise.envelope, sampleRate)
				this.noiseLow = 0
				this.noiseHigh = 0
				this.noiseLowAlpha =
					1 - Math.exp((-TAU * Math.min(sampleRate * 0.45, patch.noise.low)) / sampleRate)
				this.noiseHighAlpha =
					1 -
					Math.exp((-TAU * Math.min(sampleRate * 0.45, patch.noise.high)) / sampleRate)
				this.noiseSeed = 1234567 + note * 7919
			}
			this.lfoPhase = patch.lfoSync ? 0 : (time * this.lfoFrequency) % 1
			this.randomLFO = 0
			this.ops = patch.operators.map((op) => {
				const distance = note - (op.breakpoint + 21)
				const curve = distance < 0 ? op.leftCurve : op.rightCurve
				const depth = distance < 0 ? op.leftDepth : op.rightDepth
				const spread = Math.abs(distance) / 36
				const scaling =
					depth *
					(curve === 1 || curve === 2 ? spread * spread : spread) *
					(curve < 2 ? -1 : 1)
				const ratio = op.formant
					? Math.max(1, Math.round(op.formant / fundamental))
					: (op.ratio ?? (op.coarse || 0.5) * (1 + op.fine / 100))
				const frequency =
					(op.fixedHz ??
						(op.fixed
							? 10 ** ((op.coarse % 4) + op.fine / 100)
							: fundamental * ratio)) *
					2 ** ((op.detune * 3) / 1200)
				return {
					frequency,
					phase: patch.sync ? 0 : (time * frequency) % 1,
					value: 0,
					previous: 0,
					level:
						op.output === 0
							? 0
							: (op.gain ?? 1) *
								amplitude(Math.min(99, op.output + scaling)) *
								(1 + ((velocity - 1) * op.velocitySensitivity) / 7),
					envelope: op.envelope
						? new GMEnvelope(op.envelope, sampleRate)
						: new Envelope(
								op.rates,
								op.levels,
								sampleRate,
								(Math.max(0, note - 21) * op.rateScaling) / 24
							)
				}
			})
		}
		get lfoFrequency() {
			return 0.0625 * 2 ** (this.patch.lfoSpeed / 10)
		}
		release() {
			this.released = true
			this.releaseAge = this.age
			this.pitchEnvelope.release()
			this.ops.forEach((op) => op.envelope.release())
			this.noiseEnvelope?.release()
		}
		get finished() {
			return (
				this.released &&
				(!this.noiseEnvelope || this.noiseEnvelope.remaining === 0) &&
				this.algorithm.carriers.every((i) => this.ops[i].envelope.remaining === 0)
			)
		}
		next(bend = 0) {
			const p = this.patch
			const phase = this.lfoPhase
			let lfo
			switch (p.lfoWave) {
				case 0:
					lfo = 1 - 4 * Math.abs(phase - 0.5)
					break
				case 1:
					lfo = 1 - 2 * phase
					break
				case 2:
					lfo = 2 * phase - 1
					break
				case 3:
					lfo = phase < 0.5 ? 1 : -1
					break
				case 5:
					lfo = this.randomLFO
					break
				default:
					lfo = Math.sin(TAU * phase)
			}
			this.lfoPhase += this.lfoStep
			if (this.lfoPhase >= 1) {
				this.lfoPhase %= 1
				this.randomLFO = Math.random() * 2 - 1
			}
			const delay = (p.lfoDelay / 99) * 3
			const lfoGain = Math.max(0, Math.min(1, (this.age / this.sampleRate - delay) * 2))
			const sweep = p.pitchSweep
				? p.pitchSweep.end +
					(p.pitchSweep.start - p.pitchSweep.end) *
						Math.exp((-6 * this.age) / (this.sampleRate * p.pitchSweep.seconds))
				: 0
			const pitch =
				2 **
				((bend +
					sweep +
					this.pitchEnvelope.next() +
					((((lfo * lfoGain * p.pitchDepth) / 99) * p.pitchSensitivity) / 7) * 12) /
					12)
			for (let i = 5; i >= 0; i--) {
				const op = this.ops[i]
				let modulation = 0
				for (const source of this.algorithm.matrix[i]) {
					const input = this.ops[source]
					modulation +=
						source <= i
							? (input.value + input.previous) * 0.5 * this.feedback
							: input.value * 12
				}
				const ampMod =
					1 -
					(lfo + 1) *
						0.5 *
						lfoGain *
						(p.ampDepth / 99) *
						(p.operators[i].ampSensitivity / 3)
				op.previous = op.value
				op.value =
					Math.sin(TAU * op.phase + modulation) * op.envelope.next() * op.level * ampMod
				op.phase = (op.phase + (op.frequency * pitch) / this.sampleRate) % 1
			}
			this.age++
			let sample = 0
			for (const carrier of this.algorithm.carriers) {
				sample += this.ops[carrier].value
			}
			sample /= this.algorithm.carriers.length
			if (this.noiseEnvelope) {
				this.noiseSeed = (Math.imul(this.noiseSeed, 1664525) + 1013904223) | 0
				const white = this.noiseSeed / 2147483648
				this.noiseLow += this.noiseLowAlpha * (white - this.noiseLow)
				this.noiseHigh += this.noiseHighAlpha * (white - this.noiseLow - this.noiseHigh)
				sample += this.noiseHigh * p.noise.gain * this.velocity * this.noiseEnvelope.next()
			}
			if (p.tremolo) {
				const phase = (this.age / this.sampleRate) * p.tremolo.rate
				const wave = p.tremolo.square
					? phase % 1 < 0.5
						? 0
						: 1
					: (1 - Math.cos(TAU * phase)) * 0.5
				sample *= 1 - wave * p.tremolo.depth
			}
			if (p.drive) {
				sample = Math.tanh(sample * (1 + p.drive)) / Math.tanh(1 + p.drive)
			}
			// Fade even patches with a non-zero final envelope level to silence on release.
			let remaining = 0
			if (this.released) {
				for (const i of this.algorithm.carriers) {
					remaining = Math.max(remaining, this.ops[i].envelope.remaining)
				}
			}
			if (this.released && this.noiseEnvelope) {
				remaining = Math.max(remaining, this.noiseEnvelope.remaining)
			}
			const releaseGain = this.released ? Math.min(1, remaining / 128) : 1
			return sample * 0.25 * (p.gain ?? 1) * (p.levelTrim ?? 1) * releaseGain
		}
	}

	class FMProcessor extends AudioWorkletProcessor {
		constructor(options) {
			super()
			this.polyphony = options?.processorOptions?.polyphony ?? 16
			// One part per MIDI channel; each owns its voices, bend and mix level.
			this.parts = new Map()
			this.activeParts = new Set()
			this.events = []
			this.eventIndex = 0
			this.running = true
			this.port.onmessage = ({ data }) => {
				if (data.type === "destroy") {
					this.running = false
					this.parts.clear()
					this.activeParts.clear()
					this.events.length = 0
					this.eventIndex = 0
					return
				}
				if (data.type === "polyphony") {
					this.polyphony = Math.max(1, data.value)
					for (const part of this.parts.values()) {
						while (part.voices.size > this.polyphony) {
							part.voices.delete(part.voices.keys().next().value)
						}
					}
					return
				}
				if (data.type === "panic" || data.type === "releasePart") {
					// A panic without a part silences every part.
					const targets =
						data.part === undefined
							? [...this.parts.values()]
							: [this.parts.get(data.part)]
					for (const part of targets) {
						if (part) {
							part.voices.clear()
							part.bend = 0
							this.activeParts.delete(part)
						}
					}
					if (data.type === "releasePart") {
						this.parts.delete(data.part)
					}
					this.events = this.events
						.slice(this.eventIndex)
						.filter((event) => data.part !== undefined && event.part !== data.part)
					this.eventIndex = 0
					return
				}
				let part = this.parts.get(data.part)
				if (!part) {
					part = { id: data.part, voices: new Map(), bend: 0, gain: 1, patch: null }
					this.parts.set(data.part, part)
				}
				// Snapshot the selected patch on receipt, before scheduling. A later
				// program change must not alter held or future scheduled notes.
				if (data.type === "patch") {
					part.patch = data.patch
					return
				}
				if (data.type === "gain") {
					part.gain = data.value
					return
				}
				if (data.type === "on" && !data.patch) {
					data.patch = part.patch
				}
				data.time ??= currentTime
				if (this.eventIndex) {
					this.events = this.events.slice(this.eventIndex)
					this.eventIndex = 0
				}
				// Most events arrive in order. Insert only when a look-ahead note or
				// another instrument makes the incoming timestamp out of order.
				let index = this.events.length
				while (index > 0 && this.events[index - 1].time > data.time) {
					index--
				}
				if (index === this.events.length) {
					this.events.push(data)
				} else {
					this.events.splice(index, 0, data)
				}
			}
		}
		apply(event) {
			const part = this.parts.get(event.part)
			if (!part) {
				return
			}
			switch (event.type) {
				case "on":
					if (!event.patch) {
						break
					}
					// A retrigger replaces its own voice, so only a new note steals the oldest.
					part.voices.delete(event.note)
					while (part.voices.size >= this.polyphony) {
						part.voices.delete(part.voices.keys().next().value)
					}
					part.voices.set(
						event.note,
						new FMVoice(event.patch, event.note, event.velocity, sampleRate, event.time)
					)
					this.activeParts.add(part)
					break
				case "off":
					part.voices.get(event.note)?.release()
					break
				case "bend":
					part.bend = event.value
					break
			}
		}
		process(inputs, outputs) {
			const frames = outputs[0]?.[0]?.length ?? 128
			for (const channels of outputs) {
				for (const channel of channels) {
					channel.fill(0)
				}
			}
			if (!this.activeParts.size && this.eventIndex === this.events.length) {
				return this.running
			}
			if (
				!this.activeParts.size &&
				this.events[this.eventIndex].time > currentTime + (frames - 1) / sampleRate
			) {
				return this.running
			}
			const channels = outputs[0] ?? []
			for (let i = 0; i < frames; i++) {
				const time = currentTime + i / sampleRate
				while (
					this.eventIndex < this.events.length &&
					this.events[this.eventIndex].time <= time
				) {
					this.apply(this.events[this.eventIndex++])
				}
				let mix = 0
				for (const part of this.activeParts) {
					let sample = 0
					for (const [note, voice] of part.voices) {
						sample += voice.next(part.bend)
						if (voice.finished) {
							part.voices.delete(note)
						}
					}
					mix += Math.tanh(sample) * part.gain
					if (!part.voices.size) {
						this.activeParts.delete(part)
					}
				}
				for (const channel of channels) {
					channel[i] = mix
				}
			}
			if (this.eventIndex === this.events.length) {
				this.events.length = 0
				this.eventIndex = 0
			}
			return this.running
		}
	}

	registerProcessor(config.name, FMProcessor)
}