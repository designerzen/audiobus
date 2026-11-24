import { DEFAULT_HARMONY, NOTE_NAMES, type HarmonicState } from "../io/harmony.ts"
import { mapPitchSet, mod12, pitchClasses } from "../tuning/pitch-class-set.ts"

/** MIDI 2.0 UMP Message Type 0xD (Flex Data, always 128-bit / 4 words). */
export const UMP_TYPE_FLEX_DATA = 0xd
export const FLEX_STATUS_BANK_COMMON = 0x00
export const FLEX_STATUS_SET_TEMPO = 0x00
export const FLEX_STATUS_SET_KEY_SIGNATURE = 0x05
export const FLEX_STATUS_SET_CHORD_NAME = 0x06

const MAJOR_MASK = 2741 // 0b101010110101 (C D E F G A B)

// MIDI 2.0 note letter codes: 1=A, 2=B, 3=C, 4=D, 5=E, 6=F, 7=G
const LETTER_TO_PC: Record<number, number> = {
	1: 9,
	2: 11,
	3: 0,
	4: 2,
	5: 4,
	6: 5,
	7: 7
}

// Default (letter, accidental) spelling for each pitch class 0..11
const PC_TO_SPELLING: ReadonlyArray<{ letter: number; accidental: number }> = [
	{ letter: 3, accidental: 0 }, // C
	{ letter: 3, accidental: 1 }, // C#
	{ letter: 4, accidental: 0 }, // D
	{ letter: 5, accidental: -1 }, // Eb
	{ letter: 5, accidental: 0 }, // E
	{ letter: 6, accidental: 0 }, // F
	{ letter: 6, accidental: 1 }, // F#
	{ letter: 7, accidental: 0 }, // G
	{ letter: 1, accidental: -1 }, // Ab
	{ letter: 1, accidental: 0 }, // A
	{ letter: 2, accidental: -1 }, // Bb
	{ letter: 2, accidental: 0 } // B
]

// Standard MIDI 2.0 Table 54 Chord Types -> semitone intervals from chord tonic
const CHORD_TYPE_INTERVALS: Record<number, readonly number[]> = {
	0x01: [0, 4, 7], // Major
	0x02: [0, 4, 7, 9], // Major 6th
	0x03: [0, 4, 7, 11], // Major 7th
	0x04: [0, 4, 7, 11, 2], // Major 9th
	0x05: [0, 4, 7, 11, 2, 5], // Major 11th
	0x06: [0, 4, 7, 11, 2, 5, 9], // Major 13th
	0x07: [0, 3, 7], // Minor
	0x08: [0, 3, 7, 9], // Minor 6th
	0x09: [0, 3, 7, 10], // Minor 7th
	0x0a: [0, 3, 7, 10, 2], // Minor 9th
	0x0b: [0, 3, 7, 10, 2, 5], // Minor 11th
	0x0c: [0, 3, 7, 10, 2, 5, 9], // Minor 13th
	0x0d: [0, 4, 7, 10], // Dominant 7th
	0x0e: [0, 4, 7, 10, 2], // Dominant 9th
	0x0f: [0, 4, 7, 10, 2, 5], // Dominant 11th
	0x10: [0, 4, 7, 10, 2, 5, 9], // Dominant 13th
	0x11: [0, 4, 8], // Augmented
	0x12: [0, 4, 8, 10], // Augmented 7th
	0x13: [0, 3, 6], // Diminished
	0x14: [0, 3, 6, 9], // Diminished 7th
	0x15: [0, 3, 6, 10], // Half-Diminished
	0x16: [0, 3, 7, 11], // Minor-Major 7th
	0x17: [0, 7], // Pedal / open 5th
	0x18: [0, 7], // Power
	0x19: [0, 2, 7], // Sus2
	0x1a: [0, 5, 7], // Sus4
	0x1b: [0, 5, 7, 10] // 7Sus4
}

const CHORD_TYPE_SUFFIX: Record<number, string> = {
	0x01: "",
	0x02: "6",
	0x03: "maj7",
	0x04: "maj9",
	0x05: "maj11",
	0x06: "maj13",
	0x07: "m",
	0x08: "m6",
	0x09: "m7",
	0x0a: "m9",
	0x0b: "m11",
	0x0c: "m13",
	0x0d: "7",
	0x0e: "9",
	0x0f: "11",
	0x10: "13",
	0x11: "aug",
	0x12: "aug7",
	0x13: "dim",
	0x14: "dim7",
	0x15: "m7b5",
	0x16: "mMaj7",
	0x17: "(pedal)",
	0x18: "5",
	0x19: "sus2",
	0x1a: "sus4",
	0x1b: "7sus4"
}

const DEGREE_TO_SEMITONE: Record<number, number> = {
	1: 0,
	2: 2,
	3: 4,
	4: 5,
	5: 7,
	6: 9,
	7: 10,
	9: 2,
	11: 5,
	13: 9
}

const MAJOR_ROOT_TO_SHARPS: Record<number, number> = {
	0: 0, // C
	7: 1, // G
	2: 2, // D
	9: 3, // A
	4: 4, // E
	11: 5, // B
	6: 6, // F#
	5: -1, // F
	10: -2, // Bb
	3: -3, // Eb
	8: -4, // Ab
	1: -5 // Db
}

export interface FlexDataAddress {
	group?: number
	channel?: number
	/** When true (default), addresses the whole UMP group rather than a single channel. */
	groupScoped?: boolean
}

export interface FlexChordAlteration {
	/** 1=add, 2=subtract, 3=raise, 4=lower */
	type: 1 | 2 | 3 | 4
	degree: number
}

export interface DecodedFlexTempo {
	kind: "tempo"
	group: number
	bpm: number
	tenNanosecondsPerQuarterNote: number
}

export interface DecodedFlexKeySignature {
	kind: "keySignature"
	group: number
	channel: number
	groupScoped: boolean
	sharpsOrFlats: number
	root: number
	scale: number
}

export interface DecodedFlexChordName {
	kind: "chordName"
	group: number
	channel: number
	groupScoped: boolean
	root: number
	chord: number
	chordType: number
	alterations: FlexChordAlteration[]
	bass?: number
	name: string
}

export type DecodedFlexData = DecodedFlexTempo | DecodedFlexKeySignature | DecodedFlexChordName

function signed4(nibble: number): number {
	const value = nibble & 0xf
	return value >= 8 ? value - 16 : value
}

function packSigned4(value: number): number {
	return (Math.max(-7, Math.min(7, Math.round(value))) & 0xf) >>> 0
}

function makeFlexHeader(statusBank: number, status: number, options: FlexDataAddress = {}): number {
	const group = Math.max(0, Math.min(15, Math.round(options.group ?? 0))) & 0xf
	const groupScoped = options.groupScoped ?? true
	const addrs = groupScoped ? 1 : 0
	const channel = groupScoped
		? 0
		: Math.max(0, Math.min(15, Math.round((options.channel ?? 1) - 1))) & 0xf
	return (
		(UMP_TYPE_FLEX_DATA << 28) |
		(group << 24) |
		(addrs << 20) |
		(channel << 16) |
		((statusBank & 0xff) << 8) |
		(status & 0xff)
	) >>> 0
}

function intervalsToMask(root: number, intervals: Iterable<number>): number {
	let mask = 0
	for (const interval of intervals) {
		mask |= 1 << mod12(root + interval)
	}
	return mask
}

function applyAlterations(
	baseIntervals: readonly number[],
	alterations: readonly FlexChordAlteration[]
): Set<number> {
	const tones = new Set<number>(baseIntervals.map((interval) => mod12(interval)))
	for (const alt of alterations) {
		const semitone = DEGREE_TO_SEMITONE[alt.degree]
		if (semitone === undefined) {
			continue
		}
		if (alt.type === 1) {
			tones.add(semitone)
		} else if (alt.type === 2) {
			tones.delete(semitone)
			tones.delete(mod12(semitone - 1))
			tones.delete(mod12(semitone + 1))
		} else if (alt.type === 3) {
			tones.delete(semitone)
			tones.add(mod12(semitone + 1))
		} else if (alt.type === 4) {
			tones.delete(semitone)
			tones.add(mod12(semitone - 1))
		}
	}
	return tones
}

function decodeAlterations(word1: number, word2: number): FlexChordAlteration[] {
	const bytes = [
		(word1 >>> 8) & 0xff,
		word1 & 0xff,
		(word2 >>> 24) & 0xff,
		(word2 >>> 16) & 0xff
	]
	const result: FlexChordAlteration[] = []
	for (const byte of bytes) {
		const type = (byte >>> 4) & 0xf
		const degree = byte & 0xf
		if (type >= 1 && type <= 4 && degree > 0) {
			result.push({ type: type as 1 | 2 | 3 | 4, degree })
		}
	}
	return result
}

function formatChordName(
	root: number,
	chordType: number,
	alterations: readonly FlexChordAlteration[],
	bass?: number
): string {
	const suffix = CHORD_TYPE_SUFFIX[chordType] ?? ""
	const altText = alterations
		.map((alt) => {
			if (alt.type === 1) {
				return `add${alt.degree}`
			}
			if (alt.type === 2) {
				return `no${alt.degree}`
			}
			if (alt.type === 3) {
				return `#${alt.degree}`
			}
			return `b${alt.degree}`
		})
		.join("")
	const slash = bass !== undefined && bass !== root ? `/${NOTE_NAMES[bass]}` : ""
	return `${NOTE_NAMES[root]}${suffix}${altText}${slash}`
}

/** Decode a MIDI 2.0 Flex Data UMP packet (Set Tempo, Set Key Signature, Set Chord Name). */
export function decodeFlexDataUmp(words: readonly number[]): DecodedFlexData | undefined {
	if (!Array.isArray(words) || words.length !== 4) {
		return
	}
	const w0 = words[0] >>> 0
	if (w0 >>> 28 !== UMP_TYPE_FLEX_DATA) {
		return
	}
	const format = (w0 >>> 22) & 0x3
	if (format !== 0) {
		return
	}
	const group = (w0 >>> 24) & 0xf
	const groupScoped = ((w0 >>> 20) & 0x3) === 1
	const channel = groupScoped ? 0 : ((w0 >>> 16) & 0xf) + 1
	const statusBank = (w0 >>> 8) & 0xff
	const status = w0 & 0xff
	if (statusBank !== FLEX_STATUS_BANK_COMMON) {
		return
	}

	const w1 = words[1] >>> 0
	const w2 = words[2] >>> 0
	const w3 = words[3] >>> 0

	if (status === FLEX_STATUS_SET_TEMPO) {
		if (w1 === 0) {
			return
		}
		return {
			kind: "tempo",
			group,
			tenNanosecondsPerQuarterNote: w1,
			bpm: 6_000_000_000 / w1
		}
	}

	if (status === FLEX_STATUS_SET_KEY_SIGNATURE) {
		const sfNibble = (w1 >>> 28) & 0xf
		const tonicLetter = (w1 >>> 24) & 0xf
		if (sfNibble === 0x8) {
			return
		}
		const sharpsOrFlats = signed4(sfNibble)
		const majorRoot = mod12(sharpsOrFlats * 7)
		const scale = mapPitchSet(MAJOR_MASK, 1, majorRoot)
		let root = majorRoot
		const naturalPc = LETTER_TO_PC[tonicLetter]
		if (naturalPc !== undefined) {
			// Match the letter's diatonic spelling inside the key signature's scale.
			for (const delta of [0, 1, -1]) {
				const candidate = mod12(naturalPc + delta)
				if (scale & (1 << candidate)) {
					root = candidate
					break
				}
			}
		}
		return {
			kind: "keySignature",
			group,
			channel,
			groupScoped,
			sharpsOrFlats,
			root,
			scale
		}
	}

	if (status === FLEX_STATUS_SET_CHORD_NAME) {
		const tonicAccidental = signed4((w1 >>> 28) & 0xf)
		const tonicLetter = (w1 >>> 24) & 0xf
		const chordType = (w1 >>> 16) & 0xff
		const naturalPc = LETTER_TO_PC[tonicLetter]
		if (naturalPc === undefined || chordType === 0) {
			return
		}
		const root = mod12(naturalPc + tonicAccidental)
		const baseIntervals = CHORD_TYPE_INTERVALS[chordType] ?? [0, 4, 7]
		const alterations = decodeAlterations(w1, w2)
		const tones = applyAlterations(baseIntervals, alterations)
		const chord = intervalsToMask(root, tones)

		const bassAccidental = signed4((w3 >>> 28) & 0xf)
		const bassLetter = (w3 >>> 24) & 0xf
		const bassNatural = LETTER_TO_PC[bassLetter]
		const bass = bassNatural !== undefined ? mod12(bassNatural + bassAccidental) : undefined

		return {
			kind: "chordName",
			group,
			channel,
			groupScoped,
			root,
			chord,
			chordType,
			alterations,
			bass,
			name: formatChordName(root, chordType, alterations, bass)
		}
	}
}

/** Encode a MIDI 2.0 Flex Data Set Tempo UMP packet. */
export function encodeFlexTempoUmp(bpm: number, options: FlexDataAddress = {}): number[] {
	const safeBpm = Math.max(10, Math.min(400, Number(bpm) || 120))
	const units = Math.max(1, Math.round(6_000_000_000 / safeBpm)) >>> 0
	return [
		makeFlexHeader(FLEX_STATUS_BANK_COMMON, FLEX_STATUS_SET_TEMPO, {
			...options,
			groupScoped: true
		}),
		units,
		0,
		0
	]
}

/** Encode a MIDI 2.0 Flex Data Set Key Signature UMP packet from HarmonicState. */
export function encodeFlexKeySignatureUmp(
	state: Pick<HarmonicState, "root" | "scale">,
	options: FlexDataAddress = {}
): number[] {
	let sharpsOrFlats = 0
	for (let majorRoot = 0; majorRoot < 12; majorRoot++) {
		if (mapPitchSet(MAJOR_MASK, 1, majorRoot) === state.scale) {
			sharpsOrFlats = MAJOR_ROOT_TO_SHARPS[majorRoot] ?? 0
			break
		}
	}
	const spelling = PC_TO_SPELLING[mod12(state.root)]
	const w1 = ((packSigned4(sharpsOrFlats) << 28) | ((spelling.letter & 0xf) << 24)) >>> 0
	return [makeFlexHeader(FLEX_STATUS_BANK_COMMON, FLEX_STATUS_SET_KEY_SIGNATURE, options), w1, 0, 0]
}

function matchChordType(relativeMask: number): number {
	for (const [typeKey, intervals] of Object.entries(CHORD_TYPE_INTERVALS)) {
		const mask = intervalsToMask(0, intervals)
		if (mask === relativeMask) {
			return Number(typeKey)
		}
	}
	// Fallback to the closest triad (minor, diminished, augmented, sus4, sus2, or major).
	const hasMin3 = Boolean(relativeMask & (1 << 3))
	const hasMaj3 = Boolean(relativeMask & (1 << 4))
	const hasDim5 = Boolean(relativeMask & (1 << 6))
	const hasPerf5 = Boolean(relativeMask & (1 << 7))
	const hasAug5 = Boolean(relativeMask & (1 << 8))
	if (hasMin3 && hasDim5) {
		return 0x13
	}
	if (hasMin3) {
		return 0x07
	}
	if (hasMaj3 && hasAug5) {
		return 0x11
	}
	if (!hasMaj3 && relativeMask & (1 << 5) && hasPerf5) {
		return 0x1a
	}
	if (!hasMaj3 && relativeMask & (1 << 2) && hasPerf5) {
		return 0x19
	}
	return 0x01
}

/** Encode a MIDI 2.0 Flex Data Set Chord Name UMP packet from HarmonicState. */
export function encodeFlexChordNameUmp(
	state: Pick<HarmonicState, "root" | "chord" | "bass">,
	options: FlexDataAddress = {}
): number[] {
	const root = mod12(state.root)
	const relativeMask = mapPitchSet(state.chord, 1, -root)
	const chordType = matchChordType(relativeMask)
	const baseMask = intervalsToMask(0, CHORD_TYPE_INTERVALS[chordType] ?? [0, 4, 7])
	const alterations: FlexChordAlteration[] = []

	// Encode up to 4 extra tones as "add" alterations when not an exact table match.
	const extras = relativeMask & ~baseMask
	for (const [degreeKey, semitone] of [
		[2, 2],
		[4, 5],
		[6, 9],
		[7, 10]
	] as const) {
		if (alterations.length < 4 && extras & (1 << semitone)) {
			alterations.push({ type: 1, degree: degreeKey })
		}
	}

	const packAlt = (alt?: FlexChordAlteration) =>
		alt ? (((alt.type & 0xf) << 4) | (alt.degree & 0xf)) & 0xff : 0

	const tonic = PC_TO_SPELLING[root]
	const w1 =
		((packSigned4(tonic.accidental) << 28) |
			((tonic.letter & 0xf) << 24) |
			((chordType & 0xff) << 16) |
			(packAlt(alterations[0]) << 8) |
			packAlt(alterations[1])) >>>
		0
	const w2 = ((packAlt(alterations[2]) << 24) | (packAlt(alterations[3]) << 16)) >>> 0

	let w3 = 0
	if (state.bass !== undefined) {
		const bass = PC_TO_SPELLING[mod12(state.bass)]
		w3 = ((packSigned4(bass.accidental) << 28) | ((bass.letter & 0xf) << 24)) >>> 0
	}

	return [makeFlexHeader(FLEX_STATUS_BANK_COMMON, FLEX_STATUS_SET_CHORD_NAME, options), w1, w2, w3]
}

export interface FlexDataHarmonyAdapterOptions {
	/** Coalesce window in milliseconds so chord + key/bass packets land together (article uses 50 ms). */
	coalesceMs?: number
	initialHarmony?: HarmonicState
	onHarmony?: (state: HarmonicState, chordName?: string) => void
	onTempo?: (bpm: number) => void
}

/**
 * Stateful MIDI 2.0 Flex Data decoder that merges Set Chord Name, Set Key Signature,
 * and Set Tempo packets into HarmonEasy's HarmonicState with a coalescing window.
 */
export class FlexDataHarmonyAdapter {
	#state: HarmonicState
	#chordName?: string
	#coalesceMs: number
	#timer?: ReturnType<typeof setTimeout>
	#onHarmony?: (state: HarmonicState, chordName?: string) => void
	#onTempo?: (bpm: number) => void

	constructor(options: FlexDataHarmonyAdapterOptions = {}) {
		this.#state = { ...(options.initialHarmony ?? DEFAULT_HARMONY) }
		this.#coalesceMs = Math.max(0, options.coalesceMs ?? 50)
		this.#onHarmony = options.onHarmony
		this.#onTempo = options.onTempo
	}

	get state(): HarmonicState {
		return { ...this.#state }
	}

	get chordName(): string | undefined {
		return this.#chordName
	}

	feed(words: readonly number[]): DecodedFlexData | undefined {
		const decoded = decodeFlexDataUmp(words)
		if (!decoded) {
			return
		}
		if (decoded.kind === "tempo") {
			this.#onTempo?.(decoded.bpm)
			return decoded
		}
		if (decoded.kind === "keySignature") {
			this.#state = {
				...this.#state,
				root: decoded.root,
				scale: decoded.scale
			}
			this.#scheduleEmit()
			return decoded
		}
		if (decoded.kind === "chordName") {
			// Ensure scale at least contains the incoming chord tones if none was set yet.
			const nextScale =
				pitchClasses(this.#state.scale).length > 0 ? this.#state.scale : decoded.chord
			this.#state = {
				root: decoded.root,
				scale: nextScale,
				chord: decoded.chord,
				...(decoded.bass !== undefined ? { bass: decoded.bass } : {})
			}
			this.#chordName = decoded.name
			this.#scheduleEmit()
			return decoded
		}
		return decoded
	}

	flush(): void {
		if (this.#timer) {
			clearTimeout(this.#timer)
			this.#timer = undefined
		}
		this.#onHarmony?.(this.state, this.#chordName)
	}

	destroy(): void {
		if (this.#timer) {
			clearTimeout(this.#timer)
			this.#timer = undefined
		}
	}

	#scheduleEmit(): void {
		if (this.#coalesceMs === 0) {
			this.#onHarmony?.(this.state, this.#chordName)
			return
		}
		if (this.#timer) {
			clearTimeout(this.#timer)
		}
		this.#timer = setTimeout(() => {
			this.#timer = undefined
			this.#onHarmony?.(this.state, this.#chordName)
		}, this.#coalesceMs)
	}
}
