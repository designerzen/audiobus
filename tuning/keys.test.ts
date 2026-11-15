import { describe, expect, it } from "vitest"
import {
	CHROMATIC_SCALE,
	MAJOR_SCALE,
	NATURAL_MINOR_SCALE,
	getKeyScaleNotes,
	getPitchClassForKey,
	getScaleFormula,
	normaliseKeyName
} from "./keys.ts"

describe("global harmony helpers", () => {
	it("normalises numeric and named keys to pitch classes", () => {
		expect(normaliseKeyName(0)).toBe("C")
		expect(normaliseKeyName(10)).toBe("Bb")
		expect(normaliseKeyName("F#4")).toBe("F#")
		expect(getPitchClassForKey("Db")).toBe(1)
		expect(getPitchClassForKey("C#4")).toBe(1)
		expect(getPitchClassForKey(-1)).toBe(11)
	})

	it("resolves scale formula names and arrays", () => {
		expect(getScaleFormula("MAJOR_SCALE")).toBe(MAJOR_SCALE)
		expect(getScaleFormula("NATURAL_MINOR_SCALE")).toBe(NATURAL_MINOR_SCALE)
		expect(getScaleFormula("CHROMATIC_SCALE")).toBe(CHROMATIC_SCALE)
		expect(getScaleFormula("chromatic")).toBe(CHROMATIC_SCALE)
		expect(getScaleFormula("not a scale")).toBe(MAJOR_SCALE)
		expect(getScaleFormula(MAJOR_SCALE)).toBe(MAJOR_SCALE)
	})

	it("creates playable notes for a shared major key", () => {
		expect(getKeyScaleNotes(0, "MAJOR_SCALE")).toEqual(["C", "D", "E", "F", "G", "A", "B"])
		expect(getKeyScaleNotes("G", "MAJOR_SCALE")).toEqual(["G", "A", "B", "C", "D", "E", "Gb"])
		expect(getKeyScaleNotes("F#", "MAJOR_SCALE")).toEqual([
			"Gb",
			"Ab",
			"Bb",
			"B",
			"Db",
			"Eb",
			"F"
		])
	})

	it("creates playable notes for a shared natural minor key", () => {
		expect(getKeyScaleNotes("A", "NATURAL_MINOR_SCALE")).toEqual([
			"A",
			"B",
			"C",
			"D",
			"E",
			"F",
			"G"
		])
		expect(getKeyScaleNotes("D", "NATURAL_MINOR_SCALE")).toEqual([
			"D",
			"E",
			"F",
			"G",
			"A",
			"Bb",
			"C"
		])
	})

	it("creates all twelve playable notes for global chromatic mode", () => {
		expect(getKeyScaleNotes("C", "CHROMATIC_SCALE")).toEqual([
			"C",
			"Db",
			"D",
			"Eb",
			"E",
			"F",
			"Gb",
			"G",
			"Ab",
			"A",
			"Bb",
			"B"
		])
		expect(getKeyScaleNotes("F#", "CHROMATIC_SCALE")).toEqual([
			"Gb",
			"G",
			"Ab",
			"A",
			"Bb",
			"B",
			"C",
			"Db",
			"D",
			"Eb",
			"E",
			"F"
		])
	})
})