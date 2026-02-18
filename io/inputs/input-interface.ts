
export interface IAudioInput{
	get uuid(): string
	get name():string
	get description():string
	get isConnected():boolean
	get isHidden?():boolean
	
	// optional
	connect?():Promise<Function>|Function
	disconnect?():Promise<void>|Function
	createGui?():Promise<HTMLElement>
	destroyGui?():Promise<void>

	// From the WAM spec
	hasAudioInput?():boolean
	hasMidiInput?():boolean
	hasAutomationInput?():boolean
	hasMpeInput?():boolean
	hasOscInput?():boolean
	hasSysexInput?():boolean
}
/**
 * 
 * name: the WAM's name.
vendor: the WAM vendor's name.
version: current version (string).
sdkVersion: the WAM SDK (API) version used.
thumbnail: a URL containing an image for the WAM's thumbnail.
keywords: an array of keyword strings.
isInstrument: boolean, true if the WAM is a MIDI instrument.
website: a URL of the WAM's development website.

 */
