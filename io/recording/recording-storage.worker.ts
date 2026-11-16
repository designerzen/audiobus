import {
	RECORDING_OPEN,
	RECORDING_DATA,
	RECORDING_STOP,
	RECORDING_EXPORT,
	RECORDING_RECOVER,
	RECORDING_FLUSH,
	encodeSamples,
	waveHeader,
	type RecordingBits
} from "./recording-format"

// The raw file contains a sample-rate header followed by interleaved float32 stereo.
// A sync handle permits periodic durable checkpoints without rewriting the take.
let root: FileSystemDirectoryHandle
let handle: any
let rate = 48000
let size = 4
let checkpoint = 4
let failed = false

async function open() {
	root = await navigator.storage.getDirectory()
	const file = await root.getFileHandle("harmoneasy-audio-take.raw", { create: true })
	if (!handle) {
		handle = await (file as any).createSyncAccessHandle()
	}
}

function write(bytes: Uint8Array, offset: number) {
	let written = 0
	while (written < bytes.byteLength) {
		const count = handle.write(bytes.subarray(written), { at: offset + written })
		if (!count) {
			throw new Error("Recording storage could not write more audio.")
		}
		written += count
	}
}

async function exportWave(bits: RecordingBits): Promise<File> {
	handle.flush()
	// Reuse one preview/export file per format; never assemble a take in RAM.
	const file = await root.getFileHandle(`harmoneasy-audio-take-${bits}.wav`, { create: true })
	const output = await file.createWritable()
	try {
		await output.write(waveHeader((((size - 4) / 4) * bits) / 8, rate, bits))
		const buffer = new Uint8Array(256 * 1024)
		for (let offset = 4; offset < size; ) {
			const length = Math.min(buffer.length, size - offset)
			const count = handle.read(buffer.subarray(0, length), { at: offset })
			if (count !== length) {
				throw new Error("Could not read the complete recording.")
			}
			await output.write(encodeSamples(new Float32Array(buffer.buffer, 0, length / 4), bits))
			offset += length
		}
		await output.close()
		return file.getFile()
	} catch (error) {
		await output.abort().catch(() => {})
		throw error
	}
}

// Serialize writes and commands, including finalization after the last sample batch.
let queue = Promise.resolve()
self.onmessage = ({ data }) => {
	queue = queue.then(async () => {
		try {
			let result: unknown
			switch (data.type) {
				case RECORDING_RECOVER: {
					await open()
					size = handle.getSize()
					if (size < 12) {
						result = null
						break
					}
					const header = new Uint32Array(1)
					handle.read(header, { at: 0 })
					rate = header[0]
					if (rate < 8000 || rate > 384000) {
						throw new Error("Invalid recording sample rate.")
					}
					size = 4 + Math.floor((size - 4) / 8) * 8
					result = { sampleRate: rate, frames: (size - 4) / 8 }
					break
				}
				case RECORDING_OPEN:
					await open()
					failed = false
					rate = data.sampleRate
					handle.truncate(0)
					size = checkpoint = 4
					write(new Uint8Array(new Uint32Array([rate]).buffer), 0)
					handle.flush()
					for (const bits of [16, 32]) {
						await root.removeEntry(`harmoneasy-audio-take-${bits}.wav`).catch(() => {})
					}
					break
				case RECORDING_DATA:
					if (failed) {
						break
					}
					write(new Uint8Array(data.samples.buffer), size)
					size += data.samples.byteLength
					if (size - checkpoint >= rate * 8 * 2) {
						handle.flush()
						checkpoint = size
					}
					break
				case RECORDING_STOP:
				case RECORDING_FLUSH:
					handle.flush()
					result = { sampleRate: rate, frames: (size - 4) / 8 }
					break
				case RECORDING_EXPORT:
					result = await exportWave(data.bits)
					break
			}
			self.postMessage({ id: data.id, result })
		} catch (error) {
			if (data.type === RECORDING_DATA) {
				failed = true
			}
			self.postMessage({
				id: data.id,
				error: error instanceof Error ? error.message : String(error)
			})
		}
	})
}