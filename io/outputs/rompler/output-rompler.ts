import type { IAudioCommand } from "../../../commands/audio-command-interface"
import type { IAudioOutput } from "../output-interface"
import {
	NOTE_ON,
	NOTE_OFF,
	CONTROL_CHANGE,
	PITCH_BEND,
	PROGRAM_CHANGE,
	MIDI_STOP,
	PLAYBACK_STOP
} from "../../../commands/commands"
import { getAudioDestination } from "../../audio-destination"
import { bounded, changed } from "../../device-controls"
import { musicalCommand } from "../../event-clip"
import {
	ROMPLER_HOST,
	ROMPLER_SPACINGS,
	isSustained,
	presetTitle,
	sampleGrid,
	sampleUrl
} from "./rompler-catalogue"
import { RomplerGui } from "./rompler-gui"
import { RomplerLoader, type RomplerProgress } from "./rompler-loader"

// A plain URL rather than a bundler-specific import, so Vite and Parcel both emit the worklet as its own file.
const processorURL = new URL("./rompler.worklet.js", import.meta.url).href

const registrations = new WeakMap<BaseAudioContext, Promise<void>>()

/**
 * General MIDI soundfont player. Nothing downloads until the output is
 * connected or played; samples then stream in around the notes in use and
 * play the moment they land, with gaps pitched from the nearest sample.
 */
export default class Rompler extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-Rompler-${crypto.randomUUID()}`
	readonly name = "Rompler"
	readonly description = "General MIDI soundfont instruments that stream in as you play"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly output: GainNode
	readonly options: {
		preset: number
		baseUrl: string
		spacing: number
		volume: number
		release: number
		pitchBendRange: number
	}
	private readonly context: AudioContext
	private readonly loader: RomplerLoader
	private node?: AudioWorkletNode
	private starting?: Promise<AudioWorkletNode>
	private grid: number[] = []
	private stale = false
	private progress: RomplerProgress = { loaded: 0, failed: 0, total: 0 }
	private volumes = new Float32Array(16).fill(1)
	private expressions = new Float32Array(16).fill(1)
	private sustained = new Set<number>()
	private released = new Set<string>()
	private connected = true
	private destroyed = false
	private gui?: RomplerGui
	// Keys of the current preset that have arrived, so a panel opened later can show them
	private loadedNotes = new Set<number>()

	constructor(options: Record<string, any> = {}) {
		super()
		if (!options.audioContext) {
			throw Error("Rompler requires an audio context")
		}
		this.context = options.audioContext
		this.options = {
			preset: Math.round(bounded(options.preset, 0, 0, 127)),
			baseUrl:
				typeof options.baseUrl === "string" && options.baseUrl.endsWith("/")
					? options.baseUrl
					: ROMPLER_HOST,
			spacing: ROMPLER_SPACINGS.includes(options.spacing) ? options.spacing : 3,
			volume: bounded(options.volume, 0.8, 0, 2),
			release: bounded(options.release, 0.3, 0.005, 5),
			pitchBendRange: bounded(options.pitchBendRange, 2, 0, 24)
		}
		this.grid = sampleGrid(this.options.spacing)
		this.output = this.context.createGain()
		this.output.gain.value = this.options.volume
		this.output.connect(options.mixer ?? getAudioDestination(this.context))
		this.loader = new RomplerLoader(
			this.context,
			(sample) => {
				const { channels } = sample
				this.loadedNotes.add(sample.note)
				this.gui?.sampleLoaded(sample.note)
				if (this.stale) {
					this.stale = false
					this.node?.port.postMessage({ type: "clear" })
				}
				this.node?.port.postMessage(
					{ type: "sample", ...sample },
					channels.map((channel) => channel.buffer)
				)
			},
			(progress) => {
				this.progress = progress
				this.renderStatus()
			}
		)
	}
	get isConnected(): boolean {
		return this.connected && !this.destroyed
	}
	get loading(): boolean {
		return !!this.node && !this.loader.complete
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}
	getNoteKey(command: IAudioCommand): string {
		return `${command.channel}:${command.number}`
	}
	private initialize(): Promise<AudioWorkletNode> {
		if (this.destroyed) {
			return Promise.reject(Error("Rompler has been destroyed"))
		}
		if (this.node) {
			return Promise.resolve(this.node)
		}
		return (this.starting ??= (async () => {
			if (!this.context.audioWorklet) {
				throw Error("The Rompler requires AudioWorklet support and a secure connection")
			}
			if (!registrations.has(this.context)) {
				const pending = this.context.audioWorklet.addModule(processorURL)
				registrations.set(this.context, pending)
				pending.catch(() => registrations.delete(this.context))
			}
			await registrations.get(this.context)
			if (this.destroyed) {
				throw Error("Rompler has been destroyed")
			}
			const node = new AudioWorkletNode(this.context, "harmoneasy-rompler", {
				numberOfInputs: 0,
				numberOfOutputs: 1,
				outputChannelCount: [2]
			})
			node.onprocessorerror = () => this.allNotesOff()
			node.connect(this.output)
			node.port.postMessage({ type: "release", value: this.options.release })
			this.node = node
			this.reload()
			return node
		})().finally(() => {
			this.starting = undefined
		}))
	}
	/** Swap presets without a silent gap: old samples play until the first new one arrives */
	private reload(): void {
		if (!this.node) {
			return
		}
		const { baseUrl, preset, spacing } = this.options
		this.stale = true
		this.loadedNotes.clear()
		this.gui?.resetSamples(this.grid)
		this.loader.load(
			sampleGrid(spacing),
			(note) => sampleUrl(baseUrl, preset, note),
			isSustained(preset)
		)
	}
	private nearest(note: number): number {
		let key = this.grid[0]
		for (const candidate of this.grid) {
			if (Math.abs(candidate - note) < Math.abs(key - note)) {
				key = candidate
			}
		}
		return key
	}
	setPreset(preset: number): void {
		preset = Math.round(bounded(preset, this.options.preset, 0, 127))
		if (preset === this.options.preset) {
			return
		}
		this.options.preset = preset
		this.gui?.setPreset(preset)
		this.reload()
		changed(this)
	}
	private configure(changes: Partial<Rompler["options"]>): void {
		Object.assign(this.options, changes)
		this.grid = sampleGrid(this.options.spacing)
		this.gui?.setSpacing(this.options.spacing)
		this.reload()
		changed(this)
	}
	async connect(): Promise<void> {
		await this.context.resume()
		await this.initialize()
		if (!this.destroyed) {
			this.connected = true
		}
	}
	async disconnect(): Promise<void> {
		this.connected = false
		this.allNotesOff()
	}
	private post(message: Record<string, unknown>): void {
		this.node?.port.postMessage(message)
	}
	async sendCommand(command: IAudioCommand): Promise<void> {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.allNotesOff()
			return
		}
		if (!this.isConnected) {
			return
		}
		const channel = Math.round(bounded(command.channel, 1, 1, 16)) - 1
		const note = command.number
		// Commands may name a later AudioContext time to play at; the worklet holds them until then
		const time = command.audioTime
		if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity <= 0)) {
			if (this.sustained.has(channel)) {
				this.released.add(`${channel}:${note}`)
			} else {
				this.post({ type: "off", channel, note, time })
				this.gui?.notePlaying(note, false)
			}
			return
		}
		if (command.type === PROGRAM_CHANGE) {
			this.setPreset(command.value ?? command.number)
			return
		}
		if (command.type === CONTROL_CHANGE) {
			this.control(channel, command.number, command.value)
			return
		}
		if (command.type === PITCH_BEND) {
			this.post({
				type: "bend",
				channel,
				time,
				value:
					((bounded(command.value, 8192, 0, 16383) - 8192) / 8192) *
					this.options.pitchBendRange
			})
			return
		}
		if (
			command.type !== NOTE_ON ||
			!Number.isInteger(note) ||
			note < 0 ||
			note > 127 ||
			!Number.isFinite(command.velocity)
		) {
			return
		}
		this.released.delete(`${channel}:${note}`)
		this.loader.request(this.nearest(note))
		const node = this.node ?? (await this.initialize())
		if (!this.isConnected) {
			return
		}
		if (this.context.state === "suspended") {
			void this.context.resume()
		}
		node.port.postMessage({
			type: "on",
			channel,
			note,
			velocity: bounded(command.velocity, 100, 0, 127) / 127,
			time
		})
		this.gui?.notePlaying(note, true)
	}
	private control(channel: number, controller: number, value: number): void {
		if (controller === 64) {
			if (value >= 64) {
				this.sustained.add(channel)
				return
			}
			this.sustained.delete(channel)
			for (const id of this.released) {
				const [held, note] = id.split(":").map(Number)
				if (held === channel) {
					this.post({ type: "off", channel, note })
					this.gui?.notePlaying(note, false)
					this.released.delete(id)
				}
			}
		} else if (controller === 120 || controller === 123) {
			this.sustained.delete(channel)
			for (const id of this.released) {
				if (id.startsWith(`${channel}:`)) {
					this.released.delete(id)
				}
			}
			this.post({ type: "panic", channel })
			this.gui?.clearPlaying()
		} else if (controller === 7 || controller === 11) {
			;(controller === 7 ? this.volumes : this.expressions)[channel] =
				bounded(value, 127, 0, 127) / 127
			this.post({
				type: "gain",
				channel,
				value: this.volumes[channel] * this.expressions[channel]
			})
		}
	}
	noteOn(number: number, velocity = 100): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): void {
		void this.sendCommand(musicalCommand({ type: NOTE_OFF, number, channel: 1 }))
	}
	allNotesOff(): void {
		this.sustained.clear()
		this.released.clear()
		this.post({ type: "panic" })
		this.gui?.clearPlaying()
	}
	private renderStatus(): void {
		if (!this.gui) {
			return
		}
		const { loaded, failed, total } = this.progress
		const busy = !!this.node && loaded + failed < total
		this.gui.setStatus(
			!this.node
				? "Samples load when you play or press Play"
				: busy
					? `Loading ${presetTitle(this.options.preset)}: ${loaded} of ${total} samples`
					: failed
						? `${loaded} of ${total} samples loaded, ${failed} unavailable`
						: `${presetTitle(this.options.preset)} ready`,
			busy
		)
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui.element
		}
		this.gui = new RomplerGui(
			this.options,
			{
				preset: (program) => this.setPreset(program),
				spacing: (spacing) => this.configure({ spacing }),
				volume: (volume) => {
					this.options.volume = volume
					this.output.gain.value = volume
				},
				release: (release) => {
					this.options.release = release
					this.post({ type: "release", value: release })
				},
				pitchBendRange: (pitchBendRange) => {
					this.options.pitchBendRange = pitchBendRange
				},
				commit: () => changed(this),
				audition: (note, on) => (on ? void this.noteOn(note) : this.noteOff(note))
			},
			this.loadedNotes,
			this.grid
		)
		this.renderStatus()
		return this.gui.element
	}
	async destroyGui(): Promise<void> {
		this.gui?.element.remove()
		this.gui = undefined
	}
	destroy(): void {
		if (this.destroyed) {
			return
		}
		this.destroyed = true
		this.connected = false
		this.loader.cancel()
		this.allNotesOff()
		this.post({ type: "destroy" })
		this.node?.disconnect()
		this.node?.port.close()
		this.node = undefined
		this.output.disconnect()
		void this.destroyGui()
	}
}