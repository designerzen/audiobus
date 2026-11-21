import { checkMusicFile, commandsFromNotes } from "../formats/imported-notes"
import { projectTimeAxis } from "../formats/project-time"
import { readMediaArchive, safeArchivePath } from "./dropped-media"
import type { SequenceNote } from "../formats/note-sequence"

const children = (element: Element, name: string) =>
	[...element.children].filter((child) => child.localName === name)
const child = (element: Element, name: string) => children(element, name)[0]
const value = (element: Element, name: string, fallback?: number) => {
	const text = child(element, name)?.textContent
	const number = text === undefined ? fallback : Number(text)
	if (number === undefined || !Number.isFinite(number)) {
		throw new Error(`Invalid MuseScore ${name}`)
	}
	return number
}
function fraction(text: string): number {
	const match = /^(-?\d+)\/(\d+)$/.exec(text.trim())
	if (!match || !Number(match[2])) {
		throw new Error("Invalid MuseScore duration fraction")
	}
	return (Number(match[1]) / Number(match[2])) * 4
}
function parseScoreXML(text: string): XMLDocument {
	text = text.replace(/<!DOCTYPE\s+museScore\s*>/i, "")
	if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
		throw new Error("MuseScore external document types and entities are unsupported")
	}
	const doc = new DOMParser().parseFromString(text, "application/xml")
	if (doc.querySelector("parsererror")) {
		throw new Error("Invalid MuseScore XML")
	}
	return doc
}

/** MuseScore 3/4 written notation. Repeat/jump playback and ornament realization are not expanded. */
export async function importMuseScoreFile(file: File) {
	checkMusicFile(file)
	const signature = new Uint8Array(await file.slice(0, 2).arrayBuffer())
	let text: string
	if (signature[0] === 0x50 && signature[1] === 0x4b) {
		const files = await readMediaArchive(new Uint8Array(await file.arrayBuffer()))
		const container = files["META-INF/container.xml"]
		let path: string | undefined
		if (container) {
			const doc = parseScoreXML(new TextDecoder().decode(container))
			path = [...doc.querySelectorAll("rootfile")]
				.map((root) => root.getAttribute("full-path") ?? "")
				.find((name) => /\.mscx$/i.test(name))
		}
		if (!path) {
			const candidates = Object.keys(files).filter(
				(name) =>
					/\.mscx$/i.test(name) && !/(^|\/)(?:excerpts|parts|__MACOSX)\//i.test(name)
			)
			if (candidates.length !== 1) {
				throw new Error("MuseScore archive must identify a single main .mscx score")
			}
			path = candidates[0]
		}
		path = safeArchivePath(path)
		if (!files[path]) {
			throw new Error("MuseScore archive is missing its main score")
		}
		text = new TextDecoder().decode(files[path])
	} else {
		text = await file.text()
	}
	const doc = parseScoreXML(text),
		root = doc.documentElement
	if (root.localName !== "museScore" || !/^[34]\./.test(root.getAttribute("version") ?? "")) {
		throw new Error("Expected a MuseScore 3 or 4 score. Export older scores as MusicXML first.")
	}
	const score = child(root, "Score")
	if (!score) {
		throw new Error("MuseScore document is missing its main Score")
	}
	if (
		score.querySelector(
			'MeasureRepeat, RepeatMeasure, Spanner[type="Ottava"], InstrumentChange'
		)
	) {
		throw new Error(
			"MuseScore measure repeats, ottavas and instrument changes require MusicXML or MIDI export first"
		)
	}
	const staves = children(score, "Staff")
	if (!staves.length || staves.length > 128) {
		throw new Error("Expected 1–128 MuseScore staves")
	}
	const definitions = new Map<string, { channel: number; patch: number }>()
	let melodic = 0
	for (const part of children(score, "Part")) {
		const instrument = child(part, "Instrument"),
			drum = instrument?.querySelector("useDrumset")?.textContent === "1"
		if (!drum && melodic >= 15) {
			throw new Error("MuseScore import supports 15 melodic instruments plus drums")
		}
		const channel = drum ? 10 : melodic < 9 ? melodic + 1 : melodic + 2
		if (!drum) {
			melodic++
		}
		const patch = Number(
			instrument?.querySelector("Channel program")?.getAttribute("value") ?? 0
		)
		for (const staff of children(part, "Staff")) {
			definitions.set(staff.getAttribute("id") ?? "", { channel, patch })
		}
	}
	let meter = 4,
		measureStart = 0
	const timeline = children(staves[0], "Measure").map((measure) => {
		const signature = measure.querySelector("TimeSig")
		if (signature) {
			meter = (value(signature, "sigN") / value(signature, "sigD")) * 4
			if (!(meter > 0 && meter <= 64)) {
				throw new Error("Invalid MuseScore time signature")
			}
		}
		const duration = measure.hasAttribute("len")
			? fraction(measure.getAttribute("len")!)
			: meter
		if (!(duration > 0 && duration <= 64)) {
			throw new Error("Invalid MuseScore measure length")
		}
		const start = measureStart
		measureStart += duration
		return { start, duration }
	})
	const division = value(score, "Division", 480)
	if (!(division > 0)) {
		throw new Error("Invalid MuseScore tick division")
	}
	const notes: SequenceNote[] = [],
		tempos = new Map<number, number>([[0, 120]])
	const pending = new Map<string, SequenceNote>()
	const durationTypes: Record<string, number> = {
		longa: 16,
		breve: 8,
		whole: 4,
		half: 2,
		quarter: 1,
		eighth: 0.5,
		"16th": 0.25,
		"32nd": 0.125,
		"64th": 0.0625,
		"128th": 0.03125,
		"256th": 0.015625,
		"512th": 0.0078125,
		"1024th": 0.00390625
	}
	for (const [staffIndex, staff] of staves.entries()) {
		const measures = children(staff, "Measure")
		if (measures.length !== timeline.length) {
			throw new Error("MuseScore staves have inconsistent measure counts")
		}
		const instrument = definitions.get(staff.getAttribute("id") ?? "") ?? {
			channel: staffIndex < 9 ? staffIndex + 1 : staffIndex + 2,
			patch: 0
		}
		let velocity = 100
		for (const [measureIndex, measure] of measures.entries()) {
			const bar = timeline[measureIndex],
				voices = children(measure, "voice")
			if (!voices.length) {
				throw new Error("MuseScore measure has no voices")
			}
			for (const [voiceIndex, voice] of voices.entries()) {
				let cursor = bar.start
				const ratios = new Map<string, number>(),
					stack: number[] = []
				for (const element of voice.children) {
					if (element.localName === "Tuplet") {
						const ratio = value(element, "normalNotes") / value(element, "actualNotes")
						if (!(ratio > 0 && ratio <= 64)) {
							throw new Error("Invalid MuseScore tuplet")
						}
						const parentId = child(element, "Tuplet")?.textContent?.trim()
						if (parentId && !ratios.has(parentId)) {
							throw new Error("Unknown MuseScore parent tuplet")
						}
						if (element.hasAttribute("id")) {
							ratios.set(
								element.getAttribute("id")!,
								ratio * (parentId ? ratios.get(parentId)! : 1)
							)
						} else {
							if (stack.length >= 16) {
								throw new Error("MuseScore tuplets are nested too deeply")
							}
							stack.push(ratio)
						}
						continue
					}
					if (element.localName === "endTuplet") {
						if (!stack.pop()) {
							throw new Error("Unmatched MuseScore tuplet ending")
						}
						continue
					}
					if (element.localName === "location") {
						if (value(element, "measures", 0)) {
							throw new Error(
								"MuseScore cross-measure voice locations require MusicXML export"
							)
						}
						cursor += fraction(child(element, "fractions")?.textContent ?? "0/1")
						continue
					}
					if (element.localName === "tick") {
						cursor = Number(element.textContent) / division
						continue
					}
					if (element.localName === "Tempo") {
						tempos.set(Math.round(cursor * 960000), value(element, "tempo") * 60)
						continue
					}
					if (element.localName === "Dynamic") {
						const levels: Record<string, number> = {
							ppp: 24,
							pp: 36,
							p: 48,
							mp: 64,
							mf: 80,
							f: 96,
							ff: 112,
							fff: 127
						}
						const explicit = value(element, "velocity", -1)
						velocity =
							explicit > 0
								? explicit
								: (levels[child(element, "subtype")?.textContent ?? ""] ?? velocity)
						continue
					}
					if (!["Chord", "Rest"].includes(element.localName)) {
						continue
					}
					if (
						[...element.children].some((node) =>
							/^(?:grace|acciaccatura|appoggiatura)/i.test(node.localName)
						)
					) {
						continue
					}
					const type = child(element, "durationType")?.textContent ?? ""
					let duration = type === "measure" ? bar.duration : durationTypes[type]
					if (type === "measure" && child(element, "duration")) {
						duration = fraction(child(element, "duration")!.textContent!)
					}
					const dots = value(element, "dots", 0)
					if (!Number.isInteger(dots) || dots < 0 || dots > 4 || !duration) {
						throw new Error("Unsupported MuseScore note duration")
					}
					duration *= 2 - 2 ** -dots
					const ref = child(element, "Tuplet")?.textContent?.trim()
					if (ref && !ratios.has(ref)) {
						throw new Error("Unknown MuseScore tuplet reference")
					}
					duration *= ref ? ratios.get(ref)! : stack.reduce((a, b) => a * b, 1)
					if (
						!Number.isFinite(cursor) ||
						cursor < bar.start - 1e-7 ||
						cursor + duration > bar.start + bar.duration + 1e-7
					) {
						throw new Error("MuseScore voice exceeds its measure")
					}
					if (element.localName === "Chord") {
						for (const note of children(element, "Note")) {
							if (notes.length >= 100000) {
								throw new Error("MuseScore contains too many notes")
							}
							const number = value(note, "pitch"),
								key = `${staffIndex}:${voiceIndex}:${number}`
							const ties = children(note, "Spanner").filter(
								(spanner) => spanner.getAttribute("type") === "Tie"
							)
							const incoming =
								ties.some((tie) => child(tie, "prev")) ||
								!!child(note, "endSpanner")
							const outgoing =
								ties.some((tie) => child(tie, "next")) || !!child(note, "Tie")
							const previous = pending.get(key)
							let target: SequenceNote
							if (
								incoming &&
								previous &&
								Math.abs(previous.start + previous.duration - cursor) < 1e-7
							) {
								previous.duration += duration
								target = previous
							} else {
								if (incoming) {
									throw new Error(
										"Unresolved MuseScore note tie; export as MIDI first"
									)
								}
								target = {
									number,
									...instrument,
									velocity,
									start: cursor,
									duration
								}
								notes.push(target)
							}
							if (outgoing) {
								pending.set(key, target)
							} else {
								pending.delete(key)
							}
						}
					}
					cursor += duration
				}
				if (stack.length) {
					throw new Error("Unclosed MuseScore tuplet")
				}
			}
		}
	}
	const seconds = projectTimeAxis(
		960000,
		[...tempos].map(([position, bpm]) => ({ position, bpm }))
	)
	return commandsFromNotes(
		notes.map((note) => {
			const start = seconds(Math.round(note.start * 960000)),
				end = seconds(Math.round((note.start + note.duration) * 960000))
			return { ...note, start, duration: end - start }
		}),
		file.name
	)
}