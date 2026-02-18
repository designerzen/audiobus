export interface IAudioOutput{
	get uuid(): string
	get name():string
	get description():string
	get isConnected():boolean
	get isHidden():boolean
	
	// TODO: implement pitchBend etc
	noteOn(note: number, velocity: number): void
	noteOff(note: number): void
	allNotesOff(): void

	// optional
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
