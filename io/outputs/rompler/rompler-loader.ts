export interface RomplerSample {
	note: number
	// 16-bit PCM halves memory and transfers to the worklet without copying
	channels: Int16Array[]
	// Frames the voice jumps between while it sounds; absent for one-shot samples
	loopStart?: number
	loopEnd?: number
}

export interface RomplerProgress {
	loaded: number
	failed: number
	total: number
}

const MAX_SECONDS = 8
const FADE_SECONDS = 0.05
// Ends one-shot samples in silence so voices never click off
const END_FADE_SECONDS = 0.01
// Loops skip the attack and the MP3 padding at the end of the file
const LOOP_START_SECONDS = 1
const LOOP_TAIL_SECONDS = 0.25
const CROSSFADE_SECONDS = 0.08
const SEARCH_SECONDS = 0.01
const MATCH_FRAMES = 64

/** A unit of loading, placed on the keyboard so the nearest to demand go first */
export interface RomplerJob {
	id: number
	key: number
}

export type RomplerTask<T> = (id: number, signal: AbortSignal) => Promise<T>

/**
 * Runs one task per job, nearest-to-demand first: streamed notes, waves
 * from a soundfont file or notes from a MIDI.js pack. Jobs that are played
 * jump the queue and the starting point drifts towards the most played
 * register, so useful sounds arrive first. Calling load() again or cancel()
 * aborts every task in flight and drops their results.
 */
export class RomplerLoader<T> {
	private pending = new Map<number, number>()
	private urgent = new Set<number>()
	private active = 0
	private centre = 60
	private generation = 0
	private controller?: AbortController
	private task: RomplerTask<T> = () => Promise.reject()
	private progress: RomplerProgress = { loaded: 0, failed: 0, total: 0 }

	constructor(
		private readonly onResult: (id: number, result: T) => void,
		private readonly onProgress: (progress: RomplerProgress) => void = () => {},
		private readonly concurrency = 6
	) {}

	get complete(): boolean {
		return !this.pending.size && !this.active
	}

	load(jobs: RomplerJob[], task: RomplerTask<T>): void {
		this.cancel()
		this.task = task
		this.pending = new Map(jobs.map(({ id, key }) => [id, key]))
		this.progress = { loaded: 0, failed: 0, total: jobs.length }
		this.onProgress({ ...this.progress })
		this.pump()
	}

	/** Prioritise jobs the player needs right now for a key, including before load() */
	request(key: number, ids: Iterable<number>): void {
		this.centre = this.progress.loaded ? this.centre + (key - this.centre) * 0.25 : key
		let waiting = false
		for (const id of ids) {
			this.urgent.add(id)
			waiting ||= this.pending.has(id)
		}
		if (waiting) {
			this.pump()
		}
	}

	cancel(): void {
		this.generation++
		this.controller?.abort()
		this.controller = new AbortController()
		this.pending.clear()
		this.active = 0
	}

	private next(): number | undefined {
		for (const id of this.urgent) {
			this.urgent.delete(id)
			if (this.pending.has(id)) {
				return id
			}
		}
		let best: number | undefined
		let distance = Infinity
		for (const [id, key] of this.pending) {
			if (Math.abs(key - this.centre) < distance) {
				distance = Math.abs(key - this.centre)
				best = id
			}
		}
		return best
	}

	private pump(): void {
		while (this.active < this.concurrency) {
			const id = this.next()
			if (id === undefined) {
				return
			}
			this.pending.delete(id)
			this.active++
			void this.run(id, this.generation, this.controller!.signal)
		}
	}

	private async run(id: number, generation: number, signal: AbortSignal): Promise<void> {
		let result: T | undefined
		let ok = false
		try {
			result = await this.task(id, signal)
			ok = true
		} catch {
			if (generation === this.generation) {
				this.progress.failed++
			}
		}
		if (generation !== this.generation) {
			return
		}
		this.active--
		if (ok) {
			this.progress.loaded++
			this.onResult(id, result!)
		}
		this.onProgress({ ...this.progress })
		this.pump()
	}
}

/** Fetches and decodes one streamed note, ready for the worklet */
export const streamTask =
	(
		context: BaseAudioContext,
		url: (note: number) => string,
		loop: boolean
	): RomplerTask<RomplerSample> =>
	async (note, signal) => {
		const response = await fetch(url(note), { signal })
		if (!response.ok) {
			throw Error(`HTTP ${response.status}`)
		}
		const audio = await context.decodeAudioData(await response.arrayBuffer())
		signal.throwIfAborted()
		return { note, ...toPCM(audio, loop) }
	}

/**
 * Trim, fade and quantise; identical stereo channels collapse to mono.
 * Looped samples end at the loop with an equal-power crossfade baked in,
 * so the worklet only has to jump back while the note sounds.
 */
export const toPCM = (audio: AudioBuffer, loop: boolean): Omit<RomplerSample, "note"> => {
	const rate = audio.sampleRate
	const length = Math.min(audio.length, Math.round(MAX_SECONDS * rate))
	const sources = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, ch) =>
		audio.getChannelData(ch)
	)
	if (sources.length === 2) {
		const [left, right] = sources
		let same = true
		for (let i = 0; i < length && same; i++) {
			same = left[i] === right[i]
		}
		if (same) {
			sources.pop()
		}
	}
	const points = loop ? findLoop(sources[0], length, rate) : undefined
	if (points) {
		const [loopStart, loopEnd] = points
		const crossfade = Math.min(Math.round(CROSSFADE_SECONDS * rate), loopStart)
		const blend = loopEnd - crossfade
		return {
			loopStart,
			loopEnd,
			channels: sources.map((source) =>
				quantise(loopEnd, (i) => {
					if (i < blend) {
						return source[i]
					}
					const angle = ((i - blend) / crossfade) * Math.PI * 0.5
					return (
						source[i] * Math.cos(angle) +
						source[i - blend + loopStart - crossfade] * Math.sin(angle)
					)
				})
			)
		}
	}
	const fade = Math.round((length < audio.length ? FADE_SECONDS : END_FADE_SECONDS) * rate)
	return {
		channels: sources.map((source) =>
			quantise(length, (i) => source[i] * Math.min(1, (length - i) / fade))
		)
	}
}

const quantise = (length: number, value: (frame: number) => number): Int16Array => {
	const pcm = new Int16Array(length)
	for (let i = 0; i < length; i++) {
		pcm[i] = Math.max(-1, Math.min(1, value(i))) * 32767
	}
	return pcm
}

/** Loop from just after the attack to the end point whose waveform best continues it */
const findLoop = (
	source: Float32Array,
	length: number,
	rate: number
): [number, number] | undefined => {
	const start = Math.round(LOOP_START_SECONDS * rate)
	const target = length - Math.round(LOOP_TAIL_SECONDS * rate)
	const search = Math.round(SEARCH_SECONDS * rate)
	if (target - search - start < Math.round(CROSSFADE_SECONDS * rate) * 2) {
		return undefined
	}
	let end = target
	let best = Infinity
	for (let candidate = target - search; candidate <= target + search; candidate++) {
		let error = 0
		for (let k = 0; k < MATCH_FRAMES; k++) {
			const difference = source[candidate + k] - source[start + k]
			error += difference * difference
		}
		if (error < best) {
			best = error
			end = candidate
		}
	}
	return [start, end]
}