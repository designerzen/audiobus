import { describe, it, expect, beforeEach } from "vitest"
import { TransformerHarmoniser } from "../transformer-harmoniser.ts"
import type { IAudioCommand } from "../../../audio-command-interface.ts"
import AudioCommand from "../../../audio-command.ts"
import * as Commands from "../../../commands"
import { IONIAN_INTERVALS, AEOLIAN_INTERVALS } from "../../../tuning/intervals.ts"

const mockTimer = {
	BPM: 120,
	now: 0,
	isRunning: true
} as any

describe("TransformerHarmoniser", () => {
	let transformer: TransformerHarmoniser

	beforeEach(() => {
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })
	})

	it("should have correct name", () => {
		expect(transformer.name).toBe("Harmoniser")
	})

	it("should quantise note to closest scale note in Ionian mode", () => {
		// C Ionian (C major) - C, D, E, F, G, A, B
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })

		// C (0) is in scale, should remain unchanged
		const commands = [createAudioCommand(Commands.NOTE_ON, 0)]
		const result = transformer.transform(commands, mockTimer)
		expect(result[0].number).toBe(0)
	})

	it("should transpose out-of-scale notes to nearest scale note", () => {
		// C Ionian (C major) root: 0
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })

		// C# (1) is not in C major, should quantise to nearest (either C=0 or D=2)
		const commands = [createAudioCommand(Commands.NOTE_ON, 1)]
		const result = transformer.transform(commands, mockTimer)

		expect([0, 2]).toContain(result[0].number)
	})

	it("should handle multiple notes", () => {
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })

		const commands = [
			createAudioCommand(Commands.NOTE_ON, 0), // C - in scale
			createAudioCommand(Commands.NOTE_ON, 1), // C# - out of scale
			createAudioCommand(Commands.NOTE_ON, 4) // E - in scale
		]

		const result = transformer.transform(commands, mockTimer)

		expect(result.length).toBe(3)
		expect(result[0].number).toBe(0) // C stays
		expect(result[2].number).toBe(4) // E stays
	})

	it("should handle different roots", () => {
		// G Ionian (G major): root 7
		transformer = new TransformerHarmoniser({ root: 7, mode: IONIAN_INTERVALS })

		const commands = [createAudioCommand(Commands.NOTE_ON, 7)] // G
		const result = transformer.transform(commands, mockTimer)

		expect(result[0].number).toBe(7)
	})

	it("should preserve command properties during transposition", () => {
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })

		const command = createAudioCommand(Commands.NOTE_ON, 1, 85, 0.5)
		const result = transformer.transform([command], mockTimer)

		expect(result[0].velocity).toBe(85)
		expect(result[0].startAt).toBe(0.5)
		expect(result[0].type).toBe(Commands.NOTE_ON)
	})

	it("should handle empty command array", () => {
		const result = transformer.transform([], mockTimer)
		expect(result).toEqual([])
	})

	it("should work with different modes", () => {
		// A natural minor (A Aeolian): A, B, C, D, E, F, G
		transformer = new TransformerHarmoniser({ root: 9, mode: AEOLIAN_INTERVALS })

		const commands = [createAudioCommand(Commands.NOTE_ON, 9)] // A
		const result = transformer.transform(commands, mockTimer)

		expect(result[0].number).toBe(9)
	})

	it("should quantise MIDI notes within valid range (0-127)", () => {
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })

		// Test low note
		let commands = [createAudioCommand(Commands.NOTE_ON, 0)]
		let result = transformer.transform(commands, mockTimer)
		expect(result[0].number).toBeGreaterThanOrEqual(0)
		expect(result[0].number).toBeLessThanOrEqual(127)

		// Test high note
		commands = [createAudioCommand(Commands.NOTE_ON, 127)]
		result = transformer.transform(commands, mockTimer)
		expect(result[0].number).toBeGreaterThanOrEqual(0)
		expect(result[0].number).toBeLessThanOrEqual(127)
	})

	it("should only quantise NOTE_ON commands", () => {
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })

		const commands = [
			createAudioCommand(Commands.NOTE_OFF, 1),
			createAudioCommand(Commands.NOTE_ON, 1)
		]

		const result = transformer.transform(commands, mockTimer)

		// NOTE_OFF should remain unchanged
		expect(result[0].type).toBe(Commands.NOTE_OFF)
	})
})

function createAudioCommand(
	type: string,
	noteNumber: number,
	velocity: number = 100,
	startAt: number = 0
): IAudioCommand {
	const cmd = new AudioCommand()
	cmd.type = type
	cmd.subtype = type
	cmd.number = noteNumber
	cmd.velocity = velocity
	cmd.startAt = startAt
	cmd.time = 0
	cmd.id = Math.random()
	cmd.endAt = startAt + 1
	cmd.value = 0
	cmd.pitchBend = 0
	cmd.timeCode = 0
	cmd.text = ""
	cmd.raw = new Uint8Array()
	return cmd
}