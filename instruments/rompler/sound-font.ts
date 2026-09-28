/**
 * Just a model to contain all the samples for a specific font
 * The font has a number of presets that represent the patch
 * 
 * - PackName
 * - Descriptor
 * - Instrument Array
 * - Audio Buffers for EACH note for EACH instrument
 * 
 * NB. 	A descriptor does not have to be loaded but if one is
 * 		not loaded then WE USE THE DEAFULT gm FOLDER NAMES
 */
import { 
	INSTRUMENT_DATA_PACKS, INSTRUMENT_PACKS, 
	createInstruments, 
	getRandomInstrument, 
	loadInstrumentDataPack, loadInstrumentFromSoundFontStringViaWorker 
} from "./sound-font-instruments"

import { 
	GENERAL_MIDI_LIBRARY
} from '../../midi/general-midi-constants'

import { loadInstrumentFromSoundFont } from "./fetch-audio-data"

const DEFAULT_SOUNDFONT_OPTIONS = {
	location:"./assets/audio/"
}

export default class SoundFont {

	static audioBuffers: Map<string, AudioBuffer> = new Map()

	name: string = INSTRUMENT_PACKS[0]

	// data describing this data of descriptor
	descriptor: any = null

	// this is the URI of the data. can be
	// 1. local folder relative to this html root
	// 2. remote ftp with https:// at the start
	location: string = "./"

	// loaded assets
	audioBuffers: Map<string, AudioBuffer> = new Map()

	instrumentsByName: Map<string, any> = new Map()
	instrumentsByPath: Map<string, any> = new Map()
	instrumentsByIndex: any[] = []

	instruments: any = null
	
	// can be online or offline audio context
	#audioContext: AudioContext | null = null
	#offlineAudioContext: OfflineAudioContext | null = null

	// flags
	loading: boolean = false
	lazyLoading: boolean = false

	#abortController: AbortController | null = null
	
	get presetAudioBuffers(): Map<string, AudioBuffer> {
		return this.audioBuffers
	}	

	get presetNames(): string[] {
		return Array.from(this.instrumentsByName.keys())
	}
	
	get presetTitles(): string[] {
		return Array.from(this.instrumentsByName.keys())
	}
	
	get presets(): any {
		return this.instruments
	}

	get quantity(): number {
		return this.descriptor?.length || 0
	}

	constructor(audioContext: AudioContext | null, offlineAudioContext: OfflineAudioContext | null, path: string = "./") {
		this.#audioContext = audioContext
		this.#offlineAudioContext = offlineAudioContext
		// create defaults to overwrite
		this.createInstrumentData(createInstruments(), [path])
	}

	/**
	 * 
	 * @param options 
	 * @param onProgress 
	 * @returns 
	 */
	async load(options: Record<string, any> = {}, onProgress: ((progress: any) => void) | null = null): Promise<any> {
		// optionally load description
		// if there is a descriptor we load that first
		if (options.descriptor) {
			return await this.loadDescriptor(options.descriptor, options.descriptorPath ?? './')
		}

		// nothing to load!
		return null
	}

	createInstrumentData(instrumentData: any[], locationData: string[]): any[] {
		this.instrumentsByIndex = []
		// loop through the data and create all of our associators
		const data: any[] = instrumentData.map((preset: any, index: number) => {
			// create an object containing all the details about this sound font preset
			const data: any = {
				...preset,
				// check to see if the name is the same and if not change it?
				available: locationData[index] === preset.location,
				location: preset.location
			}

			this.instrumentsByPath.set(preset.location, data)
			this.instrumentsByName.set(data.name, data)
			this.instrumentsByIndex.push(data)
			return data
		})

		this.instruments = data

		return data
	}

	async loadFont(pack: string, location: string = '', onProgress: ((progress: number) => void) | null = null): Promise<any> {
		onProgress?.(0)

		// Load in the descriptor
		const font: any = await this.loadDescriptor(pack, location)

		onProgress?.(1)
		return font
	}

	async loadDescriptor(pack: string, packURI: string): Promise<any> {
		// 	const descriptorPath = `${location}${pack}`
		let descriptorURI: string = ""
		if (pack.indexOf(".json") === -1) {
			const index: number = INSTRUMENT_PACKS.indexOf(pack)
			if (index > -1) {
				this.name = INSTRUMENT_PACKS[index]
				const packData: any = INSTRUMENT_DATA_PACKS[index]
				descriptorURI = packData.filename
			} else {
				throw new Error(`loadFont failed to load descriptor. Expected a data source but couldn't find one: ${pack}`)
			}
		} else {
			this.name = INSTRUMENT_PACKS[INSTRUMENT_DATA_PACKS.indexOf(pack)]
			descriptorURI = pack
		}
		
		//  load JSON description from the specified location
		const descriptor = await loadInstrumentDataPack( descriptorURI, undefined, packURI )
		
		// JSON descripotion of this data
		this.descriptor = descriptor

		this.createInstrumentData( createInstruments(), descriptor )

		return this.instruments
	}

	/**
	 * Fetch Preset
	 * @param {String} presetName 
	 * @param {Object} options 
	 * @param {Function} onProgressCallback 
	 * @returns 
	 */
	async fetchPreset( presetName: string, options={}, onProgressCallback=null ){
		return this.getInstrumentData(presetName)
	}

	/**
	 * 
	 */
	findInstrumentDataFromDetails( presetName: string ){
			
		const check = ["folder", "name", "title", "location"]
		for (let i=0, l=this.instruments.length; i < l; i++)
		{

			// now check to see if there are any matches
			const instrument = this.instruments[i]
			
// console.log("looking for",presetName, instrument)

			check.forEach( key => {
				if (instrument[key] === presetName){
					return instrument
				}
			})
			
		}
		return null
	}
		

	getInstrumentData(presetName: string | number): any {
		// easy enough to resolve, as it is just a number!
		if (Number.isInteger(presetName)) {
			return this.instrumentsByIndex[presetName as number]
		}
		
		const name = presetName as string
		return this.instrumentsByName.get(name) ?? 
			this.instrumentsByPath.get(name) ??  
			this.instrumentsByName.get(name.substring(0, name.lastIndexOf('.'))) ?? 
			this.instrumentsByPath.get(name.substring(0, name.lastIndexOf('.'))) ?? 
			this.instrumentsByPath.get(name + "-mp3") ?? 
			this.instrumentsByPath.get(name + "-ogg") ?? 
			this.instrumentsByName.get(name.substring(0, name.lastIndexOf('-'))) ?? 
			this.instrumentsByPath.get(name.substring(0, name.lastIndexOf('-'))) ?? 
			this.findInstrumentDataFromDetails(name)
	}

	async loadPresetGradually(audioBuffers: Record<string, AudioBuffer>, preset: any, options: Record<string, any> = {}, onProgressCallback: ((event: any) => void) | null = null): Promise<any> {
		return this.loadPreset(preset, options, async (event: any) => {
			const { progress, part, audioBuffer }: { progress: number; part: string; audioBuffer: Promise<AudioBuffer> } = event
			const note: string = part.split('.')[0]
			const buffer: AudioBuffer = await audioBuffer
			audioBuffers[note] = buffer
			onProgressCallback?.(event)
		})
	}

	async loadPreset(preset: any, options: Record<string, any> = {}, onProgressCallback: ((event: any) => void) | null = null): Promise<any> {
		if (!preset) {
			throw new Error(`No "preset" argument provided to soundfont.loadPreset( required preset ), so not sure what preset you are expecting to load`)
		}
			
		if (!options.abortController) {
			this.#abortController = this.#abortController ?? new AbortController()
			options.abortController = this.#abortController
		}

		// establish the actual name of the preset
		let presetNameOrNumber: string | number

		// check to see what type it is
		if (typeof preset === 'object') {
			presetNameOrNumber = preset.name ?? preset.title ?? preset.folder
		} else {
			presetNameOrNumber = preset
		}

		// immediately attempt to get the instrument data from the descriptor
		const data: any = this.getInstrumentData(presetNameOrNumber) 

		const location: string = DEFAULT_SOUNDFONT_OPTIONS.location + options.soundfont
			
		// If a sound font with a name that isn't recognised
		// we complain and throw the error here
		if (!data) {
			console.error("PRESET " + presetNameOrNumber + " LOADING", data, "from", location, this)
		}

		// FIXME: this can contain holes so quickly checkit has the right size...
		if (SoundFont.audioBuffers.has(data.name)) {
			console.error("SoundFont.audioBuffers " + data.name, SoundFont.audioBuffers.get(data.name), {SFab: SoundFont.audioBuffers})
			// if the audio buffer is already loaded, just return it
			return SoundFont.audioBuffers.get(data.name)
		}
		
		// check to see if the pack name is valid...
		this.loading = true

		// console.error("PRESET "+presetName+" LOADING", data, "from", location, this )

		// let's load in all notes for this preset by requesting all the audio buffer
		// data from either the mp3 or wav or ogg files provided by the pattern
		// try{
			// we have to send "folder" if loading from a string...
			// const audioBufferData = await loadInstrumentFromSoundFontStringViaWorker( this.audioContext, data.location, options, onProgressCallback )
			
			// TODO : As zip!
			// const audioBufferData = await loadInstrumentFromSoundFontStringZipViaWorker( this.audioContext, data.location, options, onProgressCallback )
		
			// As individual mp3 files from a remote server in sequence
			// this is nice as it allows data to be streamed into the app in realtime
			// and we can load the middle most fequently used samples first as a priority
			// this results in far more requests but lower CPU usage and smoother transition
			
			let audioBufferData 
			
			try{
				audioBufferData = await loadInstrumentFromSoundFont( this.#audioContext, data.location, location, options, onProgressCallback )
				// only set it if we have a valid complete audio buffer
				this.audioBuffers.set( data.name, audioBufferData )
			}catch(error){
				// if we fail to load the audio data, we try to load it from the
				console.info("AudioBufferData catch", error)
			}

			//this.instrument = await loadInstrumentFromSoundFont( presetName, this.name, this.context, onProgressCallback )
			// const reload = await this.loadPack( this.instrumentPack, onProgressCallback  )
		
			// TODO: Use fetch-worker to load the array
			// loadInstrumentFromSoundFontSamples
			
			// console.error("Instrument loaded", presetNameOrNumber, data.name, audioBufferData )
		
			this.loading = false
			return audioBufferData

			/*
		}catch(error){

			this.loading = false

			console.error( "*** failed to get audio from", data.location, this.name, {data} )
			console.error( "*** failed to get audio from", error )

			// try to understand what has failed here and communicate it back to the user...

			// 1. ,
			if ( !this.audioContext )
			{
				throw Error("You must provide a valid AudioContext to the SoundFont")
			}

			if ( !data.location || data.location.length < 1 )
			{
				throw Error(`data.location of "${data.location}" could not be loaded, please check availability`)
			}
			
			if (error && String(error).toLowerCase().indexOf("encoding") > -1)
			{
				throw Error("A Preset '"+presetNameOrNumber+"' was loaded but the data does not appear to contain audio. Perhaps a 404 html page was returned instead of your expected audio file?")	
			}
			
			if ( !this.name || this.name.length < 1 )
			{
				throw Error("Not sure what happened but there is name associated with the instrument")	
			}

			// console.error("Instrument failed",presetNameOrNumber, error )

			// if ( !instrumentPack )
			// {
			// 	throw Error("No instrument pack provided")
			// }else if (instrumentPack.indexOf(".json") > -1){
			// 	throw Error("You tried to load a soundfont with a descriptor uri! "+instrumentPack)
			// }else{
				throw Error("Not sure what happened there")
			// }	
		}*/
	}
	
	/**
	 * Load multiple presets into memory
	 * @param {Array<String>} presetNames 
	 * @param {Onject} options 
	 * @param {Function} onProgressCallback 
	 */
	async loadPresets( presetNames, options={}, onProgressCallback=null ){

		const simultaneous = options.simultaneous ?? 12
		
		const output = []
		// presetNames = rearrangeArrayBySnake( presetNames , options.startIndex ?? 0 )
			
		// if a single string was provided, convert to array
		if (typeof presetNames === "string")
		{
			presetNames = [presetNames]
		}

		for (let i=0, l=presetNames.length; i<l; ++i )
		{	
			let promises = []

			for (let s=0; s<simultaneous; ++s )
			{
				const presetName = presetNames[i]
				const percent = i / l
			
				const presetPromise = this.loadPreset( presetName, options, 
					onProgressCallback ? 
						({progress, instrumentName})=>onProgressCallback(percent + (progress/l), progress, instrumentName) : 
						null 
				).then( preset=>{
					output.push( preset )
				})
				promises.push( presetPromise )
				i++
			}

			await Promise.allSettled( promises )
		}
		return output
	}
		
	/**
	 * Load *every* instrument in this soundfont!
	 * NB. Requires either the descriptor to be loaded
	 * or for a full sample pack with no gaps to be available
	 */
	async loadAllPresets( options={}, onProgressCallback=null ){
		return this.loadPresets( this.descriptor, options, onProgressCallback )
	}

	/**
	 * Stop loading any files immediately
	 */
	cancelLoading(){
		if (this.#abortController)
		{
			this.#abortController.abort()
		}
		this.#abortController = new AbortController()
	}

	// setAudioBuffer( buffer ){
	// 	audioBuffers.set( key, buffer )
	// }

	random(){
		return getRandomInstrument()
	}

	/**
	 * Clean up and destroy all associations 
	 * so that GC can free up memory
	 */
	async destroy(){
		this.cancelLoading()
		this.instruments = []
		delete this.audioBuffers
		delete this.instrumentsByPath
		delete this.instrumentsByName

		this.#abortController?.abort()
		this.#abortController = null
		return true
	}

	/**
	 * Debug
	 * @returns 
	 */
	toString(): string {
		let p: string = ``

		GENERAL_MIDI_LIBRARY.forEach((val: any, key: string) => {
			// Implementation pending
		})

		return p
	}
}