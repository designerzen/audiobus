/**
 * Let's you load in soundfonts in the sf2 format from around the world
 * and if not available we can fall back to other packs located in other
 * origins
 */
import SampleInstrument from "./instrument-sample"

import {
	INSTRUMENT_DATA_PACKS, 
	INSTRUMENT_PACKS, 
	getGeneralMIDIInstrumentNames,
	getGeneralMIDIInstrumentFolders,
	createInstruments,
	getRandomInstrument,
	getInstrumentTitle
} from './sound-font-instruments'

import SoundFont from "./sound-font"
import { IAudioOutput } from "../../io/outputs/output-interface"
import { noteNumberToName } from "../../conversion/note-to-name"
// import { convertMIDINoteNumberToName } from "../tuning/notes"

// these are the file names and locations of each instrument
const GM_INSTRUMENT_NAMES = getGeneralMIDIInstrumentNames()
const GM_INSTRUMENT_FOLDERS = getGeneralMIDIInstrumentFolders()

// If not specified in the constructor, the following options
// will be used. To load a preset from a specified pack you
// must provide both
const DEFAULT_OPTIONS = {
	// specify the location as part of the pack...
	instrumentPack:INSTRUMENT_PACKS[0],
	// preset to load on construction
	preset:GM_INSTRUMENT_NAMES[0],
	offlineAudioContext:null,
	// use a background thread to load / decode the data where possible
	useWorkers:false,
	// load the initial as a string
	asString:true
}

export const INSTRUMENT_TYPE_SOUNDFONT = "SoundFontInstrument"

export default class SoundFontInstrument extends SampleInstrument implements IAudioOutput{

	static get name(){
		return INSTRUMENT_TYPE_SOUNDFONT
	}

	// create a super object containing paths and families ands such!
	static dictionary = createInstruments() 

	
	#title = "SoundFont Sample Player"
	
	readonly type = "sample"
			
	soundfont
	
	// these are the file names and locations of each instrument
	instrumentTitles = GM_INSTRUMENT_NAMES
	instrumentFolders = GM_INSTRUMENT_FOLDERS

	override get name(): string {
		return INSTRUMENT_TYPE_SOUNDFONT
	}

	/**
	 * This loads in a preset immediately if one is specified
	 * 
	 * @param {AudioContext} audioContext 
	 * @param {Object} options - see DEFAULT_OPTIONS
	 */
	constructor( audioContext:AudioContext, options={} ){

		super(audioContext, {...DEFAULT_OPTIONS, ...options})

		// console.error( "zen look here", DEFAULT_OPTIONS, options)

		this.available = false

		// if we have a preset number, set it
		if (!isNaN(options.defaultPreset))
		{
			this.presetIndex = options.defaultPreset
		}else if (typeof options.defaultPreset === "string"){
			this.presetIndex = this.getIndexFromName( options.defaultPreset)
		}

		// use the provided soundfont class or else create a new instance
		// and set it with the offlineAudioCoontext if set as an option,
		// otherwise load the 
		this.soundfont = options.packData ?? new SoundFont( audioContext, options.offlineAudioContext )

		
		// attempt to load "pack" provided - this can come in various forms
		// see below in loadFont for the various options
		if (this.options.instrumentPack)
		{
			// you can use an offline context too...	
			// as this is an immediate load, we can use the JS rather than MP3s...
			this.loadFont( this.options.instrumentPack, this.options ).then((font)=>{

				if (this.options.preload)
				{
					// now load our first preset or a specified one...
					this.loadPreset( this.options.preset ?? 0, this.options.instrumentPack ).then( preset => {
						// console.error("preset", preset )
					})	
				}

				// console.error("soundfont", this, font )
			
			}).catch( error => {

				console.error("loadFont", error)
			})

		}else{

			console.error("no pack or preset provided")
		}
	}

	/**
	 * Try and determine the index of the preset within the range
	 * @param {String} presetName 
	 * @returns 
	 */
	getIndexFromName(presetName){

		// already a number
		if (!isNaN(presetName))
		{
			return presetName
		}

		let index = this.instrumentFolders.indexOf(presetName)
		if (index > -1)
		{
			return index
		}
		
		index = this.instrumentTitles.indexOf(presetName)
		if (index > -1)
		{
			return index
		}
		const data = this.soundfont.getInstrumentData(presetName)
		if (data)
		{
			index = this.instrumentFolders.indexOf( data.folder)
			
			return index
		}
		
		return -1
	}
	
	// to load a new sample we can also use the midi methods...
	async programChange( programNumber ){
		this.presetIndex = this.getIndexFromName(programNumber)
		return await super.programChange( programNumber )	
	}

	/**
	 * 
	 * @param {Number} noteNumber 
	 * @param {Number} velocity 
	 * @returns 
	 */
	async noteOn(noteNumber:number, velocity=1){
		const index = noteNumberToName(noteNumber)
		const audioBuffer = this.audioBuffers[index]
		if(audioBuffer)
		{
			const track = this.play(audioBuffer, velocity)
		}
		// console.log("Buffer playing", {index, audioBuffer,noteNumber, velocity},  this.instrument  )
		return super.noteOn(noteNumber, velocity)
	}

	// FIXME: Fade out the gate
	// async noteOff(noteNumber, velocity=0){
	// 	this.volume = velocity
	// 	return super.noteOff(noteNumber)
	// }

	/**
	 * Load in a file that describes this sound font and set the instrument
	 * to lazily load instruments from this pack and location as they are requested
	 * in the future
	 * 
	 * @param {String} pack 
	 * @param {Function} onProgress 
	 * @returns 
	 */
	async loadFont( pack, options={}, onProgress=null ){

		let descriptorURI = ""
	
		onProgress && onProgress(0)

		// FIXME: integrate the soundfont
		// if ( pack.indexOf(".js") === pack.length - 3 )
		// {
			
		// 	options.asString = true
		// 	descriptorURI = pack
		// 	console.error("found JS pack.. loading as string")


		// }else
		
		if (pack.indexOf(".json") === -1)
		{
			// pack is either by name?
			const index = INSTRUMENT_PACKS.indexOf(pack)
			if (index > -1)
			{
				this.instrumentPack = INSTRUMENT_PACKS[index]
				descriptorURI = INSTRUMENT_DATA_PACKS[index]
			}else{

				throw Error("loadFont failed. Expected a data source but couldn't find one", pack )
			}
			
		}else{

			const indexOfPack = INSTRUMENT_DATA_PACKS.indexOf(pack)

			if (indexOfPack > -1)
			{
				// pack is a JSON file that can be loaded in to provide the instrument names
				// from a dedicated location

				// determine the pack name from the JSON file
				this.instrumentPack = INSTRUMENT_PACKS[ indexOfPack ]
				
				// and assune that the pack is a full URi
				descriptorURI = pack
			}else{
				// pack provided with pack name and URL?
				this.instrumentPack = pack
			}
		}

		// console.log("loading font",this.instrumentPack, this, arguments )
		// soundfont automatically reloads so we do not need to re-request it		
		// const font = await loadInstrumentDataPack( descriptorURI )
		
		// load selected instrument

		// const reload = await this.loadPack( this.instrumentPack, onProgress  )
		
		// This should really come in from the options
		const fontDescriptor = {
			descriptor: this.instrumentPack, 
			descriptorPath:'./assets/audio/',
			preset:this.presetIndex 
		}

		// load in a sound font - this can be either a fully qualified url
		// a relative uri or the name of the pack
		// const fontData = await this.soundfont.loadFont( this.instrumentPack, './audio/', p => onProgress && onProgress( p / 2 ) )
		// console.time("loadSoundFontFont", options)	
		const fontData = await this.soundfont.load( fontDescriptor, p => onProgress && onProgress( p / 2 ) )
		// console.endTime("loadFont")	

		// fetch the available presets from the instrument...
		const availablePresets = this.soundfont.presets
		// const availablePresets = await this.soundfont.presetTitles

	
		// FIXME:
		// find associated instrument - for GM these should be the same
		// but there may be descrepencies for
		const currentPreset = availablePresets[ this.presetIndex ]
		
		// console.error("Found font", { availablePresets })
		// console.info("Found font", { fontDescriptor, fontData, availablePresets })		
		// console.info("Found availablePreset", {availablePresets, currentPreset} )

		//await this.soundfont.loadPreset( availablePresets[0], packName, p => console.log(p) )
		// await this.loadPreset( currentPreset, pack, options, p => onProgress && onProgress( 0.5 + p / 2 ) )

		onProgress && onProgress(1)

		return fontData
	}


	

	/**
	 * Load a specific instrument "patch" for this AudioNode
	 * TODO: Add loading events
	 * @param {String|Object} presetNameOrObject Name of the standard instrument to load
	 * @param {String} instrumentPack Name of the standard instrument to load
	 * @param {Function} options Settings & config
	 * @param {Function} progressCallback Method to call once the instrument has loaded
	 */
	async loadPreset(presetNameOrObject, instrumentPack, options={}, progressCallback=()=>{} ){
	
		// convert the object into a preset folder string name
		if (typeof presetNameOrObject === "object")
		{
			presetNameOrObject = presetNameOrObject.folder
		}

		if (!instrumentPack)
		{
			throw Error("No instrumentPack name was provided")
		}	

		// this might be a number...
		if (typeof programNumber === "string" && isNaN(programNumber))
  		{
			// if it is a string then we need to find the index
			presetNameOrObject = this.instrumentFolders.indexOf(programNumber)
		}
	
		// const index = this.getIndexFromName(presetName)
		
		// if (index  === -1)
		// {
		// 	console.error("Couldn't find matching preset name", {presetName, instrumentPack}, this.instrumentFolders, this.soundfont )
		// 	throw Error( `No Preset found with name "${presetName}" in pack "${instrumentPack}" (${this.soundfont.quantity})` )
		// }
	
		// check to see if the pack name is valid...
		this.instrumentLoading = true
		
		try{

			options = {				// URI of the sound font
				soundfont : instrumentPack,
				// try and use a seperate thread for loading and decoding the data
				usingWorker : false,
				// load as a single string and convert to individual files
				loadAsOne : false,
				...options
			}
			
			// we load the audio buffers from the soundfont
			// in the { A4:AudioBuffer} format without waiting for the laod to complete
			//await 

			// cancel loading any that are already loading...
			this.soundfont.cancelLoading()

			this.soundfont.loadPresetGradually( this.audioBuffers, presetNameOrObject, options, progressCallback )
			
			// this.audioBuffers = await this.soundfont.loadPreset( presetNameOrObject, { ...options }, progressCallback )

			// FIXME: Send the -mp3 version...
			//this.instrument = await loadInstrumentFromSoundFont( this.context, instrumentName, instrumentPack, progressCallback )
		
		}catch(error){

			if (!instrumentPack)
			{
				this.instrumentLoading = false
				throw Error("No instrumentPack name was provided")
			}	

			if (instrumentPack.indexOf(".json") > -1)
			{
				this.instrumentLoading = false
				throw Error("You tried to load a soundfont with a descriptor uri! "+instrumentPack)
			}	
			throw Error("Soundfont could not load "+error)
		}
		
		// FIXME: set the default instrument index if saved
		this.instrumentName = presetNameOrObject
		this.instrumentPack = instrumentPack
		this.instrumentFamily = this.audioBuffers.family

		// Fetch the GM name
		this.title = getInstrumentTitle( presetNameOrObject ) ?? presetNameOrObject
		// this.name = "SampleInstrument:"+presetNameOrObject

		// console.error("Soundfont", this, this.instrumentName, this.instrumentPack, this.instrumentFamily, {presetNameOrObject, instrumentPack, options} )

		
		// console.info("Soundfont preset", SoundFontInstrument.dictionary)

		// this.instrumentMap = {}
		// TODO: inside out object
		// convert the instrument map into a number map
		// for (let i=0; i < 200; ++i){
		// 	this.instrumentMap[i] = this.instrument
		// }
		
		this.instrumentLoading = false
		this.available = true
		return this.audioBuffers
	}

	/**
	 * Provide this Person with a random instrument
	 * @param {Function} progressCallback Method to call during load and once the instrument has loaded
	 */
	async loadRandomPreset(progressCallback){
		return await this.loadPreset( getRandomInstrument(), this.instrumentPack, {}, progressCallback )
	}
	
	clone(){
		return new SoundFontInstrument(this.audioContext, this.options)
	}
}
