export interface ReaperChunk {
	tag: string
	args: string[]
	entries: (string[] | ReaperChunk)[]
}
export const reaperChunks = (chunk: ReaperChunk, tag: string) =>
	chunk.entries.filter(
		(entry): entry is ReaperChunk => !Array.isArray(entry) && entry.tag === tag
	)
export const reaperLines = (chunk: ReaperChunk, tag: string) =>
	chunk.entries.filter((entry): entry is string[] => Array.isArray(entry) && entry[0] === tag)
export const reaperField = (chunk: ReaperChunk, tag: string) =>
	reaperLines(chunk, tag)[0]?.slice(1) ?? []

/** A bounded chunk reader. Plugin and script contents are treated only as inert data. */
export function parseReaperProject(text: string): ReaperChunk {
	const stack: ReaperChunk[] = [],
		roots: ReaperChunk[] = []
	let entries = 0
	for (const raw of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
		const line = raw.trim()
		if (!line) {
			continue
		}
		if (++entries > 1000000 || line.length > 2 * 1024 * 1024) {
			throw new Error("REAPER project has too many entries or an oversized line")
		}
		if (line === ">") {
			if (!stack.pop()) {
				throw new Error("Unexpected REAPER chunk ending")
			}
			continue
		}
		const opening = line.startsWith("<"),
			source = opening ? line.slice(1) : line
		const tokens: string[] = []
		let position = 0
		while (position < source.length) {
			if (/\s/.test(source[position])) {
				position++
				continue
			}
			const quote = source[position]
			if (['"', "'", "`"].includes(quote)) {
				const end = source.indexOf(quote, position + 1)
				if (end < 0) {
					throw new Error("Unterminated REAPER quoted string")
				}
				tokens.push(source.slice(position + 1, end))
				position = end + 1
			} else {
				const start = position
				while (position < source.length && !/\s/.test(source[position])) {
					position++
				}
				tokens.push(source.slice(start, position))
			}
		}
		if (!tokens.length) {
			throw new Error("Empty REAPER chunk")
		}
		if (opening) {
			if (stack.length >= 128) {
				throw new Error("REAPER chunks are nested too deeply")
			}
			const chunk: ReaperChunk = { tag: tokens[0], args: tokens.slice(1), entries: [] }
			if (stack.length) {
				stack.at(-1)!.entries.push(chunk)
			} else {
				roots.push(chunk)
			}
			stack.push(chunk)
		} else {
			if (!stack.length) {
				throw new Error("REAPER data outside the project chunk")
			}
			stack.at(-1)!.entries.push(tokens)
		}
	}
	if (stack.length || roots.length !== 1 || roots[0].tag !== "REAPER_PROJECT") {
		throw new Error("Expected a complete REAPER project")
	}
	return roots[0]
}

export function reaperNumber(value: string | undefined, fallback?: number): number {
	const number = value === undefined ? fallback : Number(value)
	if (number === undefined || !Number.isFinite(number)) {
		throw new Error("Invalid REAPER numeric field")
	}
	return number
}

/** REAPER tempo envelope positions are seconds. Shape 1 is a step; shape 0 is a linear BPM ramp. */
export function reaperTimeAxis(project: ReaperChunk) {
	const initial = reaperNumber(reaperField(project, "TEMPO")[0], 120)
	const changes = new Map<number, { bpm: number; linear: boolean }>([
		[0, { bpm: initial, linear: false }]
	])
	const envelope = reaperChunks(project, "TEMPOENVEX")[0]
	if (envelope) {
		const points = reaperLines(envelope, "PT")
		if (points.length > 10000) {
			throw new Error("Too many REAPER tempo changes")
		}
		for (const point of points) {
			const at = reaperNumber(point[1]),
				bpm = reaperNumber(point[2]),
				shape = reaperNumber(point[3], 1)
			if (at < 0 || at > 1800 || ![0, 1].includes(shape)) {
				throw new Error("Unsupported REAPER tempo envelope point")
			}
			changes.set(at, { bpm, linear: shape === 0 })
		}
	}
	const points = [...changes]
		.sort(([a], [b]) => a - b)
		.map(([seconds, data]) => ({ seconds, ...data, beat: 0 }))
	for (const point of points) {
		if (!(point.bpm > 0 && point.bpm <= 10000)) {
			throw new Error("Invalid REAPER tempo")
		}
	}
	for (let index = 1; index < points.length; index++) {
		const previous = points[index - 1],
			point = points[index]
		point.beat =
			previous.beat +
			((point.seconds - previous.seconds) *
				(previous.linear ? (previous.bpm + point.bpm) / 2 : previous.bpm)) /
				60
	}
	const segment = (value: number, field: "seconds" | "beat") => {
		if (!Number.isFinite(value) || value < 0) {
			throw new Error("Invalid REAPER timeline position")
		}
		let low = 0,
			high = points.length
		while (low + 1 < high) {
			const middle = (low + high) >>> 1
			if (points[middle][field] <= value) {
				low = middle
			} else {
				high = middle
			}
		}
		return low
	}
	return {
		beats(seconds: number) {
			const index = segment(seconds, "seconds"),
				point = points[index],
				next = points[index + 1]
			const delta = seconds - point.seconds,
				slope =
					point.linear && next
						? (next.bpm - point.bpm) / (next.seconds - point.seconds)
						: 0
			return point.beat + (point.bpm * delta + (slope * delta * delta) / 2) / 60
		},
		seconds(beat: number) {
			const index = segment(beat, "beat"),
				point = points[index],
				next = points[index + 1]
			const slope =
				point.linear && next ? (next.bpm - point.bpm) / (next.seconds - point.seconds) : 0
			const area = (beat - point.beat) * 60
			return (
				point.seconds +
				(Math.abs(slope) < 1e-12
					? area / point.bpm
					: (2 * area) / (point.bpm + Math.sqrt(point.bpm ** 2 + 2 * slope * area)))
			)
		}
	}
}

export function quoteReaper(value: string): string {
	const clean = value.replace(/[\r\n\t]/g, " ")
	const delimiter = ['"', "'", "`"].find((quote) => !clean.includes(quote)) ?? '"'
	return delimiter + (delimiter === '"' ? clean.replace(/"/g, "'") : clean) + delimiter
}