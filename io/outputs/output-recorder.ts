import type { IAudioOutput } from "./output-interface"
import { EVENT_CLICK, EVENT_RECORDER_TOGGLE, EVENT_RECORDER_REVIEW } from "../../event-constants"

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
		toggle.disabled = this.busy
		this.gui.querySelector<HTMLButtonElement>("[data-review]")!.disabled =
			this.busy || this.recording || !this.hasTake
		this.gui.querySelector("output")!.textContent = this.recording
			? "Recording master audio"
			: this.busy
				? "Preparing recorder…"
				: "Ready to record master audio"
	}
	async createGui() {
		const gui = document.createElement("div")
		gui.className = "recorder-output"
		const status = document.createElement("output")
		status.setAttribute("aria-live", "polite")
		const toggle = document.createElement("button")
		toggle.type = "button"
		toggle.dataset.record = ""
		toggle.addEventListener(EVENT_CLICK, () =>
			this.dispatchEvent(new Event(EVENT_RECORDER_TOGGLE))
		)
		const review = document.createElement("button")
		review.type = "button"
		review.dataset.review = ""
		review.textContent = "Last take"
		review.addEventListener(EVENT_CLICK, () =>
			this.dispatchEvent(new Event(EVENT_RECORDER_REVIEW))
		)
		gui.append(status, toggle, review)
		this.gui = gui
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
		await this.destroyGui()
	}
}