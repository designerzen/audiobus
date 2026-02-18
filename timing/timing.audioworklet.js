import AUDIOTIMER_PROCESSOR_URI from './timing.audioworklet-processor.js?worker&url'

/**
 * Wrap the above in a single call
 * @param {AudioContext} context 
 * @returns 
 */
export const createTimingProcessor = async (context) =>{
	try{
		await context.audioWorklet.addModule(AUDIOTIMER_PROCESSOR_URI)
	}catch(error){
		console.error("AudioWorklet processor cannot be added", error)
	}
	const worker = new TimingAudioWorkletNode(context)

	return worker
}


import {
	CMD_INITIALISE,
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timing.events.js'

/**
 * Gateway to the metronome AudioWorkletProcessor
 * If you add this node to your audio pipeline it 
 * should disptch events at the correct times
 */
export default class TimingAudioWorkletNode extends AudioWorkletNode {

	static get parameterDescriptors() {
		return [
			{
				name: "rate",
				defaultValue: 440.0,
				minValue: 27.5,
				maxValue: 4186.009
			}
		]
	}
	
	interval = 10
	
	onmessage

	constructor(audioContext, accurateTiming=false) 
	{
		super(audioContext, "timing-processor")
		this.accurateTiming = accurateTiming
		this.port.onmessage = this.onMessageReceived.bind(this)
		this.postMessage({command:CMD_INITIALISE, accurateTiming})
		// this.start()
	}

	/**
	 * Pass message to Processor Worklet
	 * @param {Object} data 
	 * @returns 
	 */
	postMessage( data ){
		return this.port.postMessage(data)
	}

	start(){
		this.postMessage({command:CMD_START, interval:this.interval, accurateTiming:this.accurateTiming })
	}

	stop(){
		this.postMessage({command:CMD_STOP})
	}

	/**
	 * PUBLIC: To match other Worker style APIs
	 */
	terminate(){
		// FIXME: 
	}

	onMessageReceived(event) {
		const data = event.data
		
		// console.log("onmessage:", this.onmessage,{data, event})
		switch(data.event)
		{
			case EVENT_TICK:
				//console.log("AudioWorkletNode:onmessage:", data)
				break

			default:
				// console.error("AudioWorkletNode:onmessage unknown:",data.event,EVENT_TICK === data.event,EVENT_TICK, {event})
		}

		if ( this.onmessage )
		{
			this.onmessage(event)
		}else{
			// console.info("no external callback", this)
		}
	}
}
