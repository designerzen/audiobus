import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"
import { linearToDb } from "../../conversion/linear-to-decibels.ts"
import { dbToLinear } from "../../conversion/decibels-to-linear.ts"
import type { IAudioOutput } from "../../io/outputs/output-interface.ts"

/**
 * OpenDAW Tape Instrument
 * Playback device for audio regions and clips
 */
export default class OpenDAWTape implements IAudioOutput {
	static ID: number = 0

	options = {
		// Default amplitude
		gain: 0.2, // ratio 0-1
		attack: 0.01, // in s
		decay: 0.0, // in s
		sustain: 1.0, // ratio 0-1
		release: 0.1, // in s
		minDuration: 0.1,

		arpeggioDuration: 0.0,
		slideDuration: 0.0,
		fadeDuration: 0.1,

		filterGain: 0.7,
		filterCutOff: 10000,
		filterOverdrive: 1.0,
		filterResonance: 1.0,

		filterAttack: 0.0,
		filterDecay: 0.0,
		filterSustain: 1.0,
		filterRelease: 0.0,

		reuseOscillators: true,

		// OpenDAW Tape specific
		audioBuffer: null, // The audio buffer to play
		playbackRate: 1.0, // Playback speed (1.0 = normal)
		looping: false // Whether to loop the playback
	}

	#id = "OpenDAWTape"
	#uuid = this.#id + "-" + OpenDAWTape.ID++

	activeNotes = new Map() // Map of note numbers to their trigger times
	#device: any // Reference to the actual OpenDAW Tape instance
	#audioContext: BaseAudioContext
	#audioBuffer: AudioBuffer | null = null

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
		return "OpenDAW Tape"
	}

	get description(): string {
		return "Playback device for audio regions and clips using OpenDAW"
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
		return this.options.title ?? "OpenDAW Tape"
	}

	constructor(audioContext: BaseAudioContext, options = {}) {
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)

		// Initialize OpenDAW Tape
		this.#device = this.createTapeInstance()
	}

	/**
	 * Create a Tape instance from OpenDAW
	 */
	private createTapeInstance(): any {
		// Placeholder for actual OpenDAW Tape instantiation
		return {
			volume: { value: dbToLinear(this.options.gain), rampTo: () => {} },
			play: () => {},
			stop: () => {},
			pause: () => {},
			setPlaybackRate: () => {},
			setAudioBuffer: () => {},
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
	 * Note ON - Plays the tape from the beginning
	 * @param {Number} noteNumber - MIDI note number
	 * @param {Number} velocity - strength of the note (0-1)
	 * @param {Array<Number>} arp - intervals (currently unused)
	 * @param {Number} delay - number to pause before playing
	 */
	noteOn(noteNumber: number, velocity: number = 1, arp = null, delay: number = 0) {
		// Tape playback is velocity-insensitive in most cases
		// Track the note
		if (!this.activeNotes.has(noteNumber)) {
			this.activeNotes.set(noteNumber, this.now)
		}

		try {
			this.#device.play()
		} catch (e) {
			console.error("Failed to play tape:", e)
		}

		return this
	}

	/**
	 * Note OFF - Stops the tape
	 * @param {Number} noteNumber - MIDI note number
	 */
	noteOff(noteNumber: number) {
		if (!this.activeNotes.has(noteNumber)) {
			console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
			return
		}

		this.activeNotes.delete(noteNumber)

		try {
			this.#device.stop()
		} catch (e) {
			console.error("Failed to stop tape:", e)
		}

		return this
	}

	/**
	 * Stop all notes on this instrument
	 */
	allNotesOff() {
		if (this.isNoteDown) {
			try {
				this.#device.stop()
				this.activeNotes.clear()
			} catch (e) {
				console.error("Failed to stop tape:", e)
			}
		}
	}

	/**
	 * Set the audio buffer for playback
	 * @param {AudioBuffer} buffer - The audio buffer to play
	 */
	setAudioBuffer(buffer: AudioBuffer) {
		this.#audioBuffer = buffer
		this.options.audioBuffer = buffer
		if (this.#device && this.#device.setAudioBuffer) {
			this.#device.setAudioBuffer(buffer)
		}
	}

	/**
	 * Load audio from a URL
	 * @param {String} url - URL to the audio file
	 */
	async loadAudio(url: string): Promise<void> {
		try {
			const response = await fetch(url)
			const arrayBuffer = await response.arrayBuffer()
			const audioBuffer = await this.#audioContext.decodeAudioData(arrayBuffer)
			this.setAudioBuffer(audioBuffer)
		} catch (e) {
			console.error("Failed to load audio:", e)
		}
	}

	/**
	 * Set the playback rate
	 * @param {Number} rate - Playback rate (1.0 = normal speed)
	 */
	setPlaybackRate(rate: number) {
		this.options.playbackRate = rate
		if (this.#device && this.#device.setPlaybackRate) {
			this.#device.setPlaybackRate(rate)
		}
	}

	/**
	 * Toggle looping
	 * @param {Boolean} shouldLoop - Whether to loop playback
	 */
	setLooping(shouldLoop: boolean) {
		this.options.looping = shouldLoop
		if (this.#device && this.#device.setLooping) {
			this.#device.setLooping(shouldLoop)
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
		this.#audioBuffer = null
	}
}
