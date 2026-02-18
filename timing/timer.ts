/**
 * Instance based version of timing
 * To allow hybrid timing events and for multiple
 * clocks to run at different rates
 */
import {
	CMD_START,CMD_STOP,CMD_UPDATE,
	EVENT_READY, EVENT_STARTING, EVENT_STOPPING, EVENT_TICK
} from './timing.events.js'

import AUDIOCONTEXT_WORKER_URI from './timing.audiocontext.worker.js?url'
import AUDIOCONTEXT_WORKLET_URI from './timing.audioworklet.js?url'

import { tapTempoQuick } from './tap-tempo.js'
import { Ticks } from './ticks.js'

// import AUDIOCONTEXT_WORKER_URI from './timing.audiocontext.worker.js?worker&url'
// import AUDIOTIMER_WORKLET_URI from './timing.audioworklet.js?worker&url'
// import AUDIOTIMER_PROCESSOR_URI from './timing.audioworklet-processor.js?worker&url'
// import { createTimingProcessor } from './timing.audioworklet.js'


// Timing Constants and conversions
export const SECONDS_PER_MINUTE = 60
export const MICROSECONDS_PER_MINUTE = SECONDS_PER_MINUTE * 1_000

export const MAX_BARS_ALLOWED = 32

const DEFAULT_TIMER_OPTIONS = {

	bars:16,
	// keep this at 24 to match MIDI1.0 spec
	// where there are 24 ticks per quarternote (one beat)
	divisions:24,

	bpm:90,

	contexts:null,

	// can be base64 encoded too
	type:AUDIOCONTEXT_WORKER_URI,

	// type:AUDIOTIMER_WORKLET_URI,
	// processor:AUDIOTIMER_PROCESSOR_URI,
	callback:null
}

/**
 * Convert a BPM to a period in ms
 * @param {Number} bpm beats per minute
 * @returns {Number} time in milliseconds
 */
export const convertBPMToPeriod = (bpm) => MICROSECONDS_PER_MINUTE / parseFloat(bpm)

/**
 * Convert a period in ms to a BPM
 * @param {Number} period millisecods
 * @returns {Number} time in milliseconds
 */
export const convertPeriodToBPM = (period) => MICROSECONDS_PER_MINUTE / parseFloat(period)

/**
 * Convert a midi clock to BPM
 * @param {Number} millisecondsPerClockEvent 
 * @param {Number} pulsesPerQuarterNote  MIDI clock sends 24 pulses per quarter note (PPQN)
 * @returns Number
 */
export const convertMIDIClockIntervalToBPM = (millisecondsPerClockEvent, pulsesPerQuarterNote = 24) => {
    
    // Calculate the time for one quarter note in milliseconds
    // If 1 clock event takes `millisecondsPerClockEvent` ms,
    // then 24 clock events (1 quarter note) take `24 * millisecondsPerClockEvent` ms.
    const millisecondsPerQuarterNote = millisecondsPerClockEvent * pulsesPerQuarterNote

    // Convert milliseconds per quarter note to BPM
    // BPM = (milliseconds in a minute) / (milliseconds per beat)
    // 1 minute = 60,000 milliseconds
    return convertPeriodToBPM(millisecondsPerQuarterNote)
}

/**
 * Converts seconds to ticks at a given bpm.
 * Uses internal tick resolution where 3840 ticks = 1 quarter note
 * @param seconds Time in seconds
 * @param bpm Beats per minute
 * @param resolution Optional: ticks per quarter note (default: 3840)
 * @returns Number of ticks (internal timing units)
 */
export const secondsToTicks = (seconds: number, bpm: number, resolution: number = Ticks.Beat): number => {
    const quarterNoteDurationSeconds = SECONDS_PER_MINUTE / bpm
    const ticksPerSecond = resolution / quarterNoteDurationSeconds
    return seconds * ticksPerSecond
}

/**
 * Pass in a Timer, return a formatted time
 * such as HH:MM:SS
 */
export const formatTimeStampFromSeconds = (seconds:number) => {
	const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = (seconds % 60)
    const milliseconds = (remainingSeconds%1).toFixed(2).slice(2)
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(Math.floor(remainingSeconds)).padStart(2, '0')}:${String(milliseconds).padStart(2, '0')}`
}

/**
 * Simple boolean test to work out if this is a Worklet
 * or a simple Worker file (not very smart - may break in future)
 * @param file 
 * @returns 
 */
export const isFileWorklet = (file) => {
	
	if (file.indexOf("orklet") > -1 ) {
		return true
	}
	if (file.indexOf("data:text/javascript;base64,") > -1 ) {
		return true
	}
	return false
}


export default class Timer {

	startTime = -1
	period = 100

	// for time formatting...
	currentBar = 0

	divisions = 24	// 24 quarter notes in a bar
	bars = 16		// 16 bars in a measure
	swingOffset = 0	// from 0 -> divisions

	divisionsElapsed = 0
	totalBarsElapsed = 0

	lastRecordedTime = 0
	lastRecordedExternalTime = 0
	
	isRunning = false
	isCompatible = false
	isBypassed = false
	isActive = false

	timingWorkHandler

	loaded = new Promise( this.onAvailable, this.onUnavailable )
	
	callback

	// we overwrite this with an audioContext if available
	getNow = () => performance.timeOrigin + performance.now()

	/**
	 * Can we use this timing method on this device?
	 * @returns {Boolean} is the worker available and compatable
	 */
	get available() { 
		return this.isCompatible 
	}

	/**
	 * Can we use this timing method on this device?
	 * @returns {Boolean} is the worker available and compatable
	 */
	get running() { 
		return this.isRunning 
	}

	/**
	 * Accurate time in milliseconds
	 * @returns {Number} The current time as of now
	 */
	get now(){ 
		return this.getNow() 
	}

	/**
	 * Fetch current bar length in milliseconds
	 * @returns {Number} bar length in milliseconds
	 */
	get timeBetween(){ 
		return this.period
	} 

	/**
	 * Amount of time elapsed since startTimer() in seconds
	 * @returns {Number} in seconds
	 */
	get timeElapsed() { 
		// How long has elapsed according to audio context
		return (this.now - this.startTime)// * 0.001 
	}
		
	/**
	 * Fetch whole loop length in milliseconds
	 * @returns {Number} length in milliseconds
	 */
	get totalTime(){ 
		return this.timePerBar * this.bars 
	}

	/**
	 * Fetch current bar
	 * @returns {Number} current bar
	 */
	get bar(){ 
		return this.currentBar 
	}

	/**
	 * Fetch total bars completed
	 * @returns {Number} total bars
	 */
	get barsElapsed(){
		return Math.floor( this.totalBarsElapsed / this.bars )
	}
	
	get elapsedSinceLastTick(){
		return this.now - this.lastRecordedTime
	}

	/**
	 * Fetch total bar quantity
	 * @returns {Number} total bars
	 */
	get totalBars(){ 
		return this.bars 
	} 

	get totalDivisions(){
		return this.divisions
	}

	/**
	 * Percentage duration of bar progress 0->1
	 * @returns {Number} percentage elapsed
	 */
	get barProgress(){
		return this.currentBar / this.bars
	}

	/**
	 * Percentage duration of beat progress 0->1
	 * @returns {Number} percentage elapsed
	 */
	get beatProgress(){
		return this.divisionsElapsed / this.totalDivisions 
	}


	// Bar times

	/**
	 * Fetch current bar length in milliseconds
	 * @returns {Number} bar length in milliseconds
	 */
	get timePerBar(){
		return this.period * this.divisions 
	}

	/**
	 * Get the current timing as Beats per minute
	 * BPM = 60,000,000 / MicroTempo
	 * @returns {Number} BPM
	 */
	get BPM (){
		return MICROSECONDS_PER_MINUTE / this.timePerBar
	}
	get bpm (){
		return this.BPM
	}

	/**
	 * Get the duration of one beat (quarternote) 
	 * in microseconds
	 * @returns {Number} Microtempo
	 */
	get quarterNoteDuration (){ 
		return MICROSECONDS_PER_MINUTE / this.bpm
	}
	
	/**
	 * Get the duration of one beat (quarternote) 
	 * in seconds
	 */
	get quarterNoteDurationInSeconds (){ 
		return SECONDS_PER_MINUTE / this.bpm
	}

	/**
	 * Get the current timing as a Microtempo 
	 * @returns {Number} Microtempo
	 */
	get microTempo (){ 
		return this.timePerBar * 0.001
	}

	/**
	 * Get the current timing in Micros per MIDI clock
	 * MicrosPerMIDIClock = MicroTempo / 24 (MIDI 1.0 has 24 divisions)
	 * @returns {Number} Microtempo
	 */
	get microsPerMIDIClock(){
		return this.microTempo / this.divisions
	}

	/**
	 * How many Ticks are there every second?
	 */
	get ticksPerSecond(){
		return Ticks.Beat / this.quarterNoteDurationInSeconds
	}
	
	get swing(){
		return this.swingOffset / this.divisions
	}

	
	// Positions & booleans

	get isAtStartOfBar(){
		return this.barProgress === 0
	}
	get isStartBar(){
		return this.currentBar === 0
	}
	get isAtStart(){
		return this.divisionsElapsed === 0
	}
	get isAtMiddleOfBar(){
		return this.barProgress === 0.5
	}
	get isQuarterNote(){
		return this.beatProgress % 0.25 === 0 
	}
	get isHalfNote(){
		return this.beatProgress % 0.5 === 0 
	}
	get isSwungBeat(){
		return this.divisionsElapsed % this.swingOffset === 0
	}
	get isUsingExternalTrigger(){
		return this.isBypassed
	}

	// Setters ------------------------------------------------------

	/**
	 * Fetch current bar
	 * @returns {Number} current bar
	 */
	set bar(value){
		this.currentBar = parseInt(value)
	}

	/**
	 * Allows a user to set the total number of bars
	 * @param {Number} value How many bars to have in a measure
	 * @returns {Number} total bars
	 */
	set totalBars(value) {
		this.bars = value < 1 ? 1 : value > MAX_BARS_ALLOWED ? MAX_BARS_ALLOWED : value
	}

	/**
	 * Set the current timing using a BPM where 
	 * one beat in milliseconds =  60,000 / BPM
	 * 
	 * @param {Number} bpm Beats per minute
	 * @returns {Number} period
	 */
	set BPM( value ){
		this.timeBetween = 60000 / Math.max(10, parseFloat(value) )
	}
	set bpm( value ){
		this.BPM = value
	} 
	set tempo( value ){
		this.BPM = value
	} 
 
	/**
	 * Using a time in milliseconds, set the amount of time between tick and tock
	 * @param {Number} time Amount of millieconds between ticks
	 * @returns {Number} period
	 */
	set timeBetween(time) {

		const interval =  time / this.divisions
		// we want 16 notes
		this.period = interval

		// TODO
		// FIXME
		// if it is running, stop and restart it?
		//interval = newInterval
		this.postMessage({
			command:CMD_UPDATE, 
			interval,
			time:this.now 
		})
	}

	/**
	 * Passed in the onBeat callback as a variant
	 * to determine when the "beat" should occur
	 */
	set swing( value ){
		this.swingOffset = value * this.divisions
	}

	constructor( options=DEFAULT_TIMER_OPTIONS ){
		options = {...DEFAULT_TIMER_OPTIONS, ...options}
		const optionKeys = Object.keys(options)
		// const { contexts, type=AUDIOTIMER_WORKLET_URI, divisions=DIVISIONS, processor=AUDIOTIMER_PROCESSOR_URI} = options

		for (let key of optionKeys)
		{
			switch(key)
			{
				case "audioContext":
					this.audioContext = options.audioContext
					this.getNow = () => this.audioContext.currentTime * 1000
					
					break

				case "contexts":
					for (let context in options.contexts){
						this[context] = options.contexts[context]
					}
					this.getNow = () => this.audioContext ? this.audioContext.currentTime * 1000 : performance.now()
					break

				default:
					this[key] = options[key]
					console.warn("Timer option", key, options[key])
			}			
		}

		// 
		const isWorklet = isFileWorklet(options.type)
		console.info("Timer:", options.type, this.timingWorkHandler, {isWorklet, options} )

		if (isWorklet)
		{
			this.loaded = this.setTimingWorklet( options.type, options.processor, this.audioContext )
		}else{
			this.loaded = this.setTimingWorker( options.type )
		}		
	}

	/**
	 * Set the function that gets called on every divixional tick
	 * @param {Function} callback Method to call when the timer ticks
	 */
	setCallback( callback ){
		this.callback = callback
	}

	/**
	 * Allows us to disable the existing route to send our own
	 * or to inject them into here 
	 * 
	 * @param {Boolean} useExternalClock 
	 * @returns 
	 */
	bypass( useExternalClock=true ){

		const trigger = ( ) =>{
			// call callback
			this.externalTrigger()
		}

		if (useExternalClock){
			if (this.isBypassed)
			{
				return trigger
			}
			// we want to bypass the worker's work
			this.isBypassed = true
			if (this.isRunning)
			{
				// disconnect but don't destroy
				this.disconnectWorker( this.timingWorkHandler, false )
				console.info("timer runinng, bypassing... ")
			}else{
				console.info("bypassing... ignored")
			}
			
		}else{
			if (!this.isBypassed)
			{
				return trigger
			}
			this.isBypassed = false
			if (this.isRunning)
			{
				this.startTimer()
				console.info("restarting timer... ")
			}else{
				console.info("undoing bypass... ignored")
			}
		}

		return trigger
	}

	// CONVERSIONS --------------------------------------------------------------------------------
	
	/**
	 * Convert seconds to MIDI clock ticks based on current BPM
	 * @param seconds Time in seconds
	 * @returns Number of MIDI clock ticks (24 ticks per quarter note)
	 */
	secondsToTicks(seconds: number): number {
   		return seconds * this.ticksPerSecond
	}

	/**
	 * Convert time to ticks using the current tick per second rate
	 * @param time 
	 * @returns 
	 */
	convertToTicks( time ) {
		return time / this.ticksPerSecond
	}

	createTick( intervals, timePased ){
		const timeBetweenPeriod = this.timeBetween * 0.001
		// Expected time stamp
		const expected = intervals * timeBetweenPeriod
		// How long has elapsed according to our worker
		const timePassed = timePased
		// how much spill over the expected timestamp is there
		const lag = timePassed % timeBetweenPeriod
		// should be 0 if the timer is working...
		const drift = timePassed - this.timeElapsed
		// deterministic intervals not neccessary
		const level = Math.floor(timePassed / this.timeBetween)
		// elapsed should === time
		if (this.isRunning){
			this.onTick(timePassed,expected, drift, level, intervals, lag)
		}
	}

	// WORKLET ------------------------------------------------------------------------------------

	/**
	 * Set the worklet as the main timing mechanism
	 * @param {String} type 
	 * @param {String} processor 
	 * @param {AudioContext} audioContext 
	 */
	async setTimingWorklet( type, processor, audioContext ) {
		
		let wasRunning = this.isRunning

		// destroy any existing worklet
		if (this.timingWorkHandler)
		{
			await this.unsetTimingWorker()
		}

		const imports = await import( './timing.audioworklet.js' )
		const Worklet = imports.default
		const {createTimingProcessor} = imports 

		this.timingWorkHandler = await createTimingProcessor( audioContext )	
		// this.timingWorkHandler = new Worklet( audioContext )
	
		// console.error(type, "timer.audioworklet", {module, audioContext}, this.timingWorker ) 
		if (wasRunning)
		{
			this.startTimer()
		}
		return this.timingWorkHandler
	}

	// WORKER ------------------------------------------------------------------------------------

	/**
	 * Load in the Worker URI
	 * @param {String} type or URi 
	 * @returns 
	 */
	async loadTimingWorker(type){
		const url = new URL( type, import.meta.url )
		const worker = new Worker(url, { type: 'module' })
		return worker
	}

	/**
	 * In the future, we may be able to pass offlineAudioContext to a worker
	 * and at that point, we can finally tie in the actual timing by using the 
	 * context as the global clock!
	 * NB. We NOW CAN! User the setTimingWorklet instead :)
	 * @param {String} type 
	 * @returns 
	 */
	async setTimingWorker(type){
		try{

			let wasRunning = this.isRunning

			// destroy any existing worker
			if (this.timingWorkHandler)
			{
				await this.unsetTimingWorker()
			}

			this.timingWorkHandler = await this.loadTimingWorker(type)		
			
			if (!this.timingWorkHandler)
			{
				throw Error ("Timing Worker failed to load url:"+url+ " type:" + type)
			}
		
	
			if (wasRunning)
			{
				console.info("Starting timer worker", type, this.timingWorkHandler )
				this.startTimer()
			}else{
				console.info("Awaiting timer worker", type, this.timingWorkHandler )
			}

			return this.timingWorkHandler

		}catch(error){

			this.isCompatible = false
			console.error("Timing WORKER FAILED TO LOAD", type, error)
		}	
		return null
	}

	/**
	 * Unregister any Worker set
	 * @returns {Boolean}
	 */
	async unsetTimingWorker(){
		// TODO: clone the methods into new worker
		this.stopTimer()
		this.timingWorkHandler.terminate()
		this.timingWorkHandler.onmessage = (e) => {}
		this.timingWorkHandler.onerror = (e) => {}
		this.timingWorkHandler = null
		return true
	}

	// SHARED WORKER / WORKLET CDE ------------------------------------------------------------------------------------
	
	/**
	 * Add a worker or worklet into the pipeline
	 * and monitor it's events and messages
	 * @param {Worker} worker 
	 */
	connectWorker( worker ){

		if (!worker){
			throw new Error("Timing Worker was not defined - please check paths "+worker)
		}

		// now hook into our worker bee and watch for timing changes
		worker.onmessage = (e) => {

			const time = this.now
			const data = e.data

			switch(data.event)
			{
				case EVENT_READY:
					//console.log("EVENT_READY", {time, data}) 
					break

				case EVENT_STARTING:
					// save start time
					this.startTime = time
					this.isRunning = true
					this.resetTimer()
					//console.log("EVENT_STARTING", {time:data.time, startTime})
					break

				case EVENT_TICK:
					// const timeBetweenPeriod = this.timeBetween * 0.001
					// // How many ticks have occured yet
					// const intervals = data.intervals
					// // Expected time stamp
					// const expected = intervals * timeBetweenPeriod
					
					// // How long has elapsed according to our worker
					// const timePassed = data.time
					// // how much spill over the expected timestamp is there
					// const lag = timePassed % timeBetweenPeriod
					// // should be 0 if the timer is working...
					// const drift = timePassed - this.timeElapsed
					// // deterministic intervals not neccessary
					// const level = Math.floor(timePassed / this.timeBetween)
					// // elapsed should === time
					// this.onTick(timePassed,expected, drift, level, intervals, lag)

					// timingWorker.postMessage({command:CMD_UPDATE, time:currentTime, interval})
					this.createTick( data.intervals, data.time )
					break

				default:
					console.log("message: " , e, time)
			}
		}

		// Worker Loading Error!
		worker.onerror = error =>{
			const payload = {error:error.message, time:this.now }
			console.error("Timer:Worker error", error, payload )
			worker.postMessage( payload )
		}
	}

	postMessage(payload){
		this.timingWorkHandler && this.timingWorkHandler.postMessage(payload)
	}

	/**
	 * Disconnect the worker from the timer
	 * @param {Worker} worker 
	 */
	disconnectWorker(worker, setStopped=true){
		worker.onmessage = (e) => {
			switch(e.event)
			{
				// Clean up
				case EVENT_STOPPING:
					// destroy contexts and unsubscribe from events
					if (setStopped)
					{
						this.isRunning = false
					}
					break
			}
		}

		worker.postMessage({
			command:CMD_STOP, 
			time:this.now
		})
	}

	//--------------------------------------------------

	/**
	 * Reset the timer and start from the beginning
	 */
	resetTimer(){
		this.currentBar = 0
		this.totalBarsElapsed = 0
		this.divisionsElapsed = 0
	}

	start(){
		this.startTimer( this.callback )
	}
	stop(){
		this.stopTimer()
	}
	toggle(){
		this.toggleTimer( this.callback )
	}

	/**
	 * Starts the timer and begins events being dispatched
	 * 
	 * @returns {Object} current time and timingWorker
	 */
	async startTimer( callback, options={} ){

		await this.loaded

		const currentTime = this.now

		if (!this.isRunning)
		{
			// FIXME: Alter this behaviour for rolling count
			this.totalBarsElapsed = 0
		}

		if (callback)
		{
			this.setCallback(callback)
		}
				
		// if we are using an external clock
		// we try and determine the tempo ourselves
		if (this.isBypassed)
		{
			this.isRunning = true
			return {
				time:currentTime, 
				interval:-1,
				worker:null
			}
		}

		this.connectWorker( this.timingWorkHandler )
	
		const payload = {
			command:CMD_START, 
			time:currentTime, 
			interval:this.period,
			// FIXME:
			accurateTiming:false
		}
		// send command to worker... options
		this.postMessage(payload)
		
		// console.log("Timer Starting...", { payload, timingWorker: this.timingWorkHandler} )

		return {
			time:currentTime, 
			interval:this.period,
			worker:this.timingWorkHandler
		}
	}

	/**
	 * Stops the timer and prevents events being dispatched
	 * @returns {Object} current time and timingWorker
	 */
	async stopTimer() {

		await this.loaded

		const currentTime = this.now
		// cancel the thing thrugh the workers first
		// cancel any scheduled quie noises
		this.disconnectWorker( this.timingWorkHandler )

		return {
			currentTime,
			worker:this.timingWorkHandler
		}
	}

	/**
	 * Start the timer if it is paused...
	 * or stop the timer if it is running
	 * 
	 * @param callback 
	 * @param options 
	 * @returns {Boolean} is the timer running
	 */
	async toggleTimer( callback, options={} ){
		if (this.isBypassed)
		{
			// we are using an external timer!
			return this.isRunning
		}
		if (!this.isRunning)
		{
			await this.startTimer( callback, options )
		}else{
			await this.stopTimer()
		}
		return this.isRunning
	}

	/**
	 * Tap a tempo into the system
	 * requires 3 taps to set the tempo
	 */
	tapTempo(){
		const tempo = tapTempoQuick()
		if (tempo > -1 ){
			this.BPM = tempo
			return tempo
		}
	}

	/**
	 * Use an external device to send clock signals to and through this timer
	 * such as the MIDI clock signal
	 */
	externalTrigger( advance=true ){
		// How long has elapsed according to our clock
		const timestamp = this.now
		this.lastRecordedExternalTime = timestamp
		
		// work out the BPOM from the clock...
		// const BPM = convertPeriodToBPM( period * 24 )
		
		// const period = tapTempo(true, 10000, 3)
		const elapsedSinceLastClock = timestamp - this.lastRecordedExternalTime
		// Expected time stamp
		const expected = this.divisionsElapsed * elapsedSinceLastClock
		// how much spill over the expected timestamp is there
		const lag = timestamp % elapsedSinceLastClock
		// should be 0 if the timer is working...
		const drift = timestamp - expected
		// deterministic intervals not neccessary
		const level = Math.floor(timestamp / elapsedSinceLastClock )
		
		// console.log("MIDI CLOCK", BPM, period, elapsedSinceLastClock, timestamp )
	
		if (this.isRunning && this.isBypassed)
		{
			this.onTick(elapsedSinceLastClock, expected, drift, level, this.divisionsElapsed, lag)
		}
		if (advance)
		{
			this.divisionsElapsed++
		}
	}


	/**
	 * Repeat previous clock tick but do not advance
	 */
	retrigger(){
		console.info("retrigger:Timer", this )
		this.externalTrigger(false)
		// this.createTick( data.intervals, data.time )			
	}

	// EVENTS =============================================================================

	/**
	 * EVENT: Timer is available
	 */
	onAvailable(){
		// console.info("Timer is available")
	}

	/**
	 * EVENT: Timer is unavailable
	 */
	onUnavailable(){
		// console.error("Timer is unavailable")
	}

	/**
	 * Occurs 24 times per beat
	 * Call the callback with internal flags
	 * @param {Number} timePassed 
	 * @param {Number} expected 
	 * @param {Number} drift 
	 * @param {Number} level 
	 * @param {Number} intervals 
	 * @param {Number} lag 
	 */
	onTick(timePassed, expected, drift=0, level=0, intervals=0, lag=0){
		
		//console.info("Timer:onTick", {timePassed, expected, drift, level, intervals, lag} )
		this.lastRecordedTime = timePassed

		// check if bar has completed
		if (++this.divisionsElapsed >= this.divisions)
		{
			++this.totalBarsElapsed
			this.currentBar = (this.currentBar+1) % this.bars
			this.divisionsElapsed = 0
		}
	
		// let us determine if we are on a swung beat
		const swung = this.divisionsElapsed%this.swingOffset === 0

		this.callback && this.callback({
			bar:this.currentBar, bars:this.totalBars, 
			divisionsElapsed:this.divisionsElapsed, 
			barsElapsed:this.barsElapsed, 
			elapsed: this.timeElapsed,
			//performance
			timePassed, expected, drift, level, intervals, lag
		})
	}
}
