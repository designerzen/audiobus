import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"
import type { IAudioOutput } from "../../io/outputs/output-interface.ts"
import { dbToLinear } from "../../conversion/decibels-to-linear.ts"
import { linearToDb } from "../../conversion/linear-to-decibels.ts"

/**
 * Tone.js PluckString Instrument
 * Physical model of a plucked string using Karplus-Strong algorithm
 * Lazy loads Tone.js library only when instantiated
 */
export default class TonePluckString implements IAudioOutput {
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

		// Tone.js PluckString specific
		dampening: 0.4 // controls decay of plucked string
	}

	#id = "TonePluckString"
	#uuid = this.#id + "-" + TonePluckString.ID++

	activeNote = null
	#synth: any
	#audioContext: BaseAudioContext
	#initialized = false

	get isNoteDown() {
		return this.activeNote !== null
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
		return "Tone.js Pluck String"
	}

	get description(): string {
		return "Plucked string synthesizer using Karplus-Strong algorithm"
	}

	get isConnected(): boolean {
		return this.#synth !== null && this.#synth !== undefined
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
		if (this.#synth) {
			this.#synth.volume.value = dbToLinear(value)
		}
	}

	get volume() {
		return this.#synth?.volume.value ?? 0
	}

	set volume(value) {
		if (this.#synth) {
			const dbValue = linearToDb(value)
			this.#synth.volume.rampTo(dbValue, this.options.fadeDuration)
		}
	}

	get frequency() {
		return this.#synth?.frequency.value ?? 440
	}

	set frequency(value: number) {
		if (this.#synth && Number.isFinite(value)) {
			this.#synth.frequency.value = value
		}
	}

	get output() {
		return this.#synth
	}

	get audioContext(): BaseAudioContext {
		return this.#audioContext
	}

	get title() {
		return this.options.title ?? "Tone.js Pluck String"
	}

	constructor(audioContext: BaseAudioContext, options = {}) {
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)
		// Lazy initialization - Tone.js will be loaded on first use
	}

	private async ensureInitialized() {
		if (this.#initialized) return
		
		const { PluckSynth } = await import("tone")
		
		// Initialize Tone.js PluckString
		this.#synth = new PluckSynth({
			dampening: this.options.dampening,
			volume: dbToLinear(this.options.gain)
		}).toDestination()
		
		this.#initialized = true
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
	 * Note ON - Plucks the string
	 * @param {Number} noteNumber - MIDI note number
	 * @param {Number} velocity - strength of the pluck (0-1)
	 * @param {Array<Number>} arp - intervals (currently unused)
	 * @param {Number} delay - number to pause before playing
	 */
	async noteOn(noteNumber: number, velocity: number = 1, arp = null, delay: number = 0) {
		await this.ensureInitialized()
		
		const frequency = noteNumberToFrequency(noteNumber)
		const amplitude = Math.max(0.001, velocity * this.options.gain)

		this.activeNote = noteNumber

		try {
			this.frequency = frequency
			// PluckString uses triggerAttack to pluck the string
			this.#synth.triggerAttack(frequency, "+0.1")
		} catch (e) {
			console.error("Failed to pluck string:", e)
		}

		return this
	}

	/**
	 * Note OFF - Let the pluck decay naturally
	 * PluckString doesn't have a traditional release, so this marks note as released
	 * @param {Number} noteNumber - MIDI note number
	 */
	noteOff(noteNumber: number) {
		if (!this.isNoteDown) {
			console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
			return
		}

		this.activeNote = null

		return this
	}

	/**
	 * Stop all notes on this instrument
	 */
	allNotesOff() {
		if (this.isNoteDown) {
			try {
				// PluckString doesn't have triggerRelease, so we just mark as done
				this.activeNote = null
			} catch (e) {
				console.error("Failed to stop pluck string:", e)
			}
		}
	}

	/**
	 * Clean up resources
	 */
	dispose() {
		if (this.#synth) {
			this.#synth.dispose()
			this.#synth = null
		}
	}
}
