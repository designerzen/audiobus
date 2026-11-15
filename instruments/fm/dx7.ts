// Yamaha DX7 VCED/VMEM layout: https://github.com/asb2m10/dexed/blob/master/Documentation/sysex-format.txt

export interface DX7Operator {
	rates: number[]
	levels: number[]
	breakpoint: number
	leftDepth: number
	rightDepth: number
	leftCurve: number
	rightCurve: number
	rateScaling: number
	ampSensitivity: number
	velocitySensitivity: number
	output: number
	fixed: boolean
	coarse: number
	fine: number
	detune: number
}

export interface DX7Voice {
	name: string
	operators: DX7Operator[]
	pitchRates: number[]
	pitchLevels: number[]
	algorithm: number
	feedback: number
	sync: boolean
	lfoSpeed: number
	lfoDelay: number
	pitchDepth: number
	ampDepth: number
	lfoSync: boolean
	lfoWave: number
	pitchSensitivity: number
	transpose: number
}

const bounded = (value: number, maximum = 99) => Math.min(maximum, value)

/** Expands one 128-byte bank voice into the 155-byte single voice layout. */
export const unpackDX7Voice = (packed: Uint8Array): Uint8Array => {
	const voice = new Uint8Array(155)
	for (let op = 0; op < 6; op++) {
		const p = op * 17,
			v = op * 21
		voice.set(packed.subarray(p, p + 11), v)
		voice.set(
			[
				packed[p + 11] & 3,
				(packed[p + 11] >> 2) & 3,
				packed[p + 12] & 7,
				packed[p + 13] & 3,
				(packed[p + 13] >> 2) & 7,
				packed[p + 14],
				packed[p + 15] & 1,
				(packed[p + 15] >> 1) & 31,
				packed[p + 16],
				(packed[p + 12] >> 3) & 15
			],
			v + 11
		)
	}
	voice.set(packed.subarray(102, 110), 126)
	voice.set(
		[
			packed[110] & 31,
			packed[111] & 7,
			(packed[111] >> 3) & 1,
			...packed.subarray(112, 116),
			packed[116] & 1,
			(packed[116] >> 1) & 7,
			(packed[116] >> 4) & 7,
			packed[117]
		],
		134
	)
	voice.set(packed.subarray(118, 128), 145)
	return voice
}

export const decodeDX7Voice = (data: Uint8Array): DX7Voice => ({
	name:
		String.fromCharCode(...data.subarray(145, 155))
			.replace(/[^\x20-\x7e]/g, " ")
			.trim() || "Untitled",
	operators: Array.from({ length: 6 }, (_, index) => {
		const p = (5 - index) * 21
		return {
			rates: Array.from(data.subarray(p, p + 4), (v) => bounded(v)),
			levels: Array.from(data.subarray(p + 4, p + 8), (v) => bounded(v)),
			breakpoint: bounded(data[p + 8]),
			leftDepth: bounded(data[p + 9]),
			rightDepth: bounded(data[p + 10]),
			leftCurve: bounded(data[p + 11], 3),
			rightCurve: bounded(data[p + 12], 3),
			rateScaling: bounded(data[p + 13], 7),
			ampSensitivity: bounded(data[p + 14], 3),
			velocitySensitivity: bounded(data[p + 15], 7),
			output: bounded(data[p + 16]),
			fixed: !!data[p + 17],
			coarse: bounded(data[p + 18], 31),
			fine: bounded(data[p + 19]),
			detune: bounded(data[p + 20], 14) - 7
		}
	}),
	pitchRates: Array.from(data.subarray(126, 130), (v) => bounded(v)),
	pitchLevels: Array.from(data.subarray(130, 134), (v) => bounded(v)),
	algorithm: bounded(data[134], 31),
	feedback: bounded(data[135], 7),
	sync: !!data[136],
	lfoSpeed: bounded(data[137]),
	lfoDelay: bounded(data[138]),
	pitchDepth: bounded(data[139]),
	ampDepth: bounded(data[140]),
	lfoSync: !!data[141],
	lfoWave: bounded(data[142], 5),
	pitchSensitivity: bounded(data[143], 7),
	transpose: bounded(data[144], 48) - 24
})

/** Reads a DX7 .syx single voice or 32-voice bank, with or without its SysEx wrapper. */
export const parseDX7Presets = (input: ArrayBuffer | ArrayBufferView): DX7Voice[] => {
	const bytes =
		input instanceof ArrayBuffer
			? new Uint8Array(input)
			: ArrayBuffer.isView(input)
				? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
				: null
	if (!bytes?.length) {
		throw new Error("Choose a DX7 .syx voice or bank file.")
	}
	const voices: DX7Voice[] = []
	const decode = (payload: Uint8Array, packed: boolean) => {
		if (payload.some((value) => value > 127)) {
			throw new Error("Invalid DX7 data bytes.")
		}
		const size = packed ? 128 : 155
		for (let offset = 0; offset < payload.length; offset += size) {
			const voice = payload.subarray(offset, offset + size)
			voices.push(decodeDX7Voice(packed ? unpackDX7Voice(voice) : voice))
		}
	}
	if (bytes[0] !== 0xf0) {
		if (![128, 155, 4096].includes(bytes.length)) {
			throw new Error("Unsupported DX7 file size.")
		}
		decode(bytes, bytes.length !== 155)
	} else {
		for (let offset = 0; offset < bytes.length; ) {
			if (bytes[offset] !== 0xf0 || bytes[offset + 1] !== 0x43 || bytes[offset + 2] > 15) {
				throw new Error("Expected a Yamaha DX7 voice or bank dump.")
			}
			const format = bytes[offset + 3],
				size = bytes[offset + 4] * 128 + bytes[offset + 5]
			if (!((format === 0 && size === 155) || (format === 9 && size === 4096))) {
				throw new Error("Only DX7 single voices and 32-voice banks are supported.")
			}
			const end = offset + 6 + size
			if (end + 1 >= bytes.length || bytes[end + 1] !== 0xf7) {
				throw new Error("The DX7 file is truncated.")
			}
			const payload = bytes.subarray(offset + 6, end)
			if (
				bytes[end] > 127 ||
				((payload.reduce((sum, value) => sum + value, 0) + bytes[end]) & 127) !== 0
			) {
				throw new Error("DX7 checksum failed. The file may be damaged.")
			}
			decode(payload, format === 9)
			offset = end + 2
		}
	}
	// Unique labels keep duplicate bank names individually selectable in a preset list.
	const used = new Set<string>()
	return voices.map((voice) => {
		const original = voice.name
		let suffix = 2
		while (used.has(voice.name)) {
			voice.name = `${original} (${suffix++})`
		}
		used.add(voice.name)
		return voice
	})
}