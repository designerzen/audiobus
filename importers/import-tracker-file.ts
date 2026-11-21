import type { IAudioCommand } from "../commands/audio-command-interface"
import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"
import { MAX_MEDIA_BYTES } from "./dropped-media"

// Keep in sync with openmpt_get_supported_extensions() in the bundled WASM build.
export const TRACKER_EXTENSIONS = [
	"mod",
	"xm",
	"it",
	"s3m",
	"med",
	"669",
	"far",
	"stm",
	"ult",
	"mtm",
	"dmf",
	"ptm",
	"okt",
	"mptm",
	"nst",
	"amf",
	"ams",
	"dbm",
	"dsm",
	"mdl",
	"umx",
	"667",
	"c67",
	"cba",
	"digi",
	"dsym",
	"dtm",
	"etx",
	"fc",
	"fc13",
	"fc14",
	"fmt",
	"fst",
	"ftm",
	"imf",
	"ims",
	"ice",
	"j2b",
	"m15",
	"mms",
	"mt2",
	"mus",
	"plm",
	"psm",
	"pt36",
	"puma",
	"rtm",
	"sfx",
	"sfx2",
	"smod",
	"st26",
	"stk",
	"stx",
	"stp",
	"symmod",
	"tcb",
	"gmc",
	"gtk",
	"gt2",
	"unic",
	"wow",
	"xmf",
	"gdm",
	"mo3",
	"oxm",
	"xpk",
	"ppm",
	"mmcmp"
] as const

// Lazy-load the self-contained WASM build only when a tracker is imported.
let engine: ReturnType<typeof import("chiptune3/libopenmpt.worklet.js").default> | undefined
const getEngine = () =>
	(engine ??= import("chiptune3/libopenmpt.worklet.js")
		.then(({ default: create }) => create())
		.catch((error) => {
			engine = undefined
			throw error
		}))

/** Actual format coverage of the bundled decoder, useful when updating its build. */
export async function getSupportedTrackerExtensions(): Promise<string[]> {
	const m = await getEngine()
	const pointer = m._openmpt_get_supported_extensions()
	try {
		return m.UTF8ToString(pointer).split(";").filter(Boolean)
	} finally {
		m._openmpt_free_string(pointer)
	}
}

/** Extract row notes, instruments and explicit volumes. Embedded samples, envelopes,
 * pitch slides and other sound effects are not converted into MIDI commands.
 * libopenmpt advances the song, preserving order repeats, jumps and tempo/speed changes.
 */
export async function importTrackerFile(
	file: File
): Promise<{ commands: IAudioCommand[]; noteCount: number }> {
	if (!file.size || file.size > MAX_MEDIA_BYTES) {
		throw new Error("Tracker files must be nonempty and at most 64 MB")
	}
	const bytes = new Uint8Array(await file.arrayBuffer())
	const m = await getEngine()
	const data = m._malloc(bytes.length)
	let song = 0
	let output = 0
	try {
		m.HEAPU8.set(bytes, data)
		song = m._openmpt_module_create_from_memory(data, bytes.length, 0, 0, 0)
		if (!song) {
			throw new Error(`Invalid or unsupported tracker file: ${file.name}`)
		}
		m._openmpt_module_set_repeat_count(song, 0)
		const duration = m._openmpt_module_get_duration_seconds(song)
		if (!Number.isFinite(duration) || duration <= 0 || duration > 1800) {
			throw new Error("Tracker imports must have a finite duration of at most 30 minutes")
		}
		const channels = m._openmpt_module_get_num_channels(song)
		if (channels < 1 || channels > 192) {
			throw new Error("Tracker note imports support 1–192 tracks")
		}
		const commands: IAudioCommand[] = []
		const active = new Map<number, AudioCommand>()
		const instruments = Array.from({ length: channels }, () => 0)
		const volumes = Array.from({ length: channels }, () => 64)
		let noteCount = 0
		const stop = (channel: number, time: number) => {
			const on = active.get(channel)
			if (on) {
				on.endAt = time
				const off = Object.assign(new AudioCommand(), {
					type: NOTE_OFF,
					number: on.number,
					channel: on.channel,
					patch: on.patch,
					velocity: 0,
					startAt: time,
					from: on.from
				})
				commands.push(off)
				active.delete(channel)
			}
		}
		// Render into a tiny discarded buffer to let the engine execute tracker timing.
		// Eight frames at 8 kHz bound row timestamp error to one millisecond.
		output = m._malloc(8 * 4)
		let position = ""
		let frames = 0
		const maxFrames = Math.ceil(duration * 8000)
		while (frames < maxFrames) {
			const read = m._openmpt_module_read_float_mono(song, 8000, 8, output)
			if (!read) {
				break
			}
			const pattern = m._openmpt_module_get_current_pattern(song)
			const row = m._openmpt_module_get_current_row(song)
			const next = `${m._openmpt_module_get_current_order(song)}:${pattern}:${row}`
			if (next !== position && frames + read < maxFrames) {
				position = next
				const time = frames / 8000
				for (let channel = 0; channel < channels; channel++) {
					const cell = (index: number) =>
						m._openmpt_module_get_pattern_row_channel_command(
							song,
							pattern,
							row,
							channel,
							index
						)
					const note = cell(0)
					if (cell(1)) {
						instruments[channel] = cell(1) - 1
					}
					if (cell(2) === 1) {
						volumes[channel] = Math.min(64, cell(4))
					}
					if (note) {
						stop(channel, time)
						if (note <= 120) {
							const on = Object.assign(new AudioCommand(), {
								type: NOTE_ON,
								number: note - 1,
								channel: (channel % 16) + 1,
								patch: Math.min(127, instruments[channel]),
								velocity: Math.round((volumes[channel] * 127) / 64),
								startAt: time,
								from:
									channels > 16
										? `${file.name} / track ${channel + 1}`
										: file.name
							})
							commands.push(on)
							active.set(channel, on)
							noteCount++
							if (noteCount > 100000) {
								throw new Error("Tracker imports support at most 100,000 notes")
							}
						}
					}
				}
			}
			frames += read
			if (frames % 32768 === 0) {
				await new Promise((resolve) => setTimeout(resolve, 0))
			}
		}

		for (const channel of active.keys()) {
			stop(channel, Math.min(duration, frames / 8000))
		}
		if (!noteCount) {
			throw new Error("The tracker file contains no importable notes")
		}
		return { commands, noteCount }
	} finally {
		if (output) {
			m._free(output)
		}
		if (song) {
			m._openmpt_module_destroy(song)
		}
		m._free(data)
	}
}