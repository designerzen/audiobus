import * as INPUT_TYPES from "../io/inputs/input-types.ts"

/** Lazy modules keep custom-element registration out of headless consumers. */
export const UI_INPUT_COMPONENTS = {
    [INPUT_TYPES.SVG_KEYBOARD]: { tag: "svg-keyboard", name: "SVG Keyboard", description: "Play notes using the Photosynth svg keyboard", subtype: "keyboards", load: () => import("./keyboards/svg-keyboard/svg-keyboard.ts") },
    [INPUT_TYPES.CIRCULAR_CONTROLLER]: { tag: "circular-controller", name: "Circular Controller", description: "Play notes using the Photosynth circular controller", subtype: "controllers", load: () => import("./controllers/circular-controller/circular-controller.ts") },
    [INPUT_TYPES.STAR_CONTROLLER]: { tag: "star-controller", name: "Star Controller", description: "Play notes using the Photosynth star controller", subtype: "controllers", load: () => import("./controllers/star-controller/star-controller.ts") },
    [INPUT_TYPES.SOUND_WHEEL]: { tag: "sound-wheel", name: "Sound Wheel", description: "Play notes using the Photosynth sound wheel", subtype: "controllers", load: () => import("./controllers/sound-wheel/sound-wheel.ts") },
    [INPUT_TYPES.RELATIVE_TOUCH_CONTROLLER]: { tag: "relative-touch-controller", name: "Relative Touch Controller", description: "Play notes using the Photosynth relative touch controller", subtype: "controllers", load: () => import("./controllers/relative-touch-controller/relative-touch-controller.ts") },
    [INPUT_TYPES.XY_PITCH_CONTROLLER]: { tag: "xy-pitch-controller", name: "XY Pitch Controller", description: "Play notes using the Photosynth xy pitch controller", subtype: "controllers", load: () => import("./controllers/xy-pitch-controller/xy-pitch-controller.ts") },
    [INPUT_TYPES.PITCH_BEND_GRID]: { tag: "pitch-bend-grid", name: "Pitch Bend Grid", description: "Play notes using the Photosynth pitch bend grid", subtype: "controllers", load: () => import("./controllers/pitch-bend-grid/pitch-bend-grid.ts") },
    [INPUT_TYPES.NOTE_SLIDER]: { tag: "note-slider", name: "Note Slider", description: "Play notes using the Photosynth note slider", subtype: "controls", load: () => import("./controls/note-slider/note-slider.ts") },
    [INPUT_TYPES.NOTE_DIAL]: { tag: "note-dial", name: "Note Dial", description: "Play notes using the Photosynth note dial", subtype: "controls", load: () => import("./controls/note-dial/note-dial.ts") },
    [INPUT_TYPES.AUDIO_SWITCH]: { tag: "audio-switch", name: "Audio Switch", description: "Play notes using the Photosynth audio switch", subtype: "controls", load: () => import("./controls/audio-switch/audio-switch.ts") },
    [INPUT_TYPES.PIANO_ROLL]: { tag: "piano-roll", name: "Piano Roll", description: "Play notes using the Photosynth piano roll", subtype: "sequencers", load: () => import("./sequencers/piano-roll/piano-roll.ts") },
} as const

export type UIInputId = keyof typeof UI_INPUT_COMPONENTS
