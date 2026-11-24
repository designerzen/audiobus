import type { IAudioOutput } from "./output-interface"
import {
	EVENT_CLICK,
	EVENT_RECORDER_TOGGLE,
	EVENT_RECORDER_REVIEW
} from "../../events/event-constants"
import { getAudioRecording, type AudioRecording } from "../recording/audio-recording"
import { RECORDING_STATE_CHANGED } from "../recording/recording-format"
import {
	AUDIO_EXPORT_FORMATS,
	populateAudioExportFormats,
	type AudioExportFormat
} from "../media/audio-media"

export default class OutputRecorder extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-Recorder-${crypto.randomUUID()}`
	readonly name = "Recorder"
	readonly description =
		"Records the app’s master audio. Recorder outputs share one take and can be toggled together."
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	private connected = true
	private gui?: HTMLElement
	private recording = false
	private busy = true
	private hasTake = false
	private hosted = false
	private exporting = false
	private exportStatus = ""
	private context?: AudioContext
	private take?: AudioRecording
	private readonly update = () => {
		if (!this.hosted && this.take) {
			this.recording = this.take.state === "recording"
			this.busy = this.take.state === "starting" || this.take.state === "stopping"
			this.hasTake = this.take.hasTake
		}
		this.render()
	}
	constructor(options: { audioContext?: AudioContext } = {}) {
		super()
		this.context = options.audioContext
		this.busy = !this.context
	}
	/** The shared take, created on first use so an output that is never shown opens no storage. */
	private get audioRecording() {
		if (!this.take && this.context) {
			this.take = getAudioRecording(this.context)
			this.take.addEventListener(RECORDING_STATE_CHANGED, this.update)
		}
		return this.take
	}
	get isConnected() {
		return this.connected
	}
	hasAudioOutput() {
		return false
	}
	hasMidiOutput() {
		return false
	}
	noteOn() {}
	noteOff() {}
	allNotesOff() {}
	setRecordingState(recording: boolean, busy: boolean, hasTake: boolean) {
		this.hosted = true
		this.recording = recording
		this.busy = busy
		this.hasTake = hasTake
		this.render()
	}
	private render() {
		if (!this.gui) {
			return
		}
		const toggle = this.gui.querySelector<HTMLButtonElement>("[data-record]")!
		toggle.textContent = this.recording ? "Stop recording" : "Record"
		toggle.setAttribute("aria-pressed", String(this.recording))
		toggle.disabled = this.busy || this.exporting
		this.gui.querySelector<HTMLButtonElement>("[data-review]")!.disabled =
			this.busy || this.recording || !this.hasTake || this.exporting
		const format = this.gui.querySelector<HTMLSelectElement>("select")!
		format.hidden = this.hosted
		format.disabled = this.busy || this.recording || this.exporting
		this.gui.querySelector("output")!.textContent =
			this.exportStatus ||
			(this.take?.error && !this.hosted
				? this.take.error
				: this.recording
					? "Recording master audio"
					: this.busy
						? "Preparing recorder…"
						: "Ready to record master audio")
	}
	/** Hosts that call preventDefault on the toggle and review events drive the shared take themselves. */
	private async toggle() {
		if (this.exporting) {
			return
		}
		this.exportStatus = ""
		if (!this.dispatchEvent(new Event(EVENT_RECORDER_TOGGLE, { cancelable: true }))) {
			return
		}
		const take = this.audioRecording
		if (take?.state === "recording") {
			await take.stop()
		} else {
			await take?.start()
		}
	}
	/** Without a host, save the last take in the selected format. */
	private async review() {
		if (this.exporting) {
			return
		}
		if (!this.dispatchEvent(new Event(EVENT_RECORDER_REVIEW, { cancelable: true }))) {
			return
		}
		const take = this.audioRecording
		if (!take?.hasTake) {
			return
		}
		const format = (this.gui?.querySelector("select")?.value ?? "16") as AudioExportFormat
		this.exporting = true
		this.exportStatus = "Preparing audio…"
		this.render()
		try {
			const blob = await take.exportAudio(format, (progress) => {
				this.exportStatus = `Encoding audio… ${Math.round(progress * 100)}%`
				this.render()
			})
			const url = URL.createObjectURL(blob!)
			const anchor = document.createElement("a")
			anchor.href = url
			anchor.download = `recording.${AUDIO_EXPORT_FORMATS.find((entry) => entry.id === format)!.extension}`
			anchor.click()
			setTimeout(() => URL.revokeObjectURL(url), 60_000)
			this.exportStatus = "Download started. The take is still available."
		} catch (error) {
			this.exportStatus = `Could not save: ${error instanceof Error ? error.message : error}. Your take is retained.`
		} finally {
			this.exporting = false
			this.render()
		}
	}
	async createGui() {
		const gui = document.createElement("div")
		gui.className = "recorder-output"
		const status = document.createElement("output")
		status.setAttribute("aria-live", "polite")
		const toggle = document.createElement("button")
		toggle.type = "button"
		toggle.dataset.record = ""
		toggle.addEventListener(EVENT_CLICK, () => void this.toggle())
		const review = document.createElement("button")
		review.type = "button"
		review.dataset.review = ""
		review.textContent = "Last take"
		review.addEventListener(EVENT_CLICK, () => void this.review())
		const format = document.createElement("select")
		format.setAttribute("aria-label", "Recording export format")
		populateAudioExportFormats(format, this.context?.sampleRate ?? 48000)
		gui.append(status, toggle, review, format)
		this.gui = gui
		if (!this.hosted) {
			void this.audioRecording?.ready.then(this.update)
		}
		this.render()
		return gui
	}
	async destroyGui() {
		this.gui = undefined
	}
	async disconnect() {
		this.connected = false
	}
	async destroy() {
		this.connected = false
		this.take?.removeEventListener(RECORDING_STATE_CHANGED, this.update)
		await this.destroyGui()
	}
}