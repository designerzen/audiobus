export const MAX_ROOM_LENGTH = 6

export interface RoomImpulseOptions {
	/** RT60 in seconds */
	length?: number
	/** -1 (dark) to 1 (bright) */
	tone?: number
	/** Seconds of silence before the room speaks */
	preDelay?: number
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

// Deterministic noise keeps impulses identical between sessions
const createRandom = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
	return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
}

const onePole = (frequency: number, sampleRate: number) =>
	Math.exp((-2 * Math.PI * Math.min(frequency, sampleRate * 0.45)) / sampleRate)

/**
 * Generated room: exponential decay (RT60), sparse early reflections,
 * a soft onset and highs that die faster than lows.
 */
export const generateRoomImpulse = (
	context: BaseAudioContext,
	{ length = 1.8, tone = 0, preDelay = 0.012 }: RoomImpulseOptions = {}
): AudioBuffer => {
	const rate = context.sampleRate
	const rt60 = clamp(length, 0.1, MAX_ROOM_LENGTH)
	const offset = Math.round(clamp(preDelay, 0, 0.2) * rate)
	const tail = Math.max(1, Math.ceil(rt60 * 1.1 * rate))
	const buffer = context.createBuffer(2, offset + tail, rate)
	// bigger rooms spread their reflections and build up more slowly
	const size = clamp(rt60 / 3, 0.1, 1)
	const onset = (0.004 + 0.03 * size) * rate
	const decayRate = 6.9078 / (rt60 * rate)
	const startCutoff = clamp(9000 * 2 ** (tone * 1.2), 1500, 20000)
	const endCutoff = clamp(startCutoff / (5 - tone * 2), 300, startCutoff)
	const fadeLength = Math.ceil(tail * 0.08)
	for (let channel = 0; channel < 2; channel++) {
		const data = buffer.getChannelData(channel)
		const random = createRandom(0x9e3779b9 * (channel + 1) + Math.round(rt60 * 1000))
		let filtered = 0,
			pole = 0
		for (let i = 0; i < tail; i++) {
			// the damping glide is slow, so update the filter once per block
			if (!(i & 63)) {
				pole = onePole(startCutoff * (endCutoff / startCutoff) ** (i / tail), rate)
			}
			filtered = (1 - pole) * random() + pole * filtered
			const build = i < onset ? (i / onset) ** 2 : 1
			const fade =
				i > tail - fadeLength
					? 0.5 + 0.5 * Math.cos((Math.PI * (i - tail + fadeLength)) / fadeLength)
					: 1
			data[offset + i] = filtered * Math.exp(-decayRate * i) * build * fade * 2
		}
		// early reflections arrive as distinct, decaying echoes, loud enough
		// to stand clear of the diffuse tail that is still building up
		const taps = 8
		for (let tap = 0; tap < taps; tap++) {
			const time = (0.003 + ((tap + 0.5 + random() * 0.4) / taps) * 0.07 * size) * rate
			const index = Math.min(tail - 1, Math.round(time))
			data[offset + index] +=
				(random() < 0 ? -6 : 6) * Math.exp(-decayRate * index) * (1 - (tap / taps) * 0.5)
		}
	}
	return buffer
}