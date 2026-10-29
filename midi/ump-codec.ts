import type { IAudioCommand } from "../audio-command-interface.ts"
import { NOTE_OFF, NOTE_ON } from "../commands"
import { midiToCommand } from "./midi-command-conversion.ts"
import { createAudioCommand } from "../audio-command-factory.ts"

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
	}
	command.ump = [...words]
	command.umpOriginal = {
		type: command.type,
		number: command.number,
		velocity: command.velocity,
		value: command.value
	}
	return command
}

export function commandToUmp(command: IAudioCommand): number[] {
	const words = [...command.ump!]
	if (!isUmpPacket(words)) {
		throw new Error("Invalid UMP packet")
	}
	const original = command.umpOriginal
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
	}
	return words
}
function scaleCentered(value: number, bits: number): number {
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
		return [status, a, b]
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