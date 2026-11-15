/**
 * Plays chords on any IAudioOutput(s): all at once, as an arpeggio, as a harp, or as
 * single notes. With several outputs the chord is spread across them voice by voice.
 *
 * Velocity is 0..1 on every method here and is converted to the 0..127 that
 * IAudioOutput.noteOn expects at the boundary. Every note the performer starts is
 * tracked per output, so chordOff, allNotesOff, a mode change, setOutputs and destroy
 * always release what is sounding.
 */
import {
	ARPEGGIO_VARIATION,
	Arpeggio,
	HARP_ARPEGGIO_VARIATION,
	type ArpeggioSettings,
	type ArpeggioTiming,
	type ArpeggioTimingOptions
} from "../timing/arpeggio.ts"
import type { IAudioOutput } from "./outputs/output-interface.ts"

export const CHORD_PLAY_MODE = "chord"
export const ARPEGGIO_PLAY_MODE = ARPEGGIO_VARIATION
export const HARP_PLAY_MODE = HARP_ARPEGGIO_VARIATION
export const SINGLE_NOTE_PLAY_MODE = "single-note"

export type PerformanceMode =
	| typeof CHORD_PLAY_MODE
	| typeof ARPEGGIO_PLAY_MODE
	| typeof HARP_PLAY_MODE
	| typeof SINGLE_NOTE_PLAY_MODE

const PERFORMANCE_MODES: readonly string[] = [
	CHORD_PLAY_MODE,
	ARPEGGIO_PLAY_MODE,
	HARP_PLAY_MODE,
	SINGLE_NOTE_PLAY_MODE
]

/** The part of IAudioOutput the performer drives. */
export type ChordPerformerOutput = Pick<IAudioOutput, "noteOn" | "noteOff" | "allNotesOff">

/** velocity is 0..1 */
export interface PerformerChordNote {
	noteNumber: number
	velocity?: number
}

/** Notes as objects, or plain MIDI note numbers. */
export type PerformerChord = ReadonlyArray<PerformerChordNote | number | null | undefined>

export interface ChordPerformerTimers {
	setTimer(callback: () => void, delayMilliseconds: number): unknown
	clearTimer(timer: unknown): void
}

export interface ChordPerformerOptions {
	performanceMode?: PerformanceMode
	/** Shorthand for performanceMode "arpeggio" */
	arpeggiate?: boolean
	/** Milliseconds an arpeggio note sounds before it is released; 0 holds it until the next step */
	arpeggioGateMs?: number
	/** Replace the timers, e.g. to drive the gate from a test clock. Defaults to the global timers. */
	timers?: ChordPerformerTimers
	/** Called when an output throws or rejects; the performer carries on. Defaults to console.error. */
	onError?: (error: unknown) => void
}

// Looked up on every call so fake timers installed later are honoured.
const GLOBAL_TIMERS: ChordPerformerTimers = {
	setTimer: (callback, delay) => globalThis.setTimeout(callback, delay),
	clearTimer: (timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>)
}

/** 0..1 to MIDI 1..127. Zero is raised to 1 because a MIDI note-on with velocity 0 means note-off. */
export const performerVelocityToMidi = (velocity: number): number =>
	Number.isFinite(velocity) ? Math.min(127, Math.max(1, Math.round(velocity * 127))) : 127

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
	typeof (value as PromiseLike<unknown> | undefined)?.then === "function"

export class ChordPerformer {
	arpeggioIndex = 0
	arpeggioChordKey = ""
	arpeggioGateMs = 0

	private readonly arpeggio = new Arpeggio()
	private singleNote = false
	private outputs: ChordPerformerOutput[]
	/** Per output: note number to the MIDI velocity it was started with */
	private held: Array<Map<number, number>>
	private gateTimer: unknown = null
	private gateToken = 0
	private gateNote: number | null = null
	private destroyed = false
	private readonly timers: ChordPerformerTimers
	private readonly onError: (error: unknown) => void

	constructor(
		outputs: ChordPerformerOutput | ChordPerformerOutput[],
		options: ChordPerformerOptions = {}
	) {
		this.outputs = ChordPerformer.toOutputList(outputs)
		this.held = this.outputs.map(() => new Map())
		this.timers = options.timers ?? GLOBAL_TIMERS
		this.onError = options.onError ?? ((error) => console.error("ChordPerformer", error))
		this.setArpeggioGate(options.arpeggioGateMs ?? 0)
		if (options.performanceMode && options.performanceMode !== CHORD_PLAY_MODE) {
			this.performanceMode = options.performanceMode
		} else if (options.arpeggiate) {
			this.arpeggiate = true
		}
	}

	private static toOutputList(
		outputs: ChordPerformerOutput | ChordPerformerOutput[]
	): ChordPerformerOutput[] {
		const list = Array.isArray(outputs) ? [...outputs] : [outputs]
		if (!list.length || list.some((output) => !output)) {
			throw new Error("ChordPerformer requires at least one output")
		}
		return list
	}

	get outputCount(): number {
		return this.outputs.length
	}

	get isDestroyed(): boolean {
		return this.destroyed
	}

	/** True while any note started by this performer is still sounding. */
	get isSounding(): boolean {
		return this.held.some((notes) => notes.size > 0)
	}

	/** Note numbers currently sounding on any output. */
	get activeNotes(): number[] {
		return [...new Set(this.held.flatMap((notes) => [...notes.keys()]))]
	}

	get arpeggiate(): boolean {
		return this.arpeggio.enabled
	}
	set arpeggiate(value: boolean) {
		this.performanceMode = value ? ARPEGGIO_PLAY_MODE : CHORD_PLAY_MODE
	}

	get performanceMode(): PerformanceMode {
		if (this.arpeggio.enabled) {
			return this.arpeggio.variation
		}
		return this.singleNote ? SINGLE_NOTE_PLAY_MODE : CHORD_PLAY_MODE
	}
	/** Changing the mode releases everything that is sounding and restarts the arpeggio. */
	set performanceMode(value: PerformanceMode) {
		if (!PERFORMANCE_MODES.includes(value)) {
			throw new RangeError(`Unknown performance mode "${value}"`)
		}
		this.singleNote = value === SINGLE_NOTE_PLAY_MODE
		this.arpeggio.configure(this.singleNote ? false : value)
		this.releaseAndReset()
	}

	/** False in single-note mode: the caller is expected to pass one-note chords. */
	get playsChords(): boolean {
		return !this.singleNote
	}

	/** Configure the arpeggio or harp (variation, octaveSpan, clockStep). Releases sounding notes. */
	configureArpeggio(config: ArpeggioSettings) {
		this.singleNote = false
		const configured = this.arpeggio.configure(config)
		this.releaseAndReset()
		return configured
	}

	getArpeggioTiming(bpm: unknown, options: ArpeggioTimingOptions = {}): ArpeggioTiming {
		return this.arpeggio.getTiming(bpm, options)
	}

	getArpeggioChordKey(chord: PerformerChord = []): string {
		return ChordPerformer.normaliseChord(chord)
			.map((note) => note.noteNumber)
			.join(",")
	}

	getArpeggioSequence(chord: PerformerChord = []): PerformerChordNote[] {
		return this.arpeggio.getSequence(ChordPerformer.normaliseChord(chord))
	}

	resetArpeggio(): void {
		this.arpeggioIndex = 0
		this.arpeggioChordKey = ""
		this.clearArpeggioGate()
	}

	/** Milliseconds an arpeggio note sounds; 0 (or invalid) disables the gate. Take it from getArpeggioTiming().gateMs. */
	setArpeggioGate(gateMs = 0): number {
		this.arpeggioGateMs = Number.isFinite(gateMs) && gateMs > 0 ? gateMs : 0
		return this.arpeggioGateMs
	}

	clearArpeggioGate(): void {
		if (this.gateTimer !== null) {
			this.timers.clearTimer(this.gateTimer)
			this.gateTimer = null
		}
		this.gateNote = null
		this.gateToken++
	}

	/** An explicit velocity wins over the note's own, which wins over full velocity. All 0..1. */
	getChordVelocity(chord: PerformerChordNote | null | undefined, velocity?: number): number {
		return velocity ?? chord?.velocity ?? 1
	}

	/**
	 * Start one note on one output.
	 * @param velocity 0..1, converted to MIDI 1..127
	 * @returns false when the note was already sounding there (it is struck again)
	 */
	noteOn(noteNumber: number, velocity = 1, outputIndex = 0): boolean {
		if (this.destroyed || !Number.isFinite(noteNumber)) {
			return false
		}
		const index = outputIndex % this.outputs.length
		// Silent notes are released, never sounded at the lowest MIDI velocity
		if (velocity <= 0) {
			this.noteOff(noteNumber, 0, index)
			return false
		}
		const midiVelocity = performerVelocityToMidi(velocity)
		const wasHeld = this.held[index].has(noteNumber)
		this.held[index].set(noteNumber, midiVelocity)
		this.call(() => this.outputs[index].noteOn(noteNumber, midiVelocity))
		return !wasHeld
	}

	/**
	 * Release a note on one output, or on every output when outputIndex is omitted.
	 * Notes this performer did not start are left alone.
	 * @returns true if anything was released
	 */
	noteOff(noteNumber: number, _velocity = 0, outputIndex?: number): boolean {
		const indexes =
			outputIndex === undefined
				? this.outputs.map((_, index) => index)
				: [outputIndex % this.outputs.length]
		let released = false
		for (const index of indexes) {
			if (this.held[index].delete(noteNumber)) {
				released = true
				this.call(() => this.outputs[index].noteOff(noteNumber))
			}
		}
		if (released && noteNumber === this.gateNote) {
			this.clearArpeggioGate()
		}
		return released
	}

	/**
	 * Play a chord according to the performance mode.
	 * Chord and single-note modes spread the notes across the outputs. Arpeggio and harp
	 * play one note per call on the first output: the next note of the sequence when the
	 * same chord comes again, from the start when the chord changes.
	 * @param velocity 0..1, overrides each note's own velocity when given
	 * @returns the note numbers started
	 */
	chordOn(chord: PerformerChord, velocity?: number): number[] {
		if (this.destroyed) {
			return []
		}
		const notes = ChordPerformer.normaliseChord(chord)
		if (!notes.length) {
			return []
		}
		return this.arpeggio.enabled
			? this.chordOnArpeggio(notes, velocity)
			: this.chordOnSpread(notes, velocity)
	}

	/**
	 * Release a chord. In arpeggio and harp modes this also releases the sounding
	 * note when it came from this chord's sequence (it may be octaves above the chord).
	 * @returns the note numbers released
	 */
	chordOff(chord: PerformerChord, _velocity?: number): number[] {
		const notes = ChordPerformer.normaliseChord(chord)
		const numbers = new Set(notes.map((note) => note.noteNumber))
		if (this.arpeggio.enabled) {
			this.arpeggio.getSequence(notes).forEach((note) => numbers.add(note.noteNumber))
		}
		return [...numbers].filter((noteNumber) => this.noteOff(noteNumber))
	}

	/**
	 * Strike the chord again: each note is released and started once more. As in
	 * ChordInstrument this ignores the arpeggio and re-strikes the chord notes themselves.
	 * @param velocity 0..1
	 * @returns the note numbers struck
	 */
	chordRetrigger(chord: PerformerChord, velocity?: number): number[] {
		if (this.destroyed) {
			return []
		}
		const notes = ChordPerformer.normaliseChord(chord)
		const struck: number[] = []
		this.spread(notes).forEach(([outputIndex, note]) => {
			this.noteOff(note.noteNumber, 0, outputIndex)
			this.noteOn(note.noteNumber, this.getChordVelocity(note, velocity), outputIndex)
			struck.push(note.noteNumber)
		})
		return struck
	}

	/**
	 * Release everything this performer started and cancel the arpeggio gate.
	 * The outputs' own allNotesOff is not called, so other users of a shared output are unaffected.
	 * @returns the note numbers released
	 */
	allNotesOff(): number[] {
		this.clearArpeggioGate()
		const notes = this.activeNotes
		this.held.forEach((held, index) => {
			const sounding = [...held.keys()]
			held.clear()
			sounding.forEach((noteNumber) =>
				this.call(() => this.outputs[index].noteOff(noteNumber))
			)
		})
		return notes
	}

	/** Release everything and swap the outputs. */
	setOutputs(outputs: ChordPerformerOutput | ChordPerformerOutput[]): void {
		const next = ChordPerformer.toOutputList(outputs)
		this.allNotesOff()
		this.outputs = next
		this.held = next.map(() => new Map())
		this.resetArpeggio()
	}

	/** Release everything and stop for good: later calls do nothing and no timer remains. */
	destroy(): void {
		this.allNotesOff()
		this.destroyed = true
	}

	private static normaliseChord(chord: PerformerChord | null | undefined): PerformerChordNote[] {
		const notes: PerformerChordNote[] = []
		for (const entry of chord ?? []) {
			const note = typeof entry === "number" ? { noteNumber: entry } : entry
			if (note && Number.isFinite(note.noteNumber)) {
				notes.push(note)
			}
		}
		return notes
	}

	/**
	 * Pairs each voice with an output and a chord note. With as many outputs as notes each
	 * output gets one note; extra outputs double notes from the start of the chord (as
	 * ChordInstrument does); extra notes wrap round the outputs, so a single output plays the lot.
	 */
	private spread(notes: PerformerChordNote[]): Array<[number, PerformerChordNote]> {
		if (!notes.length) {
			return []
		}
		const voices = Math.max(this.outputs.length, notes.length)
		return Array.from({ length: voices }, (_, voice) => [
			voice % this.outputs.length,
			notes[voice % notes.length]
		])
	}

	private chordOnSpread(notes: PerformerChordNote[], velocity?: number): number[] {
		return this.spread(notes).map(([outputIndex, note]) => {
			this.noteOn(note.noteNumber, this.getChordVelocity(note, velocity), outputIndex)
			return note.noteNumber
		})
	}

	private chordOnArpeggio(notes: PerformerChordNote[], velocity?: number): number[] {
		const sequence = this.arpeggio.getSequence(notes)
		if (!sequence.length) {
			return []
		}
		const chordKey = sequence.map((note) => note.noteNumber).join(",")
		this.arpeggioIndex =
			chordKey === this.arpeggioChordKey ? (this.arpeggioIndex + 1) % sequence.length : 0
		this.arpeggioChordKey = chordKey

		const note = sequence[this.arpeggioIndex]
		this.allNotesOff()
		const noteVelocity = this.getChordVelocity(note, velocity)
		this.noteOn(note.noteNumber, noteVelocity, 0)
		this.scheduleArpeggioGate(note.noteNumber)
		return [note.noteNumber]
	}

	private scheduleArpeggioGate(noteNumber: number): void {
		this.clearArpeggioGate()
		if (!this.arpeggioGateMs) {
			return
		}
		const token = this.gateToken
		this.gateNote = noteNumber
		this.gateTimer = this.timers.setTimer(() => {
			if (token !== this.gateToken) {
				return
			}
			this.gateTimer = null
			this.noteOff(noteNumber, 0, 0)
		}, this.arpeggioGateMs)
	}

	private releaseAndReset(): void {
		this.allNotesOff()
		this.resetArpeggio()
	}

	/** Run an output call so one failing output cannot stop the others from being released. */
	private call(action: () => unknown): void {
		try {
			const result = action()
			if (isPromiseLike(result)) {
				result.then(undefined, this.onError)
			}
		} catch (error) {
			this.onError(error)
		}
	}
}