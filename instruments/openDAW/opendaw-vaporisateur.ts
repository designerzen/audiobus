import type { IAudioOutput } from "../../io/outputs/output-interface.ts"
import { velocityToGain } from "../../conversion/velocity-to-gain.ts"
import { createVaporisateurEngine, type VaporisateurEngine } from "./vaporisateur-engine.ts"

export interface VaporisateurOptions {
	title?: string
	gain?: number
	attack?: number
	decay?: number
	sustain?: number
	release?: number
	filterCutOff?: number
	filterResonance?: number
	slideDuration?: number
	fadeDuration?: number
	oscillator?: { type: "sine" | "triangle" | "sawtooth" | "square" }
}

/** OpenDAW's polyphonic subtractive synth, routed through Harmoneasy's mixer. */
export default class OpenDAWVaporisateur implements IAudioOutput {
	static ID = 0
	readonly uuid = `OpenDAWVaporisateur-${OpenDAWVaporisateur.ID++}`
	readonly options: Required<Omit<VaporisateurOptions, "title">> &
		Pick<VaporisateurOptions, "title">
	readonly output: GainNode
	readonly requiresConnectionControl = false
	readonly activeNotes = new Set<number>()
	#engine: VaporisateurEngine | null = null
	#connecting: Promise<void> | null = null
	#generation = 0
	#timers = new Map<number, ReturnType<typeof setTimeout>>()

	constructor(
		readonly audioContext: BaseAudioContext,
		options: VaporisateurOptions = {}
	) {
		this.options = {
			gain: 0.2,
			attack: 0.005,
			decay: 0.1,
			sustain: 0.5,
			release: 0.5,
			filterCutOff: 8000,
			filterResonance: 0.1,
			slideDuration: 0,
			fadeDuration: 0.02,
			oscillator: { type: "sawtooth" },
			...options
		}
		this.output = audioContext.createGain()
		this.output.gain.value = this.options.gain
	}

	get name() {
		return "OpenDAW Vaporisateur"
	}
	get title() {
		return this.options.title ?? this.name
	}
	get description() {
		return "OpenDAW polyphonic subtractive synthesizer with dual oscillators, filter and ADSR"
	}
	get isConnected() {
		return this.#engine !== null
	}
	get isHidden() {
		return false
	}
	get isNoteDown() {
		return this.activeNotes.size > 0
	}
	get now() {
		return this.audioContext.currentTime
	}
	get gain() {
		return this.options.gain
	}
	set gain(value: number) {
		if (!Number.isFinite(value)) {
			return
		}
		this.options.gain = Math.max(0, value)
		this.output.gain.cancelScheduledValues(this.now)
		this.output.gain.setTargetAtTime(
			this.options.gain,
			this.now,
			Math.max(0.001, this.options.fadeDuration)
		)
	}
	get volume() {
		return this.gain
	}
	set volume(value: number) {
		this.gain = value
	}
	hasMidiOutput() {
		return false
	}
	hasAudioOutput() {
		return true
	}
	hasAutomationOutput() {
		return false
	}
	hasMpeOutput() {
		return false
	}
	hasOscOutput() {
		return false
	}
	hasSysexOutput() {
		return false
	}

	async connect(): Promise<void> {
		if (this.#engine) {
			return
		}
		if (this.#connecting) {
			return this.#connecting
		}
		const generation = this.#generation
		const connecting = (async () => {
			const engine = await createVaporisateurEngine(this.audioContext, this.options)
			if (generation !== this.#generation) {
				engine.dispose()
				return
			}
			engine.output.connect(this.output)
			this.#engine = engine
		})()
		this.#connecting = connecting
		try {
			await connecting
		} finally {
			if (this.#connecting === connecting) {
				this.#connecting = null
			}
		}
	}

	noteOn(noteNumber: number, velocity = 127, _arp = null, delay = 0) {
		if (
			!Number.isInteger(noteNumber) ||
			noteNumber < 0 ||
			noteNumber > 127 ||
			!Number.isFinite(velocity)
		) {
			return
		}
		if (velocity <= 0) {
			this.noteOff(noteNumber)
			return
		}
		if (!this.#engine) {
			return
		}
		this.noteOff(noteNumber)
		this.activeNotes.add(noteNumber)
		const play = () => {
			this.#timers.delete(noteNumber)
			this.#engine?.noteOn(noteNumber, velocityToGain(velocity))
		}
		if (Number.isFinite(delay) && delay > 0) {
			this.#timers.set(noteNumber, setTimeout(play, delay * 1000))
		} else {
			play()
		}
	}

	noteOff(noteNumber: number) {
		const timer = this.#timers.get(noteNumber)
		if (timer !== undefined) {
			clearTimeout(timer)
			this.#timers.delete(noteNumber)
		}
		if (this.activeNotes.delete(noteNumber) && timer === undefined) {
			this.#engine?.noteOff(noteNumber)
		}
	}

	allNotesOff() {
		for (const note of this.activeNotes) {
			this.noteOff(note)
		}
		this.#engine?.panic()
	}

	async disconnect(): Promise<void> {
		this.#generation++
		this.allNotesOff()
		this.#engine?.dispose()
		this.#engine = null
		await this.#connecting
	}

	async dispose(): Promise<void> {
		this.output.disconnect()
		await this.disconnect()
	}
}