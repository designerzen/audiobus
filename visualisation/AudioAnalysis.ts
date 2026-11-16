/** Silent audio analysis shared by renderers and UI adapters; owns only its source taps. */
export class AudioAnalysis {
	readonly analyser: AnalyserNode
	private sources = new Set<AudioNode>()
	private frequency = new Uint8Array(0)
	private waveform = new Uint8Array(0)
	constructor(context: BaseAudioContext, fftSize = 1024, smoothing = 0.85) {
		this.analyser = context.createAnalyser()
		this.analyser.smoothingTimeConstant = smoothing
		this.setFidelity(fftSize)
	}
	setFidelity(fftSize: number) {
		this.analyser.fftSize = fftSize
		this.frequency = new Uint8Array(this.analyser.frequencyBinCount)
		this.waveform = new Uint8Array(this.analyser.fftSize)
	}
	observe(source: AudioNode) {
		if (!this.sources.has(source)) {
			source.connect(this.analyser)
			this.sources.add(source)
		}
	}
	read(domain: "frequency" | "time", target?: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
		const data = target ?? (domain === "time" ? this.waveform : this.frequency)
		if (domain === "time") {
			this.analyser.getByteTimeDomainData(data)
		} else {
			this.analyser.getByteFrequencyData(data)
		}
		return data
	}
	dispose() {
		for (const source of this.sources) {
			try {
				source.disconnect(this.analyser)
			} catch {
				/* Already disconnected by its owner. */
			}
		}
		this.sources.clear()
		this.analyser.disconnect()
	}
}