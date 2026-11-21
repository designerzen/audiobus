/** A soundfont the Rompler offers ready to play, hosted where browsers may fetch it */
export interface RomplerSoundFont {
	name: string
	// Empty for OpenGM24, which streams note by note instead of downloading a file
	url: string
	format: string
	// Download size in bytes; zero when streamed
	size: number
	author: string
	license: string
	description: string
}

const GITHUB = "https://raw.githubusercontent.com/"

// Every entry is freely licensed and served with CORS, so it loads from any page
export const ROMPLER_SOUNDFONTS: RomplerSoundFont[] = [
	{
		name: "OpenGM24",
		url: "",
		format: "Streamed MP3",
		size: 0,
		author: "designerzen and contributors",
		license: "Mixed open licences",
		description:
			"All 128 General MIDI instruments, streamed a note at a time around what you play. Starts fastest."
	},
	{
		name: "GeneralUser GS",
		url: `${GITHUB}spessasus/SpessaSynth/master/soundfonts/GeneralUserGS.sf3`,
		format: "SF3",
		size: 8423728,
		author: "S. Christian Collins",
		license: "GeneralUser GS License",
		description:
			"A balanced, well-mixed General MIDI and GS bank with drum kits, compressed to a small download."
	},
	{
		name: "GeneralUser GS (full quality)",
		url: `${GITHUB}mrbumpy409/GeneralUser-GS/main/GeneralUser-GS.sf2`,
		format: "SF2",
		size: 32319396,
		author: "S. Christian Collins",
		license: "GeneralUser GS License",
		description: "The original uncompressed GeneralUser GS bank, for the cleanest sound."
	},
	{
		name: "FluidR3 Mono GM",
		url: `${GITHUB}musescore/MuseScore/v3.6.2/share/sound/FluidR3Mono_GM.sf3`,
		format: "SF3",
		size: 23712790,
		author: "Frank Wen, adapted by MuseScore",
		license: "MIT",
		description:
			"The classic FluidR3 General MIDI set, as shipped with MuseScore 3, with GS drum kits."
	},
	{
		name: "MS Basic",
		url: `${GITHUB}musescore/MuseScore/v4.4.4/share/sound/MS%20Basic.sf3`,
		format: "SF3",
		size: 51278610,
		author: "MuseScore",
		license: "MIT",
		description:
			"MuseScore 4's default bank: detailed orchestral and band instruments with many variations."
	},
	{
		name: "TimGM6mb",
		url: `${GITHUB}craffel/pretty-midi/main/pretty_midi/TimGM6mb.sf2`,
		format: "SF2",
		size: 5994284,
		author: "Tim Brechbill",
		license: "GPL-2.0",
		description: "A compact General MIDI bank with a full drum set. Quick to download."
	},
	{
		name: "Vintage Dreams Waves",
		url: `${GITHUB}FluidSynth/fluidsynth/master/sf2/VintageDreamsWaves-v2.sf2`,
		format: "SF2",
		size: 314640,
		author: "Ian Wilson",
		license: "Freeware",
		description:
			"Retro analogue and chip-style synth waves from the AWE soundcard era. Tiny and instant."
	}
]

export const soundFontEntry = (url: string): RomplerSoundFont | undefined =>
	ROMPLER_SOUNDFONTS.find((soundfont) => soundfont.url === url)

export const formatSize = (bytes: number): string =>
	bytes >= 1048576
		? `${(bytes / 1048576).toFixed(bytes >= 10485760 ? 0 : 1)} MB`
		: `${Math.ceil(bytes / 1024)} KB`