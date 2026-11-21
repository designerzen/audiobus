import AudioCommand from "../../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../../commands/commands"
import type { SequenceNote } from "../../formats/note-sequence"
import { trackerInstrumentKey, type TrackerSample } from "../../formats/tracker/tracker-types"
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

export interface CaptureTrackerSamplesOptions {
	audioContext: AudioContext
	getChain: (chainId: string) => { outputs: IAudioOutput[] } | undefined
	notes: SequenceNote[]
	/** Silence the audible mix downstream of the instrument taps, then restore it. */
	mute?: () => () => void
	signal?: AbortSignal
	holdSeconds?: number
	releaseSeconds?: number
	onProgress?: (done: number, total: number) => void
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

/** Inspect only the held sound, before note-off. Loop endpoints are rising crossings. */
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
	const starts: number[] = []
	const ends: number[] = []
	for (let i = Math.floor(samples.length * 0.35); i < samples.length * 0.95; i++) {
		if (samples[i - 1] <= 0 && samples[i] > 0) {
			if (i < samples.length * 0.55) {
				starts.push(i)
			} else if (i > samples.length * 0.7) {
				ends.push(i)
			}
		}
	}
	let best: { loopStart: number; loopLength: number } | undefined
	let bestMismatch = Infinity
	const window = Math.max(1, Math.min(32, Math.floor(period / 8)))
	for (const start of starts) {
		for (const end of ends) {
			const length = end - start
			const periods = Math.round(length / period)
			// Integer sample positions can differ from an exact whole period by one frame.
			if (periods < 2 || Math.abs(length - periods * period) > 1) {
				continue
			}
			let mismatch = 0
			for (let i = -window; i <= window; i++) {
				mismatch += (samples[start + i] - samples[end + i]) ** 2
			}
			mismatch = Math.sqrt(mismatch / (window * 2 + 1))
			if (mismatch < late * 0.1 && mismatch < bestMismatch) {
				bestMismatch = mismatch
				best = { loopStart: start, loopLength: length }
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
	note: SequenceNote
): Promise<TrackerSample> {
	const { audioContext: context, signal } = options
	const hold = seconds(options.holdSeconds, 0.8)
	const release = Math.min(seconds(options.releaseSeconds, 0.6), MAX_SECONDS - hold)
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
		const loop = findSustainLoop(
			data.subarray(0, Math.max(0, heldFrames - leading)),
			context.sampleRate,
			note.number
		)
		const suffix = ` ${note.patch}`
		const name =
			outputs[0].name
				.normalize("NFKD")
				.replace(/[^\x20-\x7e]/g, "")
				.slice(0, 22 - suffix.length) + suffix
		return {
			name,
			data: normalisePeak(data),
			sampleRate: context.sampleRate,
			baseNote: note.number,
			...loop
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
): Promise<Map<string, TrackerSample>> {
	const { audioContext: context, signal } = options
	checkAbort(signal)
	const groups = groupTrackerNotes(options.notes)
	const samples = new Map<string, TrackerSample>()
	if (!groups.size) {
		return samples
	}
	const restore = options.mute?.()
	try {
		let ready: Promise<void> | undefined
		let done = 0
		for (const [key, notes] of groups) {
			checkAbort(signal)
			try {
				const note = representativeTrackerNote(notes)
				const outputs =
					options.getChain(note.chainId!)?.outputs.filter((output) => {
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
					throw new Error("No connected audio output is available for this instrument")
				}
				await abortable((ready ??= prepareCapture(context)), signal)
				checkAbort(signal)
				samples.set(key, await captureInstrument(options, outputs, note))
			} catch (error) {
				checkAbort(signal)
				console.warn("Tracker sample omitted", key, error)
			}
			options.onProgress?.(++done, groups.size)
		}
		checkAbort(signal)
		return samples
	} finally {
		restore?.()
	}
}