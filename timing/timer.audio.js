import Timer from "./timer.js"

import AUDIOTIMER_WORKLET_URI from './timing.audioworklet.js?url'
import AUDIOTIMER_PROCESSOR_URI from './timing.audioworklet-processor.js?url'
// FIXME: 
import AUDIOCONTEXT_WORKER_URI from './timing.audiocontext.worker.js?url'

const DEFAULT_AUDIO_TIMER_OPTIONS = {

	// keep this at 24 to match MIDI1.0 spec
	// where there are 24 ticks per quarternote
	divisions:24,

	type:AUDIOTIMER_WORKLET_URI,
	processor:AUDIOTIMER_PROCESSOR_URI,
}

export default class AudioTimer extends Timer {
	
	// NB. do *NOT* enable the following line as it will overwrite the var on super()
	// audioContext

	/**
	 * Accurate time in milliseconds
	 * @returns {Number} The current time as of now
	 */
	get now(){ 
		return this.audioContext ? this.audioContext.currentTime : performance.now() 
	}
	
	constructor(audioContext, worklet=true){
		const timerOptions = {
			audioContext,
			...DEFAULT_AUDIO_TIMER_OPTIONS
		}

		if (!worklet)
		{
			timerOptions.type = AUDIOCONTEXT_WORKER_URI
		}else{
			timerOptions.type = AUDIOTIMER_WORKLET_URI
			timerOptions.processor = AUDIOTIMER_PROCESSOR_URI
		}

		super( timerOptions )
		if (!this.audioContext)
		{
			throw Error('No AudioContext specified')
		}
	}

	/**
	 * 
	 * @param {*} callback 
	 * @param {*} options 
	 */
	startTimer( callback, options={} ){
		
		// on Safari macOS/iOS, the audioContext is suspended if it's not created
		// in the event handler of a user action: we attempt to resume it.
		if (this.audioContext.state === 'suspended') 
		{
			this.audioContext.resume()
		}
		super.startTimer(callback, options)
	}
}