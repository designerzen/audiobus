import { Sampler } from "tone"
import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"
import type { IAudioOutput } from "../../io/outputs/output-interface.ts"

/**
 * Tone.js Sampler Instrument
 * Sample-based playback with pitch shifting capability
 */
export default class ToneSampler implements IAudioOutput {
	static ID: number = 0

	options = {
		// Default amplitude
		gain: 0.2, // ratio 0-1
		attack: 0.1, // in s
		decay: 0.5, // in s
		sustain: 0.0, // ratio 0-1
		release: 0.3, // in s
		minDuration: 0.6,

		arpeggioDuration: 0.2,
		slideDuration: 0.0,
		fadeDuration: 0.2,

		filterGain: 0.7,
		filterCutOff: 2200,
		filterOverdrive: 2.5,
		filterResonance: 1.8,

		filterAttack: 0.2,
		filterDecay: 0.08,
		filterSustain: 0.8,
		filterRelease: 0.2,

		reuseOscillators: true,

		// Tone.js Sampler specific
		urls: {
			C4: "path/to/sample-C4.wav",
			D4: "path/to/sample-D4.wav",
			E4: "path/to/sample-E4.wav",
			F4: "path/to/sample-F4.wav",
			G4: "path/to/sample-G4.wav",
			A4: "path/to/sample-A4.wav",
			B4: "path/to/sample-B4.wav"
		},
		baseUrl: "./samples/"
	}

	#id = "ToneSampler"
	#uuid = this.#id + "-" + ToneSampler.ID++

	activeNotes = new Map() // Map of note numbers to their trigger times
	#sampler: Sampler
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
		return "Tone.js Sampler"
	}

	get description(): string {
		return "Sample-based synthesizer with pitch shifting using Tone.js"
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
			this.#sampler.volume.value = this.dbToLinear(value)
		}
	}

	get volume() {
		return this.#sampler?.volume.value ?? 0
	}

	set volume(value) {
		if (this.#sampler) {
			const dbValue = this.linearToDb(value)
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
		return this.options.title ?? "Tone.js Sampler"
	}

	constructor(audioContext: BaseAudioContext, options = {}) {
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)

		// Initialize Tone.js Sampler
		this.#sampler = new Sampler({
			urls: this.options.urls,
			baseUrl: this.options.baseUrl,
			volume: this.dbToLinear(this.options.gain)
		}).toDestination()
	}

	/**
	 * Convert linear (0-1) to dB
	 */
	private linearToDb(value: number): number {
		if (value <= 0) return -Infinity
		return 20 * Math.log10(value)
	}

	/**
	 * Convert dB to linear (0-1)
	 */
	private dbToLinear(value: number): number {
		if (value <= 0) return 0
		return Math.pow(10, value / 20)
	}

	/**
	 * Convert MIDI note number to note name (e.g., 60 -> "C4")
	 */
	private noteNumberToNoteName(noteNumber: number): string {
		const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
		const octave = Math.floor(noteNumber / 12) - 1
		const noteIndex = noteNumber % 12
		return notes[noteIndex] + octave
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
	 * Note ON
	 * @param {Number} noteNumber - MIDI note number
	 * @param {Number} velocity - strength of the note (0-1)
	 * @param {Array<Number>} arp - intervals (currently unused)
	 * @param {Number} delay - number to pause before playing
	 */
	noteOn(noteNumber: number, velocity: number = 1, arp = null, delay: number = 0) {
		const noteName = this.noteNumberToNoteName(noteNumber)
		const amplitude = Math.max(0.001, velocity * this.options.gain)

		// Track the note
		if (!this.activeNotes.has(noteNumber)) {
			this.activeNotes.set(noteNumber, this.now)
		}

		try {
			this.#sampler.triggerAttack(noteName, "+0.1")
		} catch (e) {
			console.error("Failed to trigger sampler attack:", e)
		}

		return this
	}

	/**
	 * Note OFF
	 * @param {Number} noteNumber - MIDI note number
	 */
	noteOff(noteNumber: number) {
		if (!this.activeNotes.has(noteNumber)) {
			console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
			return
		}

		const noteName = this.noteNumberToNoteName(noteNumber)
		this.activeNotes.delete(noteNumber)

		try {
			this.#sampler.triggerRelease(noteName, "+0.1")
		} catch (e) {
			console.error("Failed to trigger sampler release:", e)
		}

		return this
	}

	/**
	 * Stop all notes on this instrument
	 */
	allNotesOff() {
		if (this.isNoteDown) {
			try {
				// Release all active notes
				for (const noteNumber of this.activeNotes.keys()) {
					const noteName = this.noteNumberToNoteName(noteNumber)
					this.#sampler.triggerRelease(noteName)
				}
				this.activeNotes.clear()
			} catch (e) {
				console.error("Failed to stop sampler:", e)
			}
		}
	}

	/**
	 * Set the sample URLs for the sampler
	 * @param {Object} urls - Map of note names to sample URLs
	 */
	setSampleUrls(urls: Record<string, string>) {
		this.options.urls = urls
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
