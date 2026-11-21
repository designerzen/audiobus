/**
 * General MIDI percussion grouped into the handful of voices a tracker drum kit is built from
 * Many keys sound alike, so a kit stores one sample per voice rather than one per key
 */

/** The General MIDI percussion channel, counted from 1 */
export const CHANNEL_DRUMS = 10

export interface DrumVoice {
	id: string
	name: string
	/** The key whose sound stands for the voice */
	rep: number
	/** Whether other keys of the voice play the sample transposed by their distance from `rep` */
	pitched: boolean
	keys: readonly number[]
}

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => from + i)

export const DRUM_VOICES: readonly DrumVoice[] = [
	{ id: "kick", name: "Kick", rep: 36, pitched: false, keys: [35, 36] },
	{ id: "rim", name: "Rim", rep: 37, pitched: false, keys: [37] },
	{ id: "snare", name: "Snare", rep: 38, pitched: false, keys: [38, 40] },
	{ id: "clap", name: "Clap", rep: 39, pitched: false, keys: [39] },
	{ id: "tom-low", name: "Low tom", rep: 41, pitched: true, keys: [41, 43] },
	{ id: "hat-closed", name: "Closed hat", rep: 42, pitched: false, keys: [42, 44] },
	{ id: "tom-mid", name: "Mid tom", rep: 45, pitched: true, keys: [45, 47] },
	{ id: "hat-open", name: "Open hat", rep: 46, pitched: false, keys: [46] },
	{ id: "tom-high", name: "High tom", rep: 48, pitched: true, keys: [48, 50] },
	{ id: "crash", name: "Crash", rep: 49, pitched: true, keys: [49, 52, 55, 57] },
	{ id: "ride", name: "Ride", rep: 51, pitched: true, keys: [51, 53, 59] },
	{ id: "shaker", name: "Shaker", rep: 69, pitched: false, keys: [54, 69, 70, 82, 85] },
	{ id: "block", name: "Block", rep: 56, pitched: false, keys: [56, 67, 68, 75, 76, 77] },
	{ id: "hand", name: "Hand drum", rep: 62, pitched: true, keys: range(60, 66) },
	{
		id: "misc",
		name: "Percussion",
		rep: 80,
		pitched: false,
		keys: [58, 71, 72, 73, 74, 78, 79, 80, 81, 83, 84, 86, 87]
	}
]

const VOICE_OF_KEY = new Map<number, DrumVoice>(
	DRUM_VOICES.flatMap((voice) => voice.keys.map((key) => [key, voice] as const))
)

/** The voice that plays a drum key. Keys outside the General MIDI set each stand alone. */
export const drumVoiceOf = (key: number): DrumVoice =>
	VOICE_OF_KEY.get(key) ?? {
		id: `key-${key}`,
		name: "Drum",
		rep: key,
		pitched: false,
		keys: [key]
	}