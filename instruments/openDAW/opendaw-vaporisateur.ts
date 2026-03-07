import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"
import { linearToDb } from "../../conversion/linear-to-decibels.ts"
import { dbToLinear } from "../../conversion/decibels-to-linear.ts"
import type { IAudioOutput } from "../../io/outputs/output-interface.ts"

/**
 * OpenDAW Vaporisateur Instrument
 * Subtractive synthesizer with classical waveforms
 */
export default class OpenDAWVaporisateur implements IAudioOutput {
	static ID: number = 0

	options = {
		// Default amplitude
		gain: 0.2, // ratio 0-1
		attack: 0.4, // in s
		decay: 0.9, // in s
		sustain: 0.85, // ratio 0-1
		release: 0.3, // in s
		minDuration: 0.6,

		arpeggioDuration: 0.2,
		slideDuration: 0.2, // portamento/glide time
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

		// OpenDAW Vaporisateur specific
		oscillator: {
			type: "square"
		},
		envelope: {
			attack: 0.4,
			decay: 0.9,
			sustain: 0.85,
			release: 0.3
		},
		filter: {
			Q: 6,
			type: "lowpass",
			rolloff: -24
		},
		filterEnvelope: {
			attack: 0.2,
			decay: 0.08,
			sustain: 0.8,
			release: 0.2
		}
	}

	#id = "OpenDAWVaporisateur"
	#uuid = this.#id + "-" + OpenDAWVaporisateur.ID++

	activeNote = null
	#synth: any // Reference to the actual OpenDAW Vaporisateur instance
	#audioContext: BaseAudioContext

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
		return "OpenDAW Vaporisateur"
	}

	get description(): string {
		return "Subtractive synthesizer with classical waveforms using OpenDAW"
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
			this.#synth.frequency.rampTo(value, this.options.slideDuration)
		}
	}

	get output() {
		return this.#synth
	}

	get audioContext(): BaseAudioContext {
		return this.#audioContext
	}

	get title() {
		return this.options.title ?? "OpenDAW Vaporisateur"
	}

	constructor(audioContext: BaseAudioContext, options = {}) {
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)

		// Initialize OpenDAW Vaporisateur
		// In a real implementation, this would instantiate the actual OpenDAW device
		this.#synth = this.createVaporisateurInstance()
	}

	/**
	 * Create a Vaporisateur instance from OpenDAW
	 */
	private createVaporisateurInstance(): any {
		// Placeholder for actual OpenDAW Vaporisateur instantiation
		// This would connect to the actual OpenDAW audio engine
		return {
			volume: { value: dbToLinear(this.options.gain), rampTo: () => {} },
			frequency: { value: 440, rampTo: () => {} },
			triggerAttack: () => {},
			triggerRelease: () => {},
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
	 * Note ON
	 * @param {Number} noteNumber - MIDI note number
	 * @param {Number} velocity - strength of the note (0-1)
	 * @param {Array<Number>} arp - intervals (currently unused)
	 * @param {Number} delay - number to pause before playing
	 */
	noteOn(noteNumber: number, velocity: number = 1, arp = null, delay: number = 0) {
		const frequency = noteNumberToFrequency(noteNumber)
		const startTime = this.now + delay
		const amplitude = Math.max(0.001, velocity * this.options.gain)

		this.activeNote = noteNumber

		try {
			this.frequency = frequency
			this.#synth.triggerAttack(frequency, "+0.1")
		} catch (e) {
			console.error("Failed to trigger Vaporisateur attack:", e)
		}

		return this
	}

	/**
	 * Note OFF
	 * @param {Number} noteNumber - MIDI note number
	 */
	noteOff(noteNumber: number) {
		if (!this.isNoteDown) {
			console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
			return
		}

		this.activeNote = null

		try {
			this.#synth.triggerRelease("+0.1")
		} catch (e) {
			console.error("Failed to trigger Vaporisateur release:", e)
		}

		return this
	}

	/**
	 * Stop all notes on this instrument
	 */
	allNotesOff() {
		if (this.isNoteDown) {
			try {
				this.#synth.triggerRelease()
			} catch (e) {
				console.error("Failed to stop Vaporisateur:", e)
			}
			this.activeNote = null
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
