import {getInstrumentFamily, loadInstrumentFromSoundFontSamplesViaWorker, loadInstrumentFromSoundFontString, loadInstrumentFromSoundFontStringViaWorker} from './sound-font-instruments'
import { rearrangeArrayBySnake } from "../../utils/array-tools"
import {
	createInstrumentBanks,
	// getNoteName, getNoteSound, getNoteText,
	NOTE_NAMES
} from '../../tuning/notes'

// 
export const ZERO = 0.0000001 // Math.min

let audioContext
let offlineAudioContext

/**
 * Replace the in-memory sound with a new dound
 * This loads all pitches for one specific sound
 * @param {String} instrumentName Instrument Sample name
 * @param {String} path File path for sample pack
 * @param {Object} options File path for sample pack
 * @returns {Array<Promise>} Array of instrument load promises that resolve to AudioBuffers
 */
export const loadInstrumentParts = ( context=audioContext, instrumentPath=`./assets/audio/${INSTRUMENT_PACK_FM}`, options={}, onProgressCallback=null) => new Promise( async (resolve,reject)=>{
	
	// pass to fetch as an optoin to cancel { signal:abortSignal }
	const abortSignal = options?.abortController.signal
	
	const banks = createInstrumentBanks()
	const parts = rearrangeArrayBySnake( banks, options.startIndex )

	let i = 0
	const instruments = []
	const loading = new Map()
	
	if (abortSignal)
	{
		abortSignal.addEventListener('abort', () => {
			// console.error("Aborting loadInstrumentParts", {abortSignal, options})
			reject("Cancelled loading instrument parts")
		})
	}

	const loadNextPart = async ()=>{
		const simultaneous = options.simultaneous ?? 12
		for (let b=0; b<simultaneous;++b)
		{
			if (abortSignal?.aborted === true){
				return reject("Cancelled before loading")
			}
			const part = parts[i]
			if (!part)
			{
				break
			}
			const audioBuffer = loadAudio(context, `${instrumentPath}/${part}` , options )
			instruments.push( audioBuffer )
			loading.set( part, audioBuffer )
			i++
		}

		await Promise.allSettled(instruments)
		let b = simultaneous
		loading.forEach( (audioBuffer, part) => {
			const index = i - (b--)
			const progress = index / parts.length
			onProgressCallback && onProgressCallback({ 
				progress, 
				part, 
				index,  
				audioBuffer
			})

			if (abortSignal?.aborted === true){
				return reject("Cancelled during load")
			}

			//console.info("***", index, progress, "loadInstrumentParts", i, parts.length, b, loading.size, part, audioBuffer )
			loading.delete( part )
		})

		if (abortSignal?.aborted === true){
			return reject("Cancelled once loaded")
		}

		if (i < parts.length)
		{
			// now start another loop...
			// requestAnimationFrame( loadNextPart )
			loadNextPart()
		}else{
			resolve(instruments)
		}
	}

	loadNextPart()

	// const instruments = parts.map( part => loadInstrumentPart( context, instrumentPath, part , options ) )
	
	//const instruments = parts.map( part => loadInstrumentPart(instrumentPath, part) )
	// eg FluidR3_GM
	//return instruments
})


/**
 * Replace the in-memory sample pack with a new pack
 * @param {AudioContext} context Online / Offline Audio Context
 * @param {String} instrumentName Instrument Sample name
 * @param {String} instrumentURI File path for sample pack
 * @param {?Function} onProgressCallback Optional callback to report progress
 * @returns {Object} Instrument information
 */
export const loadInstrumentFromSoundFont = async ( context=audioContext, instrumentName="alto_sax-mp3", instrumentURI="./assets/audio/OpenGM24", options={}, onProgressCallback=null ) => {	

	const title = instrumentName
	// const family = getInstrumentFamily(instrumentName)
	const name = instrumentName
	// .indexOf("-mp3") < 0 ? instrumentName + "-mp3" : instrumentName

	// ensure we have the suffix on the name
	const output = {
		title,
		family:getInstrumentFamily(name) ?? getInstrumentFamily(title),
		name
	}

	// Ensure default options are set
	options = {
		// URI of the sound font
		soundfont : instrumentURI,
		// try and use a seperate thread for loading and decoding the data
		usingWorker : false,
		// load as a single string and convert to individual files
		// NB. this uses less network but more decoding time
		loadAsOne : false,
		// as a collection of elements in an object rather than array { A0: }
		asArray : false,
		// use offline worker if available (may be faster?)
		offlineAudioContext:null,
		// prevent double instantiation
		abortController: options.abortController ?? new AbortController(),
		// overwrite with specified
		...options
	}

	// console.error("loadInstrumentFromSoundFont:" , options ) 
	
	let instrumentAudioBuffers

	if (options.loadAsOne)
	{
		// load from a single string  
		instrumentAudioBuffers = options.usingWorker ? 
			await loadInstrumentFromSoundFontStringViaWorker( context,  instrumentName, options, onProgressCallback ) :
			await loadInstrumentFromSoundFontString( instrumentName, options, onProgressCallback )
	
	}else{
		
		// set the location that all the single instruments get loaded from...
		const instrumentPath = `${instrumentURI}/${instrumentName}`
		// load from multiple files from a dedicated folder on server
		// TODO: 
		instrumentAudioBuffers = options.usingWorker ? 
			await loadInstrumentFromSoundFontSamplesViaWorker( context, instrumentPath, options, onProgressCallback ) :
			await loadInstrumentFromSoundFontSamples( context, instrumentPath, options, onProgressCallback )
	}

	NOTE_NAMES.forEach( (instrument, index) => {
		output[ instrument.split('.')[0] ] = instrumentAudioBuffers[instrument] ?? instrumentAudioBuffers[index]
	})

	// console.error("Loaded soundfont", {output, instrumentURI, instrumentAudioBuffers})
	
	return output
}