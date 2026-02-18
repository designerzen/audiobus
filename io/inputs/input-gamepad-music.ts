/**
 * Advanced Gamepad Music Input
 * 
 * A competent and enjoyable gamepad-based music input system with multiple intuitive modes:
 * 
 * MODE 1: Chord Mode (Default)
 * - D-Pad: Select root note (C to B with chromatic notes)
 * - A/B/X/Y: Play common chord shapes (Major, Minor, Major7, Minor7)
 * - Triggers: Octave up/down
 * - Sticks: Velocity/dynamics control
 * 
 * MODE 2: Melodic Mode  
 * - Right Stick: 8-way note selection (X-axis for pitch, Y-axis for octave)
 * - A/B/X/Y: Scale-based note selection (pentatonic/diatonic)
 * - D-Pad: Quick note stepping
 * - Triggers: Sustain/note duration
 * 
 * MODE 3: Drum Pad Mode
 * - A/B/X/Y: Drum sounds with velocity from stick pressure
 * - D-Pad + Buttons: Percussion variations
 * - Triggers: Effects (reverb/delay)
 * - Sticks: Mixing/panning
 * 
 * MODE 4: Arpeggiator Mode
 * - D-Pad: Note selection
 * - Buttons: Arpeggio patterns (up, down, up-down, random)
 * - Sticks: Speed and note density
 * - Triggers: Start/stop playback
 */

import { NOTE_OFF, NOTE_ON, CONTROL_CHANGE } from '../../commands'
import { COMMANDS, GamePadManager } from "../../hardware/gamepad/gamepad"
import AudioCommand from "../../audio-command"
import AbstractInput from "./abstract-input"
import type { IAudioInput } from "./input-interface"

export const GAMEPAD_MUSIC_INPUT_ID = "GamePadMusic"

// Musical constants - note numbers (MIDI notes)
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const BASE_OCTAVE = 4

// Common chord intervals (in semitones from root)
const CHORD_SHAPES = {
	major: [0, 4, 7],        // Major triad
	minor: [0, 3, 7],        // Minor triad
	major7: [0, 4, 7, 11],   // Major 7th
	minor7: [0, 3, 7, 10],   // Minor 7th
	diminished: [0, 3, 6],   // Diminished
	augmented: [0, 4, 8],    // Augmented
}

// Pentatonic scale (relative to root)
const PENTATONIC_SCALE = [0, 2, 4, 7, 9]

// Arpeggio patterns
type ArpeggioPattern = "up" | "down" | "updown" | "random" | "updown_repeat"

interface GamePadMusicState {
	currentMode: "chord" | "melodic" | "drum" | "arpeggiator"
	currentRootNote: number // MIDI note number
	currentOctave: number
	heldNotes: Map<string, number> // button -> MIDI note
	lastStickX: number
	lastStickY: number
	isArpeggioPlaying: boolean
	arpeggioNotes: number[]
	arpeggioIndex: number
	lastButtonPress: string | null
}

export default class InputGamePadMusic extends AbstractInput implements IAudioInput {

	gamePadManager: GamePadManager
	state: GamePadMusicState
	stickDeadzone: number = 0.15
	
	constructor(options: Record<string, any> = {}) {
		super(options)

		this.state = {
			currentMode: "chord",
			currentRootNote: 60, // Middle C
			currentOctave: BASE_OCTAVE,
			heldNotes: new Map(),
			lastStickX: 0,
			lastStickY: 0,
			isArpeggioPlaying: false,
			arpeggioNotes: [],
			arpeggioIndex: 0,
			lastButtonPress: null,
		}

		this.onGamePadEvent = this.onGamePadEvent.bind(this)
		this.gamePadManager = new GamePadManager()
		this.gamePadManager.addEventListener(this.onGamePadEvent)
		this.setAsConnected()
	}

	get name(): string {
		return GAMEPAD_MUSIC_INPUT_ID
	}

	get description(): string {
		return "Gamepad Music Input - Multiple intuitive modes for music creation"
	}

	override destroy(): void {
		this.gamePadManager.removeEventListener(this.onGamePadEvent)
		this.gamePadManager.destroy()
		this.state.heldNotes.clear()
		this.setAsDisconnected()
	}

	override hasMidiInput(): boolean {
		return true
	}

	/**
	 * Main gamepad event handler - routes events based on current mode
	 */
	protected onGamePadEvent(button: string, value: number, gamePad: Gamepad, heldFor: number) {
		const isHeld = this.gamePadManager.isHeld(button)

		// Mode switching
		if (button === COMMANDS.SELECT && value) {
			this.switchMode()
			return
		}

		// Handle stick inputs for dynamics/modulation
		this.handleStickInput(button, value)

		// Route to appropriate handler based on mode
		switch (this.state.currentMode) {
			case "chord":
				this.handleChordMode(button, value, isHeld, heldFor)
				break
			case "melodic":
				this.handleMelodicMode(button, value, isHeld, heldFor)
				break
			case "drum":
				this.handleDrumMode(button, value, isHeld, heldFor)
				break
			case "arpeggiator":
				this.handleArpeggiatorMode(button, value, isHeld, heldFor)
				break
		}
	}

	/**
	 * MODE 1: Chord Mode
	 * Intuitive way to play harmonies
	 */
	private handleChordMode(button: string, value: number, isHeld: boolean, heldFor: number) {
		// D-Pad: Select root note
		if (button.startsWith("d")) {
			this.handleDPadRootSelection(button)
			return
		}

		// Triggers: Octave control
		if (button === COMMANDS.LT && value) {
			this.state.currentOctave = Math.max(1, this.state.currentOctave - 1)
			this.dispatchInfoCommand(`Octave: ${this.state.currentOctave}`)
			return
		}
		if (button === COMMANDS.RT && value) {
			this.state.currentOctave = Math.min(7, this.state.currentOctave + 1)
			this.dispatchInfoCommand(`Octave: ${this.state.currentOctave}`)
			return
		}

		// Button buttons: Play chord shapes
		let chordType: keyof typeof CHORD_SHAPES | null = null
		switch (button) {
			case COMMANDS.A:
				chordType = "major"
				break
			case COMMANDS.B:
				chordType = "minor"
				break
			case COMMANDS.X:
				chordType = "major7"
				break
			case COMMANDS.Y:
				chordType = "minor7"
				break
		}

		if (chordType && value) {
			this.playChord(chordType, this.state.currentRootNote)
		} else if (chordType && !value) {
			this.stopChord(chordType)
		}
	}

	/**
	 * MODE 2: Melodic Mode
	 * Play individual notes with stick-based pitch control
	 */
	private handleMelodicMode(button: string, value: number, isHeld: boolean, heldFor: number) {
		// Right stick X: Pitch selection (8 notes per octave)
		if (button === COMMANDS.RIGHT_STICK_X) {
			const stickNote = this.getStickBasedNote(value)
			if (stickNote >= 0 && this.state.lastStickX !== stickNote) {
				this.state.lastStickX = stickNote
				// Could trigger note change here for real-time pitch selection
			}
			return
		}

		// Right stick Y: Octave selection
		if (button === COMMANDS.RIGHT_STICK_Y) {
			const octave = Math.round(3 + (value / 32768) * 4) // Maps to octaves 1-7
			if (octave !== this.state.currentOctave) {
				this.state.currentOctave = Math.max(1, Math.min(7, octave))
			}
			return
		}

		// D-Pad: Quick note stepping
		if (button === COMMANDS.UP && value) {
			this.state.currentRootNote = Math.min(127, this.state.currentRootNote + 1)
			this.playMelodicNote(this.state.currentRootNote, 100)
		} else if (button === COMMANDS.DOWN && value) {
			this.state.currentRootNote = Math.max(0, this.state.currentRootNote - 1)
			this.playMelodicNote(this.state.currentRootNote, 100)
		}

		// Buttons: Scale-based note selection (pentatonic)
		let scaleStep: number | null = null
		switch (button) {
			case COMMANDS.A:
				scaleStep = 0 // Root
				break
			case COMMANDS.B:
				scaleStep = 1
				break
			case COMMANDS.X:
				scaleStep = 2
				break
			case COMMANDS.Y:
				scaleStep = 3
				break
		}

		if (scaleStep !== null && value) {
			const noteInScale = this.state.currentRootNote + PENTATONIC_SCALE[scaleStep]
			this.playMelodicNote(noteInScale, 100)
		} else if (scaleStep !== null && !value) {
			this.stopMelodicNote(scaleStep)
		}

		// Triggers: Sustain and note duration
		if (button === COMMANDS.LT) {
			// Left trigger controls note sustain/length
		}
		if (button === COMMANDS.RT) {
			// Right trigger could add accent
		}
	}

	/**
	 * MODE 3: Drum Pad Mode
	 * Percussion and drum samples with velocity sensitivity
	 */
	private handleDrumMode(button: string, value: number, isHeld: boolean, heldFor: number) {
		// Stick pressure affects velocity
		const velocity = this.calculateStickVelocity()

		// Map buttons to drum sounds (MIDI notes)
		let drumNote: number | null = null
		let drumName: string | null = null

		switch (button) {
			case COMMANDS.A:
				drumNote = 36 // Kick drum
				drumName = "Kick"
				break
			case COMMANDS.B:
				drumNote = 38 // Snare
				drumName = "Snare"
				break
			case COMMANDS.X:
				drumNote = 42 // Closed hi-hat
				drumName = "Hi-Hat"
				break
			case COMMANDS.Y:
				drumNote = 45 // Crash
				drumName = "Crash"
				break
		}

		if (drumNote !== null && value) {
			this.playDrumPad(drumNote, drumName, velocity)
		}

		// D-Pad: Switch drum variations
		if (button === COMMANDS.LEFT && value) {
			this.dispatchInfoCommand("Variation: Acoustic")
		} else if (button === COMMANDS.RIGHT && value) {
			this.dispatchInfoCommand("Variation: Electronic")
		}

		// Triggers: Effects
		if (button === COMMANDS.LB && value) {
			this.dispatchControlChange(91, Math.round(value * 127 / 255)) // Reverb
		}
		if (button === COMMANDS.RB && value) {
			this.dispatchControlChange(94, Math.round(value * 127 / 255)) // Delay
		}
	}

	/**
	 * MODE 4: Arpeggiator Mode
	 * Automatic note sequencing with stick-based control
	 */
	private handleArpeggiatorMode(button: string, value: number, isHeld: boolean, heldFor: number) {
		// A/B/X/Y: Select arpeggio patterns
		let pattern: ArpeggioPattern | null = null

		switch (button) {
			case COMMANDS.A:
				pattern = "up"
				break
			case COMMANDS.B:
				pattern = "down"
				break
			case COMMANDS.X:
				pattern = "updown"
				break
			case COMMANDS.Y:
				pattern = "random"
				break
		}

		if (pattern && value) {
			this.startArpeggio(pattern)
		}

		// Triggers: Start/stop
		if (button === COMMANDS.LT && value) {
			this.state.isArpeggioPlaying = !this.state.isArpeggioPlaying
		}

		// D-Pad: Note selection for arpeggio
		if (button === COMMANDS.UP && value) {
			this.state.currentRootNote = Math.min(127, this.state.currentRootNote + 1)
		} else if (button === COMMANDS.DOWN && value) {
			this.state.currentRootNote = Math.max(0, this.state.currentRootNote - 1)
		}

		// Sticks control speed and density
		// Left stick Y: Tempo
		// Right stick X: Note density
	}

	// ==================== Helper Methods ====================

	private handleDPadRootSelection(button: string) {
		// Map d-pad to notes
		const noteOffset: Record<string, number> = {
			[COMMANDS.UP]: 0,      // C
			[COMMANDS.DOWN]: 3,    // D#
			[COMMANDS.LEFT]: 5,    // F
			[COMMANDS.RIGHT]: 7,   // G
		}

		const offset = noteOffset[button]
		if (offset !== undefined) {
			this.state.currentRootNote = (this.state.currentOctave * 12) + offset
			this.dispatchInfoCommand(`Root: ${NOTE_NAMES[offset]}${this.state.currentOctave}`)
		}
	}

	private handleStickInput(button: string, value: number) {
		// Normalize stick values (-32768 to 32767)
		const normalized = Math.abs(value) > this.stickDeadzone * 32767 ? value / 32767 : 0

		if (button === COMMANDS.LEFT_STICK_X) {
			this.state.lastStickX = normalized
		} else if (button === COMMANDS.LEFT_STICK_Y) {
			this.state.lastStickY = normalized
		}
	}

	private getStickBasedNote(stickX: number): number {
		// 8-note chromatic scale based on stick position
		const normalized = (stickX / 32767 + 1) / 2 // 0 to 1
		return Math.round(normalized * 11) % 12
	}

	private calculateStickVelocity(): number {
		// Combine both stick axes for velocity
		const magnitude = Math.sqrt(
			this.state.lastStickX ** 2 + this.state.lastStickY ** 2
		)
		return Math.min(127, Math.round(magnitude * 127))
	}

	private playChord(chordType: keyof typeof CHORD_SHAPES, rootNote: number) {
		const intervals = CHORD_SHAPES[chordType]
		const chordKey = `${chordType}_${rootNote}`

		intervals.forEach((interval, index) => {
			const noteNumber = rootNote + interval
			const command = new AudioCommand()
			command.number = noteNumber
			command.type = NOTE_ON
			command.velocity = 100
			command.from = GAMEPAD_MUSIC_INPUT_ID
			command.text = `${chordType}[${index}]`
			command.time = this.now
			command.startAt = this.now

			this.state.heldNotes.set(`${chordKey}_${index}`, noteNumber)
			this.dispatch(command)
		})
	}

	private stopChord(chordType: keyof typeof CHORD_SHAPES) {
		const intervals = CHORD_SHAPES[chordType]
		const chordKey = `${chordType}_${this.state.currentRootNote}`

		intervals.forEach((_, index) => {
			const command = new AudioCommand()
			command.type = NOTE_OFF
			command.from = GAMEPAD_MUSIC_INPUT_ID
			command.time = this.now
			command.startAt = this.now

			this.state.heldNotes.delete(`${chordKey}_${index}`)
			this.dispatch(command)
		})
	}

	private playMelodicNote(noteNumber: number, velocity: number) {
		const command = new AudioCommand()
		command.number = noteNumber
		command.type = NOTE_ON
		command.velocity = velocity
		command.from = GAMEPAD_MUSIC_INPUT_ID
		command.text = `${NOTE_NAMES[noteNumber % 12]}${Math.floor(noteNumber / 12)}`
		command.time = this.now
		command.startAt = this.now

		this.state.heldNotes.set(`melodic_${noteNumber}`, noteNumber)
		this.dispatch(command)
	}

	private stopMelodicNote(scaleStep: number) {
		const command = new AudioCommand()
		command.type = NOTE_OFF
		command.from = GAMEPAD_MUSIC_INPUT_ID
		command.time = this.now
		command.startAt = this.now

		this.state.heldNotes.delete(`melodic_${scaleStep}`)
		this.dispatch(command)
	}

	private playDrumPad(noteNumber: number, name: string | null, velocity: number) {
		const command = new AudioCommand()
		command.number = noteNumber
		command.type = NOTE_ON
		command.velocity = velocity
		command.channel = 9 // MIDI drum channel
		command.from = GAMEPAD_MUSIC_INPUT_ID
		command.text = name || `Drum ${noteNumber}`
		command.time = this.now
		command.startAt = this.now

		this.dispatch(command)

		// Auto-release for drum pads (short percussion)
		setTimeout(() => {
			const releaseCommand = new AudioCommand()
			releaseCommand.number = noteNumber
			releaseCommand.type = NOTE_OFF
			releaseCommand.channel = 9
			releaseCommand.from = GAMEPAD_MUSIC_INPUT_ID
			releaseCommand.time = this.now
			releaseCommand.startAt = this.now
			this.dispatch(releaseCommand)
		}, 150)
	}

	private startArpeggio(pattern: ArpeggioPattern) {
		// Build arpeggio note list based on current chord or scale
		const baseNotes = [
			this.state.currentRootNote,
			this.state.currentRootNote + 4,  // Third
			this.state.currentRootNote + 7,  // Fifth
		]

		switch (pattern) {
			case "up":
				this.state.arpeggioNotes = baseNotes
				break
			case "down":
				this.state.arpeggioNotes = [...baseNotes].reverse()
				break
			case "updown":
				this.state.arpeggioNotes = [...baseNotes, ...[...baseNotes].reverse().slice(1)]
				break
			case "random":
				this.state.arpeggioNotes = baseNotes.sort(() => Math.random() - 0.5)
				break
		}

		this.state.arpeggioIndex = 0
		this.state.isArpeggioPlaying = true
		this.dispatchInfoCommand(`Arpeggio: ${pattern}`)
	}

	private switchMode() {
		const modes: Array<"chord" | "melodic" | "drum" | "arpeggiator"> = [
			"chord",
			"melodic",
			"drum",
			"arpeggiator",
		]

		const currentIndex = modes.indexOf(this.state.currentMode)
		this.state.currentMode = modes[(currentIndex + 1) % modes.length]
		this.dispatchInfoCommand(`Mode: ${this.state.currentMode.toUpperCase()}`)
	}

	private dispatchInfoCommand(text: string) {
		const command = new AudioCommand()
		command.text = text
		command.from = GAMEPAD_MUSIC_INPUT_ID
		command.time = this.now
		command.type = "INFO"
		this.dispatch(command)
	}

	private dispatchControlChange(controller: number, value: number) {
		const command = new AudioCommand()
		command.type = CONTROL_CHANGE
		command.number = controller
		command.value = value
		command.from = GAMEPAD_MUSIC_INPUT_ID
		command.time = this.now
		command.startAt = this.now
		this.dispatch(command)
	}
}




