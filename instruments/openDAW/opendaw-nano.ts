import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"
import { linearToDb } from "../../conversion/linear-to-decibels.ts"
import { dbToLinear } from "../../conversion/decibels-to-linear.ts"
import type { IAudioOutput } from "../../io/outputs/output-interface.ts"

/**
 * OpenDAW Nano Instrument
 * Nano sampler for a single audio file with pitch shifting
 */
export default class OpenDAWNano implements IAudioOutput {
	static ID: number = 0

	options = {
		// Default amplitude
		gain: 0.2, // ratio 0-1
		attack: 0.05, // in s
		decay: 0.3, // in s
		sustain: 0.0, // ratio 0-1
		release: 0.2, // in s
		minDuration: 0.1,

		arpeggioDuration: 0.2,
		slideDuration: 0.0,
		fadeDuration: 0.1,

		filterGain: 0.7,
		filterCutOff: 4000,
		filterOverdrive: 1.5,
		filterResonance: 1.2,

		filterAttack: 0.05,
		filterDecay: 0.1,
		filterSustain: 0.0,
		filterRelease: 0.1,

		reuseOscillators: true,

		// OpenDAW Nano specific
		sampleUrl: "", // URL to the audio sample
		baseNote: 60 // MIDI note for sample playback
	}

	#id = "OpenDAWNano"
	#uuid = this.#id + "-" + OpenDAWNano.ID++

	activeNotes = new Map() // Map of note numbers to their trigger times
	#sampler: any // Reference to the actual OpenDAW Nano instance
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
		return "OpenDAW Nano"
	}

	get description(): string {
		return "Nano sampler for a single audio file with pitch shifting using OpenDAW"
	}

	get isConnected(): boolean {
		return this.#sampler !== null && this.#sampler !== undefined
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
		if (this.#sampler) {
			this.#sampler.volume.value = dbToLinear(value)
		}
	}

	get volume() {
		return this.#sampler?.volume.value ?? 0
	}

	set volume(value) {
		if (this.#sampler) {
			const dbValue = linearToDb(value)
			this.#sampler.volume.rampTo(dbValue, this.options.fadeDuration)
		}
	}

	get output() {
		return this.#sampler
	}

	get audioContext(): BaseAudioContext {
		return this.#audioContext
	}

	get title() {
		return this.options.title ?? "OpenDAW Nano"
	}

	constructor(audioContext: BaseAudioContext, options = {}) {
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)

		// Initialize OpenDAW Nano
		this.#sampler = this.createNanoInstance()
	}

	/**
	 * Create a Nano instance from OpenDAW
	 */
	private createNanoInstance(): any {
		// Placeholder for actual OpenDAW Nano instantiation
		return {
			volume: { value: dbToLinear(this.options.gain), rampTo: () => {} },
			triggerAttack: () => {},
			triggerRelease: () => {},
			setPitch: () => {},
			setSample: () => {},
			dispose: () => {}
		}
	}



	/**
	 * Calculate pitch ratio relative to base note
	 */
	private calculatePitchRatio(noteNumber: number): number {
		const semitones = noteNumber - this.options.baseNote
		return Math.pow(2, semitones / 12)
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
	 * Note ON - Plays sample with pitch shifting
	 * @param {Number} noteNumber - MIDI note number
	 * @param {Number} velocity - strength of the note (0-1)
	 * @param {Array<Number>} arp - intervals (currently unused)
	 * @param {Number} delay - number to pause before playing
	 */
	noteOn(noteNumber: number, velocity: number = 1, arp = null, delay: number = 0) {
		const amplitude = Math.max(0.001, velocity * this.options.gain)
		const pitchRatio = this.calculatePitchRatio(noteNumber)

		// Track the note
		if (!this.activeNotes.has(noteNumber)) {
			this.activeNotes.set(noteNumber, this.now)
		}

		try {
			this.#sampler.setPitch(pitchRatio)
			this.#sampler.triggerAttack("+0.1")
		} catch (e) {
			console.error("Failed to trigger Nano attack:", e)
		}

		return this
	}

	/**
	 * Note OFF - Release the sample
	 * @param {Number} noteNumber - MIDI note number
	 */
	noteOff(noteNumber: number) {
		if (!this.activeNotes.has(noteNumber)) {
			console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
			return
		}

		this.activeNotes.delete(noteNumber)

		try {
			this.#sampler.triggerRelease("+0.1")
		} catch (e) {
			console.error("Failed to trigger Nano release:", e)
		}

		return this
	}

	/**
	 * Stop all notes on this instrument
	 */
	allNotesOff() {
		if (this.isNoteDown) {
			try {
				for (const noteNumber of this.activeNotes.keys()) {
					this.noteOff(noteNumber)
				}
				this.activeNotes.clear()
			} catch (e) {
				console.error("Failed to stop Nano:", e)
			}
		}
	}

	/**
	 * Set the sample URL
	 * @param {String} url - URL to the audio sample
	 */
	setSampleUrl(url: string) {
		this.options.sampleUrl = url
		if (this.#sampler && this.#sampler.setSample) {
			this.#sampler.setSample(url)
		}
	}

	/**
	 * Set the base note for pitch calculation
	 * @param {Number} noteNumber - MIDI note number
	 */
	setBaseNote(noteNumber: number) {
		this.options.baseNote = noteNumber
	}

	/**
	 * Clean up resources
	 */
	dispose() {
		if (this.#sampler) {
			this.#sampler.dispose()
			this.#sampler = null
		}
	}
}
