import { TRANSFORMER_TYPE } from "./transformer-factory";

export const PRESETS = [
	{
		name:"Chord Arpeggiator",
		description: "Quantizes input, generates chords, and arpeggiates them for flowing melodic patterns",
		icon: "/icons/preset-chord-arpeggiator.svg",
		transformers: [TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_CHORDIFIER, TRANSFORMER_TYPE.ID_ARPEGGIATOR]
	},
	{
		name:"Random Patch",
		description: "Adds randomness with quantization and note shortening for experimental textures",
		icon: "/icons/preset-random-patch.svg",
		transformers: [TRANSFORMER_TYPE.ID_RANDOMISER, TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_NOTE_SHORTENER]
	},
	{
		name:"Chord Repeater",
		description: "Quantizes, generates chords, and repeats notes for hypnotic rhythmic effects",
		icon: "/icons/preset-chord-repeater.svg",
		transformers: [TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_CHORDIFIER, TRANSFORMER_TYPE.ID_NOTE_REPEATER]
	},
	{
		name:"Harmonic Randomiser",
		description: "Combines quantization, randomness, and harmony for chaotic yet musical results",
		icon: "/icons/preset-harmonic-randomiser.svg",
		transformers: [TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_RANDOMISER, TRANSFORMER_TYPE.ID_CHORDIFIER]
	},
	{
		name:"Staccato Arp",
		description: "Creates short, quick arpeggiated bursts with quantized timing",
		icon: "/icons/preset-staccato-arp.svg",
		transformers: [TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_ARPEGGIATOR, TRANSFORMER_TYPE.ID_NOTE_SHORTENER]
	},
	{
		name:"Complex Pattern",
		description: "Combines all transformations for intricate, layered harmonic patterns",
		icon: "/icons/preset-complex-pattern.svg",
		transformers: [TRANSFORMER_TYPE.ID_RANDOMISER, TRANSFORMER_TYPE.ID_HARMONISER, TRANSFORMER_TYPE.ID_CHORDIFIER, TRANSFORMER_TYPE.ID_ARPEGGIATOR, TRANSFORMER_TYPE.ID_NOTE_REPEATER]
	},
	{
		name:"Melodic Sequencer",
		description: "Harmonizes input and creates melodic sequences with quantization for structured improvisations",
		icon: "/icons/preset-melodic-sequencer.svg",
		transformers: [TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_HARMONISER, TRANSFORMER_TYPE.ID_ARPEGGIATOR]
	},
	{
		name:"Echo Chamber",
		description: "Repeats notes with harmonic layering to create spacious, reverberant textures",
		icon: "/icons/preset-echo-chamber.svg",
		transformers: [TRANSFORMER_TYPE.ID_NOTE_REPEATER, TRANSFORMER_TYPE.ID_HARMONISER]
	},
	{
		name:"Minimal Motion",
		description: "Light quantization and shortening for subtle, controlled harmonic movement",
		icon: "/icons/preset-minimal-motion.svg",
		transformers: [TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_NOTE_SHORTENER]
	},
	{
		name:"Harmonic Expander",
		description: "Expands single notes into rich chords with smooth arpeggio patterns",
		icon: "/icons/preset-harmonic-expander.svg",
		transformers: [TRANSFORMER_TYPE.ID_CHORDIFIER, TRANSFORMER_TYPE.ID_ARPEGGIATOR, TRANSFORMER_TYPE.ID_HARMONISER]
	},
	{
		name:"Glitch Texture",
		description: "Combines randomness and note repetition for unpredictable, experimental soundscapes",
		icon: "/icons/preset-glitch-texture.svg",
		transformers: [TRANSFORMER_TYPE.ID_RANDOMISER, TRANSFORMER_TYPE.ID_NOTE_REPEATER, TRANSFORMER_TYPE.ID_NOTE_SHORTENER]
	},
	{
		name:"Classic Chord",
		description: "Simple and elegant - just quantization and chordification for timeless harmonic enhancement",
		icon: "/icons/preset-classic-chord.svg",
		transformers: [TRANSFORMER_TYPE.ID_QUANTISE, TRANSFORMER_TYPE.ID_CHORDIFIER]
	}
]
