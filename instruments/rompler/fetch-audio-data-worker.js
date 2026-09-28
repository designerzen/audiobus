import { NOTE_NAMES, NOTE_NAMES_POPULAR_FIRST } from "./tuning/notes.js"
import decode, {decoders} from 'audio-decode'

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="

export const convertBinaryToUInt8Array = binaryString => { 
	const len = binaryString.length
	const bytes = new Uint8Array(len)
	for (let i = 0; i < len; ++i) {
		bytes[i] = binaryString.charCodeAt(i)
	}
	return bytes
}

// https://github.com/davidchambers/Base64.js/blob/master/base64.js
const base64ToBinary = input => {
	// save time skip check
	// const string = (String(input)).replace(/[=]+$/, '')
	const string = String(input)
	for (
		let bc = 0, bs, idx = 0, output = '', buffer ;
		buffer = string.charAt(idx++) ;
		~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? output += String.fromCharCode (255 & bs >> (-2 * bc & 6)) : 0 
	){
		// try to find character in table (0-63, not found => -1)
		buffer = BASE64_CHARS.indexOf(buffer)
	}
	return output
}

const base64Decode = base64 => convertBinaryToUInt8Array(base64ToBinary(base64))

/**
 * Fetch an audio sample / wave / mp3 / ogg from the server...
 * Try and decode as much as we can in threads...
 * 
 */
export const CMD_DECODE = "command-decode"
export const CMD_FETCH_SOUNDFONT_PART = "command-fetch-soundfont"
export const CMD_LOAD_SOUNDFONT = "command-load-soundfont"
export const CMD_LOAD_SOUNDFONT_PART = "command-load-soundfont-part"


export const EVENT_DECODED = "decode complete"

// const DEFAULT_SOUNDFONT_HOST = " https://gleitz.github.io/midi-js-soundfonts/"
const DEFAULT_SOUNDFONT_HOST = " https://paulrosen.github.io/midi-js-soundfonts/"

// https://paulrosen.github.io/midi-js-soundfonts/abcjs/
const DEFAULT_SOUNDFONT_STRING_OPTIONS = {
	soundfont: "MusyngKite",
	uri: DEFAULT_SOUNDFONT_HOST,
	suffix: ".js",
	url: (uri, soundfont, instrumentNameAndFormat, suffix = '.js') => `${uri}${soundfont}/${instrumentNameAndFormat}${suffix}`
}


/**
 * Allows us to load in instruments saved as base64 without having to execute
 * any code through eval - we simply download the javascript text and grep out
 * anything base64 encoded and then pass that out as an ArrayBuffer
 * @param {String} instrumentNameAndFormat 
 * @param {Object} options 
 * @returns {Object}+
 */
export const fetchSoundFontAudioDataFromString = async (instrumentNameAndFormat, options = {}) => {

	options = { ...DEFAULT_SOUNDFONT_STRING_OPTIONS, ...options }

	const url = options.url(options.uri, options.soundfont, instrumentNameAndFormat, options.suffix)

	const request = await fetch(url)
	const response = await request.text()

	let begin = response.indexOf('MIDI.Soundfont.')
	if (begin < 0) {
		throw Error('Mangled MIDI.js Soundfont format ;(')
	}

	begin = response.indexOf('=', begin) + 2
	const end = response.lastIndexOf(',')
	const source = JSON.parse(response.slice(begin, end) + '}')

	// console.log("loadSoundFontFromString", {response,source,end})
	const buffers = {}

	Object.keys(source).map(async (key) => {
		const i = source[key].indexOf(',')
		const encoded = source[key]
		const encodedSlice = encoded.slice(i + 1)
		buffers[key] = base64Decode(encodedSlice)
	})

	return buffers
}

// ------------------------------------------------

const fetchSoundFontAudioDataPartFromFile = async (path) => {
	const response = await fetch(path)
	const arrayBuffer = await response.arrayBuffer()
	return arrayBuffer
}


self.onmessage = async (e) => {

	//console.log("worker fetch audio", e)

	const { command, instrumentNameAndFormat, options } = e.data

	switch (command) {

		// Load in a JS file that contains the mp3s but as code
		// this is the slowest way to load in audio in realtime
		// but least strain on the server and option to go fully
		// remote with the data set
		case CMD_DECODE:
			const audioData = await fetchSoundFontAudioDataFromString(instrumentNameAndFormat, { ...options, asBuffer: true })
			const audioBuffers = Object.keys(audioData).map(d => typedArrayToBuffer(audioData[d]))
			postMessage({ event: EVENT_DECODED, audio: audioBuffers })
			break

		// Load in the instruments
		case CMD_FETCH_SOUNDFONT_PART:
			const audioArrayBuffers = {}
			// loop through all nmotes but in the special order	
			const filePromises = NOTE_NAMES_POPULAR_FIRST.map( async(note, index) => {
				// console.error("looosss", {note, index})
		
				const partResponse = await fetch( `${e.data.path}/${note}.${options.format ?? "mp3"}` )
				const partArrayBuffer = await partResponse.arrayBuffer()
				// console.error("loop", {note, index, partArrayBuffer})
		
				audioArrayBuffers[note] = partArrayBuffer
				return partArrayBuffer
			})
			// console.error("NOTE_NAMES_POPULAR_FIRST", NOTE_NAMES_POPULAR_FIRST)
		
			await Promise.all(filePromises)

			// console.error("NOTE_NAMES_POPULAR_FIRST", NOTE_NAMES_POPULAR_FIRST)
			
			postMessage({ event:EVENT_DECODED, audio:audioArrayBuffers  })
			break

		// Load in the instruments & parse their buffers
		// NB. REQUIRES OfflineAudioContext NOT available in workers
		case CMD_LOAD_SOUNDFONT_PART:
			// const context = data.offlineAudioContext
			const audioSampleBuffers = {}
			// loop through all nmotes but in the special order	
			const audioBufferPromises = NOTE_NAMES_POPULAR_FIRST.map( async(note, index) => {
				// console.error("looosss", {note, index})
		
				const partResponse = await fetch( `${e.data.path}/${note}.${options.format ?? "mp3"}` )
				const partArrayBuffer = await partResponse.arrayBuffer()
				
				// convert to the AudioBuffer directly in the Worker :)
				// const partAudioBuffer = await context.decodeAudioData(arrayBuffer)
				const partAudioBuffer= await decode(buffer)
				
				// console.error("loop", {note, index, partArrayBuffer, partAudioBuffer})
				
				audioArrayBuffers[note] = partAudioBuffer
				audioBuffers[note] = partAudioBuffer

				return partAudioBuffer
			})

			// console.error("NOTE_NAMES_POPULAR_FIRST", NOTE_NAMES_POPULAR_FIRST)
		
			await Promise.all(audioBufferPromises)

			postMessage({ event:EVENT_DECODED, audio:audioArrayBuffers  })
			break

		// Load in the instruments
		case CMD_LOAD_SOUNDFONT:
			// const response = await fetch(path)
			// const arrayBuffer = await response.arrayBuffer()
			// postMessage({ event:EVENT_DECODED, audio:arrayBuffer  })
			break
	}
}
