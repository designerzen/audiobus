import { mod12 } from "./pitch-class-set"

export type TonalMode = "major" | "minor"
export interface TheoryChord {
	label: string
	root: number
	pcs: number[]
	bass: number
	beats: number
}
export interface ProgressionConcept {
	id: string
	name: string
	family: "cadence" | "tonicization" | "chromatic" | "sequence" | "modulation"
	major: string
	minor?: string
	help: string
}
export const MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11]
export const MINOR_DEGREES = [0, 2, 3, 5, 7, 8, 10]
const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"]

/** Recipes describe harmonic functions, not guarantees about every possible SATB realization. */
export const CLASSICAL_CONCEPTS: ProgressionConcept[] = [
	{
		id: "authentic",
		name: "Dominant–tonic",
		family: "cadence",
		major: "V7 I",
		minor: "V7 i",
		help: "Prepare the destination with its dominant seventh."
	},
	{
		id: "predominant",
		name: "Predominant–dominant–tonic",
		family: "cadence",
		major: "ii6 V7 I",
		minor: "iiø65 V7 i",
		help: "Introduce predominant function before the dominant."
	},
	{
		id: "plagal",
		name: "Plagal approach",
		family: "cadence",
		major: "IV I",
		minor: "iv i",
		help: "Approach the destination through its subdominant."
	},
	{
		id: "minor-plagal",
		name: "Borrowed minor subdominant",
		family: "chromatic",
		major: "iv I",
		minor: "iv i",
		help: "Use the parallel minor's subdominant before arrival."
	},
	{
		id: "cadential-six-four",
		name: "Cadential six-four",
		family: "cadence",
		major: "I64 V7 I",
		minor: "i64 V7 i",
		help: "Place tonic over dominant bass before dominant resolution."
	},
	{
		id: "deceptive",
		name: "Deceptive arrival",
		family: "cadence",
		major: "V7 vi",
		minor: "V7 VI",
		help: "Interpret the played destination as vi in relative major, or VI in relative minor."
	},
	{
		id: "half",
		name: "Half-cadence approach",
		family: "cadence",
		major: "I ii6 V",
		minor: "i iiø65 V",
		help: "Interpret a major destination chord as a dominant, rather than as a tonic."
	},
	{
		id: "phrygian-half",
		name: "Phrygian half cadence",
		family: "cadence",
		major: "iv6 V",
		help: "Approach a major dominant from iv6 in the associated minor key."
	},
	{
		id: "picardy",
		name: "Picardy-third arrival",
		family: "cadence",
		major: "iv V7 I",
		help: "Prepare a major tonic through a minor-key subdominant and dominant."
	},
	{
		id: "applied-dominant",
		name: "Applied dominant",
		family: "tonicization",
		major: "V7 I",
		minor: "V7 i",
		help: "Temporarily tonicize the actual destination, including chromatic roots."
	},
	{
		id: "double-dominant",
		name: "Dominant of the dominant",
		family: "tonicization",
		major: "V7/V V7 I",
		minor: "V7/V V7 i",
		help: "Resolve V7/V into V7, then into the destination."
	},
	{
		id: "dominant-chain",
		name: "Chain of applied dominants",
		family: "tonicization",
		major: "V7/V/V V7/V V7 I",
		minor: "V7/V/V V7/V V7 i",
		help: "Traverse three descending-fifth dominant resolutions."
	},
	{
		id: "leading-tone",
		name: "Diminished leading-tone seventh",
		family: "tonicization",
		major: "vii°7 I",
		minor: "vii°7 i",
		help: "Approach from a fully diminished seventh a semitone below the tonic."
	},
	{
		id: "half-diminished",
		name: "Half-diminished leading-tone seventh",
		family: "tonicization",
		major: "viiø7 I",
		help: "Use the diatonic leading-tone seventh of a major destination."
	},
	{
		id: "applied-leading-tone",
		name: "Applied leading-tone preparation",
		family: "tonicization",
		major: "vii°7/V V7 I",
		minor: "vii°7/V V7 i",
		help: "Resolve the leading-tone seventh of V into the dominant."
	},
	{
		id: "neapolitan",
		name: "Neapolitan-sixth approach",
		family: "chromatic",
		major: "bII6 V7 I",
		minor: "bII6 V7 i",
		help: "Use the flattened-supertonic major triad in first inversion."
	},
	{
		id: "neapolitan-leading",
		name: "Neapolitan with applied leading tone",
		family: "chromatic",
		major: "bII6 vii°7/V V7 I",
		minor: "bII6 vii°7/V V7 i",
		help: "Elaborate the Neapolitan with the diminished leading-tone seventh of V."
	},
	{
		id: "italian-sixth",
		name: "Italian augmented sixth",
		family: "chromatic",
		major: "It+6 V7 I",
		minor: "It+6 V7 i",
		help: "Flat 6 and sharp 4 surround the dominant; tonic completes the Italian sixth."
	},
	{
		id: "french-sixth",
		name: "French augmented sixth",
		family: "chromatic",
		major: "Fr+6 V7 I",
		minor: "Fr+6 V7 i",
		help: "Add scale degree 2 to the Italian augmented-sixth collection."
	},
	{
		id: "german-sixth",
		name: "German sixth via cadential six-four",
		family: "chromatic",
		major: "Ger+6 I64 V7 I",
		minor: "Ger+6 i64 V7 i",
		help: "Resolve through a cadential six-four before V, avoiding the direct German-sixth/V fifths pattern."
	},
	{
		id: "common-tone-diminished",
		name: "Common-tone diminished seventh",
		family: "chromatic",
		major: "CT°7 I",
		minor: "CT°7 i",
		help: "Keep the destination root as a common tone with a diminished-seventh embellishment."
	},
	{
		id: "modal-mixture",
		name: "Parallel-minor mixture",
		family: "chromatic",
		major: "bVI iv V7 I",
		minor: "VI iv V7 i",
		help: "Borrow the lowered sixth and minor subdominant before a tonal cadence."
	},
	{
		id: "descending-fifths",
		name: "Descending-fifths sequence",
		family: "sequence",
		major: "iii vi ii V7 I",
		minor: "III VI iiø7 V7 i",
		help: "Join successive roots by descending fifths before the tonic."
	},
	{
		id: "full-fifths",
		name: "Diatonic circle sequence",
		family: "sequence",
		major: "I IV vii° iii vi ii V7 I",
		minor: "i iv VII III VI ii° V7 i",
		help: "Traverse the diatonic circle; a diminished fifth occurs where required by the scale."
	},
	{
		id: "descending-thirds",
		name: "Descending-third sequence",
		family: "sequence",
		major: "I vi IV ii V7 I",
		minor: "i VI iv iiø7 V7 i",
		help: "Move through descending thirds into a predominant and dominant."
	},
	{
		id: "ascending-five-six",
		name: "Ascending 5–6 sequence",
		family: "sequence",
		major: "I vi6 ii vii°6 iii I6 IV ii6 V7 I",
		help: "Alternate root-position triads and first inversions above a stepwise rising bass."
	},
	{
		id: "lament",
		name: "Descending lament bass",
		family: "sequence",
		major: "i VII VI V7 i",
		minor: "i VII VI V7 i",
		help: "Use the minor-key descending tetrachord, then resolve the dominant."
	},
	{
		id: "pivot",
		name: "Diatonic pivot modulation",
		family: "modulation",
		major: "ii6 V7 I",
		minor: "iiø65 V7 i",
		help: "Find a triad shared by the old and new keys, then cadence in the destination key."
	},
	{
		id: "enharmonic-diminished",
		name: "Enharmonic diminished-seventh pivot",
		family: "modulation",
		major: "vii°7 I",
		minor: "vii°7 i",
		help: "Reinterpret a symmetrical diminished seventh when both keys support that common collection."
	},
	{
		id: "common-tone-modulation",
		name: "Common-tone modulation",
		family: "modulation",
		major: "V7 I",
		minor: "V7 i",
		help: "Retain an actual shared pitch, introduce the new dominant and arrive in the new key."
	}
]

export function makeTheoryChord(
	root: number,
	intervals: number[],
	label: string,
	beats = 1,
	bass = root
): TheoryChord {
	return {
		root: mod12(root),
		pcs: [...new Set(intervals.map((interval) => mod12(root + interval)))].sort(
			(a, b) => a - b
		),
		bass: mod12(bass),
		label,
		beats
	}
}

function parseRoman(
	symbol: string,
	tonic: number,
	mode: TonalMode,
	beats: number
): TheoryChord | undefined {
	const parts = symbol.split("/")
	if (!/^[b#]*[ivIV]/.test(parts[0])) return undefined
	if (parts.length > 4) throw new Error("Applied-chord chains may have at most three targets")
	let localRoot = tonic,
		localMode = mode
	for (let i = parts.length - 1; i > 0; i--) {
		const target = /^([b#]*)([ivIV]+)$/.exec(parts[i])
		if (!target) throw new Error(`Invalid applied-chord target: ${parts[i]}`)
		const degree = ROMANS.indexOf(target[2].toUpperCase())
		if (degree < 0) throw new Error(`Invalid scale degree: ${target[2]}`)
		const alteration = [...target[1]].reduce((sum, mark) => sum + (mark === "#" ? 1 : -1), 0)
		localRoot = mod12(
			localRoot + (localMode === "minor" ? MINOR_DEGREES : MAJOR_DEGREES)[degree] + alteration
		)
		localMode = target[2] === target[2].toLowerCase() ? "minor" : "major"
	}
	const match = /^([b#]{0,2})([ivIV]+)([°oø+]?)(maj7|M7|7|65|43|42|64|6)?$/.exec(parts[0])
	if (!match) return undefined
	const degree = ROMANS.indexOf(match[2].toUpperCase())
	if (degree < 0) throw new Error(`Invalid Roman numeral: ${symbol}`)
	const alteration = [...match[1]].reduce((sum, mark) => sum + (mark === "#" ? 1 : -1), 0)
	const suffix = match[4] ?? "",
		quality = match[3]
	const raisedLeading =
		localMode === "minor" &&
		degree === 6 &&
		alteration === 0 &&
		["°", "o", "ø"].includes(quality)
			? 1
			: 0
	const root = mod12(
		localRoot +
			(localMode === "minor" ? MINOR_DEGREES : MAJOR_DEGREES)[degree] +
			alteration +
			raisedLeading
	)
	const minor = match[2] === match[2].toLowerCase()
	const diminished = quality === "°" || quality === "o" || quality === "ø"
	const intervals = diminished
		? [0, 3, 6]
		: quality === "+"
			? [0, 4, 8]
			: minor
				? [0, 3, 7]
				: [0, 4, 7]
	const seventh = ["7", "maj7", "M7", "65", "43", "42"].includes(suffix)
	if (seventh) {
		intervals.push(
			quality === "ø"
				? 10
				: diminished
					? 9
					: suffix === "maj7" || suffix === "M7"
						? 11
						: minor
							? 10
							: degree === 4 || parts.length > 1
								? 10
								: [0, 3].includes(degree) ||
									  (localMode === "minor" && [2, 5].includes(degree))
									? 11
									: 10
		)
	}
	const inversion =
		suffix === "6" || suffix === "65"
			? 1
			: suffix === "64" || suffix === "43"
				? 2
				: suffix === "42"
					? 3
					: 0
	return makeTheoryChord(root, intervals, symbol, beats, root + intervals[inversion])
}

export function parseTheoryProgression(
	text: string,
	tonic = 0,
	mode: TonalMode = "major"
): TheoryChord[] {
	const normalized = text
		.replaceAll("♭", "b")
		.replaceAll("♯", "#")
		.replace(/6\/4/g, "64")
		.replace(/6\/5/g, "65")
		.replace(/4\/3/g, "43")
		.replace(/4\/2/g, "42")
	const tokens = normalized
		.trim()
		.split(/[\s,|;]+/)
		.filter(Boolean)
	if (!tokens.length || tokens.length > 64)
		throw new Error("Enter 1–64 chords, for example I:4 vi:4 ii6:2 V7:2")
	return tokens.map((token) => {
		const pieces = token.split(":")
		const symbol = pieces[0],
			beats = pieces.length === 1 ? 1 : Number(pieces[1])
		if (pieces.length > 2 || !Number.isFinite(beats) || beats < 0.125 || beats > 64)
			throw new Error(`Invalid chord duration: ${token}`)
		if (["It+6", "Fr+6", "Ger+6"].includes(symbol)) {
			return makeTheoryChord(
				tonic,
				symbol === "It+6" ? [8, 0, 6] : symbol === "Fr+6" ? [8, 0, 2, 6] : [8, 0, 3, 6],
				symbol,
				beats,
				tonic + 8
			)
		}
		if (symbol === "CT°7" || symbol === "CTo7")
			return makeTheoryChord(tonic, [0, 3, 6, 9], symbol, beats)
		if (symbol === "N" || symbol === "N6")
			return {
				...parseRoman(symbol === "N6" ? "bII6" : "bII", tonic, mode, beats)!,
				label: symbol
			}
		const roman = parseRoman(symbol, tonic, mode, beats)
		if (roman) return roman
		const chord =
			/^([A-G])([#b]?)(maj7|m7|min7|dim7|dim|aug|sus2|sus4|m|min|7)?(?:\/([A-G])([#b]?))?$/.exec(
				symbol
			)
		if (!chord) throw new Error(`Unknown chord: ${symbol}`)
		const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
		const accidental = (mark: string) => (mark === "#" ? 1 : mark === "b" ? -1 : 0)
		const root = natural[chord[1]] + accidental(chord[2]),
			quality = chord[3] ?? ""
		const intervals = quality.startsWith("dim")
			? [0, 3, 6]
			: quality === "aug"
				? [0, 4, 8]
				: quality === "sus2"
					? [0, 2, 7]
					: quality === "sus4"
						? [0, 5, 7]
						: quality.startsWith("m") && !quality.startsWith("maj")
							? [0, 3, 7]
							: [0, 4, 7]
		if (quality.endsWith("7"))
			intervals.push(quality === "dim7" ? 9 : quality === "maj7" ? 11 : 10)
		const bass = chord[4] ? natural[chord[4]] + accidental(chord[5]) : root
		if (!intervals.some((interval) => mod12(root + interval) === mod12(bass)))
			throw new Error("Slash bass must be a chord tone")
		return makeTheoryChord(root, intervals, symbol, beats, bass)
	})
}

export function inferChord(
	notes: number[],
	preferredRoot?: number
): { root: number; mode: TonalMode; recognized: boolean } {
	const pcs = [...new Set(notes.map(mod12))]
	const qualities: Array<{ intervals: number[]; mode: TonalMode }> = [
		{ intervals: [0, 4, 7, 11], mode: "major" },
		{ intervals: [0, 4, 7, 10], mode: "major" },
		{ intervals: [0, 3, 7, 10], mode: "minor" },
		{ intervals: [0, 4, 7], mode: "major" },
		{ intervals: [0, 3, 7], mode: "minor" }
	]
	const roots =
		preferredRoot === undefined ? [...new Set(notes.map(mod12))] : [mod12(preferredRoot)]
	for (const quality of qualities)
		for (const root of roots) {
			if (
				pcs.length === quality.intervals.length &&
				quality.intervals.every((interval) => pcs.includes(mod12(root + interval)))
			)
				return { root, mode: quality.mode, recognized: true }
		}
	return {
		root: preferredRoot ?? (notes.length ? mod12(Math.min(...notes)) : 0),
		mode: "major",
		recognized: pcs.length === 1
	}
}

export function diatonicTriads(tonic: number, mode: TonalMode): TheoryChord[] {
	const scale = mode === "minor" ? MINOR_DEGREES : MAJOR_DEGREES
	return scale.map((degree, i) =>
		makeTheoryChord(
			tonic + degree,
			[0, mod12(scale[(i + 2) % 7] - degree), mod12(scale[(i + 4) % 7] - degree)],
			ROMANS[i]
		)
	)
}

export interface BridgeRecipe {
	chords: TheoryChord[]
	message: string
}
export function classicalBridgeRecipe(
	id: string,
	from: number[],
	target: number[],
	mode: TonalMode,
	rootOverride = -1
): BridgeRecipe {
	const inferred = inferChord(target, rootOverride >= 0 ? rootOverride : undefined)
	const root = inferred.root,
		targetMode = inferred.recognized && target.length > 1 ? inferred.mode : mode
	const concept = CLASSICAL_CONCEPTS.find((concept) => concept.id === id)
	if (!concept) throw new Error(`Unknown progression concept: ${id}`)
	let tonic = root,
		recipeMode = targetMode,
		text = targetMode === "minor" ? concept.minor : concept.major
	let message = concept.name
	if (id === "deceptive") {
		tonic = mod12(root + (targetMode === "minor" ? 3 : 4))
		recipeMode = targetMode === "minor" ? "major" : "minor"
		text = recipeMode === "major" ? concept.major : concept.minor
	} else if (id === "half" || id === "phrygian-half") {
		const pcs = [...new Set(target.map(mod12))]
		const dominantDestination =
			pcs.length === 1 ||
			(pcs.length === 3 &&
				[0, 4, 7].every((interval) => pcs.includes(mod12(root + interval)))) ||
			(pcs.length === 4 &&
				[0, 4, 7, 10].every((interval) => pcs.includes(mod12(root + interval))))
		if (targetMode !== "major" || !dominantDestination)
			return {
				chords: parseTheoryProgression("V7", root, targetMode),
				message: `${concept.name} needs a major dominant destination; using an applied dominant instead.`
			}
		tonic = mod12(root - 7)
		recipeMode = id === "phrygian-half" ? "minor" : mode
		text = recipeMode === "minor" && concept.minor ? concept.minor : concept.major
	} else if (id === "lament") {
		recipeMode = "minor"
		text = concept.minor
		if (targetMode === "major")
			message = "Minor lament preparation with a Picardy-third destination"
	} else if (targetMode === "minor" && !concept.minor) {
		return {
			chords: parseTheoryProgression("iiø65 V7", root, "minor"),
			message: `${concept.name} is a major-key recipe; using minor predominant–dominant preparation.`
		}
	}
	if (id === "pivot") {
		const old = inferChord(from)
		const oldTriads = diatonicTriads(old.root, old.mode)
		const candidates = diatonicTriads(root, targetMode).filter((chord) =>
			oldTriads.some((old) => old.pcs.join() === chord.pcs.join())
		)
		candidates.sort((a, b) => {
			const score = (chord: TheoryChord) =>
				chord.pcs.filter((pc) => from.some((note) => mod12(note) === pc)).length * 3 +
				(mod12(chord.root - root) === 2 ? 2 : 0)
			return score(b) - score(a)
		})
		if (candidates[0])
			return {
				chords: [
					{ ...candidates[0], label: "Shared diatonic pivot" },
					...parseTheoryProgression("V7", root, targetMode)
				],
				message
			}
		return {
			chords: parseTheoryProgression("V7/V V7", root, targetMode),
			message: "No shared diatonic triad; using a chain of applied dominants."
		}
	}
	if (id === "enharmonic-diminished") {
		const old = inferChord(from)
		const shared = mod12(old.root - root) % 3 === 0
		return {
			chords: parseTheoryProgression("vii°7", root, targetMode),
			message: shared
				? message
				: "The keys do not share a leading-tone diminished seventh; tonicizing the destination with its own vii°7."
		}
	}
	if (id === "common-tone-modulation") {
		const common = from.map(mod12).filter((pc) => target.some((note) => mod12(note) === pc))
		if (!common.length)
			return {
				chords: parseTheoryProgression("V7", root, targetMode),
				message: "No common pitch class; using dominant preparation."
			}
		const dominant = parseTheoryProgression("V7", root, targetMode)
		return {
			chords: [makeTheoryChord(common[0], [0], "Retained common tone"), ...dominant],
			message
		}
	}
	return {
		chords: parseTheoryProgression(text ?? concept.major, tonic, recipeMode).slice(0, -1),
		message
	}
}