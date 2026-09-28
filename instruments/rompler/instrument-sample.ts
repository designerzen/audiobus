import { convertNoteNameToMIDINoteNumber } from "../../conversion/name-to-number.ts"
import { loadInstrumentFromSoundFont } from "./fetch-audio-data.js"
import { noteNumberToName } from "../../conversion/note-to-name.ts"

import type { IAudioOutput } from "../../io/outputs/output-interface.ts"
import type { SampleInstrumentOptions, ProgressCallback } from "./types.ts"
// Maximum simultaneous tracks to play (will wait for slot)
const MAX_TRACKS = 64 * 4 // AKA 4 bars

export const INSTRUMENT_TYPE_SAMPLE = "SamplePlayerInstrument"

export default class SampleInstrument implements IAudioOutput {

	static ID: number = 0

	static get name(): string {
		return INSTRUMENT_TYPE_SAMPLE
	}

	#title = "Sample Player"
	#id = "SampleInstrument"
	#uuid = this.#id + "-" + (SampleInstrument.ID++)

	readonly type = "sample"
		
	audioContext: AudioContext
	gainNode: GainNode

	// Instrument is an Object where A0:"sampleAudioBuffer" 
	audioBuffers: Record<string, AudioBuffer> = {}
	
	instrumentName: string = "Unloaded"
	instrumentTitle: string = "Unloaded"
	instrumentFamily: string = "Unknown"
	instrumentPack: string = 'Not Loaded'

	// do not edit:

	// flag to determine whether this instrument is currently loading
	instrumentLoading: boolean = true
	available: boolean = false

	// these are the file names and locations of each instrument
	instrumentTitles: string[] = []
	instrumentNames: string[] = []
	instrumentFolders: string[] = []

	// position within the above of the current instrument
	presetIndex: number = 0

	pitchBendValue: number = 1
	currentVolume: number = 1
	
	// which samples are currently ongoing
	activeSamples: Map<number, any> = new Map()

	// Cache for active instrument
	private activeInstrument: any = null

	get pitchOffset(): number {
		return this.pitchBendValue
	}

	get isLoading(): boolean {
		return this.instrumentLoading
	}
	
	set volume(value: number) {
		this.gainNode.gain.value = value
		this.currentVolume = value
	}

	// always specify the output node
	get audioNode(): AudioNode {
		return this.gainNode
	}

	get activePreset(){
		return this.instrumentName
	}

	get activePresetIndex(): number {
		return this.presetIndex
	}

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return INSTRUMENT_TYPE_SAMPLE
	}

	get description(): string {
		return "Monophonic rompler soundfont"
	}

	get isConnected(): boolean {
		return true
	}

	get isHidden(): boolean {
		return false
	}

	constructor(audioContext: AudioContext, options: SampleInstrumentOptions = {}) {
		this.audioContext = audioContext
		this.gainNode = audioContext.createGain()
		this.gainNode.gain.value = this.currentVolume
	}

	async create(): Promise<void> {
		this.gainNode = this.audioContext.createGain()
		this.gainNode.gain.value = this.currentVolume
	}

	async destroy(): Promise<void> {
		this.gainNode.disconnect()
		this.activeSamples.clear()
	}

	allNotesOff(): void {
		throw new Error("Method not implemented.")
	}
	connect?(): Promise<void | Function> | Function {
		throw new Error("Method not implemented.")
	}
	disconnect?(): Promise<void | Function> | Function {
		throw new Error("Method not implemented.")
	}
	createGui?(): Promise<HTMLElement> {
		throw new Error("Method not implemented.")
	}
	destroyGui?(): Promise<void> {
		throw new Error("Method not implemented.")
	}
	hasMidiOutput?(): boolean {
		throw new Error("Method not implemented.")
	}
	hasAudioOutput?(): boolean {
		throw new Error("Method not implemented.")
	}
	hasAutomationOutput?(): boolean {
		throw new Error("Method not implemented.")
	}
	hasMpeOutput?(): boolean {
		throw new Error("Method not implemented.")
	}
	hasOscOutput?(): boolean {
		throw new Error("Method not implemented.")
	}
	hasSysexOutput?(): boolean {
		throw new Error("Method not implemented.")
	}

	// Actually make a sound with this sample
	async play(audioBuffer:AudioBuffer, velocity:number){

		// too many simultaneous samples
		if (this.polyphony + 1 >= MAX_TRACKS)
		{
			// console.log("Sample skipped due to max tracks reached", this.polyphony )
			return
		}
		
		const simultaneousId = ++this.polyphony
		// TODO: Send out pitch bend?
		// if (this.active)
		// {
		// 	//console.log("Sample overwriting playback.", noteName )
		// }

		this.active = true
		this.volume = velocity
		
		//console.error( "PLAYING NOW!" , {audioBuffer}, this.polyphony, this.gainNode )

		// FIXME: Add to active so we can remove it later
		const track = playTrack( this.audioContext, audioBuffer, 0, this.gainNode, { playbackRate: this.pitchBendValue }, ()=>{
			this.activeSamples.delete( simultaneousId )
			// console.info(this.polyphony, this.activeSamples.size, "this.activeSamples REMOVE", this.activeSamples)
			--this.polyphony
			
			if (this.polyphony < 1) {
				this.active = false
			}
		
			// console.log("Sample completed playback.", this.polyphony )
			return true
		} )
		// .then( ()=>{})
		// console.info(this.polyphony, this.activeSamples.size, "this.activeSamples ADD", this.activeSamples)
		
		this.activeSamples.set( simultaneousId, track )
			
		return track
	}

	/**
	 * Like note on but using names!
	 * 
	 * @param {String} noteName 
	 * @param {Number} velocity 
	 * @returns 
	 */
	async noteOnByName(noteName:string, velocity:number=1 ){
		// const audioBuffer = this.instrument[noteName]
		// audioBuffer && this.play(audioBuffer, velocity)
		return this.noteOn( convertNoteNameToMIDINoteNumber(noteName), velocity)
	}

	async noteOn(noteNumber:string, velocity:number=1){
		const key = noteNumberToName(noteNumber)
		const audioBuffer = this.audioBuffers[key]
		if(audioBuffer)
		{
			const track = this.play(audioBuffer, velocity )
		}else{
			// STILL LOADING THIS BUFFER... What to do?
			console.log("No buffer for", {noteNumber, velocity, key} , this.audioBuffers )
		}
		// console.log("Buffer playing", {audioBuffer,noteNumber, velocity} )
		return super.noteOn(noteNumber, velocity)
	}

	async noteOff(noteNumber: number, velocity: number = 0): Promise<any> {
		this.volume = velocity
		return this.stopNote(noteNumber)
	}

	async pitchBend(pitch: number): Promise<any> {
		this.pitchBendValue = pitch
		this.activeSamples.forEach((sample) => {
			sample.playbackRate.value = pitch
		})
		return pitch
	}

	async programChange(programNumber: number): Promise<any> {
		// Load preset based on program number
		if (programNumber >= 0 && programNumber < 128) {
			this.presetIndex = programNumber
		}
		return programNumber
	}
	
	/**
	 * 
	 * @returns {Array<String>} of Instrument Names
	 */
	async getPresets(){
		return this.instrumentTitles
	}

	
	/**
	 * Pass in an AudioCommand to perform a function...

	async doCommand( command ){
		
	}
	 */
	// INTERNAL -------------------------------------------
	
	/**
	 * Provide this Person with a random instrument
	 * @param {Function} progressCallback Method to call once the instrument has loadedNAMES
	 */
	 async loadRandomPreset(progressCallback){
		// grab an instrument randomly from the full collection
		const newIndex = Math.round( Math.random() * this.instrumentFolders.length )
		this.presetIndex = newIndex
		return await this.loadPreset( this.instrumentFolders[newIndex], this.instrumentPack, progressCallback )
	}

	/**
	 * Load the previous instrument in the list
	 * @param {Function} progressCallback Method to call once the instrument has loaded
	 */
	async loadPreviousPreset(progressCallback){
		const index = this.presetIndex-1
		const newIndex = index < 0 ? this.instrumentFolders.length + index : index
		this.presetIndex = newIndex
		return await this.loadPreset( this.instrumentFolders[newIndex], this.instrumentPack, progressCallback )
	}

	/**
	 * Load the subsequent instrument in the list
	 * NB. Does NOT wrap around
	 * @param {Function} progressCallback Method to call once the instrument has loaded
	 */
	async loadNextPreset(progressCallback){
		const index = this.presetIndex+1 
		const newIndex = index >= this.instrumentFolders.length ? 0 : index
		this.presetIndex = newIndex
		return await this.loadPreset( this.instrumentFolders[newIndex], this.instrumentPack, progressCallback )
	}

	/**
	 * Reload ALL instruments for this user
	 * NB. If we have swapped the instrument pack we can use this method
	 * to reload the same instrument but with the new samples
	 * @param {Function} callback Method to call once the instrument has loaded
	 */
	async reload(progressCallback){
		return await this.loadPreset( this.instrumentFolders[this.presetIndex], this.instrumentPack, progressCallback )
	}

	/**
	 * Changes all instuments to new pack
	 * @param {String} instrumentPack 
	 * @param {Function} onProgress 
	 */
	async loadPack(instrumentPack, onProgress){
		this.instrumentPack = instrumentPack
		return await this.reload(onProgress)
	}

	/**
	 * Load a specific instrument "patch" for this AudioNode
	 * TODO: Add loading events
	 * @param {String} instrumentName Name of the standard instrument to load
	 * @param {String} instrumentPack Name of the standard instrument to load
	 * @param {Function} callback Method to call once the instrument has loaded
	 */
	 async loadPreset(instrumentName, instrumentPack, progressCallback ){
		
		const index = this.instrumentFolders.indexOf(instrumentName)
		
		if (index  === -1)
		{
			throw Error( `No Preset found with name "${instrumentName}" in pack "${instrumentPack}" with ${ this.instrumentFolders.length} presets available` )
		}

		// check to see if the pack name is valid...
		this.instrumentLoading = true

		try{
			// FIXME: Send the -mp3 version...
			this.activeInstrument = await loadInstrumentFromSoundFont( this.audioContext, instrumentName, "./assets/audio/" + instrumentPack, progressCallback )
		
		}catch(error){

			if (instrumentPack.indexOf(".json") > -1)
			{
				this.instrumentLoading = false
				throw Error("You tried to load a soundfont with a descriptor uri! "+instrumentPack)
			}	
		}
		// Fetch the GM name
		this.#title = this.instrumentTitles[index]
		
		this.presetIndex = index ?? 0
		this.instrumentName = instrumentName
		this.instrumentPack = instrumentPack
		this.instrumentTitle = this.#title
		
		//this.name = "SampleInstrument"
		this.instrumentFamily = this.activeInstrument.family

		// this.instrumentMap = {}
		// TODO: inside out object
		// convert the instrument map into a number map
		// for (let i=0; i < 200; ++i){
		// 	this.instrumentMap[i] = this.instrument
		// }
		
		this.instrumentLoading = false

		// this.instrumentOrder = this.instrument
		return this.activeInstrument
	}

	clone(){
		return new SampleInstrument(this.audioContext, this.options)
	}
}