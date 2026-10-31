import { Transformer } from "./abstract-transformer"
import { beatSeconds, copyCommand, noteKey } from "./performance-transformer"
import { NOTE_ON, NOTE_OFF } from "../../commands"
import { AI_MODELS, type AIModelDefinition } from "../inputs/ai-model-catalogue"
import { AI_IMPROV, AI_MELODY, AI_DRUMS, AI_MUSIC_VAE, AI_TRIO } from "../inputs/input-types"
import {
	AI_MUSIC_GENERATE,
	AI_MUSIC_RESULT,
	AI_MUSIC_ERROR,
	AI_MUSIC_STATUS,
	validateMusicNotes
} from "../inputs/ai-music-messages"
import type { AIMusicNote, AIMusicResponse } from "../inputs/ai-music-messages"
import { musicAttribution } from "../inputs/ai-music-attribution"
import type { IAudioCommand } from "../../audio-command-interface"
import type { FieldConfig } from "./interface-transformer"
import type { Timer } from "netronome"

export const ID_AI_IMPROV = "AI-Improv"
export const ID_AI_MELODY = "AI-Melody"
export const ID_AI_DRUMS = "AI-Drums"
export const ID_AI_MELODY_VARIATION = "AI-Melody-Variation"
export const ID_AI_TRIO_VARIATION = "AI-Trio-Variation"
export const AI_TRANSFORMER_MODELS = {
	[ID_AI_IMPROV]: AI_IMPROV,
	[ID_AI_MELODY]: AI_MELODY,
	[ID_AI_DRUMS]: AI_DRUMS,
	[ID_AI_MELODY_VARIATION]: AI_MUSIC_VAE,
	[ID_AI_TRIO_VARIATION]: AI_TRIO
}
const DEFAULTS = {
	enabled: 1,
	modelId: AI_IMPROV as string,
	temperature: 1,
	similarity: 0.7,
	level: 80,
	captureChannel: 0,
	chords: "C, Am, F, G"
}
type Config = typeof DEFAULTS
interface Captured extends AIMusicNote {
	released: boolean
}

/** Phrase inference is asynchronous; tick owns the reply and every note release. */
export class TransformerAIMusic extends Transformer<Config> {
	readonly handlesMidiControls = true
	category = "Variation"
	status = "Start transport and play a phrase. The response starts on a bar boundary."
	private worker?: Worker
	private requestId = 0
	private busy = false
	private failed = false
	private disposed = false
	private now = 0
	private beat = 0
	private previous?: number
	private musicalBeat?: number
	private captureStart?: number
	private captured: Captured[] = []
	private held = new Map<string, Captured[]>()
	private template?: IAudioCommand
	private ready?: AIMusicNote[]
	private responseStart?: number
	private events: Array<{ step: number; note: AIMusicNote; on: boolean }> = []
	private cursor = 0
	private active = new Map<AIMusicNote, IAudioCommand>()
	private sounding = new Map<string, { count: number; command: IAudioCommand }>()
	private cleanup: IAudioCommand[] = []
	private credits?: HTMLElement
	private guide?: HTMLElement
	get model(): AIModelDefinition {
		return AI_MODELS[this.config?.modelId ?? AI_IMPROV]
	}
	get name() {
		return `${this.model.name} ${this.model.engine === "vae" ? "Variation" : "Continuation"}`
	}
	get description() {
		return this.model.engine === "vae"
			? "Capture a phrase and generate a related variation using Magenta MusicVAE."
			: "Capture your playing and answer with an AI-generated continuation."
	}
	get instructions() {
		return (
			`Start transport, then play ${this.model.steps / 16} bars. Original notes pass through. The AI prepares a response and starts it on the next bar, even if you stop playing. ` +
			(this.model.trio
				? "Capture melody on channel 1, bass on 2 and drums on 10."
				: this.model.drums
					? "Use MIDI drum pitches; the default capture channel is 10."
					: "Melodic models use a single melody voice; simultaneous notes use the last pitch.")
		)
	}
	get statusState() {
		return !this.config.enabled
			? "disabled"
			: this.failed
				? "error"
				: this.busy
					? "loading"
					: this.ready
						? "ready"
						: "idle"
	}
	get fields(): FieldConfig[] {
		const config = this.config ?? DEFAULTS
		return [
			{
				name: "enabled",
				label: "AI response",
				type: "select",
				values: [
					{ name: "On", value: 1 },
					{ name: "Off", value: 0 }
				],
				default: config.enabled
			},
			{
				name: "temperature",
				label: "Creativity",
				type: "number",
				min: 0.1,
				max: 2,
				step: 0.1,
				default: config.temperature
			},
			...(this.model.engine === "vae"
				? [
						{
							name: "similarity",
							label: "Similarity to captured phrase",
							type: "number",
							min: 0,
							max: 1,
							step: 0.1,
							default: config.similarity
						}
					]
				: []),
			{
				name: "captureChannel",
				label: "Capture channel (0 = all)",
				type: "number",
				min: 0,
				max: 16,
				step: 1,
				default: config.captureChannel
			},
			{
				name: "level",
				label: "Response volume (%)",
				type: "number",
				min: 1,
				max: 150,
				step: 1,
				default: config.level
			},
			...(this.model.chords
				? [
						{
							name: "chords",
							label: "Chord progression",
							type: "text",
							default: config.chords
						}
					]
				: []),
			{
				name: "generate",
				label: "Generate from captured phrase now",
				type: "button",
				help: "Waits for a full model phrase by default. Short captures are padded with rests."
			},
			{ name: "clear", label: "Cancel and clear phrase", type: "button" }
		]
	}
	constructor(config: Partial<Config> = {}, modelId = AI_IMPROV as string) {
		super({
			...DEFAULTS,
			...config,
			modelId,
			captureChannel: config.captureChannel ?? (AI_MODELS[modelId]?.drums ? 10 : 0)
		})
		if (!Object.hasOwn(AI_MODELS, modelId)) throw new Error("Unknown AI music model")
		this.type = Object.entries(AI_TRANSFORMER_MODELS).find(([, model]) => model === modelId)![0]
		for (const key of ["enabled", "temperature", "similarity", "level", "captureChannel"])
			this.setConfig(key, this.config[key])
	}
	override setConfig(key: string, value: unknown): void {
		if (key === "generate") {
			this.generate()
			return
		}
		if (key === "clear") {
			this.reset()
			return
		}
		if (key === "modelId" && this.config?.modelId && value !== this.config.modelId)
			throw new Error("Choose a different AI transformer to change models")
		const limits: Record<string, [number, number]> = {
			enabled: [0, 1],
			temperature: [0.1, 2],
			similarity: [0, 1],
			level: [1, 150],
			captureChannel: [0, 16]
		}
		if (limits[key]) {
			const number = Number(value),
				[low, high] = limits[key]
			value = Math.min(
				high,
				Math.max(
					low,
					Number.isFinite(number) ? number : (DEFAULTS[key as keyof Config] as number)
				)
			)
			if (["enabled", "captureChannel"].includes(key)) value = Math.round(value as number)
		}
		if (key === "chords") value = String(value).slice(0, 1000)
		if (
			this.held &&
			key !== "midiControlId" &&
			key !== "available" &&
			this.config[key] !== value
		)
			this.reset()
		super.setConfig(key, value)
	}
	setMusicalBeat(beat: number): void {
		if (Number.isFinite(beat)) this.musicalBeat = beat
	}
	private advance(now: number, timer: Timer): void {
		if (this.musicalBeat !== undefined) {
			this.beat = this.musicalBeat
			this.musicalBeat = undefined
		} else if (this.previous !== undefined)
			this.beat += Math.max(0, now - this.previous) / beatSeconds(timer)
		this.previous = now
		this.now = now
	}
	transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {
		if (!this.config.enabled || this.disposed) return commands
		this.advance(
			Number.isFinite(timer.now) ? timer.now : (commands[0]?.startAt ?? this.now),
			timer
		)
		for (const command of commands) {
			if (this.config.captureChannel && command.channel !== this.config.captureChannel)
				continue
			if (!this.model.drums && !this.model.trio && command.channel === 10) continue
			if (this.model.trio && ![1, 2, 10].includes(command.channel)) continue
			const on = command.type === NOTE_ON && command.velocity > 0
			const off =
				command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0)
			if (!on && !off) continue
			const at = this.beat + ((command.startAt ?? this.now) - this.now) / beatSeconds(timer)
			if (on && !this.busy && !this.ready && !this.failed) {
				this.captureStart ??= at
				this.template ??= copyCommand(command)
				const step = Math.round((at - this.captureStart) * 4)
				if (step < 0 || step >= this.model.steps || this.captured.length >= 512) continue
				const note: Captured = {
					pitch: command.number,
					start: step,
					end: step + 1,
					channel: command.channel,
					velocity: command.velocity,
					released: false
				}
				this.captured.push(note)
				const key = noteKey(command),
					held = this.held.get(key) ?? []
				held.push(note)
				this.held.set(key, held)
				this.status = `Listening: ${this.captured.length} notes captured. Leave transport running for the reply.`
			} else if (off && this.captureStart !== undefined) {
				const key = noteKey(command),
					held = this.held.get(key),
					note = held?.shift()
				if (note) {
					note.end = Math.min(
						this.model.steps,
						Math.max(note.start + 1, Math.round((at - this.captureStart) * 4))
					)
					note.released = true
				}
				if (!held?.length) this.held.delete(key)
			}
		}
		return commands
	}
	generate(): void {
		if (this.disposed || this.busy || !this.config.enabled) return
		if (!this.captured.length) {
			this.status = "Play a phrase before generating a response."
			return
		}
		try {
			const chords = this.config.chords
				.trim()
				.split(/[\s,]+/)
				.filter(Boolean)
			if (
				this.model.chords &&
				(!chords.length || chords.length > 32 || chords.some((chord) => chord.length > 24))
			)
				throw new Error("Enter 1–32 chord symbols")
			const notes = this.captured.map(({ released, ...note }) => ({
				...note,
				end: released ? note.end : this.model.steps
			}))
			const worker = (this.worker ??= new Worker(
				new URL("../inputs/ai-music.worker.ts", import.meta.url),
				{ type: "module" }
			))
			const id = ++this.requestId
			this.busy = true
			this.failed = false
			worker.onmessage = ({ data }: MessageEvent<AIMusicResponse>) => {
				if (this.worker !== worker || data.id !== this.requestId || this.disposed) return
				if (data.kind === AI_MUSIC_STATUS) this.status = data.status
				else if (data.kind === AI_MUSIC_ERROR) this.fail(data.error)
				else if (data.kind === AI_MUSIC_RESULT) {
					try {
						if (data.steps !== this.model.steps)
							throw new Error("Unexpected response length")
						this.ready = validateMusicNotes(data.notes, data.steps)
						this.events = this.ready
							.flatMap((note) => [
								{ step: note.start, note, on: true },
								{ step: note.end, note, on: false }
							])
							.sort((a, b) => a.step - b.step || Number(a.on) - Number(b.on))
						this.responseStart = Math.ceil((this.beat + 1e-6) / 4) * 4
						this.cursor = 0
						this.busy = false
						this.status =
							"Response ready; starts on the next bar. Keep transport running."
					} catch (error) {
						this.fail(error instanceof Error ? error.message : String(error))
					}
				}
			}
			worker.onerror = () => {
				if (this.worker === worker) this.fail("Unable to start the AI worker")
			}
			worker.postMessage({
				kind: AI_MUSIC_GENERATE,
				id,
				modelId: this.config.modelId,
				seed: [],
				notes,
				seedSteps: this.model.steps,
				chords,
				temperature: this.config.temperature,
				...(this.model.engine === "vae"
					? { operation: "variation", similarity: this.config.similarity }
					: {})
			})
			this.status = "Preparing a response…"
		} catch (error) {
			this.fail(error instanceof Error ? error.message : String(error))
		}
	}
	tick(now: number, timer: Timer): IAudioCommand[] {
		if (this.disposed) return []
		this.advance(now, timer)
		const output = this.cleanup
			.splice(0)
			.map((command) => ({ ...command, startAt: now, time: now }))
		if (!this.config.enabled) return output
		if (
			this.captureStart !== undefined &&
			!this.busy &&
			!this.ready &&
			!this.failed &&
			this.beat >= this.captureStart + this.model.steps / 4
		)
			this.generate()
		if (!this.ready || this.responseStart === undefined || this.beat < this.responseStart)
			return output
		const step = (this.beat - this.responseStart) * 4
		while (this.cursor < this.events.length && this.events[this.cursor].step <= step + 1e-8) {
			const { note, on } = this.events[this.cursor++]
			if (on && note.end > step && this.template) {
				const command = copyCommand(this.template, {
					type: NOTE_ON,
					subtype: NOTE_ON,
					number: note.pitch,
					value: note.pitch,
					channel: note.channel,
					velocity: Math.min(
						127,
						Math.max(1, Math.round((note.velocity * this.config.level) / 100))
					),
					from: this.uuid,
					startAt: now,
					time: now,
					endAt: now + ((note.end - step) / 4) * beatSeconds(timer)
				})
				this.active.set(note, command)
				const key = `${note.channel}:${note.pitch}`,
					held = this.sounding.get(key)
				if (held) held.count++
				else {
					this.sounding.set(key, { count: 1, command })
					output.push(command)
				}
			} else if (!on) {
				const command = this.active.get(note)
				if (!command) continue
				this.active.delete(note)
				const key = `${note.channel}:${note.pitch}`,
					held = this.sounding.get(key)!
				if (--held.count === 0) {
					this.sounding.delete(key)
					output.push(
						copyCommand(command, {
							type: NOTE_OFF,
							subtype: NOTE_OFF,
							velocity: 0,
							startAt: now,
							time: now
						})
					)
				}
			}
		}
		if (step >= this.model.steps) {
			output.push(...this.release())
			this.ready = undefined
			this.events = []
			this.responseStart = undefined
			this.captured = []
			this.held.clear()
			this.captureStart = undefined
			this.template = undefined
			this.status = "Reply complete. Play another phrase."
		}
		return output
	}
	private release(): IAudioCommand[] {
		const notes = [...this.sounding.values()].map(({ command }) =>
			copyCommand(command, {
				type: NOTE_OFF,
				subtype: NOTE_OFF,
				velocity: 0,
				startAt: this.now,
				time: this.now
			})
		)
		this.sounding.clear()
		this.active.clear()
		return notes
	}
	private fail(error: string): void {
		this.busy = false
		this.failed = true
		this.requestId++
		this.worker?.terminate()
		this.worker = undefined
		this.status = `AI response failed: ${error}. Clear the phrase or change a setting to retry.`
	}
	override reset(): void {
		this.cleanup.push(...this.release())
		this.requestId++
		this.worker?.terminate()
		this.worker = undefined
		this.busy = false
		this.failed = false
		this.ready = undefined
		this.responseStart = undefined
		this.events = []
		this.cursor = 0
		this.captured = []
		this.held.clear()
		this.captureStart = undefined
		this.template = undefined
		this.previous = undefined
		this.musicalBeat = undefined
		this.beat = 0
		this.status = "Start transport and play a phrase. The response starts on a bar boundary."
	}
	override async createGui(): Promise<HTMLElement> {
		const gui = await super.createGui()
		if (!this.guide) {
			this.guide = document.createElement("p")
			this.guide.textContent = this.instructions
			gui.prepend(this.guide)
		}
		if (!this.credits) {
			this.credits = musicAttribution(this.model)
			gui.append(this.credits)
		}
		return gui
	}
	override destroyGui(): void {
		this.credits = undefined
		this.guide = undefined
		super.destroyGui()
	}
	override destroy(): void {
		this.reset()
		this.disposed = true
		super.destroy()
	}
}