import { describe, it, expect, beforeEach } from "vitest"
import { TransformerHarmoniser } from "../transformer-harmoniser.ts"
import type { IAudioCommand } from "../../../commands/audio-command-interface.ts"
import AudioCommand from "../../../commands/audio-command.ts"
import * as Commands from "../../../commands/commands"
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

		expect(result.length).toBe(2)
		expect(result[0].number).toBe(0) // C stays
		expect(result[1].number).toBe(4) // E stays; C# shares the held C
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

	it("passes unmatched releases through", () => {
		transformer = new TransformerHarmoniser({ root: 0, mode: IONIAN_INTERVALS })

		const commands = [
			createAudioCommand(Commands.NOTE_OFF, 1),
			createAudioCommand(Commands.NOTE_ON, 1)
		]

		const result = transformer.transform(commands, mockTimer)

		// NOTE_OFF should remain unchanged
		expect(result[0].type).toBe(Commands.NOTE_OFF)
	})

	it("releases the original mapped pitch after changing key and scale", () => {
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_ON, 61)], mockTimer)[0].number
		).toBe(60)
		transformer.setConfig("root", 2)
		transformer.setConfig("mode", AEOLIAN_INTERVALS)
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_OFF, 61)], mockTimer)[0].number
		).toBe(60)
	})

	it("keeps a shared output sounding until its final input releases", () => {
		expect(
			transformer.transform(
				[
					createAudioCommand(Commands.NOTE_ON, 60),
					createAudioCommand(Commands.NOTE_ON, 61)
				],
				mockTimer
			)
		).toHaveLength(1)
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_OFF, 60)], mockTimer)
		).toEqual([])
		const result = transformer.transform([createAudioCommand(Commands.NOTE_OFF, 61)], mockTimer)
		expect(result).toHaveLength(1)
		expect(result[0].number).toBe(60)
	})

	it.each([
		["nearest", 60],
		["up", 62],
		["down", 60]
	])("maps C sharp using %s", (direction, expected) => {
		transformer.setConfig("direction", direction)
		const input = createAudioCommand(Commands.NOTE_ON, 61)
		const result = transformer.transform([input], mockTimer)
		expect(result[0].number).toBe(expected)
		expect(input.number).toBe(61)
		expect(result[0].raw).toHaveLength(0)
	})

	it("filters both attack and release of excluded notes", () => {
		transformer.setConfig("direction", "filter")
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_ON, 61)], mockTimer)
		).toEqual([])
		transformer.setConfig("direction", "nearest")
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_OFF, 61)], mockTimer)
		).toEqual([])
	})

	it("leaves controllers and pitch bend untouched", () => {
		const input = [
			createAudioCommand(Commands.CONTROL_CHANGE, 1),
			createAudioCommand(Commands.PITCH_BEND, 61)
		]
		expect(transformer.transform(input, mockTimer)).toEqual(input)
	})

	it("handles zero-velocity releases and bypass changes without hanging notes", () => {
		transformer.transform([createAudioCommand(Commands.NOTE_ON, 61)], mockTimer)
		transformer.setConfig("enabled", false)
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_ON, 61, 0)], mockTimer)[0]
				.number
		).toBe(60)
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_ON, 61)], mockTimer)[0].number
		).toBe(61)
		transformer.setConfig("enabled", true)
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_OFF, 61)], mockTimer)[0].number
		).toBe(61)
	})

	it("keeps MIDI channels independent", () => {
		const a = createAudioCommand(Commands.NOTE_ON, 61)
		const b = createAudioCommand(Commands.NOTE_ON, 61)
		a.channel = 1
		b.channel = 2
		expect(transformer.transform([a, b], mockTimer)).toHaveLength(2)
	})

	it("includes scale notes below the tonic in the lowest octave", () => {
		transformer.setConfig("root", 7)
		expect(transformer.notesInScale.has(0)).toBe(true)
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_ON, 0)], mockTimer)[0].number
		).toBe(0)
	})

	it("restores saved interval arrays and accepts surface string values", () => {
		transformer.setConfig("mode", "0,3,5,7,10")
		transformer.setConfig("root", "9")
		const restored = new TransformerHarmoniser(JSON.parse(transformer.exportConfig()))
		expect(restored.options.mode).toEqual([0, 3, 5, 7, 10])
		expect(restored.options.root).toBe(9)
	})

	it("clears held notes on panic and reset", () => {
		transformer.transform([createAudioCommand(Commands.NOTE_ON, 61)], mockTimer)
		const result = transformer.transform(
			[createAudioCommand(Commands.CONTROL_CHANGE, 123)],
			mockTimer
		)
		expect(result.map((command) => command.type)).toEqual([
			Commands.NOTE_OFF,
			Commands.CONTROL_CHANGE
		])
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_ON, 61)], mockTimer)
		).toHaveLength(1)
		transformer.reset()
		expect(
			transformer.transform([createAudioCommand(Commands.NOTE_ON, 61)], mockTimer)
		).toHaveLength(1)
	})

	it("releases each sounding pitch once when transport stops", () => {
		transformer.transform(
			[createAudioCommand(Commands.NOTE_ON, 60), createAudioCommand(Commands.NOTE_ON, 61)],
			mockTimer
		)
		expect(transformer.stop(2)).toEqual([
			expect.objectContaining({ type: Commands.NOTE_OFF, number: 60, startAt: 2 })
		])
		expect(transformer.stop(3)).toEqual([])
	})

	it.each(["nearest", "up", "down", "filter"])(
		"keeps %s results inside the chosen scale and MIDI range",
		(direction) => {
			for (let root = 0; root < 12; root++) {
				const effect = new TransformerHarmoniser({ root, mode: [0, 3, 7], direction })
				for (let note = 0; note <= 127; note++) {
					const result = effect.transform(
						[createAudioCommand(Commands.NOTE_ON, note)],
						mockTimer
					)
					for (const command of result) {
						expect(command.number).toBeGreaterThanOrEqual(0)
						expect(command.number).toBeLessThanOrEqual(127)
						expect([0, 3, 7]).toContain((((command.number - root) % 12) + 12) % 12)
						if (direction === "up") {
							expect(command.number).toBeGreaterThanOrEqual(note)
						}
						if (direction === "down") {
							expect(command.number).toBeLessThanOrEqual(note)
						}
					}
					effect.transform([createAudioCommand(Commands.NOTE_OFF, note)], mockTimer)
				}
			}
		}
	)
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