import AudioCommand from "../../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../../commands/commands"
import type { SequenceNote } from "../../formats/note-sequence"
import { CHANNEL_DRUMS, drumVoiceOf } from "../../formats/tracker/tracker-drums"
import {
	trackerInstrumentKey,
	type TrackerSample,
	type TrackerSampleSet
} from "../../formats/tracker/tracker-types"
import type { IAudioOutput } from "../outputs/output-interface"
import {
	RECORDING_PROCESSOR,
	RECORDING_START,
	RECORDING_STOP,
	RECORDING_DATA
} from "./recording-format"

const workletURL = new URL("./recording.worklet.js", import.meta.url).href
const loadedWorklets = new WeakMap<AudioContext, Promise<void>>()
const SILENCE_THRESHOLD = 0.001
const MAX_SECONDS = 2
/** Seconds the whole capture may take unless the caller says otherwise */
export const CAPTURE_BUDGET_SECONDS = 12
/** A pitched instrument that plays further than this many semitones apart is sampled in zones */
const ZONE_SPAN = 14
const MAX_ZONES = 3
/** Drum voices sampled per drum chain; the rest are synthesised */
const MAX_DRUM_VOICES = 12
const DEFAULT_HOLD = 0.8
const DEFAULT_RELEASE = 0.6
/** Hold and release never shrink below these when the budget is tight */
const MIN_HOLD = 0.15
const MIN_RELEASE = 0.15
/** Drums are one-shots: a short hold, then the ring-out gets the time */
const DRUM_HOLD = 0.3

export interface CaptureTrackerSamplesOptions {
	audioContext: AudioContext
	getChain: (chainId: string) => { outputs: IAudioOutput[] } | undefined
	notes: SequenceNote[]
	/** Silence the audible mix downstream of the instrument taps, then restore it. */
	mute?: () => () => void
	signal?: AbortSignal
	holdSeconds?: number
	releaseSeconds?: number
	/** Total seconds the capture may take, default 12. Holds and releases shrink when there are
	 * many captures, and the extra zones and drum voices are dropped first when even the shortest
	 * would not fit.
	 */
	budgetSeconds?: number
	onProgress?: (done: number, total: number) => void
}

/** One note to play through an instrument and record */
export interface TrackerCaptureJob {
	key: string
	/** The median pitch and velocity of the notes the capture stands for */
	note: SequenceNote
	drums: boolean
	/** The keys a drum voice answers to */
	keys: number[]
	/** 0 for the capture an instrument cannot do without; higher ranks are dropped first */
	rank: number
}

/** Group by the same identity used by tracker exporters, retaining input order. */
export function groupTrackerNotes(notes: readonly SequenceNote[]): Map<string, SequenceNote[]> {
	const groups = new Map<string, SequenceNote[]>()
	for (const note of notes) {
		if (!note.chainId) {
			continue
		}
		const key = trackerInstrumentKey(note)
		const group = groups.get(key) ?? []
		group.push(note)
		groups.set(key, group)
	}
	return groups
}

/** Use the lower middle recorded pitch for even groups, and the median velocity. */
export function representativeTrackerNote(notes: readonly SequenceNote[]): SequenceNote {
	if (!notes.length) {
		throw new Error("Cannot choose a representative of an empty note group")
	}
	const pitches = notes.map((note) => note.number).sort((a, b) => a - b)
	const velocities = notes.map((note) => note.velocity).sort((a, b) => a - b)
	const middle = Math.floor((notes.length - 1) / 2)
	return { ...notes[0], number: pitches[middle], velocity: velocities[middle] }
}

/** The captures each instrument key needs, in the order they are recorded.
 * A channel 10 instrument records each distinct drum voice it plays, the most played first and no more
 * than a dozen. A pitched instrument records one note, or up to three zones (the low, middle and high
 * median pitches) when its notes span more than 14 semitones.
 */
export function planTrackerCaptures(notes: readonly SequenceNote[]): TrackerCaptureJob[][] {
	return [...groupTrackerNotes(notes)].map(([key, group]) => {
		if (group[0].channel === CHANNEL_DRUMS) {
			const voices = new Map<string, SequenceNote[]>()
			for (const note of group) {
				const id = drumVoiceOf(note.number).id
				voices.set(id, [...(voices.get(id) ?? []), note])
			}
			return [...voices.values()]
				.sort((a, b) => b.length - a.length)
				.slice(0, MAX_DRUM_VOICES)
				.map((voice, rank) => ({
					key,
					note: representativeTrackerNote(voice),
					drums: true,
					keys: [...new Set(voice.map((note) => note.number))].sort((a, b) => a - b),
					rank
				}))
		}
		const sorted = [...group].sort((a, b) => a.number - b.number)
		const span = sorted[sorted.length - 1].number - sorted[0].number
		const zones = span > ZONE_SPAN ? Math.min(MAX_ZONES, Math.ceil(span / ZONE_SPAN)) : 1
		const reps = new Map<number, SequenceNote>()
		for (let zone = 0; zone < zones; zone++) {
			const members = sorted.slice(
				Math.floor((zone * sorted.length) / zones),
				Math.floor(((zone + 1) * sorted.length) / zones)
			)
			if (members.length) {
				const rep = representativeTrackerNote(members)
				reps.set(rep.number, rep)
			}
		}
		const middle = Math.floor((reps.size - 1) / 2)
		return [...reps.values()].map((note, index) => ({
			key,
			note,
			drums: false,
			keys: [],
			// The middle zone first, then the low and high ones
			rank:
				index === middle
					? 0
					: 1 + 2 * (Math.abs(index - middle) - 1) + (index > middle ? 1 : 0)
		}))
	})
}

/** Choose the captures that fit the budget and how long to hold and release each.
 * Every instrument keeps its rank 0 capture; the others are taken in rank order while their minimum
 * time fits. The rest of the budget is shared out by shrinking the holds and releases of all.
 */
export function scheduleTrackerCaptures(
	plans: readonly TrackerCaptureJob[][],
	budget: number,
	hold: number,
	release: number
): {
	plans: TrackerCaptureJob[][]
	timing: (job: TrackerCaptureJob) => { hold: number; release: number }
} {
	const all = plans.flat()
	const required = all.filter((job) => !job.rank)
	const room = Math.max(required.length, Math.floor(budget / (MIN_HOLD + MIN_RELEASE)))
	const optional = all
		.filter((job) => job.rank)
		.sort((a, b) => a.rank - b.rank)
		.slice(0, room - required.length)
	const kept = new Set<TrackerCaptureJob>([...required, ...optional])
	const chosen = plans.map((jobs) => jobs.filter((job) => kept.has(job)))
	const nominal = (job: TrackerCaptureJob) => {
		const held = job.drums ? Math.min(hold, DRUM_HOLD) : hold
		return { hold: held, release: Math.min(release, MAX_SECONDS - held) }
	}
	const total = [...kept].reduce((sum, job) => sum + nominal(job).hold + nominal(job).release, 0)
	const scale = total > budget ? budget / total : 1
	return {
		plans: chosen,
		timing: (job) => {
			const { hold: held, release: released } = nominal(job)
			return {
				hold: Math.min(held, Math.max(MIN_HOLD, held * scale)),
				release: Math.min(released, Math.max(MIN_RELEASE, released * scale))
			}
		}
	}
}

function silenceBounds(samples: Float32Array, threshold: number): [number, number] {
	threshold = Math.fround(threshold)
	let start = 0
	let end = samples.length
	while (start < end && Math.abs(samples[start]) <= threshold) {
		start++
	}
	while (end > start && Math.abs(samples[end - 1]) <= threshold) {
		end--
	}
	return [start, end]
}

export function trimSilence(samples: Float32Array, threshold = SILENCE_THRESHOLD): Float32Array {
	const [start, end] = silenceBounds(samples, threshold)
	return samples.slice(start, end)
}

function peak(samples: Float32Array): number {
	let maximum = 0
	for (const value of samples) {
		if (Number.isFinite(value)) {
			maximum = Math.max(maximum, Math.abs(value))
		}
	}
	return maximum
}

export function normalisePeak(samples: Float32Array, target = 0.95): Float32Array {
	const maximum = peak(samples)
	const scale = maximum > 0 ? Math.max(0, Math.min(1, target)) / maximum : 0
	return samples.map((sample) => (Number.isFinite(sample) ? sample * scale : 0))
}

/** Average interleaved PCM channels; the recording worklet always supplies stereo. */
export function downmixToMono(samples: Float32Array, channelCount = 2): Float32Array {
	if (!Number.isInteger(channelCount) || channelCount < 1) {
		throw new Error("The channel count must be a positive integer")
	}
	const mono = new Float32Array(Math.floor(samples.length / channelCount))
	for (let frame = 0; frame < mono.length; frame++) {
		let sum = 0
		for (let channel = 0; channel < channelCount; channel++) {
			const value = samples[frame * channelCount + channel]
			sum += Number.isFinite(value) ? value : 0
		}
		mono[frame] = sum / channelCount
	}
	return mono
}

function rms(samples: Float32Array, start: number, end: number): number {
	let sum = 0
	for (let i = start; i < end; i++) {
		sum += samples[i] ** 2
	}
	return Math.sqrt(sum / Math.max(1, end - start))
}

/** A loop is at least this long, so that it still sounds like the instrument and not a buzz */
const MIN_LOOP_SECONDS = 0.04

/** Inspect only the held sound, before note-off. Loop endpoints are rising crossings.
 * The loop that ends soonest wins, so the stored sample is a short attack and a short loop rather
 * than the whole held note.
 */
export function findSustainLoop(
	samples: Float32Array,
	sampleRate: number,
	baseNote: number
): Pick<TrackerSample, "loopStart" | "loopLength"> | undefined {
	const period = sampleRate / (440 * 2 ** ((baseNote - 69) / 12))
	if (!Number.isFinite(period) || period < 4 || samples.length < period * 8) {
		return undefined
	}
	const early = rms(samples, Math.floor(samples.length * 0.15), Math.floor(samples.length * 0.35))
	const late = rms(samples, Math.floor(samples.length * 0.7), Math.floor(samples.length * 0.95))
	if (late < SILENCE_THRESHOLD * 4 || late < early * 0.55) {
		return undefined
	}
	const crossings: number[] = []
	for (let i = Math.floor(samples.length * 0.35); i < samples.length * 0.95; i++) {
		if (samples[i - 1] <= 0 && samples[i] > 0) {
			crossings.push(i)
		}
	}
	const shortest = Math.max(2 * period, MIN_LOOP_SECONDS * sampleRate)
	let best: { loopStart: number; loopLength: number } | undefined
	let bestEnd = Infinity
	const window = Math.max(1, Math.min(32, Math.floor(period / 8)))
	for (const start of crossings) {
		if (start >= samples.length * 0.55 || start >= bestEnd) {
			break
		}
		for (const end of crossings) {
			const length = end - start
			if (length < shortest) {
				continue
			}
			if (end >= bestEnd) {
				break
			}
			const periods = Math.round(length / period)
			// Integer sample positions can differ from an exact whole period by one frame.
			if (Math.abs(length - periods * period) > 1) {
				continue
			}
			let mismatch = 0
			for (let i = -window; i <= window; i++) {
				mismatch += (samples[start + i] - samples[end + i]) ** 2
			}
			mismatch = Math.sqrt(mismatch / (window * 2 + 1))
			if (mismatch < late * 0.1) {
				bestEnd = end
				best = { loopStart: start, loopLength: length }
				break
			}
		}
	}
	return best
}

function checkAbort(signal?: AbortSignal) {
	if (signal?.aborted) {
		throw new DOMException("Instrument sampling was aborted", "AbortError")
	}
}

function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
	return new Promise((resolve, reject) => {
		const aborted = () => {
			signal?.removeEventListener("abort", aborted)
			reject(new DOMException("Instrument sampling was aborted", "AbortError"))
		}
		signal?.addEventListener("abort", aborted, { once: true })
		operation.then(resolve, reject).finally(() => signal?.removeEventListener("abort", aborted))
		if (signal?.aborted) {
			aborted()
		}
	})
}

async function command(output: IAudioOutput, note: SequenceNote, type: string) {
	if (output.sendCommand) {
		await output.sendCommand(
			Object.assign(new AudioCommand(), {
				type,
				number: note.number,
				velocity: type === NOTE_ON ? note.velocity : 0,
				channel: note.channel,
				patch: note.patch
			})
		)
	} else if (type === NOTE_ON) {
		await output.noteOn(note.number, note.velocity)
	} else {
		output.noteOff(note.number)
	}
}

function seconds(value: number | undefined, fallback: number): number {
	return Number.isFinite(value) ? Math.max(0, Math.min(MAX_SECONDS, value!)) : fallback
}

async function prepareCapture(context: AudioContext): Promise<void> {
	await context.resume()
	let loaded = loadedWorklets.get(context)
	if (!loaded) {
		loaded = context.audioWorklet.addModule(workletURL).catch((error) => {
			loadedWorklets.delete(context)
			throw error
		})
		loadedWorklets.set(context, loaded)
	}
	await loaded
}

async function captureInstrument(
	options: CaptureTrackerSamplesOptions,
	outputs: IAudioOutput[],
	job: TrackerCaptureJob,
	timing: { hold: number; release: number }
): Promise<{ sample: TrackerSample; peak: number }> {
	const { audioContext: context, signal } = options
	const { note } = job
	const { hold, release } = timing
	const controller = new AbortController()
	const abort = () => controller.abort()
	const tap = new AudioWorkletNode(context, RECORDING_PROCESSOR, {
		numberOfInputs: 1,
		numberOfOutputs: 1,
		outputChannelCount: [2],
		channelCount: 2,
		channelCountMode: "explicit"
	})
	signal?.addEventListener("abort", abort, { once: true })
	const sources = new Set<AudioNode>()
	const chunks: Float32Array[] = []
	let frames = 0
	let releasing = false
	let releaseChunks = 0
	let processorError: Error | undefined
	let stopped: (() => void) | undefined
	let silent: (() => void) | undefined
	const timers = new Set<ReturnType<typeof setTimeout>>()
	const wait = (milliseconds: number) => {
		let timer: ReturnType<typeof setTimeout>
		return abortable(
			new Promise<void>((resolve) => {
				timer = setTimeout(resolve, milliseconds)
				timers.add(timer)
			}),
			controller.signal
		).finally(() => {
			clearTimeout(timer)
			timers.delete(timer)
		})
	}
	const send = async (output: IAudioOutput, type: string) => {
		checkAbort(controller.signal)
		const pending = command(output, note, type)
		// Some outputs await instrument loading. Stop a note that finishes loading after abort.
		void pending
			.then(() => {
				if (controller.signal.aborted) {
					output.allNotesOff()
				}
			})
			.catch((error) => {
				if (controller.signal.aborted) {
					console.warn(
						"Could not complete sampled instrument command",
						output.name,
						error
					)
				}
			})
		await abortable(pending, controller.signal)
	}
	tap.onprocessorerror = () => {
		processorError = new Error("Instrument capture worklet failed")
		controller.abort()
	}
	tap.port.onmessage = ({ data }) => {
		if (data.type === RECORDING_STOP) {
			stopped?.()
		} else if (data.type === RECORDING_DATA) {
			const mono = downmixToMono(data.samples)
			const remaining = Math.max(0, Math.floor(context.sampleRate * MAX_SECONDS) - frames)
			const chunk = mono.slice(0, remaining)
			chunks.push(chunk)
			frames += chunk.length
			// The first batch after note-off may still contain held audio.
			if (releasing && ++releaseChunks > 1 && peak(mono) < SILENCE_THRESHOLD) {
				silent?.()
			}
		}
	}
	try {
		checkAbort(signal)
		tap.connect(context.destination)
		for (const output of outputs) {
			const source = output.output as AudioNode
			if (!sources.has(source)) {
				// Fan out to the tap without changing the output's existing routing.
				source.connect(tap)
				sources.add(source)
			}
		}
		tap.port.postMessage(RECORDING_START)
		const startedAt = context.currentTime
		for (const output of outputs) {
			await send(output, NOTE_ON)
		}
		await wait(hold * 1000)
		const heldFrames = Math.round(
			(context.currentTime - startedAt || hold) * context.sampleRate
		)
		for (const output of outputs) {
			await send(output, NOTE_OFF)
		}
		releasing = true
		await Promise.race([
			wait(release * 1000),
			new Promise<void>((resolve) => {
				silent = resolve
			})
		])
		const flushed = new Promise<void>((resolve) => {
			stopped = resolve
		})
		tap.port.postMessage(RECORDING_STOP)
		await Promise.race([
			abortable(flushed, controller.signal),
			wait(1000).then(() => {
				throw new Error("Instrument capture did not flush")
			})
		])
		const raw = new Float32Array(frames)
		let offset = 0
		for (const chunk of chunks) {
			raw.set(chunk, offset)
			offset += chunk.length
		}
		if (peak(raw) <= Math.fround(SILENCE_THRESHOLD)) {
			throw new Error("Instrument capture was silent")
		}
		const [leading] = silenceBounds(raw, SILENCE_THRESHOLD)
		const data = trimSilence(raw)
		// A drum hit rings out once; only a held pitched sound has a sustain to loop
		const loop = job.drums
			? undefined
			: findSustainLoop(
					data.subarray(0, Math.max(0, heldFrames - leading)),
					context.sampleRate,
					note.number
				)
		const suffix = job.drums ? ` ${note.number}` : ` ${note.patch}`
		const label = job.drums
			? drumVoiceOf(note.number).name
			: outputs[0].name.normalize("NFKD").replace(/[^\x20-\x7e]/g, "")
		return {
			sample: {
				name: label.slice(0, 22 - suffix.length) + suffix,
				data: normalisePeak(data),
				sampleRate: context.sampleRate,
				baseNote: note.number,
				...loop
			},
			peak: peak(data)
		}
	} catch (error) {
		throw processorError ?? error
	} finally {
		for (const timer of timers) {
			clearTimeout(timer)
		}
		controller.abort()
		signal?.removeEventListener("abort", abort)
		for (const output of outputs) {
			try {
				output.allNotesOff()
			} catch (error) {
				console.warn("Could not stop sampled instrument", output.name, error)
			}
		}
		for (const source of sources) {
			try {
				source.disconnect(tap)
			} catch (error) {
				console.warn("Could not disconnect instrument capture tap", error)
			}
		}
		tap.port.onmessage = null
		tap.onprocessorerror = null
		tap.disconnect()
		tap.port.close()
	}
}

export async function captureTrackerSamples(
	options: CaptureTrackerSamplesOptions
): Promise<Map<string, TrackerSample | TrackerSampleSet>> {
	const { audioContext: context, signal } = options
	checkAbort(signal)
	const samples = new Map<string, TrackerSample | TrackerSampleSet>()
	const budget = Number.isFinite(options.budgetSeconds)
		? Math.max(0, options.budgetSeconds!)
		: CAPTURE_BUDGET_SECONDS
	const schedule = scheduleTrackerCaptures(
		planTrackerCaptures(options.notes),
		budget,
		seconds(options.holdSeconds, DEFAULT_HOLD),
		seconds(options.releaseSeconds, DEFAULT_RELEASE)
	)
	const total = schedule.plans.reduce((sum, jobs) => sum + jobs.length, 0)
	if (!total) {
		return samples
	}
	const restore = options.mute?.()
	try {
		let ready: Promise<void> | undefined
		let done = 0
		for (const jobs of schedule.plans) {
			const captured: { job: TrackerCaptureJob; sample: TrackerSample; peak: number }[] = []
			for (const job of jobs) {
				checkAbort(signal)
				try {
					const outputs =
						options.getChain(job.note.chainId!)?.outputs.filter((output) => {
							const node = output.output
							// Context identity also excludes Web MIDI and hardware output objects.
							return (
								output.hasAudioOutput?.() &&
								node &&
								"context" in node &&
								node.context === context &&
								typeof node.connect === "function" &&
								typeof node.disconnect === "function"
							)
						}) ?? []
					if (!outputs.length) {
						throw new Error(
							"No connected audio output is available for this instrument"
						)
					}
					await abortable((ready ??= prepareCapture(context)), signal)
					checkAbort(signal)
					captured.push({
						job,
						...(await captureInstrument(options, outputs, job, schedule.timing(job)))
					})
				} catch (error) {
					checkAbort(signal)
					console.warn("Tracker sample omitted", job.key, error)
				}
				options.onProgress?.(++done, total)
			}
			if (captured.length === 1 && !captured[0].job.drums) {
				samples.set(captured[0].job.key, captured[0].sample)
			} else if (captured.length) {
				// Samples of one instrument keep their loudness relative to each other
				const loudest = Math.max(...captured.map(({ peak }) => peak))
				const keymap = new Map<number, number>()
				captured.forEach(({ job }, index) =>
					job.keys.forEach((key) => keymap.set(key, index))
				)
				samples.set(captured[0].job.key, {
					samples: captured.map(({ sample, peak }) => ({
						...sample,
						volume: loudest > 0 ? peak / loudest : 1
					})),
					...(keymap.size ? { keymap } : {})
				})
			}
		}
		checkAbort(signal)
		return samples
	} finally {
		restore?.()
	}
}