/**
 * Self-contained soundfont files: SoundFont 2 (.sf2), its Ogg Vorbis
 * compressed form (.sf3), and MIDI.js packs (.js or .json of base64 notes).
 * Parsing reads only the headers; sample data stays in the file buffer until
 * a preset asks for it, so opening even a large bank is near instant.
 */

/** One playable zone: a wave played across a key and velocity range */
export interface SoundFontRegion {
	wave: number
	low: number
	high: number
	velocityLow: number
	velocityHigh: number
	// Key at which the wave plays unshifted; tuning is folded in as a fraction
	root: number
	// Semitones moved per key; 1 for normal keyboard tracking
	scale: number
	gain: number
	// -1 left to 1 right
	pan: number
	// In frames of the wave at its native rate, relative to its first frame
	start: number
	// Frames trimmed from the end of the wave (zero or negative)
	endOffset: number
	loopStart: number
	loopEnd: number
	loop: boolean
	// Volume envelope: seconds to rise, hold and fall to the sustain level (0 to 1)
	attack: number
	hold: number
	decay: number
	sustain: number
	// Seconds, when the zone sets its own release
	release?: number
}

export interface SoundFontWave {
	name: string
	// Byte range of the wave within the file
	begin: number
	end: number
	sampleRate: number
	compressed: boolean
}

export interface SoundFontPreset {
	name: string
	bank: number
	program: number
	regions: SoundFontRegion[]
}

export interface SoundFontBank {
	name: string
	presets: SoundFontPreset[]
	waves: SoundFontWave[]
	buffer: ArrayBuffer
}

// Generator numbers from the SoundFont 2.04 specification
const START_OFFSET = 0
const END_OFFSET = 1
const LOOP_START_OFFSET = 2
const LOOP_END_OFFSET = 3
const START_COARSE = 4
const END_COARSE = 12
const PAN = 17
const ATTACK = 34
const HOLD = 35
const DECAY = 36
const SUSTAIN = 37
const RELEASE = 38
const INSTRUMENT = 41
const KEY_RANGE = 43
const VELOCITY_RANGE = 44
const LOOP_START_COARSE = 45
const ATTENUATION = 48
const LOOP_END_COARSE = 50
const COARSE_TUNE = 51
const FINE_TUNE = 52
const SAMPLE_ID = 53
const SAMPLE_MODES = 54
const SCALE_TUNING = 56
const ROOT_KEY = 58
// Preset values add to the instrument's rather than replacing them
const ADDITIVE = new Set([
	START_OFFSET,
	END_OFFSET,
	LOOP_START_OFFSET,
	LOOP_END_OFFSET,
	START_COARSE,
	END_COARSE,
	LOOP_START_COARSE,
	LOOP_END_COARSE,
	PAN,
	ATTACK,
	HOLD,
	DECAY,
	SUSTAIN,
	RELEASE,
	ATTENUATION,
	COARSE_TUNE,
	FINE_TUNE,
	SCALE_TUNING
])
const COMPRESSED = 0x10
const ROM = 0x8000

type Generators = Map<number, number>

interface Chunk {
	id: string
	offset: number
	size: number
}

const text = (view: DataView, offset: number, length: number): string => {
	let value = ""
	for (let i = 0; i < length; i++) {
		const code = view.getUint8(offset + i)
		if (!code) {
			break
		}
		value += String.fromCharCode(code)
	}
	return value.trim()
}

const chunks = (view: DataView, offset: number, end: number): Chunk[] => {
	const list: Chunk[] = []
	while (offset + 8 <= end) {
		const id = text(view, offset, 4)
		const size = view.getUint32(offset + 4, true)
		const kind = id === "LIST" ? text(view, offset + 8, 4) : id
		list.push(
			id === "LIST"
				? { id: kind, offset: offset + 12, size: size - 4 }
				: { id, offset: offset + 8, size }
		)
		// Chunks are padded to an even length
		offset += 8 + size + (size & 1)
	}
	return list
}

export const isSoundFont = (buffer: ArrayBuffer): boolean => {
	if (buffer.byteLength < 12) {
		return false
	}
	const view = new DataView(buffer)
	return text(view, 0, 4) === "RIFF" && text(view, 8, 4) === "sfbk"
}

export function parseSoundFont(buffer: ArrayBuffer): SoundFontBank {
	if (!isSoundFont(buffer)) {
		throw Error("Not a SoundFont file")
	}
	const view = new DataView(buffer)
	const top = chunks(view, 12, Math.min(buffer.byteLength, 8 + view.getUint32(4, true)))
	const find = (id: string) => top.find((chunk) => chunk.id === id)
	const info = find("INFO"),
		sdta = find("sdta"),
		pdta = find("pdta")
	if (!sdta || !pdta) {
		throw Error("SoundFont is missing its sample or preset data")
	}
	const smpl = chunks(view, sdta.offset, sdta.offset + sdta.size).find(({ id }) => id === "smpl")
	const hydra = new Map(
		chunks(view, pdta.offset, pdta.offset + pdta.size).map((chunk) => [chunk.id, chunk])
	)
	const records = <T>(id: string, length: number, read: (offset: number) => T): T[] => {
		const chunk = hydra.get(id)
		if (!chunk) {
			throw Error(`SoundFont is missing its ${id} chunk`)
		}
		return Array.from({ length: Math.floor(chunk.size / length) }, (_, i) =>
			read(chunk.offset + i * length)
		)
	}
	const name =
		(info &&
			chunks(view, info.offset, info.offset + info.size)
				.filter(({ id }) => id === "INAM")
				.map((chunk) => text(view, chunk.offset, chunk.size))[0]) ||
		"SoundFont"

	const presetHeaders = records("phdr", 38, (o) => ({
		name: text(view, o, 20),
		program: view.getUint16(o + 20, true),
		bank: view.getUint16(o + 22, true),
		zone: view.getUint16(o + 24, true)
	}))
	const bags = (id: string) => records(id, 4, (o) => view.getUint16(o, true))
	const generators = (id: string) =>
		records(id, 4, (o) => ({
			type: view.getUint16(o, true),
			value: view.getInt16(o + 2, true),
			low: view.getUint8(o + 2),
			high: view.getUint8(o + 3)
		}))
	const presetBags = bags("pbag"),
		presetGenerators = generators("pgen")
	const instrumentHeaders = records("inst", 22, (o) => ({
		name: text(view, o, 20),
		zone: view.getUint16(o + 20, true)
	}))
	const instrumentBags = bags("ibag"),
		instrumentGenerators = generators("igen")
	const sampleHeaders = records("shdr", 46, (o) => ({
		name: text(view, o, 20),
		start: view.getUint32(o + 20, true),
		end: view.getUint32(o + 24, true),
		loopStart: view.getUint32(o + 28, true),
		loopEnd: view.getUint32(o + 32, true),
		sampleRate: view.getUint32(o + 36, true),
		pitch: view.getUint8(o + 40),
		correction: view.getInt8(o + 41),
		type: view.getUint16(o + 44, true)
	}))

	// Zones as generator maps; ranges pack low and high into one value
	const zones = (
		bagIndex: number[],
		list: ReturnType<typeof generators>,
		first: number,
		last: number
	): Generators[] => {
		const result: Generators[] = []
		for (let bag = first; bag < last; bag++) {
			const zone: Generators = new Map()
			for (let g = bagIndex[bag]; g < bagIndex[bag + 1]; g++) {
				const { type, value, low, high } = list[g]
				zone.set(
					type,
					type === KEY_RANGE || type === VELOCITY_RANGE ? low | (high << 8) : value
				)
			}
			result.push(zone)
		}
		return result
	}
	// A first zone without its terminal generator holds defaults for the rest
	const split = (list: Generators[], terminal: number) =>
		list.length && !list[0].has(terminal)
			? { global: list[0], local: list.slice(1) }
			: { global: new Map() as Generators, local: list }

	const waves: SoundFontWave[] = []
	const waveIndex = new Map<number, number>()
	const smplOffset = smpl?.offset ?? 0
	const wave = (index: number): number | undefined => {
		const header = sampleHeaders[index]
		if (!header || header.type & ROM || !smpl) {
			return undefined
		}
		if (!waveIndex.has(index)) {
			const compressed = !!(header.type & COMPRESSED)
			// Compressed waves are addressed in bytes, raw ones in 16-bit frames
			const unit = compressed ? 1 : 2
			waveIndex.set(index, waves.length)
			waves.push({
				name: header.name,
				begin: smplOffset + header.start * unit,
				end: Math.min(smplOffset + smpl.size, smplOffset + header.end * unit),
				sampleRate: header.sampleRate || 44100,
				compressed
			})
		}
		return waveIndex.get(index)
	}

	const instruments = instrumentHeaders
		.slice(0, -1)
		.map((instrument, index) =>
			split(
				zones(
					instrumentBags,
					instrumentGenerators,
					instrument.zone,
					instrumentHeaders[index + 1].zone
				),
				SAMPLE_ID
			)
		)

	const presets = presetHeaders.slice(0, -1).map((header, index): SoundFontPreset => {
		const { global, local } = split(
			zones(presetBags, presetGenerators, header.zone, presetHeaders[index + 1].zone),
			INSTRUMENT
		)
		const regions: SoundFontRegion[] = []
		for (const presetZone of local) {
			const instrument = instruments[presetZone.get(INSTRUMENT)!]
			if (!instrument) {
				continue
			}
			const preset = new Map([...global, ...presetZone])
			for (const instrumentZone of instrument.local) {
				const zone = new Map([...instrument.global, ...instrumentZone])
				const sample = sampleHeaders[zone.get(SAMPLE_ID)!]
				const id = wave(zone.get(SAMPLE_ID)!)
				if (!sample || id === undefined) {
					continue
				}
				const value = (type: number, fallback = 0) =>
					(zone.get(type) ?? fallback) +
					(ADDITIVE.has(type) ? (preset.get(type) ?? 0) : 0)
				const range = (type: number) => {
					const own = zone.get(type) ?? 0x7f00,
						outer = preset.get(type) ?? 0x7f00
					return [Math.max(own & 0xff, outer & 0xff), Math.min(own >> 8, outer >> 8)]
				}
				const [low, high] = range(KEY_RANGE)
				const [velocityLow, velocityHigh] = range(VELOCITY_RANGE)
				if (low > high || velocityLow > velocityHigh) {
					continue
				}
				const compressed = waves[id].compressed
				// Loop points of compressed waves are already relative to their start
				const origin = compressed ? 0 : sample.start
				const root = zone.get(ROOT_KEY) ?? -1
				const seconds = (type: number) => 2 ** (value(type, -12000) / 1200)
				const releaseTimecents =
					zone.has(RELEASE) || preset.has(RELEASE) ? value(RELEASE, -12000) : undefined
				regions.push({
					wave: id,
					low,
					high,
					velocityLow,
					velocityHigh,
					root:
						(root >= 0 && root <= 127
							? root
							: sample.pitch <= 127
								? sample.pitch
								: 60) -
						value(COARSE_TUNE) -
						(value(FINE_TUNE) + sample.correction) / 100,
					scale: value(SCALE_TUNING, 100) / 100,
					// Scaled by 0.4 as FluidSynth and the E-mu hardware do, which most banks are voiced for
					gain: 10 ** ((-Math.max(0, value(ATTENUATION)) * 0.4) / 200),
					pan: Math.max(-1, Math.min(1, value(PAN) / 500)),
					start: value(START_OFFSET) + value(START_COARSE) * 32768,
					endOffset: Math.min(0, value(END_OFFSET) + value(END_COARSE) * 32768),
					loopStart:
						sample.loopStart -
						origin +
						value(LOOP_START_OFFSET) +
						value(LOOP_START_COARSE) * 32768,
					loopEnd:
						sample.loopEnd -
						origin +
						value(LOOP_END_OFFSET) +
						value(LOOP_END_COARSE) * 32768,
					// Mode 3 loops until release then plays on; looping throughout is close enough
					loop: (value(SAMPLE_MODES) & 1) === 1,
					attack: seconds(ATTACK),
					hold: seconds(HOLD),
					decay: seconds(DECAY),
					// Sustain is an attenuation in centibels below the peak
					sustain: 10 ** (-Math.max(0, value(SUSTAIN)) / 200),
					release:
						releaseTimecents === undefined ? undefined : 2 ** (releaseTimecents / 1200)
				})
			}
		}
		return { name: header.name, bank: header.bank, program: header.program, regions }
	})
	presets.sort((a, b) => a.bank - b.bank || a.program - b.program)
	return { name, presets, waves, buffer }
}

/**
 * 16-bit PCM for one wave at its native rate. Raw waves are copied straight
 * out of the file; compressed ones go through the browser's decoder, which
 * resamples to the context rate, so the rate it reports is the decoded one.
 */
export async function waveData(
	bank: SoundFontBank,
	index: number,
	context: BaseAudioContext
): Promise<{ data: Int16Array; sampleRate: number; scale: number }> {
	const wave = bank.waves[index]
	if (!wave.compressed) {
		// Copied out so it can be transferred to the worklet without detaching the file
		const data = new Int16Array(
			bank.buffer.slice(wave.begin, wave.end - ((wave.end - wave.begin) & 1))
		)
		return { data, sampleRate: wave.sampleRate, scale: 1 }
	}
	const audio = await context.decodeAudioData(bank.buffer.slice(wave.begin, wave.end))
	const source = audio.getChannelData(0)
	const data = new Int16Array(source.length)
	for (let i = 0; i < source.length; i++) {
		data[i] = Math.max(-1, Math.min(1, source[i])) * 32767
	}
	return { data, sampleRate: audio.sampleRate, scale: audio.sampleRate / wave.sampleRate }
}

/** Finds the bank's preset for a program, preferring the melodic bank */
export const findPreset = (bank: SoundFontBank, program: number, bankNumber = 0): number => {
	const exact = bank.presets.findIndex(
		(preset) => preset.program === program && preset.bank === bankNumber
	)
	if (exact >= 0) {
		return exact
	}
	const any = bank.presets.findIndex((preset) => preset.program === program)
	return any >= 0 ? any : 0
}

const NOTE_OFFSETS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "Bb3", "A#3" or "C-1" to a MIDI note, or undefined */
export const parseNoteName = (name: string): number | undefined => {
	const match = /^([A-G])(#|b)?(-?\d)$/.exec(name)
	if (!match) {
		return undefined
	}
	const note =
		NOTE_OFFSETS[match[1]] +
		(match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0) +
		(Number(match[3]) + 1) * 12
	return note >= 0 && note <= 127 ? note : undefined
}

/**
 * A MIDI.js pack: one script or JSON object of note names to base64 data
 * URLs. Returns each note's encoded audio, decoded only when asked for.
 */
export function parseMidiJsPack(source: string): Map<number, string> {
	const start = source.indexOf("{"),
		end = source.lastIndexOf("}")
	if (start < 0 || end < start) {
		throw Error("Not a MIDI.js soundfont")
	}
	// Packs are object literals with quoted keys, sometimes with a trailing comma
	const notes = JSON.parse(source.slice(start, end + 1).replace(/,\s*}$/, "}")) as Record<
		string,
		unknown
	>
	const pack = new Map<number, string>()
	for (const [name, value] of Object.entries(notes)) {
		const note = parseNoteName(name)
		if (note !== undefined && typeof value === "string" && value.startsWith("data:")) {
			pack.set(note, value)
		}
	}
	if (!pack.size) {
		throw Error("MIDI.js soundfont has no notes")
	}
	return pack
}

export const decodeDataUrl = (url: string): ArrayBuffer => {
	const binary = atob(url.slice(url.indexOf(",") + 1))
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes.buffer
}