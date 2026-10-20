import type { IAudioCommand } from '../../audio-command-interface.ts'
import type { AudioClockTick } from '../../timing/audio-clock-tick.ts'

export interface IAudioOutput{
	get uuid(): string
	get name():string
	get description():string
	get isConnected():boolean
	get isHidden():boolean
	
	// TODO: implement pitchBend etc
	noteOn(noteNumber: number, velocity: number): void | Promise<void>
	noteOff(noteNumber: number): void
	allNotesOff(): void

	// Full MIDI commands retain channel, controller, pressure, and system data.
	sendCommand?(command: IAudioCommand): void | Promise<void>
	getNoteKey?(command: IAudioCommand): string
	/** Set false when control changes preserve the identity of held notes. */
	readonly configurationAffectsNoteRouting?: boolean
	onClockTick?(tick: Readonly<AudioClockTick>): void
	stopClock?(): void

	// optional
	readonly requiresConnectionControl?: boolean
	readonly output?: AudioNode
	connect?():Promise<void|Function>|Function
	disconnect?():Promise<void|Function>|Function
	createGui?():Promise<HTMLElement>
	destroyGui?():Promise<void>

	hasMidiOutput?(): boolean
	hasAudioOutput?(): boolean
	hasAutomationOutput?(): boolean
	hasMpeOutput?(): boolean
	hasOscOutput?(): boolean
	hasSysexOutput?(): boolean
}
