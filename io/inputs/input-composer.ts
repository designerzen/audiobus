import NoteInput from "./note-input"
import { bounded, changed } from "../device-controls"
import type { AudioBusComposer } from "audiobus-input-composer/component"

const COMPOSER_CONTROL_CHANGE = "composer-control-change"

/**
 * An autonomous composer on the shared transport. The <audiobus-composer> element is both its
 * view and its engine: this input hands it the transport's beats and takes its notes as commands.
 */
export default class InputComposer extends NoteInput {
	private loading?: Promise<AudioBusComposer>
	private composer?: AudioBusComposer
	private playing = false
	private previous?: number
	private generation = 0
	private tempo?: number

	get name() {
		return "Composer"
	}
	get description() {
		return "An autonomous composer steered by emotion and energy on the shared transport"
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.setAsConnected()
	}

	private load(): Promise<AudioBusComposer> {
		return (this.loading ??= (async () => {
			await import("audiobus-input-composer/component")
			const element = document.createElement("audiobus-composer") as AudioBusComposer
			element.hostClock = true
			element.setOutput({ label: "Graph chain", send: (bytes) => this.receive(bytes) })
			if (this.options.composer) {
				element.configure(this.options.composer)
			}
			// Persist the selected emotion, energy and the rest with the chain, as other inputs do.
			element.addEventListener(COMPOSER_CONTROL_CHANGE, () => {
				this.options.composer = element.options
				changed(this)
			})
			return (this.composer = element)
		})())
	}

	/** Composer MIDI bytes become the same note commands every other input sends. */
	private receive(bytes: readonly number[]): void {
		const [status, note, velocity] = bytes
		const channel = (status & 15) + 1
		const type = status & 240
		if (type === 144 && velocity > 0) {
			this.noteOn(note, velocity, channel)
		} else if (type === 144 || type === 128) {
			this.noteOff(note, channel)
		}
	}

	startClock(): void {
		this.stopClock()
		this.playing = true
		const generation = this.generation
		void this.load().then((composer) => {
			if (this.playing && generation === this.generation) {
				void composer.start()
			}
		})
	}
	stopClock(): void {
		this.generation++
		this.playing = false
		this.previous = undefined
		this.composer?.stop()
		this.allNotesOff()
	}
	updateTime(now: number): void {
		if (!this.playing || !this.isConnected || !Number.isFinite(now)) {
			return
		}
		const bpm = bounded(this.options.getBpm?.(), 120, 30, 240)
		const beats =
			this.previous === undefined ? 0 : (Math.max(0, now - this.previous) * bpm) / 60
		this.previous = now
		// The host owns tempo; keep the composer's displayed and exported BPM in step with it.
		if (Math.round(bpm) !== this.tempo) {
			this.tempo = Math.round(bpm)
			this.composer?.configure({ tempo: this.tempo })
		}
		this.composer?.advance(beats)
	}

	async createGui(): Promise<HTMLElement> {
		return this.load()
	}
	async destroyGui(): Promise<void> {
		this.composer?.remove()
	}
	async disconnect(): Promise<void> {
		this.stopClock()
		await super.disconnect()
	}
	destroy(): void {
		this.stopClock()
		void this.destroyGui()
		super.destroy()
	}
}