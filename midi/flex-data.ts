import {
	DEFAULT_HARMONY,
	NOTE_NAMES,
	parseHarmony,
	type HarmonicState,
	type HarmonyChordSymbol
} from "../io/harmony.ts"
import { mapPitchSet, mod12 } from "../tuning/pitch-class-set.ts"

/** MIDI 2.0 UMP Message Type 0xD (Flex Data, always 128-bit / 4 words). */
export const UMP_TYPE_FLEX_DATA = 0xd
export const FLEX_STATUS_BANK_COMMON = 0x00
export const FLEX_STATUS_SET_TEMPO = 0x00
export const FLEX_STATUS_SET_TIME_SIGNATURE = 0x01
export const FLEX_STATUS_SET_METRONOME = 0x02
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
	0x17: [0], // Pedal (root and octave)
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
	tonic: number
	root?: number
	scale?: number
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
	symbol: HarmonyChordSymbol
}

export interface FlexTimeSignature {
	numerator: number
	denominator: number
	thirtySecondNotes: number
}
export interface FlexMetronome {
	clocksPerClick: number
	barAccents: [number, number, number]
	subdivisions: [number, number]
}
export type DecodedFlexData =
	| DecodedFlexTempo
	| DecodedFlexKeySignature
	| DecodedFlexChordName
	| ({ kind: "timeSignature"; group: number } & FlexTimeSignature)
	| ({ kind: "metronome"; group: number } & FlexMetronome)

function signed4(nibble: number): number {
	const value = nibble & 0xf
	return value >= 8 ? value - 16 : value
}

function packSigned4(value: number): number {
	return (value & 0xf) >>> 0
}

function makeFlexHeader(statusBank: number, status: number, options: FlexDataAddress = {}): number {
	if (
		options.group !== undefined &&
		(!Number.isInteger(options.group) || options.group < 0 || options.group > 15)
	) {
		throw new Error("Invalid UMP group")
	}
	if (
		options.channel !== undefined &&
		!options.groupScoped &&
		(!Number.isInteger(options.channel) || options.channel < 1 || options.channel > 16)
	) {
		throw new Error("Invalid MIDI channel")
	}
	const group = Math.max(0, Math.min(15, Math.round(options.group ?? 0))) & 0xf
	const groupScoped = options.groupScoped ?? true
	const addrs = groupScoped ? 1 : 0
	const channel = groupScoped
		? 0
		: Math.max(0, Math.min(15, Math.round((options.channel ?? 1) - 1))) & 0xf
	return (
		((UMP_TYPE_FLEX_DATA << 28) |
			(group << 24) |
			(addrs << 20) |
			(channel << 16) |
			((statusBank & 0xff) << 8) |
			(status & 0xff)) >>>
		0
	)
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
		const degree = ((alt.degree - 1) % 7) + 1
		const natural = [0, 2, 4, 5, 7, 9, 11][degree - 1]
		const candidates =
			degree === 3 ? [3, 4] : degree === 5 ? [6, 7, 8] : degree === 7 ? [10, 11] : [natural]
		const semitone = candidates.find((n) => tones.has(n)) ?? natural
		if (semitone === undefined) {
			continue
		}
		if (alt.type === 1) {
			tones.add(semitone)
		} else if (alt.type === 2) {
			tones.delete(semitone)
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

function decodeAlterations(word1: number, word2: number): FlexChordAlteration[] | undefined {
	const bytes = [(word1 >>> 8) & 0xff, word1 & 0xff, (word2 >>> 24) & 0xff, (word2 >>> 16) & 0xff]
	const result: FlexChordAlteration[] = []
	for (const byte of bytes) {
		const type = (byte >>> 4) & 0xf
		const degree = byte & 0xf
		if (type > 4 || (type !== 0 && degree === 0)) {
			return
		}
		if (type >= 1 && degree > 0) {
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
	if (
		!Array.isArray(words) ||
		words.length !== 4 ||
		words.some((w) => !Number.isInteger(w) || w < 0 || w > 0xffffffff)
	) {
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
	if (((w0 >>> 20) & 3) > 1) {
		return
	}
	const groupScoped = ((w0 >>> 20) & 0x3) === 1
	if (groupScoped && ((w0 >>> 16) & 15) !== 0) {
		return
	}
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
		if (!groupScoped || w1 === 0 || w2 !== 0 || w3 !== 0) {
			return
		}
		return {
			kind: "tempo",
			group,
			tenNanosecondsPerQuarterNote: w1,
			bpm: 6_000_000_000 / w1
		}
	}
	if (status === FLEX_STATUS_SET_TIME_SIGNATURE) {
		const numerator = w1 >>> 24
		const exponent = (w1 >>> 16) & 255
		const thirtySecondNotes = (w1 >>> 8) & 255
		if (
			!groupScoped ||
			!numerator ||
			exponent > 7 ||
			!thirtySecondNotes ||
			w1 & 255 ||
			w2 ||
			w3
		) {
			return
		}
		return {
			kind: "timeSignature",
			group,
			numerator,
			denominator: 2 ** exponent,
			thirtySecondNotes
		}
	}
	if (status === FLEX_STATUS_SET_METRONOME) {
		if (!groupScoped || !((w1 >>> 24) & 255) || w2 & 0xffff || w3) {
			return
		}
		return {
			kind: "metronome",
			group,
			clocksPerClick: w1 >>> 24,
			barAccents: [(w1 >>> 16) & 255, (w1 >>> 8) & 255, w1 & 255],
			subdivisions: [w2 >>> 24, (w2 >>> 16) & 255]
		}
	}

	if (status === FLEX_STATUS_SET_KEY_SIGNATURE) {
		const sfNibble = (w1 >>> 28) & 0xf
		const tonicLetter = (w1 >>> 24) & 0xf
		if (tonicLetter > 7 || w1 & 0xffffff || w2 || w3) {
			return
		}
		const sharpsOrFlats = signed4(sfNibble)
		if (sharpsOrFlats === -8) {
			return {
				kind: "keySignature",
				group,
				channel,
				groupScoped,
				sharpsOrFlats,
				tonic: tonicLetter
			}
		}
		const majorRoot = mod12(sharpsOrFlats * 7)
		const scale = mapPitchSet(MAJOR_MASK, 1, majorRoot)
		let root: number | undefined
		const naturalPc = LETTER_TO_PC[tonicLetter]
		if (naturalPc !== undefined) {
			const order = sharpsOrFlats > 0 ? [6, 3, 7, 4, 1, 5, 2] : [2, 5, 1, 4, 7, 3, 6]
			root = mod12(
				naturalPc +
					(order.slice(0, Math.abs(sharpsOrFlats)).includes(tonicLetter)
						? Math.sign(sharpsOrFlats)
						: 0)
			)
		}
		return {
			kind: "keySignature",
			group,
			channel,
			groupScoped,
			sharpsOrFlats,
			tonic: tonicLetter,
			root,
			scale
		}
	}

	if (status === FLEX_STATUS_SET_CHORD_NAME) {
		const tonicAccidental = signed4((w1 >>> 28) & 0xf)
		const tonicLetter = (w1 >>> 24) & 0xf
		const chordType = (w1 >>> 16) & 0xff
		const naturalPc = LETTER_TO_PC[tonicLetter]
		if (
			w2 & 0xffff ||
			chordType > 27 ||
			(chordType !== 0 && naturalPc === undefined) ||
			tonicAccidental < -2 ||
			tonicAccidental > 2
		) {
			return
		}
		const root = mod12((naturalPc ?? 0) + tonicAccidental)
		const baseIntervals = CHORD_TYPE_INTERVALS[chordType] ?? []
		const alterations = decodeAlterations(w1, w2)
		if (!alterations) {
			return
		}
		const tones = applyAlterations(baseIntervals, alterations)
		const chord = chordType === 0 ? 0 : intervalsToMask(root, tones)

		const bassAccidental = signed4((w3 >>> 28) & 0xf)
		const bassLetter = (w3 >>> 24) & 0xf
		const bassNatural = LETTER_TO_PC[bassLetter]
		const bassType = (w3 >>> 16) & 255
		const bassAlterations = decodeAlterations(w3, 0)
		if (
			!bassAlterations ||
			bassType > 27 ||
			bassLetter > 7 ||
			(bassLetter === 0
				? bassAccidental !== -8 && chordType !== 0
				: bassAccidental < -2 || bassAccidental > 2)
		) {
			return
		}
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
			name: chordType === 0 ? "N.C." : formatChordName(root, chordType, alterations, bass),
			symbol: {
				tonic: tonicLetter,
				accidental: tonicAccidental,
				type: chordType,
				alterations,
				bassTonic: bassLetter,
				bassAccidental,
				bassType,
				bassAlterations
			}
		}
	}
}

/** Encode a MIDI 2.0 Flex Data Set Tempo UMP packet. */
export function encodeFlexTempoUmp(bpm: number, options: FlexDataAddress = {}): number[] {
	const units = Math.round(6_000_000_000 / bpm)
	if (!Number.isFinite(bpm) || bpm <= 0 || units < 1 || units > 0xffffffff) {
		throw new Error("Tempo is outside the Flex Data range")
	}
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
	state: Pick<HarmonicState, "root" | "scale" | "keySignature">,
	options: FlexDataAddress = {}
): number[] {
	let sharpsOrFlats = -8
	for (let majorRoot = 0; majorRoot < 12; majorRoot++) {
		if (mapPitchSet(MAJOR_MASK, 1, majorRoot) === state.scale) {
			sharpsOrFlats = MAJOR_ROOT_TO_SHARPS[majorRoot] ?? 0
			break
		}
	}
	const spelling = PC_TO_SPELLING[mod12(state.root)]
	let tonic = spelling.letter
	// Choose the letter which actually names this tonic in the signature (e.g. Db, not C#).
	if (sharpsOrFlats !== -8) {
		tonic = 0
		for (let letter = 1; letter <= 7; letter++) {
			const packet = [
				makeFlexHeader(0, 5),
				((packSigned4(sharpsOrFlats) << 28) | (letter << 24)) >>> 0,
				0,
				0
			]
			const decoded = decodeFlexDataUmp(packet)
			if (decoded?.kind === "keySignature" && decoded.root === state.root) {
				tonic = letter
				break
			}
		}
	} else {
		tonic = 0
	}
	if (state.keySignature) {
		const signature = state.keySignature
		const packet = [
			makeFlexHeader(0, 5),
			((packSigned4(signature.sharpsOrFlats) << 28) | (signature.tonic << 24)) >>> 0,
			0,
			0
		]
		const decoded = decodeFlexDataUmp(packet)
		if (
			decoded?.kind === "keySignature" &&
			(decoded.scale === undefined || decoded.scale === state.scale) &&
			(decoded.root === undefined || decoded.root === state.root)
		) {
			sharpsOrFlats = signature.sharpsOrFlats
			tonic = signature.tonic
		}
	}
	const w1 = ((packSigned4(sharpsOrFlats) << 28) | ((tonic & 0xf) << 24)) >>> 0
	return [
		makeFlexHeader(FLEX_STATUS_BANK_COMMON, FLEX_STATUS_SET_KEY_SIGNATURE, options),
		w1,
		0,
		0
	]
}

function matchChordType(relativeMask: number): number {
	for (const [typeKey, intervals] of Object.entries(CHORD_TYPE_INTERVALS)) {
		const mask = intervalsToMask(0, intervals)
		if (mask === relativeMask) {
			return Number(typeKey)
		}
	}
	return 0
}

/** Encode a MIDI 2.0 Flex Data Set Chord Name UMP packet from HarmonicState. */
export function encodeFlexChordNameUmp(
	state: Pick<HarmonicState, "root" | "chord" | "bass" | "chordRoot" | "chordSymbol">,
	options: FlexDataAddress = {}
): number[] {
	const header = makeFlexHeader(FLEX_STATUS_BANK_COMMON, FLEX_STATUS_SET_CHORD_NAME, options)
	if (state.chordSymbol) {
		const s = state.chordSymbol
		const alt = (a?: FlexChordAlteration) => (a ? (a.type << 4) | a.degree : 0)
		const packet = [
			header,
			((packSigned4(s.accidental) << 28) |
				(s.tonic << 24) |
				(s.type << 16) |
				(alt(s.alterations[0]) << 8) |
				alt(s.alterations[1])) >>>
				0,
			((alt(s.alterations[2]) << 24) | (alt(s.alterations[3]) << 16)) >>> 0,
			((packSigned4(s.bassAccidental) << 28) |
				(s.bassTonic << 24) |
				(s.bassType << 16) |
				(alt(s.bassAlterations[0]) << 8) |
				alt(s.bassAlterations[1])) >>>
				0
		]
		const decoded = decodeFlexDataUmp(packet)
		if (
			decoded?.kind === "chordName" &&
			decoded.chord === state.chord &&
			(!state.chord || decoded.root === (state.chordRoot ?? state.root)) &&
			decoded.bass === state.bass
		) {
			return packet
		}
	}
	if (!state.chord) {
		return [header, 0, 0, 0x80000000]
	}
	const root = mod12(state.chordRoot ?? state.root)
	const relativeMask = mapPitchSet(state.chord, 1, -root)
	let chordType = matchChordType(relativeMask)
	let alterations: FlexChordAlteration[] = []
	if (!chordType) {
		// Search standard bases and encode the exact differences; never substitute a triad.
		let best: FlexChordAlteration[] | undefined
		for (const [type, intervals] of Object.entries(CHORD_TYPE_INTERVALS)) {
			const changes: FlexChordAlteration[] = []
			const baseMask = intervalsToMask(0, intervals)
			const degreeFor = (pc: number) => [1, 2, 2, 3, 3, 4, 5, 5, 5, 6, 7, 7][pc]
			for (const pc of intervals) {
				if (!(relativeMask & (1 << pc))) {
					changes.push({ type: 2, degree: degreeFor(pc) })
				}
			}
			for (let pc = 0; pc < 12; pc++) {
				if (!(relativeMask & ~baseMask & (1 << pc))) {
					continue
				}
				const degree = degreeFor(pc)
				const natural = [0, 2, 4, 5, 7, 9, 11][degree - 1]
				changes.push({ type: pc === natural ? 1 : pc > natural ? 3 : 4, degree })
			}
			if (
				changes.length <= 4 &&
				(!best || changes.length < best.length) &&
				intervalsToMask(0, applyAlterations(intervals, changes)) === relativeMask
			) {
				best = changes
				chordType = Number(type)
			}
		}
		if (!best) {
			throw new Error(
				"This pitch set cannot be represented exactly as a MIDI 2.0 chord symbol"
			)
		}
		alterations = best
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

	let w3 = 0x80000000
	if (state.bass !== undefined) {
		const bass = PC_TO_SPELLING[mod12(state.bass)]
		w3 = ((packSigned4(bass.accidental) << 28) | ((bass.letter & 0xf) << 24)) >>> 0
	}

	return [
		makeFlexHeader(FLEX_STATUS_BANK_COMMON, FLEX_STATUS_SET_CHORD_NAME, options),
		w1,
		w2,
		w3
	]
}

export function encodeFlexTimeSignatureUmp(
	signature: FlexTimeSignature,
	options: FlexDataAddress = {}
): number[] {
	const exponent = Math.log2(signature.denominator)
	if (
		!Number.isInteger(signature.numerator) ||
		signature.numerator < 1 ||
		signature.numerator > 255 ||
		!Number.isInteger(exponent) ||
		exponent < 1 ||
		exponent > 7 ||
		!Number.isInteger(signature.thirtySecondNotes) ||
		signature.thirtySecondNotes < 1 ||
		signature.thirtySecondNotes > 255
	) {
		throw new Error("Invalid Flex Data time signature")
	}
	return [
		makeFlexHeader(0, FLEX_STATUS_SET_TIME_SIGNATURE, { ...options, groupScoped: true }),
		((signature.numerator << 24) | (exponent << 16) | (signature.thirtySecondNotes << 8)) >>> 0,
		0,
		0
	]
}

export function encodeFlexMetronomeUmp(
	metronome: FlexMetronome,
	options: FlexDataAddress = {}
): number[] {
	const values = [metronome.clocksPerClick, ...metronome.barAccents, ...metronome.subdivisions]
	if (
		metronome.barAccents.length !== 3 ||
		metronome.subdivisions.length !== 2 ||
		values.some((n) => !Number.isInteger(n) || n < 0 || n > 255) ||
		!metronome.clocksPerClick
	) {
		throw new Error("Invalid Flex Data metronome")
	}
	return [
		makeFlexHeader(0, FLEX_STATUS_SET_METRONOME, { ...options, groupScoped: true }),
		((values[0] << 24) | (values[1] << 16) | (values[2] << 8) | values[3]) >>> 0,
		((values[4] << 24) | (values[5] << 16)) >>> 0,
		0
	]
}

export interface FlexDataHarmonyAdapterOptions {
	/** Coalesce window in milliseconds so chord + key/bass packets land together (article uses 50 ms). */
	coalesceMs?: number
	initialHarmony?: HarmonicState
	onHarmony?: (state: HarmonicState, chordName?: string) => void
	onTempo?: (bpm: number) => void
	onTimeSignature?: (signature: FlexTimeSignature) => void
	onMetronome?: (metronome: FlexMetronome) => void
	/** Explicit address selection prevents unrelated groups/channels changing shared harmony. */
	group?: number
	channel?: number
	/** Monotonic milliseconds used by feed's optional effectiveAt argument. */
	now?: () => number
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
	#options: FlexDataHarmonyAdapterOptions
	#scheduled = new Set<ReturnType<typeof setTimeout>>()
	#batches = new Map<number, DecodedFlexData[]>()
	#batching = false

	constructor(options: FlexDataHarmonyAdapterOptions = {}) {
		this.#options = options
		this.#state = parseHarmony(options.initialHarmony ?? DEFAULT_HARMONY)
		this.#coalesceMs = Math.max(0, options.coalesceMs ?? 50)
		this.#onHarmony = options.onHarmony
		this.#onTempo = options.onTempo
	}

	get state(): HarmonicState {
		return parseHarmony(this.#state)
	}

	get chordName(): string | undefined {
		return this.#chordName
	}

	/** Reset pending work on source changes, manual edits, disconnect, or transport seek. */
	reset(state: HarmonicState = DEFAULT_HARMONY): void {
		this.destroy()
		this.#state = parseHarmony(state)
		this.#chordName = undefined
	}

	feed(words: readonly number[], effectiveAt?: number): DecodedFlexData | undefined {
		const decoded = decodeFlexDataUmp(words)
		if (
			!decoded ||
			(this.#options.group !== undefined && decoded.group !== this.#options.group) ||
			("groupScoped" in decoded &&
				!decoded.groupScoped &&
				decoded.channel !== this.#options.channel)
		) {
			return
		}
		if (effectiveAt !== undefined) {
			const delay = effectiveAt - (this.#options.now?.() ?? performance.now())
			if (!Number.isFinite(delay) || delay > 60_000 || this.#scheduled.size >= 1024) {
				return
			}
			if (delay > 0) {
				const pending = this.#batches.get(effectiveAt)
				if (pending) {
					if (pending.length < 128) {
						pending.push(decoded)
					}
					return decoded
				}
				const batch = [decoded]
				this.#batches.set(effectiveAt, batch)
				const timer = setTimeout(() => {
					this.#scheduled.delete(timer)
					this.#batches.delete(effectiveAt)
					this.#batching = true
					try {
						for (const message of batch) {
							this.#apply(message, true)
						}
					} finally {
						this.#batching = false
					}
					if (
						batch.some(
							(message) =>
								message.kind === "keySignature" || message.kind === "chordName"
						)
					) {
						this.flush()
					}
				}, delay)
				this.#scheduled.add(timer)
				return decoded
			}
		}
		this.#apply(decoded, effectiveAt !== undefined)
		return decoded
	}

	#apply(decoded: DecodedFlexData, timed: boolean): void {
		if (decoded.kind === "tempo") {
			this.#onTempo?.(decoded.bpm)
			return
		}
		if (decoded.kind === "timeSignature") {
			this.#options.onTimeSignature?.(decoded)
			return
		}
		if (decoded.kind === "metronome") {
			this.#options.onMetronome?.(decoded)
			return
		}
		if (decoded.kind === "keySignature") {
			this.#state = {
				...this.#state,
				root: decoded.root ?? this.#state.root,
				scale: decoded.scale ?? this.#state.scale,
				chordRoot: this.#state.chordRoot ?? this.#state.root,
				keySignature: { sharpsOrFlats: decoded.sharpsOrFlats, tonic: decoded.tonic }
			}
			this.#scheduleEmit(timed)
			return
		}
		if (decoded.kind === "chordName") {
			const { bass: _bass, chordSymbol: _symbol, ...previous } = this.#state
			this.#state = {
				...previous,
				chordRoot: decoded.root,
				chord: decoded.chord,
				chordSymbol: decoded.symbol,
				...(decoded.bass !== undefined ? { bass: decoded.bass } : {})
			}
			this.#chordName = decoded.name
			this.#scheduleEmit(timed)
		}
	}

	flush(): void {
		if (this.#timer) {
			clearTimeout(this.#timer)
			this.#timer = undefined
		}
		this.#onHarmony?.(this.state, this.#chordName)
	}

	destroy(): void {
		for (const timer of this.#scheduled) {
			clearTimeout(timer)
		}
		this.#scheduled.clear()
		this.#batches.clear()
		if (this.#timer) {
			clearTimeout(this.#timer)
			this.#timer = undefined
		}
	}

	#scheduleEmit(timed = false): void {
		if (this.#batching) {
			return
		}
		if (timed || this.#coalesceMs === 0) {
			this.flush()
			return
		}
		if (this.#timer) {
			return
		}
		this.#timer = setTimeout(() => {
			this.#timer = undefined
			this.#onHarmony?.(this.state, this.#chordName)
		}, this.#coalesceMs)
	}
}