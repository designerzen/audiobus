import * as Commands from '../../commands'

const MAPPING_KEYS_TO_MIDI_NOTES = [
		"q","2","w","3","e","r","5","t","6","y","7","u","i","9","o","0","p",
		"[","]","\\",
		"a","z","s","x","d","c","f","v","g","b","h","n","j","m","k",",","l",".",";","/","'"
	]

/**
 *  Add Keyboard listeners and tie in commands
 */
export const addKeyboardDownEvents = ( callback:Function, midiNoteSequence:number[]=MAPPING_KEYS_TO_MIDI_NOTES ) => {
	
	// For typing longer numbers
	let numberSequence = ""
	let octaveOffset = 41

	const keysPressed = new Map()
	const keyboardMap = new Map()

	const abortController = new AbortController()
	const quit = () =>{
		abortController.abort()
		keysPressed.clear()
	}

	midiNoteSequence.forEach( (midiNote, index) => keyboardMap.set( midiNote, index+octaveOffset ) )

	window.addEventListener('keydown', async (event)=>{
		const isNumber = !isNaN( parseInt(event.key) )
		const focussedElement = document.activeElement

		if ( keysPressed.has(event.key) )
		{
			// already pressed so ignore
			return quit
		}

		// Contextual hotkeys - if something is focussed then different keys!
		if (focussedElement && focussedElement !== document.documentElement )
		{
			// not body!
			switch(focussedElement.nodeName)
			{
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
		if (keyboardMap.has(event.key))
		{
			const noteNumber = keyboardMap.get(event.key)
			keysPressed.set(event.key, noteNumber)
			//console.log("Key already down", Commands.NOTE_ON, event.key, noteNumber )
			callback( Commands.NOTE_ON, event.key, noteNumber, event )
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

		switch(event.key)
		{
			case 'CapsLock':
				event.preventDefault()
				break

			case 'Escape':
			case 'Del':
			case 'Delete':
				commandType = Commands.PLAYBACK_STOP
				break

			case 'Enter':
				commandType = Commands.PLAYBACK_TOGGLE
				break;
			case 'Space':
				commandType = Commands.TEMPO_TAP
				break;
			case 'QuestionMark':
			case '?':
				break;
			case 'ArrowLeft':
				commandType = Commands.PITCH_BEND
				value = 0.2
				break;
			case 'ArrowRight':
				commandType = Commands.PITCH_BEND
				value = -0.2
				break;
			case 'ArrowUp':
				commandType = Commands.TEMPO_INCREASE
				break;
			case 'ArrowDown':
				commandType = Commands.TEMPO_DECREASE
				break;
			case ',':
				break;
			case '.':
				break;
			case 'a':
				break;
			case 'b':
				break;
			case 'c':
				break;
			case 'd':
				break;
			case 'e':
				break;
			case 'f':
				break;
			case 'g':
				break;
			case 'h':
				break;
			case 'i':
				break;
			case 'j':
				break;
			case 'k':
				break;
			case 'l':
				break;
			case 'm':
				break;
			case 'n':
				break;
			case 'o':
				break;
			case 'p':
				break;
			case 'q':
				break;
			case 'r':
				break;
			case 's':
				break;
			case 't':
				break;
			case 'u':
				break;
			case 'v':
				break
			case 'w':
				break
			case 'x':
				break
			case 'y':
				break
			case 'z':
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
			case 'Tab':
				break

			default:
				// check if it is numerical...
				// or if it is a media key?
				if (!isNumber)
				{
					// loadRandomInstrument()
					// speak("Loading random instruments",true)	
				}
				//console.log("Key pressed", {event,isNumber} )
		}

		// Check to see if it is a number
		if (isNumber)
		{
			numberSequence += event.key
			// now check to see if it is 3 numbers long
			if (numberSequence.length === 3)
			{
				// reset
				numberSequence = ''
			}

		}else{

			numberSequence = ''
		}

		keysPressed.set( event.key, value )
		callback( commandType, event.key, value )
		// console.log("key", ui, event)
	}, { signal: abortController.signal })

	// depress notes held
	window.addEventListener('keyup', async (event)=>{

		// if ( event.key !== 'Tab' ){
		// 	event.preventDefault()
		// }

		if (keyboardMap.has(event.key))
		{
			// note was pressed, so send note off
			const noteNumber = keysPressed.get(event.key)
			//console.log("Key up", Commands.NOTE_OFF, event.key, noteNumber )
			keysPressed.delete(event.key)
			callback( Commands.NOTE_OFF, event.key, noteNumber, event )
		}else{
			console.log("Key up but no key down found", event.key, keyboardMap )
		}

	}, { signal: abortController.signal })

	// send out cancel event listening
	return quit
}




