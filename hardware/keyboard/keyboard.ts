import {
	EVENT_KEYBOARD_KEY_DOWN,
	EVENT_KEYBOARD_KEY_UP,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_BLUR,
	EVENT_VISIBILITY_CHANGE
} from "../../event-constants.ts"
import * as Commands from "../../commands"
import type { KeyboardConfiguration, KeyboardBinding } from "./keyboard-configuration"

export const MAPPING_KEYS_TO_MIDI_NOTES = [
	"q",
	"2",
	"w",
	"3",
	"e",
	"r",
	"5",
	"t",
	"6",
	"y",
	"7",
	"u",
	"i",
	"9",
	"o",
	"0",
	"p",
	"[",
	"]",
	"\\",
	"a",
	"z",
	"s",
	"x",
	"d",
	"c",
	"f",
	"v",
	"g",
	"b",
	"h",
	"n",
	"j",
	"m",
	"k",
	",",
	"l",
	".",
	";",
	"/",
	"'"
]

const SHORTCUTS: Record<string, KeyboardBinding> = {
	Escape: { key: "Escape", command: Commands.PLAYBACK_STOP, value: -1 },
	Delete: { key: "Delete", command: Commands.PLAYBACK_STOP, value: -1 },
	Enter: { key: "Enter", command: Commands.PLAYBACK_TOGGLE, value: -1 },
	" ": { key: " ", command: Commands.TEMPO_TAP, value: -1 },
	ArrowLeft: { key: "ArrowLeft", command: Commands.PITCH_BEND, value: 0.2 },
	ArrowRight: { key: "ArrowRight", command: Commands.PITCH_BEND, value: -0.2 },
	ArrowUp: { key: "ArrowUp", command: Commands.TEMPO_INCREASE, value: -1 },
	ArrowDown: { key: "ArrowDown", command: Commands.TEMPO_DECREASE, value: -1 }
}

/** Register musical keys, preserving the original binding until key release. */
export const addKeyboardDownEvents = (
	callback: (command: string, key: string, value: number, event?: KeyboardEvent) => void,
	midiNoteSequence: string[] = MAPPING_KEYS_TO_MIDI_NOTES,
	configuration: KeyboardConfiguration = { mode: "combined", bindings: [] }
) => {
	const controller = new AbortController()
	const held = new Map<string, KeyboardBinding>()
	const keyId = (event: KeyboardEvent) => event.code || event.key.toLowerCase()
	const release = (id: string, event?: KeyboardEvent) => {
		const binding = held.get(id)
		if (!binding) {
			return
		}
		held.delete(id)
		window.dispatchEvent(
			new CustomEvent(EVENT_KEYBOARD_KEY_UP, { detail: { key: binding.key } })
		)
		if (binding.command === Commands.NOTE_ON) {
			callback(Commands.NOTE_OFF, binding.key, binding.value, event)
		}
	}
	const releaseAll = () => {
		for (const id of held.keys()) {
			release(id)
		}
	}
	window.addEventListener(
		EVENT_KEY_DOWN,
		(event) => {
			if (event.defaultPrevented || event.repeat || held.has(keyId(event))) {
				return
			}
			const target = document.activeElement
			if (
				target?.closest(
					"input, select, textarea, [contenteditable]:not([contenteditable='false']), dialog"
				)
			) {
				return
			}
			if (event.ctrlKey || event.metaKey || event.altKey) {
				return
			}
			const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
			let binding: KeyboardBinding | undefined
			if (configuration.mode === "custom") {
				binding = configuration.bindings.find((binding) => binding.key === key)
			} else {
				const index = midiNoteSequence.indexOf(key)
				if (configuration.mode !== "shortcuts" && index !== -1) {
					binding = { key, command: Commands.NOTE_ON, value: index + 41 }
				} else if (configuration.mode !== "notes") {
					binding = SHORTCUTS[key]
				}
			}
			window.dispatchEvent(new CustomEvent(EVENT_KEYBOARD_KEY_DOWN, { detail: { key } }))
			if (!binding) {
				return
			}
			event.preventDefault()
			held.set(keyId(event), { ...binding })
			callback(binding.command, key, binding.value, event)
		},
		{ signal: controller.signal }
	)
	window.addEventListener(
		EVENT_KEY_UP,
		(event) => {
			release(keyId(event), event)
			window.dispatchEvent(
				new CustomEvent(EVENT_KEYBOARD_KEY_UP, { detail: { key: event.key } })
			)
		},
		{ signal: controller.signal, capture: true }
	)
	window.addEventListener(EVENT_BLUR, releaseAll, { signal: controller.signal })
	document.addEventListener(
		EVENT_VISIBILITY_CHANGE,
		() => {
			if (document.hidden) {
				releaseAll()
			}
		},
		{ signal: controller.signal }
	)
	return () => {
		controller.abort()
		releaseAll()
	}
}