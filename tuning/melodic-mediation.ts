import { MAJOR_DEGREES, MINOR_DEGREES, type TonalMode } from "./classical-progressions"
import { mod12 } from "./pitch-class-set"
import type { SoundingStep } from "./progression-voicing"

export const MELODIC_APPROACHES = [
	{ id: "diatonic", name: "Diatonic passing notes" },
	{ id: "chromatic", name: "Chromatic passing notes" },
	{ id: "double-neighbour", name: "Double-neighbour approach" },
	{ id: "appoggiatura", name: "Appoggiatura approach" },
	{ id: "suspension", name: "Prepared suspension" },
	{ id: "retardation", name: "Prepared retardation" },
	{ id: "anticipation", name: "Anticipation" },
	{ id: "oblique", name: "Oblique voice movement" }
]

export function melodicMediation(
	from: number[],
	target: number[],
	method: string,
	tonic: number,
	mode: TonalMode,
	beats: number,
	finalBeats: number,
	maximum = 16
): { steps: SoundingStep[]; message: string } {
	const source = [...from].sort((a, b) => a - b),
		destination = [...new Set(target)].sort((a, b) => a - b)
	const scale = (mode === "minor" ? MINOR_DEGREES : MAJOR_DEGREES).map((degree) =>
		mod12(tonic + degree)
	)
	const final = {
		notes: destination,
		label: "Played destination",
		beats: finalBeats,
		root: mod12(destination[0])
	}
	if (!source.length)
		return { steps: [final], message: "First gesture establishes the starting sound." }
	const neighbour = (pitch: number, direction: number) => {
		for (let distance = 1; distance <= 3; distance++) {
			const note = pitch + distance * direction
			if (note >= 0 && note <= 127 && scale.includes(mod12(note))) return note
		}
		return pitch
	}
	const top = destination.length - 1,
		goal = destination[top],
		previousTop = source[source.length - 1]
	const upper = neighbour(goal, 1),
		lower = neighbour(goal, -1)
	let frames: number[][] = [],
		message = MELODIC_APPROACHES.find((approach) => approach.id === method)?.name ?? method
	const withTop = (pitch: number) => [...destination.slice(0, -1), pitch]
	if (method === "double-neighbour") frames = [withTop(upper), withTop(lower)]
	else if (method === "appoggiatura") {
		const approach = [upper, lower].find(
			(pitch) => Math.abs(pitch - previousTop) > 2 && pitch !== goal
		)
		if (approach !== undefined) frames = [withTop(approach)]
		else message = "No leaping appoggiatura fits this approach; direct arrival."
	} else if (method === "suspension" || method === "retardation") {
		const down = method === "suspension"
		const distance = previousTop - goal
		const bass = destination[0]
		const before = mod12(previousTop - bass),
			after = mod12(goal - bass)
		const prepared = down
			? distance > 0 &&
				distance <= 2 &&
				((before === 5 && [3, 4].includes(after)) ||
					([10, 11].includes(before) && [8, 9].includes(after)) ||
					(before === 2 && after === 0))
			: distance < 0 &&
				distance >= -2 &&
				((before === 11 && after === 0) || (before === 2 && [3, 4].includes(after)))
		if (prepared) frames = [source, withTop(previousTop)]
		else
			message =
				"The previous soprano does not prepare this suspension/retardation; direct arrival."
	} else if (method === "anticipation") {
		frames = [[...source.slice(0, -1), goal]]
	} else if (method === "oblique") {
		const current = destination.map((_, i) => source[Math.min(i, source.length - 1)])
		for (let i = 0; i < destination.length; i++) {
			current[i] = destination[i]
			if (i < destination.length - 1) frames.push([...current])
		}
	} else {
		const paths = destination.map((pitch, i) => {
			const start = source[Math.min(i, source.length - 1)],
				direction = Math.sign(pitch - start)
			const notes: number[] = []
			for (
				let note = start + direction;
				direction && (pitch - note) * direction > 0;
				note += direction
			) {
				if (method === "chromatic" || scale.includes(mod12(note))) notes.push(note)
			}
			return notes
		})
		const count = Math.max(0, ...paths.map((path) => path.length))
		if (count <= maximum)
			frames = Array.from({ length: count }, (_, i) =>
				paths.map((path, part) => path[i] ?? destination[part])
			)
		else
			message =
				"The stepwise connection exceeds Maximum steps; direct arrival preserves the destination."
	}
	frames = frames
		.slice(0, maximum)
		.map((frame) => [...new Set(frame)].sort((a, b) => a - b))
		.filter((frame) => frame.every((note) => note >= 0 && note <= 127))
	return {
		steps: [...frames.map((notes) => ({ notes, label: message, beats, root: tonic })), final],
		message
	}
}