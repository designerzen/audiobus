/**
 * A single stream of data from the inputManager
 * through the transformerManager
 * into the outputManager
 */
import InputManager, { EVENT_INPUTS_UPDATED } from "./input-manager"
import OutputManager, { EVENT_OUTPUTS_UPDATED } from "./output-manager"
import TransformerManager, { EVENT_TRANSFORMERS_UPDATED } from "./transformer-manager"
import TransformerManagerWorker from "./transformer-manager-worker"

import { INPUT_EVENT, NOTE_OFF, NOTE_ON, OUTPUT_EVENT, PLAYBACK_START, PLAYBACK_STOP, PLAYBACK_TOGGLE, TEMPO_DECREASE, TEMPO_INCREASE, TEMPO_TAP, MIDI_CLOCK, MIDI_CONTINUE, MIDI_START, MIDI_STOP } from '../commands'
import AudioEvent from "../audio-event"

import type { IAudioCommand } from "../audio-command-interface"
import type Timer from "../timing/timer"
import type AbstractInput from "./inputs/abstract-input"
import type InputAudioEvent from "./events/input-audio-event"
import type { IAudioOutput } from "./outputs/output-interface"
import type OutputAudioEvent from "./events/output-audio-event"
import type { ITransformer } from "./transformers/interface-transformer"

const DEFAULT_OPTIONS = {

}

export default class IOChain extends EventTarget{
	
	static convertAudioCommandsToAudioEvents(commands: IAudioCommand[], timestamp:number=0 ): AudioEvent[]{
		return (commands ?? []).map((command: IAudioCommand) => new AudioEvent(command, timestamp ))
	}

	#timer: Timer

	#audioCommandQueue:IAudioCommand[] = []
	#transformerManager:TransformerManagerWorker
	#inputManager:InputManager
	#outputManager:OutputManager
	#abortController:AbortController

	#pausedQueue: number = 0

	#options:object = {}

	#enabled:boolean = true

	get options():object{
		return this.#options
	}

	get inputManager():InputManager{ 
		return this.#inputManager 
	}
	get transformerManager():TransformerManagerWorker{ 
		return this.#transformerManager 
	}
	get outputManager():OutputManager{ 
		return this.#outputManager 
	}

	get inputs():AbstractInput[] {
		return this.#inputManager.inputs
	}
	get transformers():ITransformer[]{
		return this.#transformerManager.activeTransformers
	}
	get outputs():IAudioOutput[]{ 
		return this.#outputManager.outputs
	}

	get transformerQuantity():number{ 
		return this.#transformerManager.quantity 
	}
	get timer():Timer{ 
		return this.#timer 
	}

	get isQuantised(): boolean {
		return this.#transformerManager.isQuantised
	}

	/**
	 * FIXME: Remove requirement for Timer
	 * @param timer 
	 * @param options 
	 */
	constructor( timer:Timer, options=DEFAULT_OPTIONS ){
		super()

		this.onTransformersChanged = this.onTransformersChanged.bind(this)
		this.onInputEvent = this.onInputEvent.bind(this)
		this.onOutputEvent = this.onOutputEvent.bind(this)
		this.onInputsUpdated = this.onInputsUpdated.bind(this)
		this.onOutputsUpdated = this.onOutputsUpdated.bind(this)
		
		this.#timer = timer
		this.#options = { ...DEFAULT_OPTIONS, ...options }

		this.#transformerManager = new TransformerManagerWorker()
		this.#inputManager = new InputManager()
		this.#outputManager = new OutputManager()

		this.#abortController = new AbortController()

		this.#transformerManager.addEventListener( EVENT_TRANSFORMERS_UPDATED, this.onTransformersChanged, { signal: this.#abortController.signal } )
		this.#inputManager.addEventListener( INPUT_EVENT, this.onInputEvent, { signal: this.#abortController.signal } )
		this.#inputManager.addEventListener( EVENT_INPUTS_UPDATED, this.onInputsUpdated, { signal: this.#abortController.signal } )
		this.#outputManager.addEventListener( OUTPUT_EVENT, this.onOutputEvent, { signal: this.#abortController.signal } )
		this.#outputManager.addEventListener( EVENT_OUTPUTS_UPDATED, this.onOutputsUpdated, { signal: this.#abortController.signal } )
	}

	// Transformers ---------------------------------------
	appendTransformer( transformer:Transformer ){
		this.#transformerManager.appendTransformer( transformer )
	}

	removeTransformer( transformer:Transformer ){
		this.#transformerManager.removeTransformer( transformer )
	}

	setTransformers( transformers:Transformer[] ){
		this.#transformerManager.setTransformers( transformers )
	}

	/**
	 * Transform all commands and add them to our commandQueue
	 * @param audioCommands 
	 * @param timer 
	 * @returns 
	 */
	transform( audioCommands:IAudioCommand[], timer:Timer ){
		return this.#transformerManager.transform( audioCommands, timer )
				.then((transformedAudioCommands: IAudioCommand[]) => {
					this.#audioCommandQueue.push(...transformedAudioCommands)
				})
				.catch((error) => {
					console.error('Transform failed:', error)
					// this.#audioCommandQueue.push(audioCommand)
				})
	}

	// Commands -------------------------------------------

	/**
	 * Add a single command
	 * @param command 
	 */
	addCommand( command:IAudioCommand ){
		this.#audioCommandQueue.push(command)
	}

	/**
	 * Add multiple commands
	 * @param commands 
	 */
	addCommands( commands:IAudioCommand[] ){
		this.#audioCommandQueue.push(...commands)
	}

	/**
	 * Remove all note on and note off commands
	 * (leave all other commands)
	 * cancel any scheduled commands
	 * cancel any playing sounds
	 */
	clearNoteCommands():void{
		this.#audioCommandQueue = this.#audioCommandQueue.filter(cmd =>
			cmd.type !== NOTE_ON && cmd.type !== NOTE_OFF
		)
		this.outputManager.allNotesOff()	
	}

	/**
	 * Process the queue.
	 * Actions every single Command with a startAt set in the past
	 * and returns the commands in order of creation that are in the
	 * future or not yet set to trigger
	 * @param queue
	 */
	executeQueueAndClearComplete( now:number, accumulatorLimit:number=24*12 ):IAudioCommand[]{

		const queue: IAudioCommand[] = this.#audioCommandQueue

		if (!queue || queue.length === 0) {
			return []
		}

		// only trigger commands started in the past
		// queue = queue.filter(audioCommand => audioCommand.startAt <= now)
		const activeCommands: IAudioCommand[] = []
		const remainingCommands: IAudioCommand[] = []

		// act on all data in the buffer...
		let unplayedAccumulator = 0
		const quantity = queue.length
		for (let i = 0; i < quantity && unplayedAccumulator < accumulatorLimit; i++) {
			const audioCommand: IAudioCommand = queue[i]
			const shouldTrigger = audioCommand.startAt <= now
			if (shouldTrigger) {
				activeCommands.push(audioCommand)
				// Transformations already applied at input time, just execute
				// const events = convertAudioCommandsToAudioEvents([audioCommand])
				// recorder.addEvents(events)
				// const triggers = triggerAudioCommandsOnDevice(events)
				// console.info("AudioCommand triggered in time domain", {audioCommand, triggers, timer} )
			} else {
				// ignore this command as it is not yet ready
				unplayedAccumulator++
				remainingCommands.push(audioCommand)
			}
		}

		// update remaining queue
		this.#audioCommandQueue = remainingCommands

		return activeCommands
	}
	
	/**
	 * Check queue for Commands in the past
	 * @param now 
	 * @param divisionsElapsed 
	 * @param state 
	 * @returns IAudioCommand[]
	 */
	updateTimeForCommandQueue( now:number, divisionsElapsed:number, state:State ):IAudioCommand[]{
		let activeCommands:IAudioCommand[]

		// Always process the queue, with or without quantisation
		if (this.transformerManager.isQuantised) 
		{
			console.info("TICK:QUANTISED", {divisionsElapsed, quantisationFidelity:chain.transformerManager.quantiseFidelity})
			// When quantised, only trigger events on the grid
			const gridSize = this.transformerManager.quantiseFidelity
			if ((this.#pausedQueue === 0) && (divisionsElapsed % gridSize) === 0) 
			{
				activeCommands = this.executeQueueAndClearComplete( now )

				// if grid is set to true in options, we can only ever play one
				// note at a time on this grid point
				this.#pausedQueue = state && state.get("grid") ? gridSize - 1 : 0
				// console.info( pausedQueue, "TICK:QUANTISED", {buffer: audioCommandQueue, divisionsElapsed, quantisationFidelity:transformerManager.quantiseFidelity})
			} else {
				// reset duplicator
				this.#pausedQueue = Math.max(0, this.#pausedQueue - 1)
				activeCommands = []
				// console.info( pausedQueue, "TICK:IGNORED", {buffer: audioCommandQueue, divisionsElapsed, quantisationFidelity:transformerManager.quantiseFidelity})
			}

		} else {

			// When not quantised, process queue immediately on every tick
			activeCommands = this.executeQueueAndClearComplete( now )
			
			if (activeCommands.length)
			{	
				console.info("TICK:IMMEDIATE", { activeCommands, divisionsElapsed})
			}
		}

		return activeCommands
	}

	/**
	 * Take a command and add it to the scheduler
	 * and then either transform it or leave it raw
	 * @param audioCommand 
	 * @param transform 
	 * @returns 
	 */
	async addCommandToQueue( audioCommand:IAudioCommand, transform:boolean=this.#enabled ){
		if (transform){
			this.transformerManager.transform([audioCommand], this.timer)
				.then((transformedAudioCommands: IAudioCommand[]) => {
					this.addCommands(transformedAudioCommands)
				})
				.catch((error) => {
					// console.info('Transform failed:', error)
					this.addCommand(audioCommand)
				}).finally(p=>{
					// now handle this input through the transformerManager
					// console.info( "IOChain:onInputEvent", {audioCommand} )
				})
		}else{
			this.addCommand(audioCommand)
		}
		return audioCommand
	}

	/**
	 * Schedule a series of commands to trigger in the 
	 * future using NOW as the registration time
	 * TODO: Add timestretching and time domain reconfig
	 * @param commands 
	 * @param timer 
	 * @param transform 
	 * @param startDelay 
	 * @returns IAudioCommand[]
	 */
	addCommandToFuture(commands: IAudioCommand[], timer:Timer, transform:boolean=false, startDelay:number=3):IAudioCommand[]{
		commands.forEach(command => {
			// shift it into the future
			command.startAt += timer.now + startDelay
			this.addCommandToQueue(command, transform)
		})

		return commands
	}
	
	/**
	 * OutputManager - trigger commands
	 * @param commands 
	 * @returns 
	*/
	triggerAudioCommandsOnDevice(commands: IAudioCommand[]){
		return this.outputManager.triggerAudioCommandsOnOutputs(commands)
	}
	
	// Inputs -------------------------------------------
	addInput( input:AbstractInput ){
		this.#inputManager.add(input)
	}
	addInputs( inputs:AbstractInput[] ){
		inputs.forEach(input => this.#inputManager.add(input))
	}
	removeInput( input:AbstractInput ){
		this.#inputManager.remove(input)
	}

	/**
	 * Fetch a specific input by ID
	 * @param name 
	 * @returns 
	 */
	getInput(name:string):AbstractInput{
		return this.#inputManager.getInput(name)
	}

	// Outputs -------------------------------------------
	addOutput( output:IAudioOutput ){
		this.#outputManager.add(output)
	}
	addOutputs( outputs:IAudioOutput[] ){
		outputs.forEach(output => this.addOutput(output))
	}
	removeOutput( output:IAudioOutput ){
		this.#outputManager.remove(output)
	}

	/**
	 * Cancel any playing notes and let them settle
	 */
	allNotesOff():void {
		// Clear the audio command queue of pending note commands
		this.clearNoteCommands()
		// Cancel any currently playing notes
		this.outputManager.allNotesOff()
	}

	/**
	 * Kill this and clean up
	 */
	destroy():void{
		this.#abortController.abort()
	}

	// EVENTS -----------------------------------------------

	/**
	 * User has inputted something
	 * Now we have received these commands
	 * we can decide how to react
	 * either we cache them for scheduling later
	 * or we trigger them immediately
	 * but we always add them to our queue
	 * @param inputEvent 
	 */
	onInputEvent( inputEvent:InputAudioEvent ){
		
		inputEvent.preventDefault()
		
		// extract command and add to queue for consumption later
		const audioCommand:IAudioCommand = inputEvent.command
		switch ( audioCommand.type ) {
			
			case PLAYBACK_TOGGLE:
				this.timer.toggle()
				break

			case PLAYBACK_START:
			case MIDI_START:
				this.timer.start()
				break

			case PLAYBACK_STOP:
			case MIDI_STOP:
				this.timer.stop()
				break

			case TEMPO_TAP:
				this.timer.tapTempo()
				break

			case TEMPO_INCREASE:
				this.timer.BPM++
				break

			case TEMPO_DECREASE:
				this.timer.BPM--
				break

			case MIDI_CLOCK:
				// MIDI clock signal received - update timing if available in command
				if ((audioCommand as any).bpm) {
					// Synchronize to MIDI clock BPM if provided
					this.timer.BPM = Math.round((audioCommand as any).bpm)
				}
				break

			case MIDI_CONTINUE:
				// Continue playback from current position (MIDI clock command)
				if (!this.timer.isRunning) {
					this.timer.start()
				}
				break
		}
		// NB. ensure that the timing is set for it to be scheduled
		this.addCommandToQueue(audioCommand).then( t=>{
			// redispatch event (do not update UI yet)
			this.dispatchEvent( inputEvent.clone() )					
		})
	}

	/**
	 * The Input array has changed
	 * @param inputEvent 
	 */
	onInputsUpdated( inputEvent:CustomEvent ){
		inputEvent.preventDefault()
		this.dispatchEvent( new CustomEvent( inputEvent.type ) )
	}

	/**
	 * Transformer has moved, been added or removed
	 * @param transformerEvent 
	 */
	onTransformersChanged(transformerEvent:CustomEvent):void{
		transformerEvent.preventDefault()
		this.dispatchEvent( new CustomEvent(transformerEvent.type, {detail:transformerEvent.detail}) )
	}

	/**
	 * An Output event has occurred in OutputManager
	 * @param outputEvent 
	 */
	onOutputEvent( outputEvent:OutputAudioEvent ):void{
		const command:IAudioCommand = outputEvent.command
		outputEvent.preventDefault()
		this.dispatchEvent( outputEvent.clone() )
	}

	/**
	 * Outputs have been updated in the OutputManager
	 * @param outputEvent 
	 */
	onOutputsUpdated( outputEvent:CustomEvent ):void{
		outputEvent.preventDefault()
		this.dispatchEvent( new CustomEvent( outputEvent.type ) )
	}
}


