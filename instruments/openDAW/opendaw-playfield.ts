import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"
import { linearToDb } from "../../conversion/linear-to-decibels.ts"
import { dbToLinear } from "../../conversion/decibels-to-linear.ts"
import type { IAudioOutput } from "../../io/outputs/output-interface.ts"

/**
 * OpenDAW Playfield Instrument
 * Sample drum computer with individual effect chains
 */
export default class OpenDAWPlayfield implements IAudioOutput {
	static ID: number = 0

	options = {
		// Default amplitude
		gain: 0.2, // ratio 0-1
		attack: 0.05, // in s
		decay: 0.3, // in s
		sustain: 0.0, // ratio 0-1
		release: 0.2, // in s
		minDuration: 0.1,

		arpeggioDuration: 0.1,
		slideDuration: 0.0,
		fadeDuration: 0.1,

		filterGain: 0.8,
		filterCutOff: 8000,
		filterOverdrive: 1.0,
		filterResonance: 1.0,

		filterAttack: 0.05,
		filterDecay: 0.1,
		filterSustain: 0.0,
		filterRelease: 0.1,

		reuseOscillators: true,

		// OpenDAW Playfield specific
		pads: 16, // Number of drum pads
		sampleUrls: {} // Map of pad indices to sample URLs
	}

	#id = "OpenDAWPlayfield"
	#uuid = this.#id + "-" + OpenDAWPlayfield.ID++

	activeNotes = new Map() // Map of note numbers to their trigger times
	#device: any // Reference to the actual OpenDAW Playfield instance
	#audioContext: BaseAudioContext

	get isNoteDown() {
		return this.activeNotes.size > 0
	}

	get id() {
		return this.#id
	}

	set id(value) {
		this.#id = value
	}

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "OpenDAW Playfield"
	}

	get description(): string {
		return "Sample drum computer with individual effect chains using OpenDAW"
	}

	get isConnected(): boolean {
		return this.#device !== null && this.#device !== undefined
	}

	get isHidden(): boolean {
		return false
	}

	get now() {
		return this.#audioContext.currentTime
	}

	get gain() {
		return this.options.gain
	}

	set gain(value) {
		this.options.gain = value
		if (this.#device) {
			this.#device.volume.value = dbToLinear(value)
		}
	}

	get volume() {
		return this.#device?.volume.value ?? 0
	}

	set volume(value) {
		if (this.#device) {
			const dbValue = linearToDb(value)
			this.#device.volume.rampTo(dbValue, this.options.fadeDuration)
		}
	}

	get output() {
		return this.#device
	}

	get audioContext(): BaseAudioContext {
		return this.#audioContext
	}

	get title() {
		return this.options.title ?? "OpenDAW Playfield"
	}

	constructor(audioContext: BaseAudioContext, options = {}) {
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)

		// Initialize OpenDAW Playfield
		this.#device = this.createPlayfieldInstance()
	}

	/**
	 * Create a Playfield instance from OpenDAW
	 */
	private createPlayfieldInstance(): any {
		// Placeholder for actual OpenDAW Playfield instantiation
		return {
			volume: { value: dbToLinear(this.options.gain), rampTo: () => {} },
			triggerPad: () => {},
			dispose: () => {}
		}
	}



	/**
	 * Convert MIDI note to pad index (0-15 for 16 pads)
	 */
	private noteToPadIndex(noteNumber: number): number {
		// Maps MIDI notes to drum pad indices
		// C1-C2 (36-48) maps to pads 0-15
		const padIndex = (noteNumber - 36) % this.options.pads
		return Math.max(0, Math.min(padIndex, this.options.pads - 1))
	}

	hasMidiOutput(): boolean {
		return false
	}

	hasAudioOutput(): boolean {
		return true
	}

	hasAutomationOutput(): boolean {
		return false
	}

	hasMpeOutput(): boolean {
		return false
	}

	hasOscOutput(): boolean {
		return false
	}

	hasSysexOutput(): boolean {
		return false
	}

	/**
	 * Note ON - Triggers a drum pad
	 * @param {Number} noteNumber - MIDI note number
	 * @param {Number} velocity - strength of the note (0-1)
	 * @param {Array<Number>} arp - intervals (currently unused)
	 * @param {Number} delay - number to pause before playing
	 */
	noteOn(noteNumber: number, velocity: number = 1, arp = null, delay: number = 0) {
		const padIndex = this.noteToPadIndex(noteNumber)
		const amplitude = Math.max(0.001, velocity * this.options.gain)

		// Track the note
		if (!this.activeNotes.has(noteNumber)) {
			this.activeNotes.set(noteNumber, this.now)
		}

		try {
			this.#device.triggerPad(padIndex, amplitude)
		} catch (e) {
			console.error("Failed to trigger Playfield pad:", e)
		}

		return this
	}

	/**
	 * Note OFF - Playfield pads typically don't have a release
	 * @param {Number} noteNumber - MIDI note number
	 */
	noteOff(noteNumber: number) {
		if (!this.activeNotes.has(noteNumber)) {
			console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
			return
		}

		this.activeNotes.delete(noteNumber)

		return this
	}

	/**
	 * Stop all notes on this instrument
	 */
	allNotesOff() {
		if (this.isNoteDown) {
			try {
				this.activeNotes.clear()
			} catch (e) {
				console.error("Failed to stop Playfield:", e)
			}
		}
	}

	/**
	 * Set the sample URL for a specific pad
	 * @param {Number} padIndex - Pad index (0-15)
	 * @param {String} url - URL to the audio sample
	 */
	setPadSample(padIndex: number, url: string) {
		if (padIndex >= 0 && padIndex < this.options.pads) {
			this.options.sampleUrls[padIndex] = url
			if (this.#device && this.#device.setSample) {
				this.#device.setSample(padIndex, url)
			}
		}
	}

	/**
	 * Clean up resources
	 */
	dispose() {
		if (this.#device) {
			this.#device.dispose()
			this.#device = null
		}
	}
}
