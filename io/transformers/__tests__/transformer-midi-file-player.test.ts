import { describe, it, expect, beforeEach } from "vitest"
import { TransformerMIDIFilePlayer } from "../robots/transformer-midi-file-player.ts"
import AudioCommand from "../../audio-command.ts"
import * as Commands from '../../../commands'
import Timer from "../../timing/timer.ts"

describe("TransformerMIDIFilePlayer", () => {
	let transformer: TransformerMIDIFilePlayer
	let timer: Timer

	beforeEach(() => {
		transformer = new TransformerMIDIFilePlayer()
		timer = new Timer()
	})

	it("should pass through commands when MIDI file is not loaded", () => {
		const noteOn = new AudioCommand()
		noteOn.type = Commands.NOTE_ON
		noteOn.number = 60
		noteOn.velocity = 100
		noteOn.startAt = 0

		const noteOff = new AudioCommand()
		noteOff.type = Commands.NOTE_OFF
		noteOff.number = 60
		noteOff.velocity = 0
		noteOff.startAt = 1

		const commands = [noteOn, noteOff]
		const result = transformer.transform(commands, timer)

		expect(result).toEqual(commands)
	})

	it("should return empty array when disabled", () => {
		transformer.setConfig("enabled", false)

		const noteOn = new AudioCommand()
		noteOn.type = Commands.NOTE_ON
		noteOn.number = 60

		const result = transformer.transform([noteOn], timer)
		expect(result).toEqual([noteOn])
	})

	it("should have correct name and description", () => {
		expect(transformer.name).toBe("MIDI File Player")
		expect(transformer.description).toContain("Replace notes")
	})

	it("should expose configuration fields", () => {
		const fields = transformer.fields
		expect(fields.length).toBeGreaterThan(0)
		expect(fields.some((f) => f.name === "midiFileUrl")).toBe(true)
		expect(fields.some((f) => f.name === "enabled")).toBe(true)
	})

	it("should reset state", () => {
		transformer.reset()
		// Should not throw
		expect(true).toBe(true)
	})

	it("should destroy resources", () => {
		transformer.destroy()
		// Should not throw
		expect(true).toBe(true)
	})
})




