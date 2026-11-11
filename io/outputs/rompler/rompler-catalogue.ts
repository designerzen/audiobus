/**
 * Soundfont packs in the midi-js-soundfonts layout:
 * `${baseUrl}${pack}/${preset}-mp3/${NoteName}.mp3`
 */
export const ROMPLER_HOST = "https://gleitz.github.io/midi-js-soundfonts/"

export const ROMPLER_PACKS = [
	{ id: "FluidR3_GM", title: "Fluid R3 (balanced)" },
	{ id: "MusyngKite", title: "Musyng Kite (detailed, larger)" },
	{ id: "FatBoy", title: "FatBoy (punchy)" }
] as const

export const ROMPLER_FAMILIES = [
	"Piano",
	"Chromatic Percussion",
	"Organ",
	"Guitar",
	"Bass",
	"Strings",
	"Ensemble",
	"Brass",
	"Reed",
	"Pipe",
	"Synth Lead",
	"Synth Pad",
	"Synth Effects",
	"Ethnic",
	"Percussive",
	"Sound Effects"
] as const

// General MIDI program order; the index is the program number
export const ROMPLER_PRESETS =
	`acoustic_grand_piano bright_acoustic_piano electric_grand_piano honkytonk_piano electric_piano_1 electric_piano_2 harpsichord clavinet celesta glockenspiel music_box vibraphone marimba xylophone tubular_bells dulcimer drawbar_organ percussive_organ rock_organ church_organ reed_organ accordion harmonica tango_accordion acoustic_guitar_nylon acoustic_guitar_steel electric_guitar_jazz electric_guitar_clean electric_guitar_muted overdriven_guitar distortion_guitar guitar_harmonics acoustic_bass electric_bass_finger electric_bass_pick fretless_bass slap_bass_1 slap_bass_2 synth_bass_1 synth_bass_2 violin viola cello contrabass tremolo_strings pizzicato_strings orchestral_harp timpani string_ensemble_1 string_ensemble_2 synth_strings_1 synth_strings_2 choir_aahs voice_oohs synth_choir orchestra_hit trumpet trombone tuba muted_trumpet french_horn brass_section synth_brass_1 synth_brass_2 soprano_sax alto_sax tenor_sax baritone_sax oboe english_horn bassoon clarinet piccolo flute recorder pan_flute blown_bottle shakuhachi whistle ocarina lead_1_square lead_2_sawtooth lead_3_calliope lead_4_chiff lead_5_charang lead_6_voice lead_7_fifths lead_8_bass__lead pad_1_new_age pad_2_warm pad_3_polysynth pad_4_choir pad_5_bowed pad_6_metallic pad_7_halo pad_8_sweep fx_1_rain fx_2_soundtrack fx_3_crystal fx_4_atmosphere fx_5_brightness fx_6_goblins fx_7_echoes fx_8_scifi sitar banjo shamisen koto kalimba bagpipe fiddle shanai tinkle_bell agogo steel_drums woodblock taiko_drum melodic_tom synth_drum reverse_cymbal guitar_fret_noise breath_noise seashore bird_tweet telephone_ring helicopter applause gunshot`.split(
		" "
	)

// The packs only ship the 88 piano keys
export const LOWEST_NOTE = 21
export const HIGHEST_NOTE = 108

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]

export const noteName = (note: number): string =>
	`${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`

export const presetTitle = (program: number): string =>
	(ROMPLER_PRESETS[program] ?? "")
		.split("_")
		.filter(Boolean)
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(" ")

export const presetFamily = (program: number): string => ROMPLER_FAMILIES[program >> 3]

export const sampleUrl = (baseUrl: string, pack: string, program: number, note: number): string =>
	`${baseUrl}${pack}/${ROMPLER_PRESETS[program]}-mp3/${noteName(note)}.mp3`

/** Keys that get their own sample; the rest are pitched from the nearest one */
export const sampleGrid = (spacing: number): number[] => {
	const grid = []
	for (let note = LOWEST_NOTE; note <= HIGHEST_NOTE; note++) {
		if ((note - 60) % spacing === 0) {
			grid.push(note)
		}
	}
	return grid
}