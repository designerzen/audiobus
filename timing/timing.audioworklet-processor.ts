// @ts-nocheck
/**
* A timer that uses the AudioWorklet API
* currentTime is a global variable
*
* @class TimingProcessor
* @extends AudioWorkletProcessor
*/
import {
	CMD_INITIALISE,
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timing.events'

class TimingAudioWorkletProcessor extends AudioWorkletProcessor {
 
	isAvailable = false
	isRunning = false
	// exit = false
	accurateTiming = true

	startTime = -1
	nextInterval = -1
	gap = 0
	intervals = 0		// loop counter

	get elapsed(){
		return currentTime - this.startTime
	}

	constructor() {
	  	super()
		this.port.onmessage = this.onmessage.bind(this)
		this.postMessage({ event:EVENT_READY })
	}

	postMessage( message ){
		this.port.postMessage(message)
	}

	reset(){
		this.intervals = 0
	}

	/**
	 * 
	 * @param {Number} interval in milliseconds
	 * @param {*} accurateTiming 
	 */
	start(interval=250, accurateTiming=true ){
		
		this.gap = interval * 0.001 // 000
		console.error("Timer audioWorklet start with interval "+this.gap)

		if (!this.isRunning)
		{   
			this.startTime = currentTime
			// work out the next step from this step...
			this.nextInterval = this.startTime + this.gap
			this.isRunning = true
			this.postMessage({event:EVENT_STARTING, time:0, intervals:this.intervals})
		}else{
			// work out the next step from this step...
			this.nextInterval = currentTime + this.gap
		}
	
		// INITIAL tick
		this.postMessage({event:EVENT_TICK, time:this.elapsed, intervals:this.intervals })
	}

	/**
	 * 
	 */
	stop(){
		this.isRunning = false
		this.postMessage({ event:EVENT_STOPPING, time:this.elapsed, intervals:this.intervals })
	}

  	/**
	 * We never want the volume to just drop out so we glide between the values
	 * 
	 * @param {Float32Array(128)} inputs 
	 * @param {Float32Array(128)} outputs 
	 * @param {AudioParam} parameters 
	 * @returns {Boolean} keep alive
	 */
	process(inputs, outputs, parameters) {

		const sourceLimit = Math.min(inputs.length, outputs.length)

		// console.log(currentTime, "Processor:process", {sourceLimit, inputs, outputs, parameters})
		// Wwrite the output into each of the outputs
		// By default, the node has single input and output.
		for (let inputIndex = 0; inputIndex < sourceLimit; ++inputIndex) {
			const input = inputs[inputIndex]
			const output = outputs[inputIndex]

			if (input.length === 0){
				//console.error("Processor:FAIL NO INPUT", {input, inputs, output, outputs, parameters})
				continue
			}

			//console.log(inputIndex, "> Processor:process", {input, inputs, output, outputs, parameters})
			for (let channel = 0; channel < output.length; ++channel) {
				output[channel].set(input[channel])
			}
		}

		if (this.isRunning && currentTime >= this.nextInterval )
		{
			// console.info("Timer Processor:BEAT", this.nextInterval, currentTime )
			this.onTick()
		// }else{
			// console.info("Timer WAITING ", this.nextInterval - currentTime )
		}
		
		// check to see the time has elapsed
		return true
	}

	/**
	 * 
	 */
	onTick(){
		this.intervals++
		this.nextInterval = currentTime + this.gap
		this.postMessage({event:EVENT_TICK, time:this.elapsed, intervals:this.intervals })
	}

	/**
	 * Pass in the WAV data or URL to load via worklet 
	 * @param {Event} event 
	 */
	onmessage(event) {
		
		const data = event.data

		// Handling data from the node.
		// console.log("SampleAudioWorkletProcessor:MESSAGE:", {event}, this)
		switch (data.command) {
			
			// 
			case EVENT_READY:
				break;

			case CMD_INITIALISE:
				// this.accurateTiming = data.accurateTiming ?? false
				// this.start(data.interval)
				break

			case CMD_START:
				this.accurateTiming = data.accurateTiming ?? false
				this.start(data.interval)
				break
	
			case CMD_STOP:
				this.stop()
				break
	
			case CMD_UPDATE:
				this.start(data.interval)
				break

			default:
				console.log('[Processor:Received] ' , event)
				console.error("SampleAudioWorkletProcessor: Unknown message type", event)
		}
	}
}
  
const ID = "timing-processor"
registerProcessor(ID, TimingAudioWorkletProcessor)

