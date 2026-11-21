import {
	importedSong,
	songFromCommands,
	songTimeAxis,
	type SongSource
} from "../formats/song-source"
import { projectTimeAxis } from "../formats/project-time"
import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"
import { parseXML } from "./import-musicxml-import"

/** Import arrangement notes only; audio, plugins and expression are not restored. */
export function importDawProjectXML(text: string, name: string) {
	const doc = parseXML(text)
	if (doc.documentElement.localName !== "Project") {
		throw new Error("Expected a DAWproject Project document")
	}
	if (doc.querySelector('TempoAutomation RealPoint[interpolation="linear"]')) {
		throw new Error("DAWproject linear tempo ramps are not supported")
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
	const automation = doc.querySelector("TempoAutomation")
	const points = [...(automation?.querySelectorAll("RealPoint") ?? [])]
	const beatTime = projectTimeAxis(960000, [
		{ position: 0, bpm },
		...points.map((p) => ({
			position: Math.round(numeric(p, "time") * 960000),
			bpm: numeric(p, "value")
		}))
	])
	const tempos = [
		{ time: 0, bpm },
		...points.map((p) => ({
			time:
				automation?.getAttribute("timeUnit") === "seconds"
					? numeric(p, "time")
					: beatTime(Math.round(numeric(p, "time") * 960000)),
			bpm: numeric(p, "value")
		}))
	]
	const initialMeter = doc.querySelector("Transport > TimeSignature")
	const meta = songFromCommands([], name, { tempos })
	const axis = songTimeAxis(meta)
	const meterPoints = [...doc.querySelectorAll("TimeSignatureAutomation TimeSignaturePoint")]
	meta.meters = [
		{
			time: 0,
			numerator: initialMeter ? numeric(initialMeter, "numerator", 4) : 4,
			denominator: initialMeter ? numeric(initialMeter, "denominator", 4) : 4
		},
		...meterPoints.map((p) => ({
			time:
				p.parentElement?.getAttribute("timeUnit") === "seconds"
					? numeric(p, "time")
					: axis.seconds(numeric(p, "time")),
			numerator: numeric(p, "numerator"),
			denominator: numeric(p, "denominator")
		}))
	]
	const durationAt = (value: number, unit: string, origin: number) => {
		if (unit === "seconds") return value
		if (unit === "beats")
			return axis.seconds(axis.beats(Math.max(0, origin)) + value) - Math.max(0, origin)
		throw new Error(`Unsupported DAWproject time unit: ${unit}`)
	}
	const trackNotes = new Map<string, SongSource["tracks"][number]>()
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
		depth: number,
		trackId = ""
	) => {
		if (++visits > 100000 || depth > 64) {
			throw new Error("DAWproject arrangement is too complex or contains cyclic references")
		}
		trackId = el.getAttribute("track") ?? trackId
		unit = el.getAttribute("timeUnit") ?? unit
		if (el.localName === "Note") {
			const start = Math.max(min, offset + durationAt(numeric(el, "time"), unit, offset))
			const end = Math.min(
				max,
				offset + durationAt(numeric(el, "time") + numeric(el, "duration"), unit, offset)
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
			const id = `${trackId}:${channel}`
			let track = trackNotes.get(id)
			if (!track)
				trackNotes.set(
					id,
					(track = {
						name: ids.get(trackId)?.getAttribute("name") ?? `Channel ${channel}`,
						channel,
						patch: 0,
						notes: []
					})
				)
			track.notes.push({
				number,
				channel,
				patch: 0,
				velocity: Math.round(velocity * 127),
				start,
				duration: end - start
			})
			noteCount++
			return
		}
		if (el.localName === "Clip") {
			if (el.getAttribute("enable") === "false") {
				return
			}
			const start = offset + durationAt(numeric(el, "time"), unit, offset)
			const duration = el.hasAttribute("duration")
				? durationAt(numeric(el, "duration"), unit, start)
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
			const factor = durationAt(1, contentUnit, start)
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
						depth + 1,
						trackId
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
				visit(child, unit, offset, min, max, depth + 1, trackId)
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
	return {
		commands,
		noteCount,
		song: importedSong({ ...meta, tracks: [...trackNotes.values()] })
	}
}