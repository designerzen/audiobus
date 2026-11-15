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

/**
 * Fetches and decodes one sample per grid key, nearest-to-demand first.
 * Notes that are played jump the queue and the starting point drifts
 * towards the most played register, so useful keys arrive first.
 * Calling load() again or cancel() aborts every in-flight request.
 */
export class RomplerLoader {
	private pending = new Set<number>()
	private urgent = new Set<number>()
	private active = 0
	private centre = 60
	private generation = 0
	private controller?: AbortController
	private url: (note: number) => string = () => ""
	private loop = false
	private progress: RomplerProgress = { loaded: 0, failed: 0, total: 0 }

	constructor(
		private readonly context: BaseAudioContext,
		private readonly onSample: (sample: RomplerSample) => void,
		private readonly onProgress: (progress: RomplerProgress) => void = () => {},
		private readonly concurrency = 6
	) {}

	get complete(): boolean {
		return !this.pending.size && !this.active
	}

	load(grid: number[], url: (note: number) => string, loop = false): void {
		this.cancel()
		this.url = url
		this.loop = loop
		this.pending = new Set(grid)
		this.progress = { loaded: 0, failed: 0, total: grid.length }
		this.onProgress({ ...this.progress })
		this.pump()
	}

	/** Prioritise a key the player needs right now, including before load() */
	request(note: number): void {
		this.centre = this.progress.loaded ? this.centre + (note - this.centre) * 0.25 : note
		this.urgent.add(note)
		if (this.pending.has(note)) {
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
		for (const note of this.urgent) {
			this.urgent.delete(note)
			if (this.pending.has(note)) {
				return note
			}
		}
		let best: number | undefined
		for (const note of this.pending) {
			if (best === undefined || Math.abs(note - this.centre) < Math.abs(best - this.centre)) {
				best = note
			}
		}
		return best
	}

	private pump(): void {
		while (this.active < this.concurrency) {
			const note = this.next()
			if (note === undefined) {
				return
			}
			this.pending.delete(note)
			this.active++
			void this.fetch(note, this.generation, this.controller!.signal)
		}
	}

	private async fetch(note: number, generation: number, signal: AbortSignal): Promise<void> {
		let sample: RomplerSample | undefined
		try {
			const response = await fetch(this.url(note), { signal })
			if (!response.ok) {
				throw Error(`HTTP ${response.status}`)
			}
			const audio = await this.context.decodeAudioData(await response.arrayBuffer())
			if (generation === this.generation) {
				sample = { note, ...toPCM(audio, this.loop) }
			}
		} catch {
			if (generation === this.generation) {
				this.progress.failed++
			}
		}
		if (generation !== this.generation) {
			return
		}
		this.active--
		if (sample) {
			this.progress.loaded++
			this.onSample(sample)
		}
		this.onProgress({ ...this.progress })
		this.pump()
	}
}

/**
 * Trim, fade and quantise; identical stereo channels collapse to mono.
 * Looped samples end at the loop with an equal-power crossfade baked in,
 * so the worklet only has to jump back while the note sounds.
 */
const toPCM = (audio: AudioBuffer, loop: boolean): Omit<RomplerSample, "note"> => {
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