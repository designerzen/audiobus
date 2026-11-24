/** Shared media support, loaded only when a native decoder cannot read a sample or on export. */
export const AUDIO_MEDIA_ACCEPT =
	"audio/*,video/mp4,video/webm,video/quicktime,.mkv,.m4a,.ogg,.flac,.aif,.aiff"
const MAX_DECODED_BYTES = 128 * 1024 * 1024

export async function decodeAudioMedia(
	context: BaseAudioContext,
	bytes: ArrayBuffer
): Promise<AudioBuffer> {
	let nativeError: unknown
	try {
		return await context.decodeAudioData(bytes.slice(0))
	} catch (error) {
		nativeError = error
		// The native decoder supports formats such as AIFF that vary between browsers.
		// Mediabunny additionally demuxes audio from video containers.
	}
	const { Input, BufferSource, ALL_FORMATS, AudioBufferSink } = await import("mediabunny")
	const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS })
	try {
		if (!(await input.canRead())) {
			throw nativeError
		}
		const track = await input.getPrimaryAudioTrack()
		if (!track) {
			throw new Error("This file has no audio track.")
		}
		if (!(await track.canDecode())) {
			throw new Error("This browser cannot decode the file’s audio codec.")
		}
		const chunks: { buffer: AudioBuffer; offset: number }[] = []
		let firstTimestamp: number | undefined
		let frames = 0
		let sampleRate = 0
		let channels = 0
		let allocated = 0
		for await (const { buffer, timestamp } of new AudioBufferSink(track).buffers()) {
			firstTimestamp ??= timestamp
			sampleRate ||= buffer.sampleRate
			channels ||= buffer.numberOfChannels
			if (sampleRate !== buffer.sampleRate || channels !== buffer.numberOfChannels) {
				throw new Error("Samples with changing audio formats are not supported.")
			}
			const offset = Math.max(0, Math.round((timestamp - firstTimestamp) * sampleRate))
			frames = Math.max(frames, offset + buffer.length)
			allocated += buffer.length * channels * 4
			if (frames * channels * 4 + allocated > MAX_DECODED_BYTES) {
				throw new Error("Decoded sample is too large. Choose a shorter audio clip.")
			}
			chunks.push({ buffer, offset })
		}
		if (!frames) {
			throw new Error("The audio track is empty.")
		}
		const result = context.createBuffer(channels, frames, sampleRate)
		for (const { buffer, offset } of chunks) {
			for (let channel = 0; channel < channels; channel++) {
				result.copyToChannel(buffer.getChannelData(channel), channel, offset)
			}
		}
		return result
	} finally {
		input.dispose()
	}
}

export const AUDIO_EXPORT_FORMATS = [
	{ id: "16", label: "WAV · 16-bit PCM (smaller)", extension: "wav", mime: "audio/wav" },
	{
		id: "32",
		label: "WAV · 32-bit float (original quality)",
		extension: "wav",
		mime: "audio/wav"
	},
	{ id: "webm", label: "WebM · Opus (compressed)", extension: "webm", mime: "audio/webm" },
	{ id: "ogg", label: "Ogg · Opus (compressed)", extension: "ogg", mime: "audio/ogg" },
	{ id: "m4a", label: "M4A · AAC (compressed)", extension: "m4a", mime: "audio/mp4" }
] as const
export type AudioExportFormat = (typeof AUDIO_EXPORT_FORMATS)[number]["id"]

export async function canExportAudio(
	format: AudioExportFormat,
	sampleRate: number
): Promise<boolean> {
	if (format === "16" || format === "32") {
		return true
	}
	try {
		const { canEncodeAudio } = await import("mediabunny")
		return await canEncodeAudio(format === "m4a" ? "aac" : "opus", {
			numberOfChannels: 2,
			sampleRate: format === "m4a" ? sampleRate : 48000
		})
	} catch {
		return false
	}
}

/** Checks each compressed format without making the always-available WAV choices wait. */
export function populateAudioExportFormats(select: HTMLSelectElement, sampleRate: number): void {
	for (const format of AUDIO_EXPORT_FORMATS) {
		let option = Array.from(select.options).find((entry) => entry.value === format.id)
		if (!option) {
			option = select.ownerDocument.createElement("option")
			option.value = format.id
			option.textContent = format.label
			select.append(option)
		}
		if (format.id === "16" || format.id === "32") {
			continue
		}
		option.disabled = true
		const entry = option
		void canExportAudio(format.id, sampleRate).then((supported) => {
			entry.disabled = !supported
			entry.textContent = format.label + (supported ? "" : " — unavailable in this browser")
		})
	}
}

export async function convertAudioMedia(
	blob: Blob,
	format: Exclude<AudioExportFormat, "16" | "32">,
	onProgress?: (progress: number) => void,
	destination?: FileSystemWritableFileStream
): Promise<Blob | undefined> {
	const {
		Input,
		BlobSource,
		ALL_FORMATS,
		Output,
		BufferTarget,
		StreamTarget,
		Conversion,
		WebMOutputFormat,
		OggOutputFormat,
		Mp4OutputFormat,
		Quality
	} = await import("mediabunny")
	const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
	const target = destination
		? new StreamTarget(new WritableStream({ write: (chunk) => destination.write(chunk) }))
		: new BufferTarget()
	const output = new Output({
		format:
			format === "webm"
				? new WebMOutputFormat()
				: format === "ogg"
					? new OggOutputFormat()
					: new Mp4OutputFormat(),
		target
	})
	try {
		const conversion = await Conversion.init({
			input,
			output,
			video: { discard: true },
			audio: {
				codec: format === "m4a" ? "aac" : "opus",
				quality: new Quality({ bitrate: 192000 }),
				...(format === "m4a" ? {} : { sampleRate: 48000 })
			}
		})
		if (!conversion.isValid) {
			throw new Error(
				"This browser cannot encode the selected audio format. Choose WAV instead."
			)
		}
		conversion.onProgress = onProgress
		await conversion.execute()
		if (destination) {
			await destination.close()
			return
		}
		if (!(target instanceof BufferTarget) || !target.buffer) {
			throw new Error("Audio export produced no data.")
		}
		return new Blob([target.buffer], {
			type: AUDIO_EXPORT_FORMATS.find((entry) => entry.id === format)!.mime
		})
	} catch (error) {
		await output.cancel().catch(() => {})
		await destination?.abort().catch(() => {})
		throw error
	} finally {
		input.dispose()
	}
}