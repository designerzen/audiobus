import {
	EVENT_KEYBOARD_KEY_DOWN,
	EVENT_KEYBOARD_KEY_UP,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_BLUR,
	EVENT_VISIBILITY_CHANGE
} from "../../event-constants.ts"
import * as Commands from "../../commands"

const MAPPING_KEYS_TO_MIDI_NOTES = [
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

/**
 *  Add Keyboard listeners and tie in commands
 */
export const addKeyboardDownEvents = (
	callback: Function,
	midiNoteSequence: string[] = MAPPING_KEYS_TO_MIDI_NOTES
) => {
	// For typing longer numbers
	let numberSequence = ""
	const octaveOffset = 41

	const keysPressed = new Map()
	const keyboardMap = new Map()
	// Keep the original character and pitch even if modifiers change before keyup.
	const heldNotes = new Map<string, { key: string; noteNumber: number }>()
	const keyId = (event: KeyboardEvent) => event.code || event.key.toLowerCase()
	const releaseNote = (id: string, event?: KeyboardEvent) => {
		const note = heldNotes.get(id)
		if (!note) {
			return
		}
		heldNotes.delete(id)
		keysPressed.delete(note.key)
		window.dispatchEvent(new CustomEvent(EVENT_KEYBOARD_KEY_UP, { detail: { key: note.key } }))
		callback(Commands.NOTE_OFF, note.key, note.noteNumber, event)
	}
	const releaseAll = () => {
		for (const id of Array.from(heldNotes.keys())) {
			releaseNote(id)
		}
		keysPressed.clear()
	}

	const abortController = new AbortController()
	const quit = () => {
		abortController.abort()
		releaseAll()
	}

	midiNoteSequence.forEach((midiNote, index) => keyboardMap.set(midiNote, index + octaveOffset))

	window.addEventListener(
		EVENT_KEY_DOWN,
		async (event) => {
			const isNumber = !isNaN(parseInt(event.key))
			const focussedElement = document.activeElement

			// Dispatch visual feedback event for QWERTY keyboard display
			window.dispatchEvent(
				new CustomEvent(EVENT_KEYBOARD_KEY_DOWN, { detail: { key: event.key } })
			)

			if (keysPressed.has(event.key) || heldNotes.has(keyId(event))) {
				// already pressed so ignore
				return quit
			}

			// Contextual hotkeys - if something is focussed then different keys!
			if (focussedElement && focussedElement !== document.documentElement) {
				// not body!
				switch (focussedElement.nodeName) {
					case "BUTTON":
						break

					//
					case "DIALOG":
					case "INPUT":
					case "SELECT":
						console.info("Ignoring key input due to focus")
						return quit
				}

				// we should quit here?
			}

			let commandType = undefined
			let value = -1

			// NB. On some systems (such as Windows 11 Desktops)
			// the keyboard event is triggered many times when held
			// to prevent this, we only dispatch changes
			if (keyboardMap.has(event.key)) {
				const noteNumber = keyboardMap.get(event.key)
				keysPressed.set(event.key, noteNumber)
				heldNotes.set(keyId(event), { key: event.key, noteNumber })
				//console.log("Key already down", Commands.NOTE_ON, event.key, noteNumber )
				callback(Commands.NOTE_ON, event.key, noteNumber, event)
				return quit
			}

			// Allow Tab to continue to perform its default function
			// switch(event.key)
			// {
			// 	case 'Tab':
			// 		break

			// 	default:
			// 		//event.preventDefault()
			// }

			switch (event.key) {
				case "CapsLock":
					event.preventDefault()
					break

				case "Escape":
				case "Del":
				case "Delete":
					commandType = Commands.PLAYBACK_STOP
					break

				case "Enter":
					commandType = Commands.PLAYBACK_TOGGLE
					break
				case " ":
				case "Space":
					commandType = Commands.TEMPO_TAP
					break
				case "QuestionMark":
				case "?":
					break
				case "ArrowLeft":
					commandType = Commands.PITCH_BEND
					value = 0.2
					break
				case "ArrowRight":
					commandType = Commands.PITCH_BEND
					value = -0.2
					break
				case "ArrowUp":
					commandType = Commands.TEMPO_INCREASE
					break
				case "ArrowDown":
					commandType = Commands.TEMPO_DECREASE
					break
				case ",":
					break
				case ".":
					break
				case "a":
					break
				case "b":
					break
				case "c":
					break
				case "d":
					break
				case "e":
					break
				case "f":
					break
				case "g":
					break
				case "h":
					break
				case "i":
					break
				case "j":
					break
				case "k":
					break
				case "l":
					break
				case "m":
					break
				case "n":
					break
				case "o":
					break
				case "p":
					break
				case "q":
					break
				case "r":
					break
				case "s":
					break
				case "t":
					break
				case "u":
					break
				case "v":
					break
				case "w":
					break
				case "x":
					break
				case "y":
					break
				case "z":
					break
				case "F1":
					break
				case "F2":
					break
				case "F3":
					break
				case "F4":
					break
				// Select Players only
				case "F5":
					event.preventDefault()
					break

				case "F6":
					event.preventDefault()
					break

				case "F7":
					event.preventDefault()
					break

				case "F8":
					event.preventDefault()
					break

				// Media Hotkeys

				// Launch Media
				case "LaunchMediaPlayer":
					event.preventDefault()
					break

				// Previous Track
				case "MediaTrackPrevious":
					event.preventDefault()
					break

				// Play / Pause Percussion
				case "MediaPlayPause":
					event.preventDefault()
					break

				// Next Track
				case "MediaTrackNext":
					event.preventDefault()
					break

				case "F9":
					event.preventDefault()
					break

				case "F10":
					event.preventDefault()
					break

				// Play / Pause Percussion
				case "F11":
					event.preventDefault()
					break

				// Next Track
				case "F12":
					event.preventDefault()
					break

				case "F13":
					event.preventDefault()
					break

				case "F14":
					event.preventDefault()
					break

				case "F15":
					event.preventDefault()
					break

				case "F16":
					event.preventDefault()
					break

				case "F17":
					event.preventDefault()
					break

				case "F18":
					event.preventDefault()
					break

				case "F19":
					event.preventDefault()
					break

				// don't hijack tab you numpty!
				// FILTER
				case "Tab":
					break

				default:
					// check if it is numerical...
					// or if it is a media key?
					if (!isNumber) {
						// loadRandomInstrument()
						// speak("Loading random instruments",true)
					}
				//console.log("Key pressed", {event,isNumber} )
			}

			// Check to see if it is a number
			if (isNumber) {
				numberSequence += event.key
				// now check to see if it is 3 numbers long
				if (numberSequence.length === 3) {
					// reset
					numberSequence = ""
				}
			} else {
				numberSequence = ""
			}

			keysPressed.set(event.key, value)
			callback(commandType, event.key, value)
			// console.log("key", ui, event)
		},
		{ signal: abortController.signal }
	)

	// depress notes held
	window.addEventListener(
		EVENT_KEY_UP,
		async (event) => {
			// Dispatch visual feedback event for QWERTY keyboard display
			if (!heldNotes.has(keyId(event))) {
				window.dispatchEvent(
					new CustomEvent(EVENT_KEYBOARD_KEY_UP, { detail: { key: event.key } })
				)
			}

			// if ( event.key !== 'Tab' ){
			// 	event.preventDefault()
			// }

			releaseNote(keyId(event), event)
			keysPressed.delete(event.key)
		},
		{ signal: abortController.signal, capture: true }
	)

	window.addEventListener(EVENT_BLUR, releaseAll, { signal: abortController.signal })
	document.addEventListener(
		EVENT_VISIBILITY_CHANGE,
		() => {
			if (document.hidden) {
				releaseAll()
			}
		},
		{ signal: abortController.signal }
	)

	// send out cancel event listening
	return quit
}