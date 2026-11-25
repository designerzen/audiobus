import NoteInput from "./note-input"
import { bounded, changed } from "../device-controls"
import type { AudioBusComposer } from "audiobus-input-composer/component"
import { COMPOSER_CONTROL_CHANGE } from "audiobus-input-composer"
import { EVENT_ERROR } from "../../events/event-constants"

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
	private destroyed = false
	private listeners = new AbortController()

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
		if (this.destroyed) {
			return Promise.reject(new Error("Composer input has been destroyed"))
		}
		return (this.loading ??= (async () => {
			await import("audiobus-input-composer/component")
			if (this.destroyed) {
				throw new Error("Composer input has been destroyed")
			}
			const element = document.createElement("audiobus-composer") as AudioBusComposer
			element.hostClock = true
			element.setOutput({ label: "Graph chain", send: (bytes) => this.receive(bytes) })
			element.configure({ ...this.options.composer, tempo: this.hostTempo() })
			this.options.composer = element.options
			// Persist the selected emotion, energy and the rest with the chain, as other inputs do.
			element.addEventListener(
				COMPOSER_CONTROL_CHANGE,
				() => {
					this.options.composer = element.options
					changed(this)
				},
				{ signal: this.listeners.signal }
			)
			return (this.composer = element)
		})().catch((error) => {
			this.loading = undefined
			throw error
		}))
	}

	private hostTempo(): number {
		return Math.round(bounded(this.options.getBpm?.(), 120, 30, 240))
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
		if (this.destroyed || !this.isConnected) {
			return
		}
		this.playing = true
		const generation = this.generation
		void this.load()
			.then((composer) => {
				if (this.playing && generation === this.generation) {
					composer.configure({ tempo: this.hostTempo() })
					void composer.start()
				}
			})
			.catch((error) => {
				if (this.destroyed || generation !== this.generation) {
					return
				}
				this.stopClock()
				this.setAsDisconnected()
				this.dispatchEvent(new CustomEvent(EVENT_ERROR, { detail: error }))
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
		const bpm = this.hostTempo()
		const beats = this.previous === undefined ? 0 : ((now - this.previous) * bpm) / 60
		this.previous = now
		// A seek or long clock stall releases the current phrase; restarting transport rejoins cleanly.
		if (beats < 0 || beats > 4) {
			this.stopClock()
			return
		}
		// The host owns tempo; keep the composer's displayed and exported BPM in step with it.
		if (this.composer && this.composer.options.tempo !== bpm) {
			this.composer.configure({ tempo: bpm })
		}
		this.composer?.advance(beats)
	}

	async createGui(): Promise<AudioBusComposer> {
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
		if (this.destroyed) {
			return
		}
		this.destroyed = true
		this.stopClock()
		this.listeners.abort()
		void this.destroyGui()
		super.destroy()
	}
}