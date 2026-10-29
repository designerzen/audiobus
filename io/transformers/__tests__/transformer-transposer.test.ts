import { describe, expect, it } from "vitest"
import { TransformerTransposer } from "../transformer-transposer"
import { createAudioCommand } from "../../../audio-command-factory"
import { NOTE_ON, NOTE_OFF } from "../../../commands"
import type { Timer } from "netronome"

const timer = { BPM: 120, now: 0 } as Timer

describe("semitone transposition", () => {
	it.each([
		[12, 60, 72],
		[-12, 60, 48],
		[12, 120, 127],
		[-12, 5, 0]
	])("shifts by %s semitones and keeps notes in MIDI range", (distance, pitch, expected) => {
		const effect = new TransformerTransposer({ distance })
		for (const type of [NOTE_ON, NOTE_OFF]) {
			const command = createAudioCommand(type, pitch, 0)
			expect(effect.transform([command], timer)[0].number).toBe(expected)
		}
	})
	it("preserves the original commands when disabled", () => {
		const commands = [createAudioCommand(NOTE_ON, 60, 0)]
		const effect = new TransformerTransposer({ distance: 12, enabled: false })
		expect(effect.transform(commands, timer)).toBe(commands)
	})
})