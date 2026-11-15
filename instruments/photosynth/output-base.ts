import type { IAudioOutput } from "../../io/outputs/output-interface.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"
import {
	NOTE_ON,
	NOTE_OFF,
	PITCH_BEND,
	CONTROL_CHANGE,
	MIDI_STOP,
	PLAYBACK_STOP
} from "../../commands/commands.ts"
import { EVENT_CHANGE, EVENT_CONFIGURATION_CHANGED } from "../../events/event-constants.ts"
import { musicalCommand } from "../../io/event-clip.ts"
import { getAudioDestination } from "../../io/audio-destination.ts"
import { bounded, devicePanel, numberControl } from "../../io/device-controls.ts"
import { midiNoteToFrequency } from "../../conversion/note-to-frequency.ts"

export type Waveform =
	| "sine"
	| "square"
	| "triangle"
	| "sawtooth"
	| { real: number[]; imag: number[] }
export interface CommonSettings {
	volume: number
	channel: number
	maxPolyphony: number
	attack: number
	decay: number
	sustain: number
	release: number
	pitchBendRange: number
}
export type OutputOptions<T> = Partial<T> & { audioContext: AudioContext; mixer?: AudioNode }
type Parameter =
	| { default: number; min: number; max: number; step: number }
	| { default: Waveform; waveform: true }
export type Parameters<T> = { [K in keyof T]: Parameter }
export const numeric = (value: number, min: number, max: number, step = 0.01): Parameter => ({
	default: value,
	min,
	max,
	step
})
export const waveform = (value: Waveform): Parameter => ({ default: value, waveform: true })
export const commonParameters: Parameters<CommonSettings> = {
	volume: numeric(0.3, 0, 1),
	channel: numeric(0, 0, 16, 1),
	maxPolyphony: numeric(16, 1, 64, 1),
	attack: numeric(0.001, 0.001, 10, 0.001),
	decay: numeric(0.1, 0.001, 10, 0.001),
	sustain: numeric(0.8, 0, 1),
	release: numeric(0.1, 0.005, 20, 0.001),
	pitchBendRange: numeric(2, 0, 24)
}
export interface VoiceGraph {
	nodes: AudioNode[]
	sources: AudioScheduledSourceNode[]
	pitch: (frequency: number) => void
	modulate?: (value: number) => void
	release?: (time: number) => void
}
interface Voice extends VoiceGraph {
	channel: number
	note: number
	envelope: GainNode
	level: GainNode
	started: number
	velocity: number
	adsr: Pick<CommonSettings, "attack" | "decay" | "sustain">
	held: boolean
	retiring: boolean
	endAt?: number
	releaseAt?: number
	releaseLevel?: number
	timer?: ReturnType<typeof setTimeout>
}
interface ChannelState {
	bend: number
	volume: number
	expression: number
	modulation: number
	sustain: boolean
}
function validWaveform(value: unknown): value is Waveform {
	if (typeof value === "string") {
		return ["sine", "square", "triangle", "sawtooth"].includes(value)
	}
	if (!value || typeof value !== "object" || !("real" in value) || !("imag" in value)) {
		return false
	}
	const { real, imag } = value
	return (
		Array.isArray(real) &&
		Array.isArray(imag) &&
		real.length >= 2 &&
		real.length <= 4096 &&
		real.length === imag.length &&
		[...real, ...imag].every((item) => typeof item === "number" && Number.isFinite(item))
	)
}
export function setWaveform(
	context: AudioContext,
	oscillator: OscillatorNode,
	shape: Waveform
): void {
	if (typeof shape === "string") {
		oscillator.type = shape
	} else {
		oscillator.setPeriodicWave(
			context.createPeriodicWave(new Float32Array(shape.real), new Float32Array(shape.imag))
		)
	}
}
export function noiseBuffer(context: AudioContext, duration: number): AudioBuffer {
	const buffer = context.createBuffer(
		1,
		Math.max(1, Math.round(context.sampleRate * duration)),
		context.sampleRate
	)
	const data = buffer.getChannelData(0)
	for (let index = 0; index < data.length; index++) {
		data[index] = Math.random() * 2 - 1
	}
	return buffer
}
export function pitchControl(
	context: AudioContext,
	parameter: AudioParam
): (value: number) => void {
	let initialized = false
	return (value) => {
		if (initialized) {
			parameter.setTargetAtTime(value, context.currentTime, 0.005)
		} else {
			parameter.setValueAtTime(value, context.currentTime)
			initialized = true
		}
	}
}

export default abstract class PhotoSynthOutput<T extends CommonSettings>
	extends EventTarget
	implements IAudioOutput
{
	private static nextId = 0
	readonly uuid = "PhotoSynth-" + PhotoSynthOutput.nextId++
	readonly configurationAffectsNoteRouting = false
	readonly requiresConnectionControl = false
	readonly output: GainNode
	protected readonly context: AudioContext
	protected settings: T
	private readonly destination: AudioNode
	private readonly voices = new Set<Voice>()
	private readonly channels = new Map<number, ChannelState>()
	private connected = true
	private destroyed = false
	private gui?: HTMLElement
	private guiEvents?: AbortController
	abstract readonly name: string
	abstract readonly description: string
	protected abstract buildVoice(input: GainNode): VoiceGraph

	constructor(
		options: OutputOptions<T>,
		private readonly parameters: Parameters<T>
	) {
		super()
		if (!options?.audioContext) {
			throw new Error("PhotoSYNTH output requires an audio context")
		}
		this.context = options.audioContext
		this.destination = options.mixer ?? getAudioDestination(this.context)
		this.output = this.context.createGain()
		this.output.connect(this.destination)
		this.settings = Object.fromEntries(
			Object.entries(parameters).map(([key, value]) => [key, (value as Parameter).default])
		) as unknown as T
		this.configure(options)
	}
	get options(): T {
		return structuredClone(this.settings)
	}
	get isConnected(): boolean {
		return this.connected
	}
	get isHidden(): boolean {
		return false
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}
	configure(patch: Partial<T>): void {
		for (const key of Object.keys(this.parameters) as (keyof T)[]) {
			const parameter = this.parameters[key]
			const value = patch[key]
			if ("waveform" in parameter) {
				if (validWaveform(value)) {
					this.settings[key] = structuredClone(value) as T[keyof T]
				}
			} else {
				const next = bounded(
					value,
					this.settings[key] as number,
					parameter.min,
					parameter.max
				)
				this.settings[key] = (parameter.step === 1 ? Math.round(next) : next) as T[keyof T]
			}
		}
		this.output.gain.setTargetAtTime(this.settings.volume, this.context.currentTime, 0.005)
		const active = [...this.voices].filter((voice) => !voice.retiring)
		while (active.length > this.settings.maxPolyphony) {
			this.releaseVoice(active.shift()!, 0.005)
		}
		for (const voice of this.voices) {
			this.updateVoice(voice)
		}
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}
	private channelState(channel: number): ChannelState {
		let state = this.channels.get(channel)
		if (!state) {
			state = { bend: 8192, volume: 1, expression: 1, modulation: 0, sustain: false }
			this.channels.set(channel, state)
		}
		return state
	}
	private updateVoice(voice: Voice): void {
		const state = this.channelState(voice.channel)
		voice.pitch(
			midiNoteToFrequency(
				voice.note + ((state.bend - 8192) / 8192) * this.settings.pitchBendRange
			)
		)
		voice.level.gain.setTargetAtTime(
			state.volume * state.expression,
			this.context.currentTime,
			0.005
		)
		voice.modulate?.(state.modulation)
	}
	noteOn(number: number, velocity = 100): void {
		this.sendCommand(
			musicalCommand({ type: NOTE_ON, number, velocity, channel: this.settings.channel || 1 })
		)
	}
	noteOff(number: number): void {
		this.sendCommand(
			musicalCommand({ type: NOTE_OFF, number, channel: this.settings.channel || 1 })
		)
	}
	getNoteKey(command: IAudioCommand): string {
		return command.channel + ":" + command.number
	}
	sendCommand(command: IAudioCommand): void {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.allNotesOff()
			return
		}
		const isNoteOff =
			command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity <= 0)
		if (
			this.destroyed ||
			!this.connected ||
			(!isNoteOff && this.settings.channel && command.channel !== this.settings.channel)
		) {
			return
		}
		const channel = Math.round(bounded(command.channel, 1, 1, 16))
		const state = this.channelState(channel)
		const matching = [...this.voices].filter((voice) => voice.channel === channel)
		if (command.type === CONTROL_CHANGE) {
			const value = bounded(command.value, 0, 0, 127)
			switch (command.number) {
				case 1:
					state.modulation = value / 127
					break
				case 7:
					state.volume = value / 127
					break
				case 11:
					state.expression = value / 127
					break
				case 64:
					state.sustain = value >= 64
					if (!state.sustain) {
						for (const voice of matching) {
							if (!voice.held) {
								this.releaseVoice(voice)
							}
						}
					}
					break
				case 120:
				case 123:
					state.sustain = false
					for (const voice of matching) {
						this.releaseVoice(voice, 0.005)
					}
			}
			for (const voice of matching) {
				this.updateVoice(voice)
			}
			return
		}
		if (command.type === PITCH_BEND) {
			state.bend = bounded(command.value, 8192, 0, 16383)
			for (const voice of matching) {
				this.updateVoice(voice)
			}
			return
		}
		if (isNoteOff) {
			for (const voice of matching) {
				if (voice.note === command.number && voice.endAt === undefined) {
					voice.held = false
					if (!state.sustain) {
						this.releaseVoice(voice)
					}
				}
			}
			return
		}
		if (
			command.type !== NOTE_ON ||
			!Number.isInteger(command.number) ||
			command.number < 0 ||
			command.number > 127 ||
			!Number.isFinite(command.velocity) ||
			this.context.state !== "running"
		) {
			return
		}
		const active = [...this.voices].filter((voice) => voice.endAt === undefined)
		for (const voice of active) {
			if (voice.channel === channel && voice.note === command.number) {
				this.releaseVoice(voice, 0.005)
			}
		}
		const remaining = [...this.voices].filter((voice) => !voice.retiring)
		if (remaining.length >= this.settings.maxPolyphony) {
			this.releaseVoice(remaining[0], 0.005)
		}
		const envelope = this.context.createGain()
		const level = this.context.createGain()
		envelope.connect(level)
		level.connect(this.output)
		const now = this.context.currentTime
		const velocity = Math.min(127, command.velocity) / 127
		const { attack, decay, sustain } = this.settings
		envelope.gain.setValueAtTime(0, now)
		envelope.gain.linearRampToValueAtTime(velocity, now + attack)
		envelope.gain.linearRampToValueAtTime(velocity * sustain, now + attack + decay)
		const graph = this.buildVoice(envelope)
		const voice: Voice = {
			...graph,
			channel,
			note: command.number,
			envelope,
			level,
			started: now,
			velocity,
			adsr: { attack, decay, sustain },
			held: true,
			retiring: false
		}
		this.voices.add(voice)
		this.updateVoice(voice)
		for (const source of graph.sources) {
			source.start(now)
		}
	}
	private envelopeLevel(voice: Voice, now: number): number {
		if (voice.endAt !== undefined && voice.releaseAt !== undefined) {
			return (
				(voice.releaseLevel ?? 0) *
				Math.max(0, (voice.endAt - now) / (voice.endAt - voice.releaseAt))
			)
		}
		const elapsed = now - voice.started
		const { attack, decay, sustain } = voice.adsr
		return (
			voice.velocity *
			(elapsed < attack
				? elapsed / attack
				: elapsed < attack + decay
					? 1 - ((1 - sustain) * (elapsed - attack)) / decay
					: sustain)
		)
	}
	private releaseVoice(voice: Voice, duration = this.settings.release): void {
		const now = this.context.currentTime
		if (duration <= 0.005) {
			voice.retiring = true
		}
		if (voice.endAt !== undefined && voice.endAt <= now + duration) {
			return
		}
		const level = this.envelopeLevel(voice, now)
		voice.envelope.gain.cancelScheduledValues(now)
		voice.envelope.gain.setValueAtTime(level, now)
		voice.envelope.gain.linearRampToValueAtTime(0, now + duration)
		voice.releaseAt = now
		voice.releaseLevel = level
		voice.endAt = now + duration
		voice.release?.(voice.endAt)
		for (const source of voice.sources) {
			source.stop(voice.endAt)
			source.onended = () => {
				if (this.context.currentTime >= voice.endAt!) {
					this.cleanup(voice)
				}
			}
		}
		clearTimeout(voice.timer)
		const finish = () => {
			if (this.context.currentTime >= voice.endAt!) {
				this.cleanup(voice)
			} else {
				// Audio time pauses while a context is suspended.
				voice.timer = setTimeout(finish, 50)
			}
		}
		voice.timer = setTimeout(finish, duration * 1000 + 10)
	}
	private cleanup(voice: Voice): void {
		if (!this.voices.delete(voice)) {
			return
		}
		clearTimeout(voice.timer)
		for (const source of voice.sources) {
			source.onended = null
			source.stop()
		}
		for (const node of [...voice.nodes, ...voice.sources, voice.envelope, voice.level]) {
			node.disconnect()
		}
	}
	allNotesOff(): void {
		for (const state of this.channels.values()) {
			state.sustain = false
		}
		for (const voice of this.voices) {
			this.releaseVoice(voice, 0.005)
		}
	}
	async connect(): Promise<void> {
		if (this.destroyed) {
			return
		}
		if (this.context.state === "suspended") {
			await this.context.resume()
		}
		if (!this.destroyed && !this.connected) {
			this.output.connect(this.destination)
			this.connected = true
		}
	}
	async disconnect(): Promise<void> {
		this.connected = false
		for (const voice of this.voices) {
			this.cleanup(voice)
		}
		this.output.disconnect()
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel()
		panel.setAttribute("aria-label", this.name + " controls")
		this.guiEvents = new AbortController()
		const inputs = (Object.keys(this.parameters) as (keyof T)[]).map((key) => {
			const parameter = this.parameters[key]
			let input: HTMLInputElement
			if ("waveform" in parameter) {
				const label = document.createElement("label")
				input = document.createElement("input")
				input.type = "text"
				input.title = "sine, square, triangle, sawtooth, or JSON {real:[...],imag:[...]}"
				input.addEventListener(
					EVENT_CHANGE,
					() => {
						let value: unknown = input.value
						try {
							value = JSON.parse(input.value)
						} catch {
							// Standard waveform names are plain text.
						}
						this.configure({ [key]: value } as Partial<T>)
					},
					{ signal: this.guiEvents!.signal }
				)
				label.append(String(key) + " ", input)
				panel.append(label)
			} else {
				input = numberControl(
					panel,
					String(key),
					this.settings[key] as number,
					parameter.min,
					parameter.max,
					(value) => this.configure({ [key]: value } as Partial<T>),
					parameter.step
				)
			}
			input.name = String(key)
			return { key, input }
		})
		const update = () => {
			for (const { key, input } of inputs) {
				const value = this.settings[key]
				input.value = typeof value === "object" ? JSON.stringify(value) : String(value)
			}
		}
		this.addEventListener(EVENT_CONFIGURATION_CHANGED, update, {
			signal: this.guiEvents.signal
		})
		update()
		this.gui = panel
		return panel
	}
	async destroyGui(): Promise<void> {
		this.guiEvents?.abort()
		this.gui?.remove()
		this.gui = undefined
	}
	destroy(): void {
		this.destroyed = true
		void this.disconnect()
		void this.destroyGui()
	}
}