/**
 * Lets you play many synths at once.
 * Can be of any instrument but defaults
 * to the single oscillator
 */
import type { IAudioOutput } from "../io/outputs/output-interface.ts"
import type SynthOscillator from "./oscillators/synth-oscillator.ts"
import { EVENT_CONFIGURATION_CHANGED } from "../event-constants.ts"
import {
	POLYSYNTH_DEFAULTS,
	POLYSYNTH_PARAMETERS,
	POLYSYNTH_WAVEFORMS,
	type PolySynthSettings
} from "./polyphonic-settings.ts"
import { createPolySynthGui } from "./polyphonic-gui.ts"

export default class PolySynth extends EventTarget implements IAudioOutput {
	static ID = 0

	options = {
		...POLYSYNTH_DEFAULTS,
		maxPolyphony: 24,
		class: null as any
	}

	instruments: SynthOscillator[] = []
	instrumentActivity = new Map()

	#gainNode: GainNode
	#voiceMix: GainNode
	#limiter: WaveShaperNode
	#audioContext: AudioContext
	#activeVoices = 0
	get activeVoices(): number {
		return this.#activeVoices
	}
	#gui?: ReturnType<typeof createPolySynthGui>

	#uuid: string = "polyphonic-" + PolySynth.ID++

	InstrumentClass

	get output(): AudioNode {
		return this.#gainNode
	}

	get name(): string {
		return "PolySynth"
	}

	get uuid(): string {
		return this.#uuid
	}

	get description(): string {
		return "A polyphonic synthesizer that can play many notes at once."
	}

	get isConnected(): boolean {
		return this.instruments.length > 0
	}

	get isHidden(): boolean {
		return false
	}

	async #initializeDefaults() {
		if (this.InstrumentClass === undefined || this.InstrumentClass === null) {
			const { default: SynthOscillator } = await import("./oscillators/synth-oscillator.ts")
			this.InstrumentClass = this.options.class || SynthOscillator
		}
	}

	constructor(audioContext: AudioContext, options = {}) {
		super()
		this.#audioContext = audioContext
		this.options = Object.assign({}, this.options, options)

		this.InstrumentClass = this.options.class
		this.#gainNode = audioContext.createGain()
		this.#voiceMix = audioContext.createGain()
		// Leave single voices at their native level. Bound the summed signal
		// instead of attenuating every note for an entirely full voice pool.
		const range = Math.max(1, this.options.maxPolyphony)
		this.#voiceMix.gain.value = 1 / range
		this.#limiter = audioContext.createWaveShaper()
		const curve = new Float32Array(65537)
		for (let i = 0; i < curve.length; i++) {
			const input = ((2 * i) / (curve.length - 1) - 1) * range
			curve[i] = 0.9 * Math.tanh(input / 0.9)
		}
		this.#limiter.curve = curve
		this.#limiter.oversample = "4x"
		this.#voiceMix.connect(this.#limiter)
		this.#limiter.connect(this.#gainNode)
		this.updateMasterGain()
		this.#initializeDefaults().then(() => {
			this.factory(this.InstrumentClass, this.options.maxPolyphony)
		})
	}

	/**
	 *
	 * @param {Class} InstrumentClass
	 * @param {Number} quantity
	 */
	factory(InstrumentClass: typeof SynthOscillator, quantity: number) {
		for (let i = 0; i < quantity; ++i) {
			const instrument = new InstrumentClass(this.#audioContext, {
				...this.options,
				title: "osc-0" + i
			})
			this.instruments.push(instrument)
			instrument.output.connect(this.#voiceMix)
		}
	}

	/**
	 * Note ON
	 * @param {Number} noteNumber - Model data
	 * @param {Number} velocity - strength of the note
	 * @param {Array<Number>} arp - intervals
	 * @param {Number} delay - number to pause before playing
	 */
	async noteOn(noteNumber: number, velocity = 127, arp = null, delay = 0) {
		if (this.instrumentActivity.has(noteNumber)) {
			// already playing!
		} else {
			for (const instrument of this.instruments) {
				if (!instrument.isNoteDown) {
					await instrument.noteOn(noteNumber, velocity, arp, delay)
					this.instrumentActivity.set(noteNumber, instrument)
					this.#activeVoices++
					this.updateMasterGain()
					break
				}
			}

			return this.instrumentActivity.get(noteNumber)
		}
		return null
	}

	/**
	 * Note OFF
	 * This starts the process of stopping the note
	 * by creating a smooth transition to silence from
	 * the current amplitude via release time.
	 * @param {Number} noteNumber - Model data
	 * @returns
	 */
	noteOff(noteNumber: number) {
		const instrument = this.instrumentActivity.get(noteNumber)
		if (instrument) {
			instrument.noteOff(noteNumber)
			this.instrumentActivity.delete(noteNumber)
			this.#activeVoices--
			this.updateMasterGain()
		}
		return instrument
	}

	/**
	 * Stop all notes on all instruments
	 */
	allNotesOff() {
		this.instrumentActivity.forEach((instrument) => instrument.allNotesOff())
		this.instrumentActivity.clear()
		this.#activeVoices = 0
		this.updateMasterGain()
		// If the synth has an all notes off method, use it
		// Otherwise, iterate through all possible notes
		// for (let noteNumber = 0; noteNumber < 128; noteNumber++)
		// {
		//     synth.noteOff(noteNumber)
		// }
	}

	/**
	 * Volume stays independent of held notes and their release tails. The
	 * saturator before this node reserves headroom for dense chords.
	 */
	updateMasterGain() {
		this.#gainNode.gain.value = this.options.volume
	}

	configure(settings: Partial<PolySynthSettings>): void {
		let changed = false
		for (const key of Object.keys(settings) as (keyof PolySynthSettings)[]) {
			const value = settings[key]
			if (key === "shape") {
				if (
					!POLYSYNTH_WAVEFORMS.includes(value as PolySynthSettings["shape"]) ||
					value === this.options.shape
				) {
					continue
				}
				this.options.shape = value as PolySynthSettings["shape"]
				for (const instrument of this.instruments) {
					instrument.shape = this.options.shape
				}
			} else {
				const parameter = POLYSYNTH_PARAMETERS[key]
				if (!parameter || typeof value !== "number" || !Number.isFinite(value)) {
					continue
				}
				const bounded = Math.min(parameter.max, Math.max(parameter.min, value))
				if (bounded === this.options[key]) {
					continue
				}
				this.options[key] = bounded
				if (key === "volume") {
					this.updateMasterGain()
				} else {
					for (const instrument of this.instruments) {
						instrument.options[key] = bounded
						if (key === "filterCutOff") {
							instrument.filterCutOff = bounded
						}
						if (key === "filterResonance") {
							instrument.Q = bounded
						}
					}
				}
			}
			changed = true
		}
		if (changed) {
			this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
		}
	}

	async createGui(): Promise<HTMLElement> {
		this.#gui ??= createPolySynthGui(this)
		return this.#gui.element
	}

	async destroyGui(): Promise<void> {
		this.#gui?.dispose()
		this.#gui = undefined
	}

	/**
	 * Set a random oscillator timbre from the collection
	 */
	async setRandomTimbre() {
		this.configure({
			shape: POLYSYNTH_WAVEFORMS[Math.floor(Math.random() * POLYSYNTH_WAVEFORMS.length)]
		})
	}
}