// Kept free of imports so the worklet loads as-is under any bundler.
// These names mirror RECORDING_PROCESSOR, RECORDING_START, RECORDING_STOP and RECORDING_DATA in recording-format.ts
const RECORDING_PROCESSOR = "harmoneasy-recorder"
const RECORDING_START = "start"
const RECORDING_STOP = "stop"
const RECORDING_DATA = "data"

class RecordingProcessor extends AudioWorkletProcessor {
	constructor() {
		super()
		this.recording = false
		this.samples = new Float32Array(8192)
		this.offset = 0
		this.port.onmessage = ({ data }) => {
			if (data === RECORDING_START) {
				this.recording = true
			}
			if (data === RECORDING_STOP) {
				this.recording = false
				this.flush()
				this.port.postMessage({ type: RECORDING_STOP })
			}
		}
	}

	flush() {
		if (!this.offset) {
			return
		}
		const samples = this.samples.slice(0, this.offset)
		this.port.postMessage({ type: RECORDING_DATA, samples }, [samples.buffer])
		this.offset = 0
	}

	process(inputs) {
		if (!this.recording) {
			return true
		}
		const channels = inputs[0]
		const length = channels?.[0]?.length ?? 128
		for (let i = 0; i < length; i++) {
			this.samples[this.offset++] = channels?.[0]?.[i] ?? 0
			this.samples[this.offset++] = (channels?.[1] ?? channels?.[0])?.[i] ?? 0
			if (this.offset === this.samples.length) {
				this.flush()
			}
		}
		return true
	}
}
registerProcessor(RECORDING_PROCESSOR, RecordingProcessor)