import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"
import { linearToDb } from "../../conversion/linear-to-decibels.ts"
import { dbToLinear } from "../../conversion/decibels-to-linear.ts"
import type { IAudioOutput } from "../../io/outputs/output-interface.ts"

/**
 * OpenDAW Soundfont Instrument
 * Soundfont player for loading and playing SF2 files
 */
export default class OpenDAWSoundfont implements IAudioOutput {
	static ID: number = 0

	options = {
		// Default amplitude
		gain: 0.2, // ratio 0-1
		attack: 0.05, // in s
		decay: 0.3, // in s
		sustain: 0.5, // ratio 0-1
		release: 0.3, // in s
		minDuration: 0.1,

		arpeggioDuration: 0.2,
		slideDuration: 0.0,
		fadeDuration: 0.2,

		filterGain: 0.7,
		filterCutOff: 5000,
		filterOverdrive: 1.0,
		filterResonance: 1.0,

		filterAttack: 0.05,
		filterDecay: 0.15,
		filterSustain: 0.5,
		filterRelease: 0.2,

		reuseOscillators: true,

		// OpenDAW Soundfont specific
		soundfontUrl: "", // URL to the SF2 file
		program: 0, // MIDI program (instrument)
		bank: 0 // MIDI bank
	}

	#id = "OpenDAWSoundfont"
	#uuid = this.#id + "-" + OpenDAWSoundfont.ID++

	activeNotes = new Map() // Map of note numbers to their trigger times
	#player: any // Reference to the actual OpenDAW Soundfont instance
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
		return "OpenDAW Soundfont"
	}

	get description(): string {
		return "Soundfont player for loading and playing SF2 files using OpenDAW"
	}

	get isConnected(): boolean {
		return this.#player !== null && this.#player !== undefined
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
		if (this.#player) {
			this.#player.volume.value = dbToLinear(value)
		}
	}

	get volume() {
		return this.#player?.volume.value ?? 0
	}

	set volume(value) {
		if (this.#player) {
			const dbValue = linearToDb(value)
			this.#player.volume.rampTo(dbValue, this.options.fadeDuration)
		}
	}

	get output() {
		return this.#player
	}

	get audioContext(): BaseAudioContext {
		return this.#audioContext
	}

	get title() {
		return this.options.title ?? "OpenDAW Soundfont"
	}

	constructor(audioContext: BaseAudioContext, options = {}) {
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)

		// Initialize OpenDAW Soundfont player
		this.#player = this.createSoundfontInstance()
	}

	/**
	 * Create a Soundfont instance from OpenDAW
	 */
	private createSoundfontInstance(): any {
		// Placeholder for actual OpenDAW Soundfont instantiation
		return {
			volume: { value: dbToLinear(this.options.gain), rampTo: () => {} },
			triggerAttack: () => {},
			triggerRelease: () => {},
			setProgram: () => {},
			setBank: () => {},
			loadSoundfont: () => {},
			dispose: () => {}
		}
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
	 * Note ON - Triggers a note on the soundfont
	 * @param {Number} noteNumber - MIDI note number
	 * @param {Number} velocity - strength of the note (0-1)
	 * @param {Array<Number>} arp - intervals (currently unused)
	 * @param {Number} delay - number to pause before playing
	 */
	noteOn(noteNumber: number, velocity: number = 1, arp = null, delay: number = 0) {
		const frequency = noteNumberToFrequency(noteNumber)
		const amplitude = Math.max(0.001, velocity * this.options.gain)

		// Track the note
		if (!this.activeNotes.has(noteNumber)) {
			this.activeNotes.set(noteNumber, this.now)
		}

		try {
			this.#player.triggerAttack(noteNumber, amplitude, "+0.1")
		} catch (e) {
			console.error("Failed to trigger Soundfont attack:", e)
		}

		return this
	}

	/**
	 * Note OFF - Release the note
	 * @param {Number} noteNumber - MIDI note number
	 */
	noteOff(noteNumber: number) {
		if (!this.activeNotes.has(noteNumber)) {
			console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
			return
		}

		this.activeNotes.delete(noteNumber)

		try {
			this.#player.triggerRelease(noteNumber, "+0.1")
		} catch (e) {
			console.error("Failed to trigger Soundfont release:", e)
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
				console.error("Failed to stop Soundfont:", e)
			}
		}
	}

	/**
	 * Load a soundfont file
	 * @param {String} url - URL to the SF2 file
	 */
	async loadSoundfont(url: string): Promise<void> {
		this.options.soundfontUrl = url
		if (this.#player && this.#player.loadSoundfont) {
			try {
				await this.#player.loadSoundfont(url)
			} catch (e) {
				console.error("Failed to load soundfont:", e)
			}
		}
	}

	/**
	 * Set the MIDI program (instrument)
	 * @param {Number} program - MIDI program number (0-127)
	 */
	setProgram(program: number) {
		this.options.program = Math.max(0, Math.min(program, 127))
		if (this.#player && this.#player.setProgram) {
			this.#player.setProgram(this.options.program)
		}
	}

	/**
	 * Set the MIDI bank
	 * @param {Number} bank - MIDI bank number (0-16383)
	 */
	setBank(bank: number) {
		this.options.bank = Math.max(0, Math.min(bank, 16383))
		if (this.#player && this.#player.setBank) {
			this.#player.setBank(this.options.bank)
		}
	}

	/**
	 * Clean up resources
	 */
	dispose() {
		if (this.#player) {
			this.#player.dispose()
			this.#player = null
		}
	}
}
