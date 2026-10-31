import type { IAudioCommand } from "../../audio-command-interface"
import type { IAudioOutput } from "./output-interface"
import { NOTE_OFF, NOTE_ON } from "../../commands"
import { EVENT_CHANGE, EVENT_ENDED } from "../../event-constants"
import { bounded, changed, devicePanel, numberControl } from "../device-controls"
import { getAudioDestination } from "../../audio-destination"
import { musicalCommand } from "../event-clip"
import { DEFAULT_HARMONY, type HarmonicState } from "../harmony"
import { quantisePitchSet } from "../../tuning/pitch-class-set"

const MAX_SAMPLE_BYTES = 4 * 1024 * 1024
interface SampleVoice {
	source: AudioBufferSourceNode
	gain: GainNode
	note: number
	level: number
}

export default class OutputSamplePlayer extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-SamplePlayer-${crypto.randomUUID()}`
	readonly name: string = "Sample Player"
	readonly description: string = "Load your own audio sample and play it across the keyboard"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly options: Record<string, any>
	readonly output: GainNode
	protected context: AudioContext
	private destination: AudioNode
	private connected = true
	protected buffer?: AudioBuffer
	private loading?: Promise<AudioBuffer>
	private generation = 0
	private sampleRevision = 0
	private voices = new Map<string, SampleVoice>()
	private gui?: HTMLElement
	private status?: HTMLElement
	private destroyed = false
	protected harmony = { ...DEFAULT_HARMONY }
	private pending = new Map<string, object>()
	setHarmony(state: HarmonicState): void {
		this.harmony = { ...state }
		if (this.options.follow !== "scale" && this.options.follow !== "chord") {
			return
		}
		for (const voice of this.voices.values()) {
			const pitch = this.targetPitch(voice.note)
			voice.gain.gain.setTargetAtTime(
				pitch === undefined ? 0 : voice.level,
				this.context.currentTime,
				0.02
			)
			if (pitch !== undefined) {
				voice.source.playbackRate.setTargetAtTime(
					2 ** ((pitch - this.options.root) / 12),
					this.context.currentTime,
					0.02
				)
			}
		}
	}
	protected targetPitch(note: number): number | undefined {
		if (this.options.follow === "scale" || this.options.follow === "chord") {
			return quantisePitchSet(note, this.harmony[this.options.follow as "scale" | "chord"], 0)
		}
		return note
	}
	get isConnected() {
		return this.connected
	}
	hasAudioOutput() {
		return true
	}
	constructor(options: Record<string, any> = {}) {
		super()
		if (!options.audioContext) {
			throw new Error("Sample Player requires an audio context")
		}
		this.context = options.audioContext
		this.destination = options.mixer ?? getAudioDestination(this.context)
		this.options = {
			...options,
			root: Math.round(bounded(options.root, 60, 0, 127)),
			loop: options.loop === true
		}
		if (
			options.sample !== undefined &&
			(typeof options.sample !== "string" ||
				options.sample.length > Math.ceil(MAX_SAMPLE_BYTES / 3) * 4)
		) {
			throw new Error("Saved sample exceeds 4 MB")
		}
		this.output = this.context.createGain()
		this.output.connect(this.destination)
	}
	getNoteKey(command: IAudioCommand): string {
		return `${command.channel}:${command.number}`
	}
	protected decodeSaved(): Promise<AudioBuffer> {
		if (this.buffer) {
			return Promise.resolve(this.buffer)
		}
		if (!this.options.sample) {
			return Promise.reject(new Error("Load an audio sample first"))
		}
		if (!this.loading) {
			const bytes = Uint8Array.from(atob(this.options.sample), (character) =>
				character.charCodeAt(0)
			)
			const revision = this.sampleRevision
			this.loading = this.context
				.decodeAudioData(bytes.buffer)
				.then((buffer) => {
					if (revision === this.sampleRevision && !this.destroyed) {
						this.buffer = buffer
					}
					return buffer
				})
				.finally(() => {
					this.loading = undefined
				})
		}
		return this.loading
	}
	async loadSample(bytes: ArrayBuffer, fileName: string): Promise<void> {
		if (bytes.byteLength > MAX_SAMPLE_BYTES) {
			throw new Error("Sample exceeds 4 MB")
		}
		const generation = ++this.generation
		++this.sampleRevision
		const buffer = await this.context.decodeAudioData(bytes.slice(0))
		if (generation !== this.generation || this.destroyed) {
			return
		}
		this.allNotesOff()
		this.buffer = buffer
		const data = new Uint8Array(bytes)
		let binary = ""
		for (let start = 0; start < data.length; start += 8192) {
			binary += String.fromCharCode(...data.subarray(start, start + 8192))
		}
		this.options.sample = btoa(binary)
		this.options.fileName = fileName
		changed(this)
		if (this.status) {
			this.status.textContent = `${fileName}: ${buffer.duration.toFixed(2)} seconds`
		}
	}
	async sendCommand(command: IAudioCommand): Promise<void> {
		if (!this.connected) {
			return
		}
		const key = this.getNoteKey(command)
		if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0)) {
			this.pending.delete(key)
			this.release(key)
			return
		}
		if (
			command.type !== NOTE_ON ||
			!Number.isInteger(command.number) ||
			command.number < 0 ||
			command.number > 127
		) {
			return
		}
		const generation = this.generation
		const request = {}
		this.pending.set(key, request)
		try {
			const buffer = await this.decodeSaved()
			if (
				generation !== this.generation ||
				!this.connected ||
				this.pending.get(key) !== request
			) {
				return
			}
			this.pending.delete(key)
			const pitch = this.targetPitch(command.number)
			if (pitch === undefined) {
				return
			}
			this.release(key)
			if (this.voices.size >= 32) {
				this.release(this.voices.keys().next().value!)
			}
			const source = this.context.createBufferSource(),
				gain = this.context.createGain()
			source.buffer = buffer
			source.loop = this.options.loop
			source.playbackRate.value = 2 ** ((pitch - this.options.root) / 12)
			gain.gain.setValueAtTime(0, this.context.currentTime)
			gain.gain.linearRampToValueAtTime(
				Math.max(0, Math.min(127, command.velocity)) / 127,
				this.context.currentTime + 0.005
			)
			source.connect(gain)
			gain.connect(this.output)
			const voice = {
				source,
				gain,
				note: command.number,
				level: Math.max(0, Math.min(127, command.velocity)) / 127
			}
			this.voices.set(key, voice)
			source.addEventListener(
				EVENT_ENDED,
				() => {
					source.disconnect()
					gain.disconnect()
					if (this.voices.get(key) === voice) {
						this.voices.delete(key)
					}
				},
				{ once: true }
			)
			source.start()
		} catch (error) {
			if (this.status) {
				this.status.textContent = error instanceof Error ? error.message : String(error)
			}
			throw error
		}
	}
	private release(key: string): void {
		const voice = this.voices.get(key)
		if (!voice) {
			return
		}
		this.voices.delete(key)
		const now = this.context.currentTime
		voice.gain.gain.cancelScheduledValues(now)
		voice.gain.gain.setTargetAtTime(0, now, 0.005)
		voice.source.stop(now + 0.03)
	}
	noteOn(number: number, velocity: number): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): void {
		this.release(`1:${number}`)
	}
	allNotesOff(): void {
		this.pending.clear()
		++this.generation
		for (const key of this.voices.keys()) {
			this.release(key)
		}
	}
	async connect(): Promise<void> {
		if (this.destroyed) {
			return
		}
		await this.context.resume()
		if (this.destroyed) {
			return
		}
		if (!this.connected) {
			this.output.connect(this.destination)
			this.connected = true
		}
	}
	async disconnect(): Promise<void> {
		this.allNotesOff()
		this.output.disconnect()
		this.connected = false
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel(),
			file = document.createElement("input"),
			label = document.createElement("label")
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.status.textContent =
			this.options.fileName ??
			"Load an audio sample, up to 4 MB. The sample is saved with your workspace."
		file.type = "file"
		file.accept = "audio/*"
		file.addEventListener(EVENT_CHANGE, async () => {
			const selected = file.files?.[0]
			if (!selected) {
				return
			}
			try {
				if (selected.size > MAX_SAMPLE_BYTES) {
					throw new Error("Sample exceeds 4 MB")
				}
				await this.context.resume()
				await this.loadSample(await selected.arrayBuffer(), selected.name)
			} catch (error) {
				if (this.status) {
					this.status.textContent = error instanceof Error ? error.message : String(error)
				}
			}
			file.value = ""
		})
		label.append("Audio sample ", file)
		panel.append(label, this.status)
		numberControl(panel, "Original pitch (MIDI note)", this.options.root, 0, 127, (value) => {
			this.options.root = value
			changed(this)
		})
		const loopLabel = document.createElement("label"),
			loop = document.createElement("input")
		loop.type = "checkbox"
		loop.checked = this.options.loop
		loop.addEventListener(EVENT_CHANGE, () => {
			this.options.loop = loop.checked
			changed(this)
		})
		loopLabel.append(loop, " Loop while a note is held")
		panel.append(loopLabel)
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
		this.status = undefined
	}
	destroy(): void {
		this.destroyed = true
		void this.disconnect()
		void this.destroyGui()
		this.buffer = undefined
	}
}