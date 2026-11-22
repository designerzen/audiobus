import * as INPUT_TYPES from "../io/inputs/input-types.ts"
import { CHROME_MUSIC_LAB_ATTRIBUTION } from "./shared/chrome-music-lab.ts"

/** Lazy modules keep custom-element registration out of headless consumers. */
export const UI_INPUT_COMPONENTS = {
	[INPUT_TYPES.SVG_KEYBOARD]: {
		tag: "svg-keyboard",
		name: "SVG Keyboard",
		description: "Play notes using the Photosynth svg keyboard",
		subtype: "keyboard",
		load: () => import("./keyboards/svg-keyboard/svg-keyboard.ts")
	},
	[INPUT_TYPES.CIRCULAR_CONTROLLER]: {
		tag: "circular-controller",
		name: "Circular Controller",
		description: "Play notes using the Photosynth circular controller",
		subtype: "pointer",
		load: () => import("./controllers/circular-controller/circular-controller.ts")
	},
	[INPUT_TYPES.STAR_CONTROLLER]: {
		tag: "star-controller",
		name: "Star Controller",
		description: "Play notes using the Photosynth star controller",
		subtype: "pointer",
		load: () => import("./controllers/star-controller/star-controller.ts")
	},
	[INPUT_TYPES.SOUND_WHEEL]: {
		tag: "sound-wheel",
		name: "Sound Wheel",
		description: "Play notes using the Photosynth sound wheel",
		subtype: "pointer",
		load: () => import("./controllers/sound-wheel/sound-wheel.ts")
	},
	[INPUT_TYPES.RELATIVE_TOUCH_CONTROLLER]: {
		tag: "relative-touch-controller",
		name: "Relative Touch Controller",
		description: "Play notes using the Photosynth relative touch controller",
		subtype: "pointer",
		load: () => import("./controllers/relative-touch-controller/relative-touch-controller.ts")
	},
	[INPUT_TYPES.XY_PITCH_CONTROLLER]: {
		tag: "xy-pitch-controller",
		name: "XY Pitch Controller",
		description: "Play notes using the Photosynth xy pitch controller",
		subtype: "pointer",
		load: () => import("./controllers/xy-pitch-controller/xy-pitch-controller.ts")
	},
	[INPUT_TYPES.PITCH_BEND_GRID]: {
		tag: "pitch-bend-grid",
		name: "Pitch Bend Grid",
		description: "Play notes using the Photosynth pitch bend grid",
		subtype: "pointer",
		load: () => import("./controllers/pitch-bend-grid/pitch-bend-grid.ts")
	},
	[INPUT_TYPES.NOTE_SLIDER]: {
		tag: "note-slider",
		name: "Note Slider",
		description: "Play notes using the Photosynth note slider",
		subtype: "pointer",
		load: () => import("./controls/note-slider/note-slider.ts")
	},
	[INPUT_TYPES.NOTE_DIAL]: {
		tag: "note-dial",
		name: "Note Dial",
		description: "Play notes using the Photosynth note dial",
		subtype: "pointer",
		load: () => import("./controls/note-dial/note-dial.ts")
	},
	[INPUT_TYPES.AUDIO_SWITCH]: {
		tag: "audio-switch",
		name: "Audio Switch",
		description: "Play notes using the Photosynth audio switch",
		subtype: "pointer",
		load: () => import("./controls/audio-switch/audio-switch.ts")
	},
	[INPUT_TYPES.LEAP_MOTION]: {
		tag: "theremid-input",
		name: "Leap Motion",
		description:
			"Play in the air with a Leap Motion, the camera or a pointer: theremin glides, scales, chords, arpeggios and strums over 2D and 3D surfaces",
		subtype: "gesture",
		load: () => import("theremid/source")
	},
	[INPUT_TYPES.PIANO_ROLL]: {
		tag: "piano-roll",
		name: "Piano Roll",
		description: "Play notes using the Photosynth piano roll",
		subtype: "pads",
		load: () => import("./sequencers/piano-roll/piano-roll.ts")
	},
	[INPUT_TYPES.STRUM_STRINGS]: {
		tag: "strum-strings",
		name: "Strum Strings",
		description:
			"Strum, pluck and mute colourful physically simulated strings; resizes to fit control surfaces",
		subtype: "pointer",
		load: () => import("./controllers/strum-strings/strum-strings.ts")
	},
	[INPUT_TYPES.CHROME_MUSIC_LAB_ARPEGGIOS]: {
		tag: "chrome-music-lab-arpeggios",
		name: "Chrome Music Lab Arpeggios",
		description:
			"Circle-of-fifths major and minor chord wheel with looping arpeggio patterns inspired by Chrome Music Lab",
		subtype: "pointer",
		attribution: CHROME_MUSIC_LAB_ATTRIBUTION,
		load: () => import("./controllers/arpeggios/arpeggios.ts")
	},
	[INPUT_TYPES.CHROME_MUSIC_LAB_CHORDS]: {
		tag: "chrome-music-lab-chords",
		name: "Chrome Music Lab Chords",
		description:
			"Play major or minor triads from any key on a two-octave keyboard inspired by Chrome Music Lab",
		subtype: "keyboard",
		attribution: CHROME_MUSIC_LAB_ATTRIBUTION,
		load: () => import("./controllers/chords/chords.ts")
	},
	[INPUT_TYPES.CHROME_MUSIC_LAB_HARMONICS]: {
		tag: "chrome-music-lab-harmonics",
		name: "Chrome Music Lab Harmonics",
		description:
			"Explore standing-wave overtones of the harmonic series with physically wobbling modal waves inspired by Chrome Music Lab",
		subtype: "pointer",
		attribution: CHROME_MUSIC_LAB_ATTRIBUTION,
		load: () => import("./controllers/harmonics/harmonics.ts")
	},
	[INPUT_TYPES.CHROME_MUSIC_LAB_STRINGS]: {
		tag: "chrome-music-lab-strings",
		name: "Chrome Music Lab Strings",
		description:
			"Pluck and strum divided string lengths (1/1 through 1/6) simulated with modal string physics inspired by Chrome Music Lab",
		subtype: "pointer",
		attribution: CHROME_MUSIC_LAB_ATTRIBUTION,
		load: () => import("./controllers/harmonic-strings/harmonic-strings.ts")
	},
	[INPUT_TYPES.CHROME_MUSIC_LAB_MELODY_MAKER]: {
		tag: "chrome-music-lab-melody-maker",
		name: "Chrome Music Lab Melody Maker",
		description:
			"Eight-step diatonic grid sequencer with ghost harmony shadows inspired by Chrome Music Lab",
		subtype: "pads",
		attribution: CHROME_MUSIC_LAB_ATTRIBUTION,
		load: () => import("./controllers/melody-maker/melody-maker.ts")
	},
	[INPUT_TYPES.CHROME_MUSIC_LAB_PIANO_ROLL]: {
		tag: "chrome-music-lab-piano-roll",
		name: "Chrome Music Lab Piano Roll",
		description:
			"Play and scrub classical piano roll scores forward or backward across a live trigger line inspired by Chrome Music Lab",
		subtype: "pointer",
		attribution: CHROME_MUSIC_LAB_ATTRIBUTION,
		load: () => import("./controllers/scrolling-piano-roll/scrolling-piano-roll.ts")
	},
	[INPUT_TYPES.CHROME_MUSIC_LAB_SOUND_WAVES]: {
		tag: "chrome-music-lab-sound-waves",
		name: "Chrome Music Lab Sound Waves",
		description:
			"Play a keyboard while watching longitudinal air-particle waves and zoomed sine traces inspired by Chrome Music Lab",
		subtype: "keyboard",
		attribution: CHROME_MUSIC_LAB_ATTRIBUTION,
		load: () => import("./controllers/sound-waves/sound-waves.ts")
	}
} as const

export type UIInputId = keyof typeof UI_INPUT_COMPONENTS