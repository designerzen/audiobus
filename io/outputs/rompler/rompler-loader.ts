export interface RomplerSample {
	note: number
	// 16-bit PCM halves memory and transfers to the worklet without copying
	channels: Int16Array[]
}

export interface RomplerProgress {
	loaded: number
	failed: number
	total: number
}

const MAX_SECONDS = 8
const FADE_SECONDS = 0.05

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

	load(grid: number[], url: (note: number) => string): void {
		this.cancel()
		this.url = url
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
				sample = { note, channels: toPCM(audio) }
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

/** Trim, fade and quantise; identical stereo channels collapse to mono */
const toPCM = (audio: AudioBuffer): Int16Array[] => {
	const length = Math.min(audio.length, Math.round(MAX_SECONDS * audio.sampleRate))
	const fade = length < audio.length ? Math.round(FADE_SECONDS * audio.sampleRate) : 0
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
	return sources.map((source) => {
		const pcm = new Int16Array(length)
		for (let i = 0; i < length; i++) {
			const gain = i < length - fade ? 1 : (length - i) / fade
			pcm[i] = Math.max(-1, Math.min(1, source[i] * gain)) * 32767
		}
		return pcm
	})
}