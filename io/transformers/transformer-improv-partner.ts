import {
	PerformanceTransformer,
	beatSeconds,
	copyCommand,
	type Settings,
	type Voice
} from "./performance-transformer"
import type { IAudioCommand } from "../../audio-command-interface"
import type { Timer } from "netronome"
import { quantisePitchSet, pitchSetMask } from "../../tuning/pitch-class-set"

export const ID_IMPROV_PARTNER = "Improvisation-Partner"
interface MotifNote {
	pitch: number
	velocity: number
	offset: number
	duration: number
	command: IAudioCommand
}
/** Bounded, deterministic phrase memory: generation never waits for model inference. */
export class TransformerImprovPartner extends PerformanceTransformer {
	type = ID_IMPROV_PARTNER
	category = "Variation"
	mask = 4095
	private memory: MotifNote[][] = []
	private phrase: MotifNote[] = []
	private captured = new Map<Voice, MotifNote>()
	private generated = new Set<Voice>()
	private response?: Voice
	private phraseStart = 0
	private lastActivity = 0
	private turn = 0
	private pending = false
	get name() {
		return "Improvisation Partner"
	}
	get description() {
		return "Listen to a phrase, leave a gap, then answer using a bounded memory of your motifs."
	}
	get instructions() {
		return "Start transport, play a phrase, then leave a gap to hear a reply through this chain’s outputs. Play again to interrupt. Listen mode remembers phrases without replying."
	}
	get status() {
		return this.response
			? "Responding; play to interrupt"
			: this.pending
				? "Listening"
				: `Ready; ${this.memory.length} remembered motifs`
	}
	constructor(config: Settings = {}) {
		super(
			{ mode: "respond", gap: 2, variation: 0, level: 80, silence: 0, mask: 4095 },
			[
				{ name: "mode", label: "Mode", values: ["listen", "respond"] },
				{
					name: "gap",
					label: "Silence before reply (beats)",
					values: [1, 2, 4, 8],
					min: 1,
					max: 8
				},
				{
					name: "variation",
					label: "Variation (%)",
					values: [0, 25, 50, 75, 100],
					min: 0,
					max: 100
				},
				{
					name: "level",
					label: "Response velocity (%)",
					values: [25, 50, 75, 100],
					min: 1,
					max: 100
				},
				{
					name: "silence",
					label: "Skip every Nth reply (0 = never)",
					values: [0, 2, 3, 4],
					min: 0,
					max: 8
				}
			],
			config
		)
		this.mask = pitchSetMask(this.options.mask)
	}
	private cancelResponse(): IAudioCommand[] {
		const result = [...this.generated].flatMap((voice) => this.release(voice))
		this.generated.clear()
		if (this.response) {
			result.push(...this.release(this.response))
		}
		this.response = undefined
		return result
	}
	protected noteOn(voice: Voice) {
		const result = this.cancelResponse()
		if (!this.pending) {
			this.phrase = []
			this.phraseStart = this.now
		}
		this.pending = true
		this.lastActivity = this.now
		if (this.phrase.length < 128) {
			const note = {
				pitch: voice.input.number,
				velocity: voice.input.velocity,
				offset: (this.now - this.phraseStart) / beatSeconds(this.timer),
				duration: 0.25,
				command: copyCommand(voice.input)
			}
			this.phrase.push(note)
			this.captured.set(voice, note)
		}
		result.push(this.start(voice))
		return result
	}
	protected noteOff(voice: Voice) {
		const note = this.captured.get(voice)
		if (note) {
			note.duration = Math.max(
				0.05,
				Math.min(16, (this.now - this.phraseStart) / beatSeconds(this.timer) - note.offset)
			)
		}
		this.captured.delete(voice)
		this.lastActivity = this.now
		return this.release(voice)
	}
	override tick(now: number, timer?: Timer): IAudioCommand[] {
		const output = super.tick(now, timer)
		if (this.response && (this.options.mode === "listen" || !this.options.enabled)) {
			output.push(...this.cancelResponse())
		}
		if (
			!this.options.enabled ||
			!this.pending ||
			this.captured.size ||
			now - this.lastActivity < Number(this.options.gap) * beatSeconds(timer)
		) {
			return output
		}
		this.pending = false
		if (!this.phrase.length) {
			return output
		}
		this.memory.push(this.phrase.map((note) => ({ ...note })))
		if (this.memory.length > 8) {
			this.memory.shift()
		}
		this.turn++
		if (
			this.options.mode === "listen" ||
			(Number(this.options.silence) > 0 && this.turn % Number(this.options.silence) === 0)
		) {
			return output
		}
		const motif = this.memory[(this.turn - 1) % this.memory.length]
		const owner: Voice = { input: motif[0].command, targets: [], released: false }
		this.response = owner
		this.voices.add(owner)
		const seconds = beatSeconds(timer)
		const variation = Number(this.options.variation) / 100
		let end = now
		for (const [index, note] of motif.entries()) {
			const altered =
				variation > 0 && index % Math.max(1, Math.round(1 / variation)) === 0
					? 2 * (this.turn % 2 ? 1 : -1)
					: 0
			const at = now + Math.min(32, note.offset) * seconds
			const duration = Math.max(0.01, note.duration * seconds)
			end = Math.max(end, at + duration)
			this.schedule(
				at,
				() => {
					const pitch = quantisePitchSet(
						Math.max(0, Math.min(127, note.pitch + altered)),
						this.mask,
						0
					)
					if (pitch === undefined) {
						return []
					}
					const voice: Voice = { input: note.command, targets: [], released: true }
					this.generated.add(voice)
					this.voices.add(voice)
					const on = this.start(
						voice,
						pitch,
						this.now,
						(note.velocity * Number(this.options.level)) / 100
					)
					this.schedule(
						this.now + duration,
						() => {
							this.generated.delete(voice)
							return this.release(voice)
						},
						voice
					)
					return [on]
				},
				owner
			)
		}
		this.schedule(
			end + 0.001,
			() => {
				if (this.response === owner) {
					this.response = undefined
				}
				return this.release(owner)
			},
			owner
		)
		return [...output, ...super.tick(now, timer)]
	}
	override get fields() {
		return [
			...super.fields,
			{
				name: "forget",
				label: "Forget remembered phrases",
				type: "button",
				group: "Performance"
			}
		]
	}
	override setConfig(key: string, value: unknown): void {
		if (key === "forget") {
			this.clearMemory()
			return
		}
		super.setConfig(key, value)
	}
	clearMemory(): void {
		this.memory = []
	}
	protected clearRoute() {
		const result = this.cancelResponse()
		this.clearState()
		return result
	}
	protected clearState() {
		this.phrase = []
		this.captured?.clear()
		this.generated?.clear()
		this.response = undefined
		this.pending = false
		this.lastActivity = 0
	}
}