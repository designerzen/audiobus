import { describe, it, expect } from "vitest"
import {
	buildPassingChord,
	computeKeyScores,
	detectChord,
	findKey,
	groupNextChords,
	isSecondaryDominant,
	placeBassNote,
	voiceChord
} from "./chord-suggestions"

describe("detectChord", () => {
	it("names root position and inverted triads", () => {
		expect(detectChord([60, 64, 67])).toMatchObject({ rootPc: 0, type: "major", label: "C" })
		expect(detectChord([64, 67, 72])).toMatchObject({ rootPc: 0, type: "major" })
		expect(detectChord([57, 60, 64])).toMatchObject({ rootPc: 9, type: "minor", label: "Am" })
	})

	it("detects sevenths and extensions folded into one octave", () => {
		expect(detectChord([55, 59, 62, 65])).toMatchObject({ rootPc: 7, type: "dom7", label: "Gdom7" })
		expect(detectChord([60, 62, 64, 67])).toMatchObject({ rootPc: 0, type: "add9" })
	})

	it("keeps the octave the root was played in", () => {
		expect(detectChord([48, 52, 55])?.octaveOffset).toBe(48)
	})

	it("ignores single notes and unknown shapes", () => {
		expect(detectChord([60])).toBeNull()
		expect(detectChord([60, 72])).toBeNull()
		expect(detectChord([60, 61, 62])).toBeNull()
	})
})

describe("computeKeyScores", () => {
	it("ranks the key that contains the history first", () => {
		const history = [
			{ rootPc: 0, type: "major" as const },
			{ rootPc: 5, type: "major" as const },
			{ rootPc: 7, type: "major" as const },
			{ rootPc: 9, type: "minor" as const }
		]
		const [top] = computeKeyScores(history)
		expect(["C", "Am"]).toContain(top.name)
		expect(top.score).toBe(4)
	})

	it("lifts a forced key to the top", () => {
		expect(computeKeyScores([{ rootPc: 0, type: "major" }], "Eb")[0].name).toBe("Eb")
	})
})

describe("suggestions", () => {
	const cMajor = findKey("C")!

	it("treats V/V as a secondary dominant", () => {
		expect(isSecondaryDominant({ rootPc: 2, type: "dom7", label: "D7" }, cMajor)).toBe(true)
		expect(isSecondaryDominant({ rootPc: 1, type: "dom7", label: "C#7" }, cMajor)).toBe(false)
	})

	it("groups every suggestion once and lists the full diatonic set", () => {
		const groups = groupNextChords(detectChord([60, 64, 67])!, cMajor)
		expect(groups.diatonic.map((c) => c.label)).toEqual(["C", "Dm", "Em", "F", "G", "Am", "Bdim"])
		expect(groups.functional.some((c) => c.label === "Ddom7")).toBe(true)
		expect(groups.chromatic.every((c) => c.group === "chromatic")).toBe(true)
	})

	it("builds passing chords", () => {
		expect(buildPassingChord({ rootPc: 0, type: "major", label: "C" }).rootPc).toBe(11)
		expect(buildPassingChord({ rootPc: 7, type: "dom7", label: "G7" }).rootPc).toBe(1)
	})
})

describe("voicing", () => {
	it("keeps chord tones near the centre", () => {
		const notes = voiceChord(7, "major", 60)
		expect(notes.every((n) => Math.abs(n - 60) <= 6)).toBe(true)
		expect(notes.map((n) => n % 12).sort()).toEqual([11, 2, 7].sort())
	})

	it("places bass notes below the voicing and not below C1", () => {
		expect(placeBassNote(0, 60)).toBe(36)
		expect(placeBassNote(0, 30)).toBe(24)
	})
})
