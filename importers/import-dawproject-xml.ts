import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"
import { parseXML } from "./import-musicxml-import"

/** Import arrangement notes only; audio, plugins and expression are not restored. */
export function importDawProjectXML(text: string, name: string) {
	const doc = parseXML(text)
	if (doc.documentElement.localName !== "Project") {
		throw new Error("Expected a DAWproject Project document")
	}
	if (doc.querySelector("TempoAutomation RealPoint")) {
		throw new Error("DAWproject tempo automation is not supported")
	}
	const bpm = Number(doc.querySelector("Transport > Tempo")?.getAttribute("value") ?? 120)
	if (!(bpm > 0) || !Number.isFinite(bpm)) {
		throw new Error("Invalid DAWproject tempo")
	}
	const numeric = (el: Element, key: string, fallback = 0) => {
		const value = Number(el.getAttribute(key) ?? fallback)
		if (!Number.isFinite(value)) {
			throw new Error(`Invalid DAWproject ${key}`)
		}
		return value
	}
	const scale = (unit: string) => {
		if (unit === "beats") {
			return 60 / bpm
		}
		if (unit === "seconds") {
			return 1
		}
		throw new Error(`Unsupported DAWproject time unit: ${unit}`)
	}
	const ids = new Map([...doc.querySelectorAll("[id]")].map((el) => [el.getAttribute("id")!, el]))
	const commands: AudioCommand[] = []
	let noteCount = 0,
		visits = 0
	const visit = (
		el: Element,
		unit: string,
		offset: number,
		min: number,
		max: number,
		depth: number
	) => {
		if (++visits > 100000 || depth > 64) {
			throw new Error("DAWproject arrangement is too complex or contains cyclic references")
		}
		unit = el.getAttribute("timeUnit") ?? unit
		if (el.localName === "Note") {
			const start = Math.max(min, offset + numeric(el, "time") * scale(unit))
			const end = Math.min(
				max,
				offset + (numeric(el, "time") + numeric(el, "duration")) * scale(unit)
			)
			if (end <= start) {
				return
			}
			const number = numeric(el, "key"),
				channel = numeric(el, "channel") + 1
			const velocity = numeric(el, "vel", 1)
			if (
				!Number.isInteger(number) ||
				number < 0 ||
				number > 127 ||
				!Number.isInteger(channel) ||
				channel < 1 ||
				channel > 16 ||
				velocity < 0 ||
				velocity > 1
			) {
				throw new Error("Invalid DAWproject note")
			}
			commands.push(
				Object.assign(new AudioCommand(), {
					type: NOTE_ON,
					number,
					channel,
					velocity: Math.round(velocity * 127),
					startAt: start,
					endAt: end,
					from: name
				}),
				Object.assign(new AudioCommand(), {
					type: NOTE_OFF,
					number,
					channel,
					velocity: 0,
					startAt: end,
					from: name
				})
			)
			noteCount++
			return
		}
		if (el.localName === "Clip") {
			if (el.getAttribute("enable") === "false") {
				return
			}
			const start = offset + numeric(el, "time") * scale(unit)
			const duration = el.hasAttribute("duration")
				? numeric(el, "duration") * scale(unit)
				: Infinity
			const lower = Math.max(min, start),
				upper = Math.min(max, start + duration)
			if (lower >= upper) {
				return
			}
			const reference = el.getAttribute("reference")
			const content = reference ? ids.get(reference) : el
			if (!content) {
				throw new Error("Missing DAWproject clip reference")
			}
			const contentUnit =
				el.getAttribute("contentTimeUnit") ??
				content.getAttribute("contentTimeUnit") ??
				unit
			const factor = scale(contentUnit)
			const playStart = numeric(el, "playStart") * factor
			const playStop = el.hasAttribute("playStop")
				? numeric(el, "playStop") * factor
				: Infinity
			const loopStart = numeric(el, "loopStart") * factor
			const loopEnd = numeric(el, "loopEnd") * factor
			const loop = loopEnd > loopStart
			if (loop && !Number.isFinite(duration)) {
				throw new Error("Looped DAWproject clips require a duration")
			}
			let source = playStart,
				target = start
			while (target < upper) {
				if (loop && source >= loopEnd) {
					source = loopStart + ((source - loopStart) % (loopEnd - loopStart))
				}
				const segment = loop ? loopEnd - source : playStop - source
				if (segment <= 0) {
					break
				}
				const limit = Math.min(upper, target + segment)
				for (const child of content.children) {
					visit(
						child,
						contentUnit,
						target - source,
						Math.max(lower, target),
						limit,
						depth + 1
					)
				}
				if (!loop) {
					break
				}
				target = limit
				source = loopStart
				if (++visits > 100000) {
					throw new Error("Too many DAWproject clip repetitions")
				}
			}
			return
		}
		for (const child of el.children) {
			if (["Lanes", "Clips", "Clip", "Notes", "Note", "Timeline"].includes(child.localName)) {
				visit(child, unit, offset, min, max, depth + 1)
			}
		}
	}
	const arrangement = doc.querySelector("Arrangement")
	if (!arrangement) {
		throw new Error("DAWproject has no arrangement")
	}
	visit(arrangement, "beats", 0, 0, Infinity, 0)
	if (!noteCount) {
		throw new Error("DAWproject arrangement contains no importable notes")
	}
	commands.sort((a, b) => a.startAt - b.startAt || (a.type === NOTE_OFF ? -1 : 1))
	return { commands, noteCount }
}