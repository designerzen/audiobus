import { cityRhythms } from "./city-rhythms.mjs"

export const rhythmPresets = cityRhythms.map((rhythm) => ({
	...rhythm,
	beats: rhythm.beats ?? (rhythm.id === "waltz" ? 3 : 4)
}))
const regular = (degrees, beats = 4, length = 0.32) =>
	degrees.map((degree, index) => [degree, (index * beats) / degrees.length, length])
// Core accompaniment rules adapted from inclusive-city's JourneyMusicComposer.
const bassFigures = {
	classical: regular([0, 7, 4, 7, 0, 7, 4, 7], 4, 0.4),
	jazz: regular([0, 4, 7, 10], 4, 0.8),
	blues: regular([0, 7, 9, 10], 4, 0.65),
	techno: [
		[0, 0.5, 0.35],
		[7, 1.5, 0.35],
		[0, 2.5, 0.35],
		[7, 3.5, 0.35]
	],
	waltz: [[0, 0, 0.65]],
	latin: [
		[0, 0, 0.7],
		[7, 1.5, 0.4],
		[0, 2, 0.7],
		[7, 3.5, 0.4]
	],
	baroque: regular([0, -1, -3, -5], 4, 0.8),
	romantic: regular([0, 7, 16, 19, 12, 7, 16, 19], 4, 0.6),
	ragtime: regular([0, 7, 0, 7], 4, 0.3),
	funk: [
		[0, 0, 0.2],
		[12, 0.75, 0.12],
		[0, 1.5, 0.2],
		[7, 1.75, 0.12],
		[0, 2.5, 0.2],
		[10, 3.25, 0.12],
		[12, 3.75, 0.12]
	],
	reggae: [
		[0, 0, 0.9],
		[7, 1.75, 0.35],
		[12, 2.5, 0.6],
		[7, 3.5, 0.3]
	],
	disco: regular([0, 12, 0, 7, 0, 12, 10, 12], 4, 0.3),
	synthwave: regular([0, 0, 0, 12, 0, 0, 7, 0], 4, 0.35),
	dnb: [
		[0, 0, 1.2],
		[0, 1.5, 0.5],
		[7, 2.75, 0.7]
	]
}
const chordFigures = {
	waltz: [[1, 2], 0.4],
	latin: [[0, 0.75, 1.5, 2.5, 3.25], 0.25],
	ragtime: [[0.5, 1.5, 2.5, 3.5], 0.2],
	reggae: [[0.5, 1.5, 2.5, 3.5], 0.15],
	funk: [[0.75, 1.75, 2.5, 3.75], 0.12],
	disco: [[0.5, 1.5, 2.5, 3.5], 0.3],
	electronic: [[0.5, 1.5, 2.5, 3.5], 0.3],
	ambient: [[0], 3.5],
	cinematic: [[0], 3.5],
	synthwave: [[0], 3.5],
	classical: [[0, 2], 0.6],
	baroque: [[0, 2], 0.4],
	folk: [[0, 2], 1.2]
}
const electronicDrums = {
	techno: [[0, 1, 2, 3], [], [0.5, 1.5, 2.5, 3.5]],
	electronic: [
		[0, 1, 2, 3],
		[1, 3],
		[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
	],
	lofi: [
		[0, 2.5],
		[1, 3],
		[0, 2 / 3, 1, 1 + 2 / 3, 2, 2 + 2 / 3, 3, 3 + 2 / 3]
	],
	funk: [[0, 1.75, 2.5], [1, 3], Array.from({ length: 16 }, (_, i) => i / 4)],
	reggae: [[2], [2], [0.5, 1.5, 2.5, 3.5]],
	disco: [
		[0, 1, 2, 3],
		[1, 3],
		[0.5, 1.5, 2.5, 3.5]
	],
	synthwave: [
		[0, 2],
		[1, 3],
		[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
	],
	dnb: [[0, 1.5, 2.75], [1, 3, 3.75], Array.from({ length: 16 }, (_, i) => i / 4)],
	jazz: [
		[0, 2],
		[1, 3],
		[0, 2 / 3, 1, 1 + 2 / 3, 2, 2 + 2 / 3, 3, 3 + 2 / 3]
	],
	blues: [
		[0, 2],
		[1, 3],
		[0, 2 / 3, 1, 1 + 2 / 3, 2, 2 + 2 / 3, 3, 3 + 2 / 3]
	],
	chiptune: [
		[0, 2],
		[1, 3],
		[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]
	]
}
const names = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]

/**
 * @param {Record<string, any>} options
 * @param {Array<{id:string,name:string,detail:string,voice:number,volume:number,pan:number,color:string}>} layers
 * @param {Array<{id:string,minor:boolean}>} moods
 * @param {(seed:string) => () => number} randomFromSeed
 */
export function createGenreSong(options, layers, moods, randomFromSeed) {
	const rhythm = rhythmPresets.find((preset) => preset.id === options.groove)
	const settings = {
		seed: String(options.seed || "golden-hour").slice(0, 60),
		tempo: Math.round(Math.min(200, Math.max(50, Number(options.tempo) || rhythm.bpm))),
		key: Math.round(Math.min(11, Math.max(0, Number(options.key) || 0))),
		mood: moods.some((mood) => mood.id === options.mood) ? options.mood : "bright",
		groove: rhythm.id,
		energy: Math.min(100, Math.max(0, Number(options.energy ?? 65) || 0)),
		length: options.length === "full" ? "full" : "short"
	}
	const mood = moods.find((item) => item.id === settings.mood)
	const gentle = ["dreamy", "tender", "bittersweet"].includes(settings.mood)
	const excited = settings.mood === "excited"
	const random = randomFromSeed(settings.seed)
	const size = settings.length === "full" ? 2 : 1
	const beats = rhythm.beats,
		stepsPerBeat = 24,
		steps = beats * stepsPerBeat
	let start = 0
	const sections = [
		["Intro", 2, 0],
		["Verse", 4, 1],
		["Build", 2, 2],
		["Chorus", 4, 3],
		["Bridge", 2, 1],
		["Final chorus", 4, 3],
		["Outro", 2, 0]
	].map(([name, bars, intensity]) => {
		const section = {
			name: String(name),
			bars: Number(bars) * size,
			intensity: Number(intensity),
			start
		}
		start += section.bars
		return section
	})
	const roots =
		rhythm.roots ??
		(rhythm.id === "blues"
			? [60, 60, 60, 60, 65, 65, 60, 60, 67, 65, 60, 67]
			: ["jazz", "latin", "lofi"].includes(rhythm.id)
				? [62, 67, 60, 60]
				: ["ambient", "minimalist", "chimes", "cinematic", "synthwave", "dnb"].includes(
							rhythm.id
					  )
					? [57, 65, 60, 67]
					: rhythm.id === "funk"
						? [60, 60, 60, 65]
						: [60, 65, 67, 60])
	const baseScale =
		rhythm.scale ??
		(rhythm.id === "blues"
			? [0, 3, 5, 6, 7, 10]
			: rhythm.id === "folk"
				? [0, 2, 4, 7, 9]
				: [0, 2, 4, 5, 7, 9, 11])
	const scale = mood.minor
		? baseScale.map((note) => ({ 4: 3, 9: 8, 11: 10 })[note] ?? note)
		: baseScale
	const pitch = (degree) =>
		scale[((degree % scale.length) + scale.length) % scale.length] +
		Math.floor(degree / scale.length) * 12
	const hook =
		rhythm.hook ??
		(rhythm.id === "minimalist"
			? regular([0, 4, 2, 4, 0, 4, 2, 4])
			: rhythm.id === "baroque"
				? regular([0, 1, 2, 4, 3, 2, 1, 0])
				: rhythm.id === "waltz"
					? regular([4, 2, 1, 0, 1, 2], 3)
					: rhythm.id === "chimes"
						? regular([0, 4, 2, 6, 4, 2], 4, 0.75)
						: rhythm.id === "chiptune"
							? regular([0, 2, 4, 7, 4, 2, 0, 4, 2, 4, 7, 9, 7, 4, 2, 0], 4, 0.12)
							: regular([0, 4, 7, 4, 0, 4, 7, 6]))
	const third = mood.minor || rhythm.minor ? 3 : !baseScale.includes(4) ? 5 : 4
	const bass = rhythm.bass ?? bassFigures[rhythm.id] ?? regular([0, 7, 0, 7], beats, 0.55)
	const [chords, chordLength] = rhythm.chords
		? [rhythm.chords, rhythm.chordLength]
		: (chordFigures[rhythm.id] ?? [[0], 2])
	const drums = rhythm.drums
		? [rhythm.drums, [], rhythm.ticks]
		: (electronicDrums[rhythm.id] ?? [[], [], []])
	/** @type {Array<Array<{step: number, note: number, duration: number}>>} */
	const empty = []
	const tracks = layers.map((layer) => ({ ...layer, mode: 6, mute: false, bars: [...empty] }))
	const leadVoice = ["classical", "romantic", "ragtime", "latin", "lofi", "jazz"].includes(
		rhythm.id
	)
		? 9
		: rhythm.id === "baroque"
			? 1
			: rhythm.voice.waveform === "sine"
				? 7
				: rhythm.voice.waveform === "triangle"
					? 1
					: rhythm.voice.waveform === "square"
						? 8
						: 0
	tracks[0].voice = leadVoice
	tracks[1].voice = leadVoice
	tracks[2].voice = ["classical", "romantic", "ragtime", "jazz", "lofi"].includes(rhythm.id)
		? 9
		: 1
	tracks[5].voice = rhythm.voice.waveform === "sine" ? 7 : 1
	if (["ambient", "cinematic"].includes(rhythm.id)) {
		tracks[0].voice = tracks[1].voice = 2
	}
	if (["classical", "baroque", "romantic", "ragtime"].includes(rhythm.id)) {
		tracks[6].voice = 9
	}
	if (rhythm.id === "chiptune") {
		for (const index of [0, 1, 5, 6]) {
			tracks[index].mode = 1
			tracks[index].voice = 0
		}
	}
	let barIndex = 0
	for (const section of sections) {
		for (let bar = 0; bar < section.bars; bar++, barIndex++) {
			const root = roots[barIndex % roots.length] - 12 + settings.key
			const last = section.name === "Outro" && bar === section.bars - 1
			const events = Object.fromEntries(
				tracks.map((track) => {
					const values = []
					track.bars.push(values)
					return [track.id, values]
				})
			)
			const add = (id, at, note, length = 0.12) => {
				if (at < beats) {
					events[id].push({
						step: Math.round(at * stepsPerBeat),
						note: Math.max(0, Math.min(127, Math.round(note))),
						duration: Math.max(1, Math.round(length * stepsPerBeat))
					})
				}
			}
			const chordIntervals = [
				0,
				third,
				["jazz", "latin", "lofi", "funk", "disco", "ragtime"].includes(rhythm.id) ? 10 : 7
			]
			chords.forEach((at) =>
				chordIntervals.forEach((interval, i) =>
					add(`chord${i + 1}`, at, root + interval, chordLength)
				)
			)
			if (section.intensity > 0 || last) {
				bass.forEach(([interval, at, length]) =>
					add("bass", at, root - 24 + (interval === 4 ? third : interval), length)
				)
			}
			if (section.intensity > 0) {
				hook.forEach(([degree, at, length], index) => {
					if (gentle && index % 3 === 1) {
						return
					}
					const variation = index % 3 === 0 ? Math.floor(random() * 3) - 1 : 0
					const resolved =
						settings.mood === "angry" ? (index % 2 ? 0 : degree) : degree + variation
					add(
						"lead",
						at,
						root +
							12 +
							(excited ? 12 : settings.mood === "bittersweet" ? -12 : 0) +
							pitch(resolved),
						length * (gentle ? 1.2 : 1)
					)
				})
				drums[0].forEach((at) => add("kick", at, 36, 0.12))
				drums[1].forEach((at) => add("snare", at, 60, 0.08))
				drums[2].forEach((at) => add("hats", at, 84, 0.04))
			}
			if (section.intensity >= 2) {
				hook.filter((_, i) => i % 3 === 1).forEach(([degree, at, length]) =>
					add("counter", at, root + pitch(4 - degree), length)
				)
				const arpStep =
					rhythm.id === "chiptune" || excited || settings.energy > 75 ? 0.25 : 0.5
				for (let at = 0, i = 0; at < beats; at += arpStep, i++) {
					add("arp", at, root + 12 + pitch([0, 2, 4, 2][i % 4]), arpStep * 0.65)
				}
			}
			// The original motifs can overlap. Each SiON part is monophonic, so trim at the next onset.
			for (const values of Object.values(events)) {
				values.sort((a, b) => a.step - b.step)
				for (let i = values.length - 1; i >= 0; i--) {
					const note = values[i],
						end = Math.min(steps, values[i + 1]?.step ?? steps)
					if (note.step >= end) {
						values.splice(i, 1)
					} else {
						note.duration = Math.min(note.duration, end - note.step)
					}
				}
			}
		}
	}
	return {
		settings,
		sections,
		tracks,
		totalBars: start,
		beats,
		stepsPerBeat,
		rhythm: rhythm.label,
		minor: Boolean(mood.minor || rhythm.minor),
		duration: (start * beats * 60) / settings.tempo,
		title: `${["Velvet", "Golden", "Neon", "Satellite", "Sunday", "Electric"][Math.floor(random() * 6)]} ${["Skies", "Hearts", "Daydream", "Summer", "Afterglow", "Motion"][Math.floor(random() * 6)]}`,
		chords: roots.map(
			(root) =>
				names[(((root + settings.key) % 12) + 12) % 12] +
				(mood.minor || rhythm.minor ? "m" : "")
		)
	}
}