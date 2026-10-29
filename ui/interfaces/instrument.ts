import { NOTE_ON, NOTE_OFF, PITCH_BEND } from "../../commands.ts"

/** Structural subset of the existing Note model; noteNumber is a MIDI note, frequency is Hz. */
export interface InstrumentNote {
	readonly noteNumber: number
	readonly noteKey: string
	readonly noteName: string
	readonly octave: number
	readonly frequency: number
}

export type UMP64 = readonly [number, number]
export interface MIDIAddress {
	readonly group: number
	readonly channel: number
}
export interface NoteDetail extends MIDIAddress {
	readonly note: InstrumentNote
	/** Existing application convention: normalized 0–1 attack/release velocity. */
	readonly velocity: number
	readonly velocity16: number
	/** Application voice identity, not a MIDI field. Preserved on noteOff. */
	readonly id: number
	readonly isMidi: false
	readonly ump: UMP64
}
export interface InstrumentEventMap {
	/** Dispatch from disconnectedCallback so hosts can detach synchronously. */
	instrumentDisconnect: CustomEvent<Record<string, never>>
	noteOn: CustomEvent<NoteDetail>
	noteOff: CustomEvent<NoteDetail>
	pitchBend: CustomEvent<MIDIAddress & { value: number; value32: number; ump: UMP64 }>
	controlChange: CustomEvent<
		MIDIAddress & { controller: number; value: number; value32: number; ump: UMP64 }
	>
	programChange: CustomEvent<MIDIAddress & { program: number; bank?: number; ump: UMP64 }>
	instrumentChange: CustomEvent<{
		control:
			| "octave"
			| "mode"
			| "scale"
			| "note-count"
			| "key"
			| "transpose"
			| "harmony"
			| "custom-roots"
			| "region-behavior"
			| "chord-type"
			| "hold-behavior"
			| "velocity-mode"
			| "velocity"
			| "sensitivity"
			| "minimum-velocity"
			| "labels"
			| "voice-leading"
		value: number | string
	}>
}

/** Controllers implement this contract by emitting events; audio adapters consume them. */
export interface InstrumentInterface extends EventTarget {
	/** Zero-based MIDI patch; program is a reflected alias for the same selection. */
	patch: number
	program: number
	/** Display feedback only. These methods must never emit instrument events or play audio. */
	setActiveNote(note: InstrumentNote | number, active?: boolean): void
	setActiveNotes(notes: Iterable<InstrumentNote | number>): void
	clearActiveNotes(): void
	noteOn(note: InstrumentNote | number, velocity?: number, id?: number): void
	noteOff(note: InstrumentNote | number, velocity?: number, id?: number): void
	pitchBend(value: number): void
	controlChange(controller: number, value: number): void
	programChange(program: number, bank?: number): void
	stop(): void
	addEventListener<K extends keyof InstrumentEventMap>(
		type: K,
		listener: (event: InstrumentEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void
	addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions
	): void
}

export const instrumentEvents = {
	noteOn: NOTE_ON,
	noteOff: NOTE_OFF,
	pitchBend: PITCH_BEND
} as const

export function range(value: number, min: number, max: number, name: string, integer = false) {
	if (
		!Number.isFinite(value) ||
		value < min ||
		value > max ||
		(integer && !Number.isInteger(value))
	) {
		throw new RangeError(
			`${name} must be ${integer ? "an integer " : ""}between ${min} and ${max}`
		)
	}
	return value
}

export function instrumentNote(note: InstrumentNote | number): InstrumentNote {
	const number = range(
		typeof note === "number" ? note : note.noteNumber,
		0,
		127,
		"noteNumber",
		true
	)
	const noteKey = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][number % 12]!
	const octave = Math.floor(number / 12) - 1
	return Object.freeze({
		noteNumber: number,
		noteKey,
		octave,
		noteName: noteKey + octave,
		frequency: 440 * 2 ** ((number - 69) / 12)
	})
}

/** MIDI 2.0 Channel Voice header (MT=4). Addresses use the wire's zero-based 0–15 range. */
export function midi2Header(status: number, address: MIDIAddress) {
	range(address.group, 0, 15, "group", true)
	range(address.channel, 0, 15, "channel", true)
	return (0x40000000 | (address.group << 24) | (status << 20) | (address.channel << 16)) >>> 0
}

/** Attribute type/data zero: no note attribute. MIDI 2.0 noteOn velocity zero remains noteOn. */
export function noteDetail(
	type: "noteOn" | "noteOff",
	note: InstrumentNote | number,
	velocity: number,
	id: number,
	address: MIDIAddress
): NoteDetail {
	range(velocity, 0, 1, "velocity")
	range(id, 0, Number.MAX_SAFE_INTEGER, "id", true)
	const model = instrumentNote(note)
	const velocity16 = Math.round(velocity * 0xffff)
	const ump: UMP64 = Object.freeze([
		(midi2Header(type === "noteOn" ? 9 : 8, address) | (model.noteNumber << 8)) >>> 0,
		(velocity16 << 16) >>> 0
	])
	return Object.freeze({ ...address, note: model, velocity, velocity16, id, isMidi: false, ump })
}

export function dispatchInstrumentEvent<K extends keyof InstrumentEventMap>(
	target: EventTarget,
	type: K,
	detail: InstrumentEventMap[K]["detail"]
) {
	target.dispatchEvent(
		new CustomEvent(type, { detail: Object.freeze(detail), bubbles: true, composed: true })
	)
}