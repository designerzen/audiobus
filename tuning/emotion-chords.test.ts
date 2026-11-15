import { describe, expect, it } from "vitest"
import {
	EMOJI_EXPRESSIONS,
	EMOJI_INTERVAL_CHOICES,
	getChordQualityForEmoji,
	getChromaticIntervalsForEmoji,
	getDiatonicChordInKey,
	getMusicalDetailsFromEmoji,
	getPrimaryIntervalsForEmoji,
	getVoiceCountForEmoji
} from "./emotion-chords.ts"
import { HARMONY_MODE_FREE_RANGE, HARMONY_MODE_GLOBAL_KEY } from "./keys.ts"

const E = EMOJI_EXPRESSIONS
const noteNumbers = (chord: { noteNumber: number }[] | null) => chord?.map((n) => n.noteNumber)
const noteNames = (chord: { noteName: string }[] | null) => chord?.map((n) => n.noteName)

describe("diatonic global-key chord generation", () => {
	it("keeps D minor inside C major instead of making D major", () => {
		const chord = getDiatonicChordInKey(62, 0, "MAJOR_SCALE")
		expect(noteNumbers(chord)).toEqual([62, 65, 69])
		expect(noteNames(chord)).toEqual(["D4", "F4", "A4"])
	})

	it("uses the selected key signature for the same played note", () => {
		expect(noteNames(getDiatonicChordInKey(62, 0, "MAJOR_SCALE"))).toEqual(["D4", "F4", "A4"])
		expect(noteNames(getDiatonicChordInKey(62, 7, "MAJOR_SCALE"))).toEqual(["D4", "Gb4", "A4"])
	})

	it("builds the expected i chord in A natural minor", () => {
		expect(noteNames(getDiatonicChordInKey(69, "A", "NATURAL_MINOR_SCALE"))).toEqual([
			"A4",
			"C5",
			"E5"
		])
	})

	it("snaps non-diatonic roots to the nearest scale degree before stacking thirds", () => {
		expect(noteNames(getDiatonicChordInKey(61, 0, "MAJOR_SCALE"))).toEqual(["C4", "E4", "G4"])
	})

	it("quantizes a chromatic emotional profile when it contains an unavailable note", () => {
		const chord = getMusicalDetailsFromEmoji(72, E.EMOJI_OPEN_MOUTH, true, {
			harmonyMode: HARMONY_MODE_GLOBAL_KEY,
			tonic: "F",
			keyScale: "MAJOR_SCALE"
		})
		expect(noteNames(chord)).toEqual(["C5", "E5", "G5"])
		expect(noteNames(chord)).not.toContain("Eb5")
	})

	it("keeps every chord tone inside the selected global scale", () => {
		const fMajor = new Set([5, 7, 9, 10, 0, 2, 4])
		const chord = getMusicalDetailsFromEmoji(72, E.EMOJI_OPEN_MOUTH, true, {
			harmonyMode: HARMONY_MODE_GLOBAL_KEY,
			tonic: "F",
			keyScale: "MAJOR_SCALE"
		})
		expect(chord?.every((note) => fMajor.has(note.noteNumber % 12))).toBe(true)
	})

	it("global chromatic mode allows all pitch classes and uses chromatic emotion intervals", () => {
		const chord = getMusicalDetailsFromEmoji(60, E.EMOJI_NEUTRAL, true, {
			harmonyMode: HARMONY_MODE_GLOBAL_KEY,
			tonic: "C",
			keyScale: "CHROMATIC_SCALE"
		})
		expect(getChromaticIntervalsForEmoji(E.EMOJI_NEUTRAL)).toEqual([0, 4, 7])
		expect(noteNames(chord)).toEqual(["C4", "E4", "G4"])
	})
})

describe("emoji harmony mode selection", () => {
	it("defines an expressive interval profile for every exported emoji", () => {
		for (const emoji of Object.values(E)) {
			const profile = getPrimaryIntervalsForEmoji(emoji)
			expect(profile.length).toBeGreaterThan(0)
			expect(profile[0]).toBe(0)
		}
		expect(EMOJI_INTERVAL_CHOICES.size).toBeGreaterThan(100)
	})

	it("uses distinct chromatic interval profiles for different emotional characters", () => {
		expect(getPrimaryIntervalsForEmoji(E.EMOJI_NEUTRAL)).toEqual([0, 4, 7])
		expect(getPrimaryIntervalsForEmoji(E.EMOJI_HEARTS)).toEqual([0, 4, 7, 9, 14])
		expect(getPrimaryIntervalsForEmoji(E.EMOJI_SLEEPING)).toEqual([0, 7, 12])
		expect(getPrimaryIntervalsForEmoji(E.EMOJI_ANGRY)).toEqual([0, 3, 6])
	})

	it("global-key mode returns diatonic chords in the shared key", () => {
		const chord = getMusicalDetailsFromEmoji(62, E.EMOJI_NEUTRAL, true, {
			harmonyMode: HARMONY_MODE_GLOBAL_KEY,
			tonic: 0,
			keyScale: "MAJOR_SCALE"
		})
		expect(noteNames(chord)).toEqual(["D4", "F4", "A4"])
	})

	it("global-key mode lets sad emoticons choose a minor triad colour", () => {
		const chord = getMusicalDetailsFromEmoji(69, E.EMOJI_OPEN_MOUTH, true, {
			harmonyMode: HARMONY_MODE_GLOBAL_KEY,
			tonic: "A",
			keyScale: "NATURAL_MINOR_SCALE"
		})
		expect(noteNames(chord)).toEqual(["A4", "C5", "E5"])
	})

	it("global-key mode lets angry emoticons choose a tense colour inside the key", () => {
		const chord = getMusicalDetailsFromEmoji(71, E.EMOJI_ANGRY, true, {
			harmonyMode: HARMONY_MODE_GLOBAL_KEY,
			tonic: 0,
			keyScale: "MAJOR_SCALE"
		})
		expect(noteNames(chord)).toEqual(["B4", "D5", "F5"])
	})

	it("free range mode preserves note-as-root behaviour", () => {
		const chord = getMusicalDetailsFromEmoji(62, E.EMOJI_NEUTRAL, true, {
			harmonyMode: HARMONY_MODE_FREE_RANGE,
			tonic: 0,
			keyScale: "MAJOR_SCALE"
		})
		expect(noteNames(chord)).toEqual(["D4", "Gb4", "A4"])
	})

	it("voices dense emoji with more notes and falls back for unknown emoji", () => {
		expect(getVoiceCountForEmoji(E.EMOJI_WAIL)).toBe(5)
		expect(getVoiceCountForEmoji(E.EMOJI_NEUTRAL)).toBe(3)
		expect(getMusicalDetailsFromEmoji(60, E.EMOJI_WAIL)).toHaveLength(5)
		expect(noteNumbers(getMusicalDetailsFromEmoji(60, E.EMOJI_NEUTRAL_EYES_CLOSED))).toEqual([
			60
		])
		expect(noteNumbers(getMusicalDetailsFromEmoji(60, "not an emoji"))).toEqual([60, 64, 67])
		expect(getChordQualityForEmoji(E.EMOJI_NEUTRAL)).toBe("major")
	})
})