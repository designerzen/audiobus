import type { IAudioOutput } from "./output-interface"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import type { AudioClockTick } from "../../timing/audio-clock-tick"
import { MIDI_STOP, PLAYBACK_STOP } from "../../commands/commands"
import { EVENT_CHANGE, EVENT_ENDED } from "../../events/event-constants"
import { action, bounded, changed, devicePanel, numberControl } from "../device-controls"
import { getAudioDestination } from "../audio-destination"
import { DEFAULT_HARMONY, type HarmonicState } from "../harmony"
import { describeMusicalContext } from "../ai-fugue"
import { generateLyriaTrack, LYRIA_MODELS, MAX_TRACK_BYTES } from "../lyria"
import { readBackingTrack, saveBackingTrack } from "../backing-track-store"

export default class OutputLyria extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-Lyria-${crypto.randomUUID()}`
	readonly name = "Lyria Backing Track"
	readonly description =
		"Generate a backing track with Google Lyria, then play along with the transport"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly options: Record<string, any>
	readonly output: GainNode
	private context: AudioContext
	private destination: AudioNode
	private getBpm?: () => number
	private harmony: HarmonicState = { ...DEFAULT_HARMONY }
	private connected = true
	private destroyed = false
	private buffer?: AudioBuffer
	private bytes?: ArrayBuffer
	private source?: AudioBufferSourceNode
	private lastStep?: number
	private previewing = false
	private revision = 0
	private request?: AbortController
	private gui?: HTMLElement
	private status?: HTMLElement
	private key?: HTMLInputElement
	private previewButton?: HTMLButtonElement
	private downloadButton?: HTMLButtonElement
	private generateButton?: HTMLButtonElement
	private cancelButton?: HTMLButtonElement
	private message = "Describe a backing track, or load an MP3/WAV file."

	constructor(options: Record<string, any> = {}) {
		super()
		if (!options.audioContext) {
			throw new Error("Lyria requires an audio context")
		}
		this.context = options.audioContext
		this.destination = options.mixer ?? getAudioDestination(this.context)
		this.getBpm = options.getBpm
		// Explicitly select serializable settings: credentials are never persisted.
		this.options = {
			prompt: String(options.prompt ?? ""),
			model: LYRIA_MODELS.includes(options.model) ? options.model : LYRIA_MODELS[0],
			bpm: bounded(options.bpm, 120, 30, 300),
			duration: bounded(options.duration, 60, 30, 180),
			instrumental: options.instrumental !== false,
			loop: options.loop === true,
			trackId: typeof options.trackId === "string" ? options.trackId : undefined,
			fileName: typeof options.fileName === "string" ? options.fileName : undefined,
			mimeType: options.mimeType === "audio/wav" ? "audio/wav" : "audio/mpeg"
		}
		this.output = this.context.createGain()
		this.output.connect(this.destination)
		if (this.options.trackId) {
			void this.restore()
		}
	}
	get isConnected(): boolean {
		return this.connected
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}
	setHarmony(state: HarmonicState): void {
		this.harmony = { ...state }
	}
	private show(message: string): void {
		this.message = message
		if (this.status) {
			this.status.textContent = message
		}
	}
	private refresh(): void {
		if (this.previewButton) {
			this.previewButton.disabled = !this.buffer || !this.connected
		}
		if (this.downloadButton) {
			this.downloadButton.disabled = !this.bytes
		}
		if (this.generateButton) {
			this.generateButton.disabled = !!this.request
		}
		if (this.cancelButton) {
			this.cancelButton.disabled = !this.request
		}
	}
	private async restore(): Promise<void> {
		const revision = this.revision
		try {
			const bytes = await readBackingTrack(this.options.trackId)
			if (!bytes) {
				throw new Error(
					"Audio is not stored in this browser. Load the downloaded file to restore it."
				)
			}
			const buffer = await this.context.decodeAudioData(bytes.slice(0))
			if (revision !== this.revision || this.destroyed) {
				return
			}
			this.bytes = bytes
			this.buffer = buffer
			this.show(
				`${this.options.fileName}: ${buffer.duration.toFixed(1)} seconds. Ready for transport playback.`
			)
			this.refresh()
		} catch (error) {
			if (revision === this.revision && !this.destroyed) {
				this.show(String((error as Error).message))
			}
		}
	}
	async loadTrack(bytes: ArrayBuffer, fileName: string, mimeType = "audio/mpeg"): Promise<void> {
		if (!bytes.byteLength || bytes.byteLength > MAX_TRACK_BYTES) {
			throw new Error("Audio must be between 1 byte and 32 MB")
		}
		const revision = ++this.revision
		const buffer = await this.context.decodeAudioData(bytes.slice(0))
		if (revision !== this.revision || this.destroyed) {
			return
		}
		if (!Number.isFinite(buffer.duration) || buffer.duration <= 0) {
			throw new Error("Audio has no playable duration")
		}
		const trackId = crypto.randomUUID()
		let stored = true
		try {
			await saveBackingTrack(trackId, bytes)
		} catch {
			stored = false
		}
		if (revision !== this.revision || this.destroyed) {
			return
		}
		this.stopClock()
		this.buffer = buffer
		this.bytes = bytes
		Object.assign(this.options, { trackId: stored ? trackId : undefined, fileName, mimeType })
		this.show(
			`${fileName}: ${buffer.duration.toFixed(1)} seconds. ${stored ? "Saved in this browser." : "Local storage unavailable; download before closing."} Start the transport to play.`
		)
		this.refresh()
		changed(this)
	}
	async generate(apiKey: string): Promise<void> {
		if (this.request || this.destroyed) {
			return
		}
		const request = new AbortController()
		this.request = request
		const revision = ++this.revision
		this.refresh()
		this.show("Generating music with Google Lyria…")
		const timeout = setTimeout(() => this.cancelGeneration(), 180_000)
		try {
			const bpm = bounded(this.getBpm?.(), this.options.bpm, 30, 300)
			const prompt = [
				this.options.prompt,
				describeMusicalContext({ harmony: this.harmony }, "chord", bpm),
				`Duration: ${this.options.model === LYRIA_MODELS[1] ? 30 : this.options.duration} seconds.`,
				this.options.instrumental
					? "Instrumental backing track, without vocals."
					: "Vocals are welcome."
			].join("\n")
			if (!this.options.prompt.trim()) {
				throw new Error("Describe the music you want to generate")
			}
			const track = await generateLyriaTrack(
				apiKey,
				prompt,
				this.options.model,
				request.signal
			)
			if (request.signal.aborted || this.destroyed || revision !== this.revision) {
				return
			}
			await this.loadTrack(
				track.bytes,
				track.mimeType.includes("wav") ? "lyria-backing.wav" : "lyria-backing.mp3",
				track.mimeType
			)
		} catch (error) {
			if (!this.destroyed && this.request === request && !request.signal.aborted) {
				this.show((error as Error).message)
			}
		} finally {
			clearTimeout(timeout)
			if (this.request === request) {
				this.request = undefined
			}
			this.refresh()
		}
	}
	cancelGeneration(): void {
		if (this.request) {
			this.request.abort()
			++this.revision
			this.show(
				"Generation cancelled or timed out. Google may still charge for an accepted request."
			)
		}
	}
	private start(at: number, offset: number, preview = false): void {
		this.stopSource()
		if (!this.buffer || !this.connected || this.destroyed) {
			return
		}
		const source = this.context.createBufferSource()
		source.buffer = this.buffer
		source.loop = !preview && this.options.loop
		source.connect(this.output)
		source.addEventListener(
			EVENT_ENDED,
			() => {
				source.disconnect()
				if (this.source === source) {
					this.source = undefined
					this.previewing = false
				}
			},
			{ once: true }
		)
		this.source = source
		this.previewing = preview
		source.start(at, offset)
	}
	private stopSource(): void {
		if (this.source) {
			this.source.stop()
			this.source.disconnect()
			this.source = undefined
		}
		this.previewing = false
	}
	onClockTick(tick: Readonly<AudioClockTick>): void {
		if (
			!Number.isInteger(tick.step) ||
			tick.step < 0 ||
			!Number.isFinite(tick.triggerAt) ||
			!Number.isFinite(tick.bpm) ||
			tick.bpm <= 0 ||
			!this.connected ||
			this.destroyed ||
			!this.buffer ||
			this.context.state !== "running"
		) {
			return
		}
		const restart =
			this.lastStep === undefined ||
			this.previewing ||
			tick.step < this.lastStep ||
			tick.step > this.lastStep + 1
		this.lastStep = tick.step
		if (!restart) {
			return
		}
		const at = Math.max(this.context.currentTime, tick.triggerAt)
		let offset = (tick.step * 60) / tick.bpm / 4 + at - tick.triggerAt
		if (this.options.loop) {
			offset %= this.buffer.duration
		}
		if (offset >= this.buffer.duration) {
			this.stopSource()
			return
		}
		this.start(at, offset)
	}
	stopClock(): void {
		this.stopSource()
		this.lastStep = undefined
	}
	allNotesOff(): void {
		this.stopClock()
	}
	noteOn(_note: number, _velocity: number): void {}
	noteOff(_note: number): void {}
	sendCommand(command: IAudioCommand): void {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.stopClock()
		}
	}
	async connect(): Promise<void> {
		if (this.destroyed) {
			return
		}
		await this.context.resume()
		if (!this.connected && !this.destroyed) {
			this.output.connect(this.destination)
			this.connected = true
		}
		this.refresh()
	}
	async disconnect(): Promise<void> {
		this.stopClock()
		this.output.disconnect()
		this.connected = false
		this.refresh()
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel()
		const label = (title: string, control: HTMLElement) => {
			const wrapper = document.createElement("label")
			wrapper.append(title, control)
			panel.append(wrapper)
		}
		const info = document.createElement("p")
		info.textContent =
			"Uses your Gemini API account and quota. Your key is held only while this panel is open. Audio is stored in this browser; download it to move to another device. Tempo and key guide generation; playback keeps the original audio speed and pitch."
		panel.append(info)
		const key = document.createElement("input")
		key.type = "password"
		key.autocomplete = "off"
		key.spellcheck = false
		label("Gemini API key ", key)
		this.key = key
		const prompt = document.createElement("textarea")
		prompt.value = this.options.prompt
		prompt.rows = 3
		prompt.maxLength = 8000
		prompt.placeholder = "Warm jazz trio with space for a lead melody"
		prompt.addEventListener(EVENT_CHANGE, () => {
			this.options.prompt = prompt.value
			changed(this)
		})
		label("Describe your backing track ", prompt)
		const model = document.createElement("select")
		for (const [index, id] of LYRIA_MODELS.entries()) {
			const option = document.createElement("option")
			option.value = id
			option.textContent =
				index === 0 ? "Lyria 3.5 — full track" : "Lyria 3 Clip — 30 seconds"
			model.append(option)
		}
		model.value = this.options.model
		model.addEventListener(EVENT_CHANGE, () => {
			this.options.model = model.value
			changed(this)
		})
		label("Model ", model)
		if (!this.getBpm) {
			numberControl(panel, "Generation tempo (BPM)", this.options.bpm, 30, 300, (value) => {
				this.options.bpm = value
				changed(this)
			})
		}
		numberControl(
			panel,
			"Requested duration (seconds; Clip always uses 30)",
			this.options.duration,
			30,
			180,
			(value) => {
				this.options.duration = value
				changed(this)
			}
		)
		for (const [setting, title] of [
			["instrumental", "Instrumental (no vocals)"],
			["loop", "Loop during transport playback"]
		]) {
			const checkbox = document.createElement("input")
			checkbox.type = "checkbox"
			checkbox.checked = this.options[setting]
			checkbox.addEventListener(EVENT_CHANGE, () => {
				this.options[setting] = checkbox.checked
				if (setting === "loop") {
					this.stopClock()
				}
				changed(this)
			})
			label(title, checkbox)
		}
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.status.textContent = this.message
		this.generateButton = action(
			panel,
			"Generate backing track",
			() => {
				this.options.prompt = prompt.value
				changed(this)
				return this.generate(key.value)
			},
			this.status
		)
		this.cancelButton = action(panel, "Cancel generation", () => this.cancelGeneration())
		this.previewButton = action(
			panel,
			"Preview from start",
			async () => {
				await this.context.resume()
				this.lastStep = undefined
				this.start(this.context.currentTime, 0, true)
			},
			this.status
		)
		action(panel, "Stop preview", () => this.stopClock())
		this.downloadButton = action(panel, "Download audio", () => {
			if (!this.bytes) {
				return
			}
			const url = URL.createObjectURL(new Blob([this.bytes], { type: this.options.mimeType }))
			const link = document.createElement("a")
			link.href = url
			link.download = this.options.fileName ?? "lyria-backing.mp3"
			link.click()
			setTimeout(() => URL.revokeObjectURL(url), 1000)
		})
		const file = document.createElement("input")
		file.type = "file"
		file.accept = ".mp3,.wav,audio/mpeg,audio/wav"
		file.addEventListener(EVENT_CHANGE, async () => {
			const selected = file.files?.[0]
			if (!selected) {
				return
			}
			this.cancelGeneration()
			try {
				if (selected.size > MAX_TRACK_BYTES) {
					throw new Error("Audio exceeds 32 MB")
				}
				await this.loadTrack(
					await selected.arrayBuffer(),
					selected.name,
					/\.wav$/i.test(selected.name) ? "audio/wav" : "audio/mpeg"
				)
			} catch (error) {
				if (!this.destroyed) {
					this.show((error as Error).message)
				}
			}
			file.value = ""
		})
		label("Load existing MP3/WAV (up to 32 MB) ", file)
		panel.append(this.status)
		this.refresh()
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		if (this.key) {
			this.key.value = ""
		}
		this.key = undefined
		this.cancelGeneration()
		this.gui?.remove()
		this.gui = undefined
		this.status = undefined
		this.previewButton =
			this.downloadButton =
			this.generateButton =
			this.cancelButton =
				undefined
	}
	destroy(): void {
		this.destroyed = true
		++this.revision
		void this.destroyGui()
		void this.disconnect()
		this.buffer = undefined
		this.bytes = undefined
	}
}