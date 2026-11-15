import {
	CLACK_PRESETS,
	CLAP_PRESETS,
	TOM_PRESETS,
	HAND_DRUM_PRESETS,
	SHAKER_PRESETS,
	TRIANGLE_PRESETS,
	JINGLE_PRESETS,
	SCRAPE_PRESETS,
	FRICTION_DRUM_PRESETS,
	WHISTLE_PRESETS,
	CHIME_PRESETS,
	ELECTRONIC_PERCUSSION_PRESETS,
	COWBELL_PRESETS,
	HIHAT_PRESETS,
	type TomOptions,
	type ShakerOptions,
	type HihatOptions
} from "./percussion-presets.ts"
import {
	createParticleBufferPair,
	renderCymbal,
	generateTriangleImpulse
} from "./percussion-buffers.ts"

export type EnvelopeScheduler = (parameter: AudioParam) => void
type RegisterVoice = (
	source: AudioScheduledSourceNode,
	nodes: AudioNode[],
	part: string,
	at: number,
	length: number,
	envelope: EnvelopeScheduler
) => void

const FLOOR = 0.0001
const positive = (value: number) => Math.max(FLOOR, value)
const vary = (amount: number) => (Math.random() * 2 - 1) * amount
const cents = (amount: number) => 2 ** (amount / 1200)

/** Per-hit graphs share only immutable excitation buffers; every node belongs to one source. */
export class PercussionRecipes {
	private readonly buffers = new Map<string, AudioBuffer[]>()
	private scrapeNoise?: AudioBuffer
	private triangleImpulse?: AudioBuffer
	private readonly strikes = new Map<string, { lastAt: number; energy: number; seed: number }>()
	private panDirection = -1

	constructor(
		private readonly context: AudioContext,
		private readonly noise: AudioBuffer,
		private readonly register: RegisterVoice
	) {}

	reset(): void {
		this.strikes.clear()
	}

	trigger(part: string, at: number, velocity: number, scale: number, pitch: number): void {
		const oscillator = (type: OscillatorType, from: number, to = from, bend = 0) => {
			const source = this.context.createOscillator()
			source.type = type
			source.frequency.setValueAtTime(positive(from * pitch), at)
			if (bend > 0) {
				source.frequency.exponentialRampToValueAtTime(positive(to * pitch), at + bend)
			}
			return source
		}
		const filter = (type: BiquadFilterType, frequency: number, q = 0.7) => {
			const node = this.context.createBiquadFilter()
			node.type = type
			node.frequency.setValueAtTime(
				Math.min(this.context.sampleRate * 0.45, Math.max(20, frequency * pitch)),
				at
			)
			node.Q.setValueAtTime(q, at)
			return node
		}
		const noise = (buffer = this.noise) => {
			const source = this.context.createBufferSource()
			source.buffer = buffer
			source.loop = true
			return source
		}
		const chain = (source: AudioNode, nodes: AudioNode[]) => {
			let previous = source
			for (const node of nodes) {
				previous.connect(node)
				previous = node
			}
		}
		const play = (
			source: AudioScheduledSourceNode,
			nodes: AudioNode[],
			length: number,
			level: number,
			attack = 0.001,
			decay = 0,
			sustain = 1,
			delay = 0,
			reverb = 0
		) => {
			chain(source, nodes)
			const end = at + delay + Math.max(0.015, length)
			const envelope: EnvelopeScheduler = (gain) => {
				gain.setValueAtTime(FLOOR, at)
				const start = at + delay
				if (delay > 0) {
					gain.setValueAtTime(FLOOR, start)
				}
				const attackAt = Math.min(end, start + attack * scale)
				gain.exponentialRampToValueAtTime(positive(level * velocity), attackAt)
				if (decay > 0) {
					gain.exponentialRampToValueAtTime(
						positive(level * velocity * sustain),
						Math.min(end, attackAt + decay * scale)
					)
				}
				gain.exponentialRampToValueAtTime(FLOOR, end)
			}
			if (reverb > 0) {
				const dry = this.context.createGain()
				envelope(dry.gain)
				;(nodes.at(-1) ?? source).connect(dry)
				const send = this.context.createGain()
				send.gain.setValueAtTime(reverb, at)
				const delayNode = this.context.createDelay(0.03)
				delayNode.delayTime.setValueAtTime(0.006, at)
				const convolver = this.context.createConvolver()
				this.triangleImpulse ??= generateTriangleImpulse(this.context)
				convolver.buffer = this.triangleImpulse
				convolver.normalize = true
				const highpass = filter("highpass", 2800, 0.45)
				const wet = this.context.createGain()
				wet.gain.setValueAtTime(0.3, at)
				const mix = this.context.createGain()
				dry.connect(mix)
				chain(dry, [send, delayNode, convolver, highpass, wet, mix])
				this.register(
					source,
					[...nodes, dry, send, delayNode, convolver, highpass, wet, mix],
					part,
					at,
					end - at + 0.21,
					(gain) => {
						gain.setValueAtTime(1, at)
					}
				)
			} else {
				this.register(source, nodes, part, at, end - at, envelope)
			}
		}

		const clack = CLACK_PRESETS[part]
		if (clack) {
			for (const frequency of clack.ratios) {
				play(
					oscillator("triangle", frequency * clack.octave),
					[
						filter("bandpass", clack.bandpass, clack.bandpassQ),
						filter("highpass", clack.highpass)
					],
					clack.length * scale,
					clack.outputGain,
					0
				)
			}
			return
		}
		const clap = CLAP_PRESETS[part]
		if (clap) {
			const brightness = 0.7 + velocity * 0.3
			const source = noise()
			const nodes = [
				filter("bandpass", clap.bandpass * brightness, clap.bandpassQ),
				filter(
					"highpass",
					(clap.highpass > 20 ? clap.highpass : CLAP_PRESETS.clap.highpass) * brightness
				)
			]
			chain(source, nodes)
			const length = Math.max(0.015, clap.length * scale)
			this.register(source, nodes, part, at, length, (gain) => {
				const peak = positive(velocity * clap.noiseLevel)
				gain.setValueAtTime(FLOOR, at)
				for (const offset of clap.burstOffsets) {
					const start = at + Math.min(length, offset * scale)
					gain.setValueAtTime(peak, start)
					gain.exponentialRampToValueAtTime(
						positive(peak * clap.burstFloor),
						Math.min(at + length, start + clap.burstDecay * scale)
					)
				}
				const tail = Math.min(length, (clap.burstOffsets.at(-1)! + clap.burstDecay) * scale)
				gain.setValueAtTime(positive(peak * clap.tailLevel), at + tail)
				gain.exponentialRampToValueAtTime(FLOOR, at + length)
			})
			return
		}
		const tom = TOM_PRESETS[part]
		if (tom) {
			const length = tom.length * scale
			const dynamics = this.tomDynamics(part, at, velocity)
			const bodyLength = length * dynamics.bodyDecay
			const ringLength = length * dynamics.ringDecay
			const triangle = oscillator("triangle", tom.triStart)
			const sine = oscillator("sine", tom.sineStart)
			this.tomPitch(
				triangle.frequency,
				tom,
				at,
				length,
				scale,
				pitch,
				false,
				velocity,
				dynamics.pitchAttack
			)
			this.tomPitch(
				sine.frequency,
				tom,
				at,
				length,
				scale,
				pitch,
				true,
				velocity,
				dynamics.pitchAttack
			)
			play(triangle, [], ringLength, dynamics.ringGain, tom.attack, tom.decay, tom.sustain)
			play(sine, [], bodyLength, dynamics.bodyGain, tom.attack, tom.decay, tom.sustain)
			return
		}
		const hand = HAND_DRUM_PRESETS[part]
		if (hand) {
			const length = hand.length * scale
			play(
				oscillator(
					"sine",
					hand.frequency * hand.pitchBend,
					hand.frequency,
					hand.pitchBendTime * scale
				),
				[],
				length,
				hand.outputGain,
				hand.attack,
				hand.decay,
				hand.sustain
			)
			play(
				oscillator(
					"triangle",
					hand.frequency * hand.overtoneRatio * Math.max(1, hand.pitchBend * 0.92),
					hand.frequency * hand.overtoneRatio,
					hand.pitchBendTime * scale
				),
				[],
				length,
				hand.outputGain * hand.overtoneLevel,
				hand.attack,
				hand.decay,
				hand.sustain
			)
			play(
				noise(),
				[filter("bandpass", hand.noiseFrequency, hand.noiseQ)],
				Math.min(length, 0.035 * scale),
				hand.outputGain * hand.noiseLevel,
				0
			)
			return
		}
		const friction = FRICTION_DRUM_PRESETS[part]
		if (friction) {
			const length = friction.length * scale
			for (const [type, ratio, level] of [
				["sine", 1, 1],
				["triangle", friction.overtoneRatio, friction.overtoneLevel]
			] as const) {
				play(
					oscillator(
						type,
						friction.startFrequency * ratio,
						friction.endFrequency * ratio,
						length
					),
					[],
					length,
					friction.outputGain * level,
					friction.attack
				)
			}
			play(
				noise(),
				[filter("bandpass", friction.noiseFrequency, 2.4)],
				Math.min(length, 0.045 * scale),
				friction.outputGain * friction.noiseLevel,
				0
			)
			return
		}
		const whistle = WHISTLE_PRESETS[part]
		if (whistle) {
			const length = whistle.length * scale
			for (const [ratio, level] of [
				[1, 1],
				[whistle.secondRatio, 0.34]
			]) {
				play(
					oscillator(
						"sine",
						whistle.startFrequency * ratio,
						whistle.endFrequency * ratio,
						length
					),
					[],
					length,
					whistle.outputGain * level,
					whistle.attack,
					whistle.decay,
					0.72
				)
			}
			play(
				noise(),
				[filter("bandpass", whistle.breathFrequency)],
				length,
				whistle.outputGain * whistle.breathLevel,
				whistle.attack,
				whistle.decay,
				0.72
			)
			return
		}
		const electronic = ELECTRONIC_PERCUSSION_PRESETS[part]
		if (electronic) {
			const length = electronic.length * scale
			for (const [ratio, level] of [
				[1, 1],
				[electronic.overtoneRatio, electronic.overtoneLevel]
			]) {
				play(
					oscillator(
						electronic.waveform,
						electronic.startFrequency * ratio,
						electronic.endFrequency * ratio,
						length
					),
					[],
					length,
					electronic.outputGain * level,
					electronic.attack
				)
			}
			play(
				noise(),
				[filter("bandpass", electronic.noiseFrequency, 1.3)],
				Math.min(length, 0.08 * scale),
				electronic.outputGain * electronic.noiseLevel,
				0
			)
			return
		}
		const scrape = SCRAPE_PRESETS[part]
		if (scrape) {
			const length = Math.max(0.015, scrape.length * scale)
			const source = noise(this.getScrapeNoise())
			const nodes = [
				filter("bandpass", scrape.bandpass, scrape.bandpassQ),
				filter("highpass", scrape.highpass)
			]
			chain(source, nodes)
			this.register(source, nodes, part, at, length, (gain) => {
				gain.setValueAtTime(FLOOR, at)
				for (let index = 0; index < scrape.strokes; index++) {
					const stroke =
						at +
						Math.min(
							length - Math.min(0.004, length / 2),
							index * scrape.spacing * scale
						)
					gain.setValueAtTime(
						positive(
							velocity * scrape.outputGain * (1 - index / (scrape.strokes * 1.45))
						),
						stroke
					)
					gain.exponentialRampToValueAtTime(
						FLOOR,
						Math.min(at + length, stroke + 0.012 * scale)
					)
				}
			})
			play(
				oscillator("triangle", scrape.bodyFrequency),
				[],
				length,
				scrape.outputGain * scrape.bodyLevel,
				0
			)
			return
		}
		const triangle = TRIANGLE_PRESETS[part]
		if (triangle) {
			const frequency = triangle.frequency * cents(vary(triangle.pitchVariation))
			const length = triangle.length * scale * (1 + vary(triangle.lengthVariation))
			triangle.partialRatios.forEach((ratio, index) => {
				const source = oscillator(
					"sine",
					frequency * ratio * cents(vary(triangle.modeVariation))
				)
				const partial = this.context.createGain()
				partial.gain.setValueAtTime(
					positive(triangle.partialLevels[index] * (1 + vary(triangle.levelVariation))),
					at
				)
				partial.gain.exponentialRampToValueAtTime(
					FLOOR,
					at + length * Math.max(0.45, 0.86 - index * 0.09)
				)
				play(
					source,
					[partial, filter("highpass", triangle.highpass)],
					length,
					triangle.outputGain,
					triangle.attack,
					triangle.decay,
					triangle.sustain,
					0,
					triangle.reverb
				)
			})
			return
		}
		const chime = CHIME_PRESETS[part]
		if (chime) {
			chime.partialRatios.forEach((ratio, index) => {
				play(
					oscillator("sine", chime.frequency * ratio * cents(vary(chime.pitchVariation))),
					[filter("highpass", chime.highpass)],
					Math.max(0.08, chime.length * (1 - index * 0.09)) * scale,
					chime.outputGain * chime.partialLevels[index],
					0,
					0,
					1,
					index * chime.stagger * scale
				)
			})
			return
		}
		const jingle = JINGLE_PRESETS[part]
		if (jingle) {
			jingle.frequencies.forEach((frequency, index) => {
				play(
					oscillator(index % 2 ? "square" : "triangle", frequency),
					[filter("highpass", jingle.highpass)],
					jingle.length * scale * (1 - index * 0.03),
					jingle.outputGain * jingle.levels[index],
					jingle.attack
				)
			})
			play(
				noise(),
				[
					filter("bandpass", jingle.bandpass, jingle.bandpassQ),
					filter("highpass", jingle.highpass)
				],
				jingle.length * scale,
				jingle.outputGain * jingle.noiseLevel,
				0
			)
			return
		}
		const bell = COWBELL_PRESETS[part]
		if (bell) {
			const fundamental = bell.fundamental * cents(vary(bell.pitchVariation))
			const length =
				Math.max(
					bell.attack + bell.decay + 0.01,
					bell.length + vary(bell.lengthVariation)
				) * scale
			const level = 1 + vary(bell.velocityVariation)
			const q = Math.max(0.1, bell.q * (1 + vary(bell.qVariation)))
			bell.ratios.forEach((ratio, index) => {
				const frequency = fundamental * ratio
				const bandpass = filter("bandpass", bell.bandpass, q)
				bandpass.frequency.exponentialRampToValueAtTime(
					Math.min(
						this.context.sampleRate * 0.45,
						Math.max(40, bell.bandpass * bell.filterSweep * pitch)
					),
					at + Math.min(bell.length, bell.filterSweepTime) * scale
				)
				play(
					oscillator(
						bell.waveforms[index] ?? "square",
						frequency * cents(bell.pitchSweep),
						frequency,
						Math.min(bell.pitchSweepTime, bell.length * 0.35) * scale
					),
					[bandpass],
					length,
					bell.outputGain * (bell.partialLevels[index] ?? 1) * level,
					bell.attack,
					bell.decay,
					bell.sustain
				)
			})
			return
		}
		const cymbal = HIHAT_PRESETS[part]
		if (cymbal) {
			const source = this.context.createBufferSource()
			source.buffer = this.cymbalBuffer(part, cymbal, pitch)
			source.playbackRate.setValueAtTime(1 / scale, at)
			const brightness = 0.6 + velocity * 0.4
			const lowpass = filter("lowpass", cymbal.lowpass * brightness, 0.45)
			lowpass.frequency.exponentialRampToValueAtTime(
				Math.min(
					this.context.sampleRate * 0.45,
					Math.max(20, cymbal.lowpass * brightness * 0.72 * pitch)
				),
				at + cymbal.length * scale
			)
			const nodes = [
				filter("bandpass", cymbal.bandpass * brightness, cymbal.bandpassQ),
				filter("highpass", cymbal.highpass * brightness),
				lowpass
			]
			chain(source, nodes)
			this.register(source, nodes, part, at, cymbal.length * scale, (gain) => {
				const end = at + cymbal.length * scale
				const attack = Math.min(end, at + cymbal.attack * scale)
				const decay = Math.min(end, attack + cymbal.decay * scale)
				gain.setValueAtTime(FLOOR, at)
				gain.linearRampToValueAtTime(velocity, attack)
				gain.linearRampToValueAtTime(velocity * cymbal.sustain, decay)
				gain.setValueAtTime(
					velocity * cymbal.sustain,
					Math.max(decay, end - cymbal.release * scale)
				)
				gain.linearRampToValueAtTime(FLOOR, end)
			})
			return
		}
		const shaker = SHAKER_PRESETS[part]
		if (shaker) {
			const density = velocity < 0.34 ? 0.28 : velocity < 0.68 ? 0.62 : 1
			const buffers = this.shakerBuffers(part, shaker, density)
			const brightness = (0.76 + velocity * 0.24) * (1 + vary(shaker.filterVariation))
			const length = shaker.length * scale * (1 + vary(shaker.durationVariation))
			const level = shaker.outputGain * velocity ** (shaker.velocityCurve - 1)
			this.panDirection *= -1
			const pan = this.panDirection * shaker.panWidth * (0.6 + Math.random() * 0.4)
			for (const [buffer, nodes, amplitude] of [
				[
					buffers[0],
					[
						filter("highpass", shaker.highpass * brightness),
						filter("bandpass", shaker.bandpass * brightness, shaker.bandpassQ),
						filter("lowpass", shaker.lowpass, 0.45)
					],
					shaker.fineLevel
				],
				[
					buffers[1],
					[filter("bandpass", shaker.seedFrequency * brightness, shaker.seedQ)],
					shaker.coarseLevel
				],
				[
					buffers[1],
					[filter("bandpass", shaker.bodyFrequency, shaker.bodyQ)],
					shaker.bodyLevel
				]
			] as const) {
				const source = this.context.createBufferSource()
				source.buffer = buffer
				source.playbackRate.setValueAtTime(shaker.length / length, at)
				const path: AudioNode[] = [...nodes]
				if (typeof this.context.createStereoPanner === "function") {
					const panner = this.context.createStereoPanner()
					panner.pan.setValueAtTime(pan, at)
					path.push(panner)
				}
				chain(source, path)
				this.register(source, path, part, at, length, (gain) => {
					gain.setValueAtTime(positive(level * amplitude * velocity), at)
					gain.setValueAtTime(
						positive(level * amplitude * velocity),
						at + Math.max(0, length - 0.006)
					)
					gain.exponentialRampToValueAtTime(FLOOR, at + length)
				})
			}
		}
	}

	private tomDynamics(part: string, at: number, velocity: number) {
		const state = this.strikes.get(part) ?? { lastAt: -Infinity, energy: 0, seed: 0x13579bdf }
		const elapsed = at - state.lastAt
		const residual =
			elapsed >= 0 ? state.energy * Math.min(1, Math.max(0, 1 - elapsed / 0.18)) : 0
		if (elapsed >= 0) {
			state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0
		}
		const variation = Number.isFinite(state.lastAt) ? (state.seed / 2147483648 - 1) * 0.12 : 0
		const offset = Math.min(1, Math.max(0, 0.35 + variation)) - 0.35
		const rebound = residual * (1 - velocity * 0.7)
		if (elapsed >= 0) {
			state.energy = Math.min(1, residual + velocity * 0.65)
			state.lastAt = at
			this.strikes.set(part, state)
		}
		return {
			bodyGain: 1 - offset * 0.18 - rebound * 0.06,
			ringGain: 1 + offset * 0.7 + residual * 0.035,
			pitchAttack: 1 + residual * 0.006 + variation * 0.003,
			bodyDecay: (0.82 + velocity * 0.18) * (1 - rebound * 0.06),
			ringDecay: Math.min(1, (0.72 + velocity * 0.28) * (1 + offset * 0.18))
		}
	}

	private tomPitch(
		parameter: AudioParam,
		options: TomOptions,
		at: number,
		length: number,
		scale: number,
		pitch: number,
		sine: boolean,
		velocity: number,
		pitchAttack: number
	): void {
		const duration = Math.min(length, options.pitchDecay * scale)
		const end = at + duration
		const stageScale = Math.min(scale, (duration * 0.65) / (options.attack + options.decay))
		const startRatio = options.pitchStartRatio * (0.8 + velocity * 0.2) * pitchAttack
		parameter.setValueAtTime(
			(sine ? options.sineStart : options.triStart) * startRatio * pitch,
			at
		)
		if (sine) {
			parameter.exponentialRampToValueAtTime(
				options.sineApex * startRatio * pitch,
				at + options.attack * stageScale
			)
			parameter.exponentialRampToValueAtTime(
				options.sineSustain * options.pitchEndRatio * pitch,
				at + (options.attack + options.decay) * stageScale
			)
		}
		parameter.exponentialRampToValueAtTime(
			(sine ? options.sineEnd : options.triEnd) * options.pitchEndRatio * pitch,
			end
		)
	}

	private getScrapeNoise(): AudioBuffer {
		if (!this.scrapeNoise) {
			this.scrapeNoise = this.context.createBuffer(
				1,
				this.context.sampleRate,
				this.context.sampleRate
			)
			const data = this.scrapeNoise.getChannelData(0)
			let value = 0
			for (let index = 0; index < data.length; index++) {
				if (index % 5 === 0) {
					value = Math.random() * 2 - 1
				}
				data[index] = value
			}
		}
		return this.scrapeNoise
	}

	private cymbalBuffer(part: string, options: HihatOptions, pitch: number): AudioBuffer {
		const key = part + ":" + pitch
		let bank = this.buffers.get(key)
		if (!bank) {
			const tuned = { ...options, fundamental: options.fundamental * pitch }
			bank = [renderCymbal(this.context, tuned, 0), renderCymbal(this.context, tuned, 1)]
			if (this.buffers.size >= 36) {
				this.buffers.delete(this.buffers.keys().next().value!)
			}
			this.buffers.set(key, bank)
		}
		return bank[Math.floor(Math.random() * bank.length)]
	}

	private shakerBuffers(part: string, options: ShakerOptions, density: number): AudioBuffer[] {
		const key = part + density
		let bank = this.buffers.get(key)
		if (!bank) {
			bank = []
			for (let index = 0; index < options.bufferVariants; index++) {
				const pair = createParticleBufferPair(this.context, options, density)
				bank.push(pair.fineBuffer, pair.coarseBuffer)
			}
			this.buffers.set(key, bank)
		}
		const index = Math.floor(Math.random() * (bank.length / 2)) * 2
		return bank.slice(index, index + 2)
	}
}