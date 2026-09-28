import { rearrangeArrayBySnake } from "../../utils/array-rearrange"

/**
 * buffer source - to convert back to audio...
 * const song = await audioCtx.createBufferSource()
 * song.buffer = renderedAudioBuffer
 * song.connect(audioCtx.destination)
 * 
 * @param {OfflineAudioContext} offlineAudioContext 
 * @param {Array} arrayBuffer 
 * @returns {AudioBuffer} Audio buffer
 */
export const convertArrayToBuffer = async (context:AudioContext, arrayBuffer:ArrayBuffer)=>{
	return await context.decodeAudioData(arrayBuffer)
}


/**
 * Load an Audio Buffer
 * @param {String} path Instrument Sample path
 * @returns {AudioBuffer} Audio buffer
 */
export const loadAudio = async ( context:AudioContext, path, options ) => {
	const response = await fetch(path)
	const arrayBuffer = await response.arrayBuffer()
	// TODO : Check for offline audio context !
	if (options.offlineAudioContext)
	{

	}else{
		
	}
	const audioBuffer = await convertArrayToBuffer( context, arrayBuffer )
	return audioBuffer
}


/**
 * Replace the in-memory sound with a new dound
 * This loads all pitches for one specific sound
 * @param {String} instrumentName Instrument Sample name
 * @param {String} path File path for sample pack
 * @param {Object} options File path for sample pack
 * @returns {Array<Promise>} Array of instrument load promises that resolve to AudioBuffers
 */
export const loadInstrumentParts = ( context:AudioContext, instrumentPath=`./assets/audio/${INSTRUMENT_PACK_FM}`, options={}, onProgressCallback=null) => new Promise( async (resolve,reject)=>{
	
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
 * Play an Audio Buffer
 * create a buffer, plop in data, connect and play -> modify graph here if required
 * detune:0,,  playbackRate:1
 * @param {AudioContext} context AudioContext to stream track to
 * @param {Object} audioBuffer Audio data buffer
 * @param {Number} offset position to start from
 * @param {AudioNode} destination Audio Node to route to
 * @param {Object} options options such as looping
 * @returns {HTMLAudioElement} Audio object
 */
const playingTracks = new Map()
export const playTrack = (context:AudioContext, audioBuffer:AudioBuffer, offset:number=0, destination=null, options={ loop:false }, onComplete=()=>{} ) => {
	
	if (playingTracks.has( audioBuffer))
	{
		const existingTrack = playingTracks.get( audioBuffer )
		existingTrack.start(0, context.currentTime - offset)
		return existingTrack
	}

	const trackSource = context.createBufferSource()
	trackSource.buffer = audioBuffer
	
	// loop through options nad add
	// options
	trackSource.loop = options.loop
	// trackSource.detune = options.detune
	if (options.playbackRate)
	{
		trackSource.playbackRate.value = options.playbackRate
	}
	
	if (!destination)
	{
		throw Error("No destination Node provided to PlayTrack")
	}
	trackSource.connect(destination)
	// trackSource.connect(audioContext.destination)
	// console.error("Playing track", {audioBuffer,trackSource} )

	// https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode
	// FIXME: when it has finished playing remove it...
	// trackSource.addEventListener()
	trackSource.onended = () => {
		trackSource.disconnect()
		playingTracks.delete( audioBuffer)
		// resolve(trackSource)
		onComplete(trackSource)
	}
	trackSource.onerror = (error) => {
		trackSource.disconnect()
		playingTracks.delete( audioBuffer)
	
		// reject(error)
		onComplete(null)
	}

	if (context.state === 'suspended') 
	{
		context.resume()
	}
	
	if (offset == 0) 
	{
		trackSource.start()
		//offset = audioContext.currentTime
	} else {
		trackSource.start(0, context.currentTime - offset)
	}

	playingTracks.set( audioBuffer, trackSource)
	
	return trackSource
}

/**
 * This loads the AudioBuffers for the specified audio samples
 * @param {AudioContext} context 
 * @param {String} name 
 * @param {String} path 
 * @param {Object} options such as abortController
 * @param {?Function} onProgressCallback 
 * @returns {Object|Array} [ AudioBuffer ] , { A0:AudioBuffer }
 */
export const loadInstrumentFromSoundFontSamples = async( context:AudioContext, path="FluidR3_GM", options={}, onProgressCallback=null ) => {
		
	// Load as individual parts
	const partPromises = await loadInstrumentParts(context, path, options, onProgressCallback ) 
	const parts = options.asArray ? [] : {}

	// ensure promises have resolved
	for (let i=0, l=partPromises.length; i < l; ++i)
	{
		const part = await partPromises[i]
		let index
		if (options.asArray === true)
		{
			parts.push( part )
			index = parts.length-1

		}else{

			index = NOTE_NAMES[i]
			parts[ index ] = part
		}
	}
	// await Promise.allSettled( partPromises )
	return parts
}