

import { 
	SOUNDFONT_DEFAULT_INSTRUMENT_FOLDERS,
	GENERAL_MIDI_INSTRUMENTS, 
	GENERAL_MIDI_LIBRARY,
	GENERAL_MIDI_FAMILY_DICTIONARY, GENERAL_MIDI_INSTRUMENTS_FRIENDLY, 
	GENERAL_MIDI_INSTRUMENT_FAMILY_IDS,
	GENERAL_MIDI_INSTRUMENT_FAMILY_BY_ID,
	GENERAL_MIDI_FAMILIES
} from "./midi/general-midi.constants.js"

import { CMD_DECODE, CMD_FETCH_SOUNDFONT_PART, CMD_LOAD_SOUNDFONT_PART, EVENT_DECODED } from "./fetch.audio.worker"
// import { convertArrayToBuffer } from "./audio"
import audioDecoder from 'audio-decode'

import { convertArrayToBuffer } from "./audio-sample-utils.js"

import { 
	INSTRUMENT_PACK_OPEN_SF, SOUNDFONT_OPEN_SF_JSON 
} from "../settings/options.instruments.js"

import { 
	FAMILY_BASS, 
	FAMILY_BRASS, 
	FAMILY_CHROMATIC_PERCUSSION, 
	FAMILY_ENSEMBLE, 
	FAMILY_ETHNIC, 
	FAMILY_GUITAR, 
	FAMILY_ORGAN, 
	FAMILY_PERCUSSIVE, 
	FAMILY_PIANO, 
	FAMILY_PIPE, 
	FAMILY_REED, 
	FAMILY_SOUND_FX, 
	FAMILY_STRINGS, 
	FAMILY_SYNTH_EFFECTS, 
	FAMILY_SYNTH_LEAD, 
	FAMILY_SYNTH_PAD 
} from "./midi/general-midi-instrument.constants.js"

import { base64Decode } from "../utils/base64.js"
import SoundFont from "./sound-font.js"

export const INSTRUMENT_PACKS = [
	INSTRUMENT_PACK_OPEN_SF
]
export const INSTRUMENT_DATA_PACKS = [
	SOUNDFONT_OPEN_SF_JSON
]

// actual instrument folder names
export let instrumentFolders = SOUNDFONT_DEFAULT_INSTRUMENT_FOLDERS.map( instrumentFolder => instrumentFolder+`-mp3`)
// nice names for the above
export let instrumentNames = instrumentFolders.map( (instrument, index) => GENERAL_MIDI_INSTRUMENTS[index] )

/**
 * https://paulrosen.github.io/midi-js-soundfonts/abcjs/
 * https://paulrosen.github.io/midi-js-soundfonts/FluidR3_GM/
 * https://paulrosen.github.io/midi-js-soundfonts/MusyngKite/
 */
// const DEFAULT_SOUNDFONT_HOST = " https://gleitz.github.io/midi-js-soundfonts/"
const DEFAULT_SOUNDFONT_HOST = " https://paulrosen.github.io/midi-js-soundfonts/"

// https://paulrosen.github.io/midi-js-soundfonts/abcjs/
const DEFAULT_SOUNDFONT_STRING_OPTIONS = {
	soundfont : INSTRUMENT_PACK_OPEN_SF,
	uri: DEFAULT_SOUNDFONT_HOST,
	suffix:".js",
	url:(uri, soundfont, instrumentNameAndFormat, suffix='.js')=>  `${uri}${soundfont}/${instrumentNameAndFormat}${suffix}`
}

// combine those 2 together

const instrumentFilenames = new Map()
const instrumentTitles= new Map()

const TITLE_DICTIONARY = {}
SOUNDFONT_DEFAULT_INSTRUMENT_FOLDERS.forEach( (name,index) =>{
	TITLE_DICTIONARY[name] = instrumentNames[index] 
	TITLE_DICTIONARY[name+'-mp3'] = instrumentNames[index] 
})

GENERAL_MIDI_INSTRUMENTS.forEach( (name,index) =>{
	instrumentFilenames.set( name, instrumentFolders[index] )
	instrumentTitles.set( name, instrumentNames[index] )
	instrumentTitles.set( name+'-mp3', instrumentNames[index] )
})


const loadFetchAudioDataWorker = ()=> {
	return new Worker(
		new	URL('./fetch-audio-data-worker.js', import.meta.url), 
		{type: 'module'}
	)
}

/*

// Notes
console.error("Created soundfont", {
	instrumentFolders,DEFAULT_FOLDERS: SOUNDFONT_DEFAULT_INSTRUMENT_FOLDERS,
	instrumentNames,

	instrumentFilenames,
	instrumentTitles,

	GENERAL_MIDI_INSTRUMENTS, TITLE_DICTIONARY,
	GENERAL_MIDI_LIBRARY
})

*/

/**
 * As I cannot guarantee where the files are stored, we have a list of ideal to 
 * not so ideal links that we try to load each time
 */
export const loadRemoteSoundfonts = async ( offlineAudioContext:AudioContext ) => {
	
	const soundFontModel = new SoundFont( offlineAudioContext )
	const soundFontModels = await soundFontModel.loadDescriptor( packName, "assets/audio/" )
	// const all = await soundFontModel.loadAllPresets()
	return soundFontModels
}



export const getGeneralMIDIInstrumentFolders = () => instrumentFolders
export const getGeneralMIDIInstrumentNames = () => instrumentNames

// we fall back to the name if the name was already provided and exists!
export const getGeneralMIDIInstrumentFileFromName = name => instrumentFilenames.get(name) ?? instrumentTitles.get(name)
// export const getGeneralMIDIInstrumentFileFromName = name => instrumentFolders[ instrumentNames.indexOf(name) ]

/**
 * Fetch the name of a sound pack or the subsequent one if a 
 * name is provided as an argument
 * @param {String} soundPack 
 * @returns 
 */
export const getNextSoundPackName = ( soundPack=INSTRUMENT_DATA_PACKS[0] ) => {
	const existingIndex = INSTRUMENT_PACKS.indexOf(soundPack)
	const newIndex = existingIndex > -1 ? 
		(existingIndex+1)%(INSTRUMENT_PACKS.length-1) :
		0
	return INSTRUMENT_PACKS[newIndex]	
}


export const getRandomPresetIndex = (family) => 
{
	const familyIndex = GENERAL_MIDI_INSTRUMENT_FAMILY_BY_ID[family]
	const allInstrumentsInFamily = GENERAL_MIDI_FAMILIES.get(family)
	// console.log("getRandomPresetIndex",{family, familyIndex, allInstrumentsInFamily})
	return family ?
		familyIndex + Math.floor( Math.random() * allInstrumentsInFamily.length ) :
		-1
}
 
/**
 * Fetch a random instrument name
 * @returns {String} Instrument Name
 */
export const getRandomInstrument = () => instrumentFolders[ Math.floor( Math.random() * instrumentFolders.length ) ]


export const getRandomPianoPresetIndex = () => getRandomPresetIndex(FAMILY_PIANO)
export const getRandomChromaticPercussionPresetIndex = () => getRandomPresetIndex(FAMILY_CHROMATIC_PERCUSSION)
export const getRandomOrganPresetIndex = () => getRandomPresetIndex(FAMILY_ORGAN)
export const getRandomGuitarPresetIndex = () => getRandomPresetIndex(FAMILY_GUITAR)
export const getRandomBassPresetIndex = () => getRandomPresetIndex(FAMILY_BASS)
export const getRandomStringsPresetIndex = () => getRandomPresetIndex(FAMILY_STRINGS)
export const getRandomEnsemblePresetIndex = () => getRandomPresetIndex(FAMILY_ENSEMBLE)
export const getRandomBrassPresetIndex = () => getRandomPresetIndex(FAMILY_BRASS)
export const getRandomReedPresetIndex = () => getRandomPresetIndex(FAMILY_REED)
export const getRandomPipePresetIndex = () => getRandomPresetIndex(FAMILY_PIPE)
export const getRandomSynthLeadPresetIndex = () => getRandomPresetIndex(FAMILY_SYNTH_LEAD)
export const getRandomSynthPadPresetIndex = () => getRandomPresetIndex(FAMILY_SYNTH_PAD)
export const getRandomSynthFXPresetIndex = () => getRandomPresetIndex(FAMILY_SYNTH_EFFECTS)
export const getRandomEthnicPresetIndex = () => getRandomPresetIndex(FAMILY_ETHNIC)
export const getRandomPercussivePresetIndex = () => getRandomPresetIndex(FAMILY_PERCUSSIVE)
export const getRandomSFXPresetIndex = () => getRandomPresetIndex(FAMILY_SOUND_FX)

export const leadPresetMethods = [
	getRandomPianoPresetIndex,
	getRandomOrganPresetIndex,
	getRandomGuitarPresetIndex,
	getRandomStringsPresetIndex,
	getRandomBrassPresetIndex,
	getRandomReedPresetIndex,
	getRandomPipePresetIndex,
	getRandomSynthLeadPresetIndex,
	getRandomSynthPadPresetIndex,
	getRandomSFXPresetIndex
]
let randomLeadIndex = 0
export const getRandomLeadPresetIndex = type => leadPresetMethods[randomLeadIndex++ % leadPresetMethods.length]()


export const harmonicLeadPresetMethods = [
	getRandomPianoPresetIndex,
	getRandomOrganPresetIndex,
	getRandomGuitarPresetIndex,
	getRandomStringsPresetIndex,
	getRandomBrassPresetIndex,
	getRandomEnsemblePresetIndex,
	getRandomReedPresetIndex,
	getRandomPipePresetIndex,
	getRandomSynthLeadPresetIndex,
	getRandomSynthPadPresetIndex,
	getRandomSynthFXPresetIndex,
	getRandomSFXPresetIndex
]
let randomHarmonicLeadIndex = 0
export const getRandomHarmonicLeadPresetIndex = type => harmonicLeadPresetMethods[randomHarmonicLeadIndex++ % harmonicLeadPresetMethods.length]()


export const percussionPresetMethods = [
	getRandomChromaticPercussionPresetIndex,
	getRandomEthnicPresetIndex,
	getRandomPercussivePresetIndex
]
let randomBeatsIndex = 0
export const getRandomBeatsPresetIndex = type => percussionPresetMethods[randomBeatsIndex++ % percussionPresetMethods.length]()


export const bassPresetMethods = [
	getRandomBassPresetIndex,
	getRandomOrganPresetIndex,
	getRandomSynthLeadPresetIndex,
	getRandomSynthPadPresetIndex,

]
let randomBassIndex = 0
export const getRandomBasslinePresetIndex = type => bassPresetMethods[randomBassIndex++ % bassPresetMethods.length]()



/**
 * Find the family for this instrument
 * @param {String} instrumentName - name of the instrument
 * @returns 
 */
export const getInstrumentFamily = instrumentName => GENERAL_MIDI_FAMILY_DICTIONARY[instrumentName]

/**
 * 
 * @param {String} instrumentName 
 * @returns 
 */
export const getInstrumentTitle = instrumentName => TITLE_DICTIONARY[instrumentName.toLowerCase()]


/**
 * Create an Object of all instruments and folders -
 * useful for debugging and understanding connections
 * but also used in the side bar for each user
 * @returns 
 */
export const createInstruments = () => SOUNDFONT_DEFAULT_INSTRUMENT_FOLDERS.map( (folder, index) => {
		const name = GENERAL_MIDI_INSTRUMENTS[index]
		const title = GENERAL_MIDI_INSTRUMENTS_FRIENDLY[index]
		const family = GENERAL_MIDI_FAMILY_DICTIONARY[name]
		const location = instrumentFolders[index]

		return {
			folder,
			name,
			title,
			family,
			location
		}
	}
)

/*
// TODO: Which of these are loops?
// export const LOOPS = []
// export const SINGLE_SHOTS = []

export const instrumentCache = {}
export const fetchInstrument = (name) =>{
	
	// FIXME: Create if it doesn't exist?
	return instrumentCache[name]
}

export const storeInstrument = (name,data) => {
	instrumentCache[name] = data
}
*/

const createPack = (packs, format="mp3") => {

	return packs.map( (instrument, i) => {
		const formatted = `${instrument}-${format}`
		instrumentFolders[i] =formatted
		// FIXME: May not always align...
		instrumentNames[i] = GENERAL_MIDI_INSTRUMENTS[i]
		return formatted
	})
}

/**
 * Load an Data pack from specified JSON file
 *  This is a way to load in a collection of files from json
 * @param {String} packName 
 * @returns {Array}
 */
export const loadInstrumentDataPack = async ( packName='musyng.json', format="mp3", resourcePath="./assets/audio/" ) => {
	const url = `${resourcePath}${packName}`
	try{
		const request = await fetch( url )
		const contentType = request.headers.get('content-type')
        const isJson = contentType ? contentType.includes('application/json') : false
		// if (!isJson)
		// {
		// 	throw Error(`File loaded was not full of json as expected, perhaps the asset ${url} was moved or never copied?`)
		// }
		
		const packs = await request.json()
		return createPack( packs, format )
	}catch(error){
		if (error instanceof SyntaxError) 
		{
			console.error(`loadInstrumentDataPack: File loaded was not full of json as expected, perhaps the asset ${url} was moved or never copied?`)
		}else{
			console.error("loadInstrumentDataPack", {url, packName, error})
		}
		return []
	}	
}

// FIXME: Remove this!
export const getFolderNameForInstrument = name => {
	let index = instrumentFolders.indexOf(name)
	if (index === -1){
		index = instrumentNames.indexOf(name)
	}
	return instrumentFolders[index]
}

// repeated in audio but importing will fail inside worker
// NB. CANNOT RUN INSIDE WORKER
// const convertArrayToBuffer = async (audioContext, bufferData)=>{
// 	return await audioContext.decodeAudioData(bufferData)
// }

// CANNOT RUN INSIDE WORKER
export const decodeAudioDataIntoBuffer = async (bufferData, asBuffer=false) => {

	return asBuffer ? 
		await audioDecoder(bufferData).buffer : 
		await audioDecoder(bufferData)
}

// CANNOT RUN INSIDE WORKER
export const decodeAudioDataIntoBuffers = async (buffersData, asBuffer=false, onProgress=null ) => {

	const buffers = {}
	const total = buffersData.length
	const loading = Object.keys(buffersData).map(async (key, index) => {
		const promised = await decodeAudioDataIntoBuffer(buffersData[key], asBuffer )
		buffers[key] = promised
		// console.error( key, buffersData[key], { asBuffer, promised}  )
		onProgress && onProgress( index / total )
		return promised
	})

	await Promise.allSettled( loading )
	return buffers
}

/**
 * Allows us to load in instruments saved as base64 without having to execute
 * any code through eval - we simply download the javascript text and grep out
 * anything base64 encoded and then pass that out as an ArrayBuffer
 * @param {String} instrumentNameAndFormat 
 * @param {Object} options 
 * @returns {Object}+
 */
export const fetchSoundFontAudioDataFromString = async ( instrumentNameAndFormat, options = {}) => {
	
	options = { ...DEFAULT_SOUNDFONT_STRING_OPTIONS, ...options}
	
	const url = options.url( options.uri, options.soundfont, instrumentNameAndFormat, options.suffix )
		
	const request = await fetch(url)
	const response = await request.text()

	let begin = response.indexOf('MIDI.Soundfont.')
	if (begin < 0) { 
		throw Error('Mangled MIDI.js Soundfont format ;(')
	}

	begin = response.indexOf('=', begin) + 2
	const end = response.lastIndexOf(',')
	const source =  JSON.parse(response.slice(begin, end) + '}')
	
	// console.log("loadSoundFontFromString", {response,source,end})
	const buffers = {}

	Object.keys(source).map(async (key) => {
		const i = source[key].indexOf(',')
		const encoded =  source[key]
		const encodedSlice = encoded.slice(i + 1)
		buffers[key] = base64Decode( encodedSlice )
	})

	return buffers
}

/**
 * Load in a soundfont from an external JS script as base64 encoded mp3s / oggs
 * Thanks MIDI.js and DAWG for suggesting this approach
 * @param {String} instrumentNameAndFormat 
 * @param {Object} options 
 * @returns [AudioBuffer]
 */
export const loadInstrumentFromSoundFontString = async ( instrumentNameAndFormat,options = {}) => {
	const audioData = await fetchSoundFontAudioDataFromString( instrumentNameAndFormat, options)
	// const instrumentAudioBuffers = await convertArrayToBuffers( audioContext, buffers, onProgress )
	// options.asBuffer ?? false
	return await decodeAudioDataIntoBuffers(audioData, false )
}

/**
 * 
 * @param {AudioContext} audioContext 
 * @param {Array<AudioBuffer>} buffers 
 * @param {?Function} onProgress 
 * @returns 
 */
export const convertArrayToBuffers = async( audioContext, buffers, onProgress=undefined ) => {
	const quantity = buffers.length
	return Promise.all( buffers.map( async(buffer, index) =>{ 
		onProgress && onProgress( index / quantity )
		return await convertArrayToBuffer( audioContext , buffer )
	}) )
}

/**
 * Load an instrument from a JS file but using a worker residing in a different
 * thread so should be a bit more soft on the CPU
 * 
 * @param {AudioContext} audioContext 
 * @param {String} instrumentName 
 * @param {Object} options 
 * @param {Function} ?onProgress 
 * @returns [AudioBuffer]
 */
export const loadInstrumentFromSoundFontStringDataViaWorker = async ( audioContext:AudioContext, instrumentName:string, options = {}, onProgress:Function=undefined ) => {

	let decoderWorker = loadFetchAudioDataWorker()

	// the above but in a worker...
	const loadFromWorker = (instrumentNameAndFormat, options={} ) => new Promise((resolve,reject) => {
				
		const cleanUp = () => {
			decoderWorker.terminate()
			decoderWorker = null
		}

		decoderWorker.onmessage = (e) => {	
			const data = e.data
			switch(data.event)
			{
				case EVENT_DECODED: 
					cleanUp()
					return resolve(data)
			}
		}

		decoderWorker.onerror = event => {
			cleanUp()
			return reject(event.message)
		}

		decoderWorker.postMessage( { command:CMD_DECODE, instrumentNameAndFormat, options } )
	})
	
	const workerLoadedAudioBuffers = await loadFromWorker(instrumentName, options)
	return workerLoadedAudioBuffers.audio
}

/**
 * Uses FETCH inside a worker that also decodes the samples from mp3 / ogg
 * @param {AudioContext} offlineAudioContext 
 * @param {String} path 
 * @param {Object} options 
 * @param {Function} onProgressCallback 
 */
export const loadInstrumentFromSoundFontSamplesViaWorker = async( offlineAudioContext, path="FluidR3_GM", options={}, onProgressCallback=null ) => {

	let decoderWorker = loadFetchAudioDataWorker()

	onProgressCallback && onProgressCallback(0)

	// load in an individual sound
	const loadSampleViaWorker = (presetSamplePath, options={} ) => new Promise((resolve,reject) => {
				
		const cleanUp = () => {
			decoderWorker.terminate()
			decoderWorker = null
		}

		decoderWorker.onmessage = (e) => {	
			const data = e.data
			switch(data.event)
			{
				case EVENT_DECODED: 
				// console.error("received audio buffers from workers", data.audio )
				cleanUp()

				const rawAudioArrayBuffers = data.audio

				const audioBufferArray = {}
				const keys = Object.keys(rawAudioArrayBuffers)
				const quantity = keys.length
				const promises = keys.map( async (key, index) => {
					
					// console.error( index,keys.length, "parsing audio buffers from workers", {key, index} )
		
					const data =  rawAudioArrayBuffers[key] 
					const audioBuffer = await convertArrayToBuffer( offlineAudioContext, data )		
					// console.error(index,keys.length, "parsed audio buffers from workers", { data, audioBuffer, audioBufferArray, promises } )
			
					audioBufferArray[key] = audioBuffer
					onProgressCallback && onProgressCallback(index/quantity)
					return audioBuffer
				})

				// wait for all files to finish loading???
				Promise.all(promises).then( ()=>{
					resolve(audioBufferArray)
				})
			}
		}

		decoderWorker.onerror = event => {
			cleanUp()
			return reject(event.message)
		}

		decoderWorker.postMessage( { command:CMD_FETCH_SOUNDFONT_PART, path:presetSamplePath, options }, [  ] )
	})

	const workerLoadedAudioBuffers = await loadSampleViaWorker(path, options)	
	onProgressCallback && onProgressCallback(1)
	// console.error("audio buffers", workerLoadedAudioBuffers )
	return workerLoadedAudioBuffers
} 

/**
 * Load an instrument from a JS file but using a worker residing in a different
 * thread so should be a bit more soft on the CPU
 * 
 * @param {AudioContext} audioContext 
 * @param {String} instrumentName 
 * @param {Object} options 
 * @param {Function} ?onProgress 
 * @returns [AudioBuffer]
 */
export const loadInstrumentFromSoundFontStringViaWorker = async ( audioContext:AudioContext, instrumentName:string, options = {}, onProgress=undefined ) => {
	const buffers = await loadInstrumentFromSoundFontStringDataViaWorker( audioContext, instrumentName, options, onProgress )
	return await convertArrayToBuffers( audioContext, buffers, onProgress )
}

/**
 * TODO
 * Load an instrument from a Gzip file but using a worker residing in a different
 * thread so should be a bit more soft on the CPU
 * 
 * @param {AudioContext} audioContext 
 * @param {String} instrumentName 
 * @param {Object} options 
 * @param {Function} ?onProgress 
 * @returns [AudioBuffer]
 */
export const loadInstrumentFromSoundFontStringZipViaWorker = async ( audioContext, instrumentName, options = {}, onProgress=undefined ) => {
	const buffers = await loadInstrumentFromSoundFontString(audioContext, instrumentName, {...options, suffix:".js.gz" }, onProgress)
	// now convert zips into buffers?
	const instrumentAudioBuffers = await convertArrayToBuffers( audioContext, buffers, onProgress )
}
