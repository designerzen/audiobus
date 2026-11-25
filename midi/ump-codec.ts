import type { IAudioCommand } from "../commands/audio-command-interface.ts"
import { NOTE_OFF, NOTE_ON, PER_NOTE_CONTROLLER, PER_NOTE_PITCH_BEND } from "../commands/commands"
import { midiToCommand, commandToMidi } from "./midi-command-conversion.ts"
import { cloneAudioCommand, createAudioCommand } from "../commands/audio-command-factory.ts"

// UMP words are unsigned integers in protocol order, never packed MIDI byte streams.
const wordCounts = [1, 1, 1, 2, 2, 4, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4]
export function isUmpPacket(words: number[]): boolean {
	return (
		Array.isArray(words) &&
		words.length === wordCounts[words[0] >>> 28] &&
		words.every((word) => Number.isInteger(word) && word >= 0 && word <= 0xffffffff)
	)
}

export function umpToCommand(
	words: number[],
	now: number,
	from: string
): IAudioCommand | undefined {
	if (!isUmpPacket(words)) {
		return
	}
	const bytes = umpToMidiBytes(words)
	const command = bytes
		? midiToCommand(bytes, now, from)
		: createAudioCommand("midi2Message", (words[0] >>> 8) & 127, now, from)
	if (!command) {
		return
	}
	if (!bytes) {
		command.channel = words[0] >>> 28 === 4 ? ((words[0] >>> 16) & 15) + 1 : 0
		decodePerNote(command, words)
	}
	command.ump = [...words]
	const type = words[0] >>> 28
	if (type !== 0 && type !== 15) {
		command.midiGroup = (words[0] >>> 24) & 15
	}
	command.umpOriginal = {
		type: command.type,
		number: command.number,
		velocity: command.velocity,
		value: command.value,
		channel: command.channel
	}
	return command
}

export function commandToUmp(command: IAudioCommand): number[] {
	const words = [...command.ump!]
	if (!isUmpPacket(words)) {
		throw new Error("Invalid UMP packet")
	}
	const original = command.umpOriginal
	const type = words[0] >>> 28
	if (command.midiGroup !== undefined && type !== 0 && type !== 15) {
		if (
			!Number.isInteger(command.midiGroup) ||
			command.midiGroup < 0 ||
			command.midiGroup > 15
		) {
			throw new Error("Invalid UMP group")
		}
		words[0] = ((words[0] & 0xf0ffffff) | (command.midiGroup << 24)) >>> 0
	}
	if (type === 1 || type === 2) {
		const bytes = commandToMidi(command)
		if (bytes) {
			words[0] =
				((words[0] & 0xff000000) |
					(bytes[0] << 16) |
					((bytes[1] ?? 0) << 8) |
					(bytes[2] ?? 0)) >>>
				0
		}
		return words
	}
	if (type === 4 && command.channel > 0) {
		if (!Number.isInteger(command.channel) || command.channel > 16) {
			throw new Error("Invalid MIDI channel")
		}
		words[0] = ((words[0] & 0xfff0ffff) | ((command.channel - 1) << 16)) >>> 0
	}
	if (!original || words[0] >>> 28 !== 4) {
		return words
	}
	const kind = (words[0] >>> 20) & 15
	// Transformers may alter pitch/velocity while the original high-resolution
	// value must survive an unchanged command. Never round-trip UMP through bytes.
	if ((kind === 8 || kind === 9) && (command.type === NOTE_ON || command.type === NOTE_OFF)) {
		const note = Math.max(0, Math.min(127, Math.round(command.number)))
		words[0] =
			((words[0] & 0xff0f00ff) |
				((command.type === NOTE_OFF ? 8 : 9) << 20) |
				(note << 8)) >>>
			0
		if (command.velocity !== original.velocity || command.type !== original.type) {
			const value = Math.max(0, Math.min(127, Math.round(command.velocity ?? 0)))
			words[1] =
				((((value << 9) | (value << 2) | (value >>> 5)) << 16) | (words[1] & 0xffff)) >>> 0
		}
	} else if (kind === 10 || kind === 11) {
		words[0] = ((words[0] & 0xffff00ff) | ((command.number & 127) << 8)) >>> 0
		if (command.value !== original.value) {
			words[1] = scaleCentered(Math.max(0, Math.min(127, Math.round(command.value))), 7)
		}
	} else if (kind === 13 || kind === 14) {
		if (command.value !== original.value) {
			words[1] = scaleCentered(
				Math.max(0, Math.min(kind === 14 ? 16383 : 127, Math.round(command.value))),
				kind === 14 ? 14 : 7
			)
		}
	} else if (kind === 12 && command.value !== original.value) {
		words[1] = ((words[1] & 0x00ffffff) | ((command.value & 127) << 24)) >>> 0
	} else if (kind === 0 || kind === 1 || kind === 6) {
		words[0] = ((words[0] & 0xffff00ff) | ((command.number & 127) << 8)) >>> 0
		if (kind !== 6 && command.type === PER_NOTE_CONTROLLER) {
			words[0] =
				((words[0] & 0xff0fff00) |
					((command.registered ? 0 : 1) << 20) |
					((command.controller ?? words[0]) & 255)) >>>
				0
		}
		if (command.value !== original.value) {
			words[1] =
				kind === 6
					? scaleCentered(Math.max(0, Math.min(16383, Math.round(command.value))), 14)
					: scaleCentered(Math.max(0, Math.min(127, Math.round(command.value))), 7)
		}
	}
	return words
}

// Per-note pitch bend (status 6) and registered/assignable per-note controllers (0/1)
// have no MIDI 1 bytes, so expose them as per-note commands with MIDI 1 value ranges.
function decodePerNote(command: IAudioCommand, words: number[]): void {
	const kind = (words[0] >>> 20) & 15
	if (words[0] >>> 28 !== 4 || words.length !== 2) {
		return
	}
	if (kind === 6) {
		command.type = command.subtype = PER_NOTE_PITCH_BEND
		command.value = command.pitchBend = words[1] >>> 18
	} else if (kind === 0 || kind === 1) {
		command.type = command.subtype = PER_NOTE_CONTROLLER
		command.controller = words[0] & 255
		command.registered = kind === 0
		command.value = words[1] >>> 25
	}
}

/** MIDI 2 packets for per-note expression commands. */
export function perNoteToUmp(command: IAudioCommand): number[] | undefined {
	const header =
		(0x40000000 |
			((command.midiGroup ?? 0) << 24) |
			((Math.max(1, Math.min(16, command.channel || 1)) - 1) << 16) |
			((Math.max(0, Math.min(127, Math.round(command.number || 0))) & 127) << 8)) >>>
		0
	if (command.type === PER_NOTE_PITCH_BEND) {
		const value = Math.round(command.value ?? command.pitchBend ?? 8192)
		return [(header | (6 << 20)) >>> 0, scaleCentered(Math.max(0, Math.min(16383, value)), 14)]
	}
	if (command.type === PER_NOTE_CONTROLLER) {
		const value = Math.max(0, Math.min(127, Math.round(command.value ?? 0)))
		return [
			(header | ((command.registered ? 0 : 1) << 20) | ((command.controller ?? 0) & 255)) >>>
				0,
			scaleCentered(value, 7)
		]
	}
}

/** MIDI 2 protocol packet for a channel voice or per-note command, or undefined. */
export function commandToMidi2Ump(command: IAudioCommand): number[] | undefined {
	if (command.ump && command.ump[0] >>> 28 === 4) {
		return commandToUmp(command)
	}
	const perNote = perNoteToUmp(command)
	if (perNote) {
		return perNote
	}
	const bytes = commandToMidi(command)
	if (!bytes || bytes[0] < 0x80 || bytes[0] >= 0xf0) {
		return
	}
	const words = midiBytesToUmp(bytes)
	words[0] = (words[0] | ((command.midiGroup ?? 0) << 24)) >>> 0
	return words
}

/** MIDI 1 protocol (UMP type 2) packet for a channel voice command, or undefined. */
export function commandToMidi1Ump(command: IAudioCommand): number[] | undefined {
	const bytes = commandToMidi(command)
	if (!bytes || bytes[0] < 0x80 || bytes[0] >= 0xf0) {
		return
	}
	return [
		(0x20000000 |
			((command.midiGroup ?? 0) << 24) |
			(bytes[0] << 16) |
			((bytes[1] ?? 0) << 8) |
			(bytes[2] ?? 0)) >>>
			0
	]
}

/** A copy of a command carrying its native packet, so later edits patch it like decoded UMP. */
export function withUmp(command: IAudioCommand, words: number[]): IAudioCommand {
	const copy = cloneAudioCommand(command)
	copy.ump = [...words]
	copy.umpOriginal = {
		type: copy.type,
		number: copy.number,
		velocity: copy.velocity,
		value: copy.value,
		channel: copy.channel
	}
	return copy
}
export function scaleCentered(value: number, bits: number): number {
	const shift = 32 - bits
	let scaled = (value << shift) >>> 0
	if (value <= 2 ** (bits - 1)) {
		return scaled
	}
	const repeatBits = bits - 1
	let repeated = ((value & (2 ** repeatBits - 1)) << (shift - repeatBits)) >>> 0
	while (repeated) {
		scaled = (scaled | repeated) >>> 0
		repeated >>>= repeatBits
	}
	return scaled
}

export function midiBytesToUmp(bytes: number[]): number[] {
	const [status, a = 0, b = 0] = bytes
	if (
		!bytes.length ||
		!Number.isInteger(status) ||
		status < 0x80 ||
		status > 0xff ||
		status === 0xf0 ||
		bytes.length > 3 ||
		bytes.slice(1).some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 127)
	) {
		throw new Error("Unsupported MIDI message")
	}
	if (status >= 0xf0) {
		return [(0x10000000 | (status << 16) | (a << 8) | b) >>> 0]
	}
	const kind = status >> 4
	const header = (0x40000000 | ((kind === 9 && b === 0 ? status - 0x10 : status) << 16)) >>> 0
	if (kind === 8 || kind === 9) {
		const velocity = (b << 9) | (b << 2) | (b >> 5)
		return [header | (a << 8), (velocity << 16) >>> 0]
	}
	if (kind === 10 || kind === 11) {
		return [header | (a << 8), scaleCentered(b, 7)]
	}
	if (kind === 12) {
		return [header, (a << 24) >>> 0]
	}
	if (kind === 13) {
		return [header, scaleCentered(a, 7)]
	}
	const bend = a | (b << 7)
	return [header, scaleCentered(bend, 14)]
}

export function umpToMidiBytes(words: number[]): number[] | undefined {
	if (
		!Array.isArray(words) ||
		words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffffffff)
	) {
		return
	}
	const first = words[0],
		type = first >>> 28
	const status = (first >>> 16) & 255,
		a = (first >>> 8) & 127,
		b = first & 127
	if ((type === 1 || type === 2) && words.length === 1) {
		return status >= 0xf8 || status === 0xf6
			? [status]
			: status === 0xf1 || status === 0xf3 || status >> 4 === 0xc || status >> 4 === 0xd
				? [status, a]
				: [status, a, b]
	}
	if (type !== 4 || words.length !== 2) {
		return
	}
	const value = words[1],
		kind = status >> 4
	if (kind === 8 || kind === 9) {
		return [status, a, kind === 9 ? Math.max(1, value >>> 25) : value >>> 25]
	}
	if (kind === 10 || kind === 11) {
		return [status, a, value >>> 25]
	}
	if (kind === 12) {
		return [status, (value >>> 24) & 127]
	}
	if (kind === 13) {
		return [status, value >>> 25]
	}
	if (kind === 14) {
		return [status, (value >>> 18) & 127, value >>> 25]
	}
}
