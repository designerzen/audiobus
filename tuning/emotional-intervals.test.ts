import { describe, expect, it } from "vitest"
import * as intervals from "./intervals.ts"
import {
	CHORD_VOICING_INTERVAL_LIBRARY,
	CHROMATIC_INTERVAL_LIBRARY,
	SUSPENDED_7_VOICING_INTERVALS
} from "./emotional-intervals.ts"

describe("emotional interval library", () => {
	it("matches the PhotoSYNTH voicing content", () => {
		expect(CHORD_VOICING_INTERVAL_LIBRARY.radiantMajor11).toEqual([0, 4, 7, 11, 14, 18])
		expect(CHORD_VOICING_INTERVAL_LIBRARY.ecstaticMajor13).toEqual([0, 4, 7, 11, 14, 18, 21])
		expect(CHORD_VOICING_INTERVAL_LIBRARY.weepingMinor11).toEqual([0, 3, 7, 10, 14, 17])
		expect(CHORD_VOICING_INTERVAL_LIBRARY.desolateMinorMajor13).toEqual([
			0, 3, 7, 11, 14, 17, 21
		])
		expect(CHORD_VOICING_INTERVAL_LIBRARY.suspended7).toEqual([0, 5, 7, 10])
		expect(CHORD_VOICING_INTERVAL_LIBRARY.sixth9).toEqual([0, 4, 7, 9, 14])
		expect(CHORD_VOICING_INTERVAL_LIBRARY.minor6th9).toEqual([0, 3, 7, 9, 14])
	})

	it("reuses existing audiobus sets instead of duplicating them", () => {
		expect(CHORD_VOICING_INTERVAL_LIBRARY.major).toBe(intervals.MAJOR_CHORD_INTERVALS)
		expect(CHORD_VOICING_INTERVAL_LIBRARY.major9).toBe(intervals.MAJOR_NINTH_CHORD_INTERVALS)
		expect(CHROMATIC_INTERVAL_LIBRARY.sleep).toBe(intervals.POWER_CHORD_EXTENDED_INTERVALS)
		expect(CHROMATIC_INTERVAL_LIBRARY.coolHeart).toBe(SUSPENDED_7_VOICING_INTERVALS)
	})

	it("holds no two voicings with the same intervals", () => {
		const seen = new Map<string, string>()
		const duplicates: string[] = []
		for (const [name, set] of Object.entries(CHORD_VOICING_INTERVAL_LIBRARY)) {
			const key = set.join(",")
			if (seen.has(key)) {
				duplicates.push(`${name}=${seen.get(key)}`)
			}
			seen.set(key, name)
		}
		expect(duplicates).toEqual([])
	})

	it("defines the chromatic sets", () => {
		expect(CHROMATIC_INTERVAL_LIBRARY.lydianGlow).toEqual([0, 4, 6, 7])
		expect(CHROMATIC_INTERVAL_LIBRARY.alarm).toEqual([0, 1, 6, 13])
		expect(CHROMATIC_INTERVAL_LIBRARY.darkHeart).toEqual([0, 1, 5, 7])
		expect(CHROMATIC_INTERVAL_LIBRARY.blues).toEqual([0, 3, 6, 7])
	})
})