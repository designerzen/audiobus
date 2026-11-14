// Fixed trims measured with the same A3 note at MIDI velocity 80. Keep these
// separate from user gain: continuous automatic gain would flatten envelopes,
// velocity changes, and chords. Custom patches can still need a manual mix.
export const ENGINE_TRIM_DB = {
	"tone-synth": 2,
	"tone-mono-synth": -0.5,
	"tone-fm-synth": 3.5,
	"tone-pluck-string": -5,
	polyphonic: -1,
	moog: 4,
	tb303: 1.5,
	sion: 5.5,
	yoshimi: -5.5
} as const

export function engineGain(engine: keyof typeof ENGINE_TRIM_DB): number {
	return 10 ** (ENGINE_TRIM_DB[engine] / 20)
}