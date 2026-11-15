import { describe, it, expect, beforeEach } from "vitest"
import { TransformerArpeggiator } from "../transformer-arpeggiator"
import type { IAudioCommand } from "../../../commands/audio-command-interface"
import AudioCommand from "../../../commands/audio-command"
import * as Commands from "../../../commands/commands"

const mockTimer = {
	BPM: 120,
	now: 0,
	isRunning: true
} as any

describe("TransformerArpeggiator", () => {
	let transformer: TransformerArpeggiator
	const noteOns = (commands: IAudioCommand[]) =>
		commands.filter((command) => command.type === Commands.NOTE_ON)
	const noteOffs = (commands: IAudioCommand[]) =>
		commands.filter((command) => command.type === Commands.NOTE_OFF)
	/** Everything played from the given commands until the given time */
	const play = (commands: IAudioCommand[], until = 4) => [
		...transformer.transform(commands, mockTimer),
		...transformer.tick(until, { ...mockTimer, now: until })
	]
	const chord = (velocity = 100, startAt = 0) => [
		createAudioCommand(Commands.NOTE_ON, 60, velocity, startAt),
		createAudioCommand(Commands.NOTE_ON, 64, velocity, startAt),
		createAudioCommand(Commands.NOTE_ON, 67, velocity, startAt)
	]

	beforeEach(() => {
		transformer = new TransformerArpeggiator({
			enabled: true,
			pattern: "up",
			rate: "1/16",
			octaves: 1,
			collect: 0
		})
	})

	it("should have correct name", () => {
		expect(transformer.name).toBe("Arpeggiator")
	})

	it("should pass through single note when disabled", () => {
		transformer = new TransformerArpeggiator({ enabled: false })
		const commands = [createAudioCommand(Commands.NOTE_ON, 60)]
		expect(transformer.transform(commands, mockTimer)).toEqual(commands)
	})

	it("should handle empty command array", () => {
		expect(transformer.transform([], mockTimer)).toEqual([])
	})

	it("should play a single note", () => {
		const result = play([createAudioCommand(Commands.NOTE_ON, 60)])
		expect(noteOns(result).map((command) => command.number)).toEqual([60])
	})

	it("should arpeggiate chord notes in up pattern", () => {
		expect(noteOns(play(chord())).map((command) => command.number)).toEqual([60, 64, 67])
	})

	it("should arpeggiate chord notes in down pattern", () => {
		transformer.setConfig("pattern", "down")
		expect(noteOns(play(chord())).map((command) => command.number)).toEqual([67, 64, 60])
	})

	it("should preserve velocity in arpeggio", () => {
		expect(noteOns(play(chord(85))).map((command) => command.velocity)).toEqual([85, 85, 85])
	})

	it("should release every arpeggiated note once its key is released", () => {
		play(chord())
		const result = transformer.transform(
			[60, 64, 67].map((number) => createAudioCommand(Commands.NOTE_OFF, number, 0, 5)),
			{ ...mockTimer, now: 5 }
		)
		expect(noteOffs(result).map((command) => command.number)).toEqual([60, 64, 67])
	})

	it("should reset state", () => {
		transformer.transform(chord(), mockTimer)
		transformer.reset()
		expect(transformer.tick(4, { ...mockTimer, now: 4 })).toEqual([])
		const result = play([createAudioCommand(Commands.NOTE_ON, 62)])
		expect(noteOns(result).map((command) => command.number)).toEqual([62])
	})

	it("should expand notes across multiple octaves", () => {
		transformer.setConfig("octaves", 2)
		expect(noteOns(play(chord())).map((command) => command.number)).toEqual([
			60, 64, 67, 72, 76, 79
		])
	})

	it("should delay arpeggio notes based on rate", () => {
		transformer.setConfig("rate", "1/4")
		expect(noteOns(play(chord())).map((command) => command.startAt)).toEqual([0, 0.5, 1])
	})

	it("should handle chord pattern (all notes at once)", () => {
		transformer.setConfig("pattern", "chord")
		const result = noteOns(transformer.transform(chord(), mockTimer))
		expect(result.map((command) => command.number)).toEqual([60, 64, 67])
	})

	it("should keep cycling while keys are held when repeat is on", () => {
		transformer.setConfig("repeat", 1)
		expect(noteOns(play(chord(), 0.99)).map((command) => command.number)).toEqual([
			60, 64, 67, 60, 64, 67, 60, 64
		])
	})
})

function createAudioCommand(
	type: string,
	noteNumber: number,
	velocity: number = 100,
	startAt: number = 0,
	time: number = 0
): IAudioCommand {
	const cmd = new AudioCommand()
	cmd.type = type
	cmd.subtype = type
	cmd.number = noteNumber
	cmd.velocity = velocity
	cmd.startAt = startAt
	cmd.time = time
	cmd.id = Math.random()
	cmd.endAt = startAt + 1
	cmd.value = 0
	cmd.pitchBend = 0
	cmd.timeCode = 0
	cmd.text = ""
	cmd.raw = new Uint8Array()
	return cmd
}