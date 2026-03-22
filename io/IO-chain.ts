/**
 * A single stream of data from the inputManager
 * through the transformerManager
 * into the outputManager
 */
import { compress, decompress, compressToBase64, decompressFromBase64 } from 'lz-string'

import InputManager, { EVENT_INPUTS_UPDATED } from "./input-manager"
import OutputManager, { EVENT_OUTPUTS_UPDATED } from "./output-manager"
import TransformerManager, { EVENT_TRANSFORMERS_UPDATED } from "./transformer-manager"
import TransformerManagerWorker from "./transformer-manager-worker"

import { INPUT_EVENT, NOTE_OFF, NOTE_ON, OUTPUT_EVENT, PLAYBACK_START, PLAYBACK_STOP, PLAYBACK_TOGGLE, TEMPO_DECREASE, TEMPO_INCREASE, TEMPO_TAP, MIDI_CLOCK, MIDI_CONTINUE, MIDI_START, MIDI_STOP } from '../commands'
import AudioEvent from "../audio-event"

import type { ITimerControl as Timer } from "netronome"
import type { IAudioCommand } from "../audio-command-interface"
import type AbstractInput from "./inputs/abstract-input"
import type InputAudioEvent from "./events/input-audio-event"
import type { IAudioOutput } from "./outputs/output-interface"
import type OutputAudioEvent from "./events/output-audio-event"
import type { ITransformer } from "./transformers/interface-transformer"

interface IOChainSerializedData {
    version: number
    options: object
    transformersConfig: string
    timerState: {
        BPM: number
        isRunning: boolean
        position: number
    }
    audioCommandQueue: IAudioCommand[]
}

interface IOChainOptions {
    layout?: string | null
}

const DEFAULT_OPTIONS: IOChainOptions = {
    layout: null
}

export default class IOChain extends EventTarget {

    static convertAudioCommandsToAudioEvents(commands: IAudioCommand[], timestamp: number = 0): AudioEvent[] {
        return (commands ?? []).map((command: IAudioCommand) => new AudioEvent(command, timestamp))
    }

    #timer: Timer

    #audioCommandQueue: IAudioCommand[] = []
    #transformerManager: TransformerManagerWorker
    #inputManager: InputManager
    #outputManager: OutputManager
    #abortController: AbortController

    #pausedQueue: number = 0

    #options: IOChainOptions = {}

    #enabled: boolean = true

    get options(): IOChainOptions {
        return this.#options
    }

    get inputManager(): InputManager {
        return this.#inputManager
    }
    get transformerManager(): TransformerManagerWorker {
        return this.#transformerManager
    }
    get outputManager(): OutputManager {
        return this.#outputManager
    }

    get inputs(): AbstractInput[] {
        return this.#inputManager.inputs
    }
    get transformers(): ITransformer[] {
        return this.#transformerManager.activeTransformers
    }
    get outputs(): IAudioOutput[] {
        return this.#outputManager.outputs
    }

    get transformerQuantity(): number {
        return this.#transformerManager.quantity
    }
    get timer(): Timer {
        return this.#timer
    }

    get isQuantised(): boolean {
        return this.#transformerManager.isQuantised
    }

    /**
     * Create an IOChain with optional state restoration
     * @param timer Timer instance for scheduling
     * @param options Configuration options:
     *   - layout?: string | null - Export string to restore chain state via importString()
     *                               If null/undefined, state is not restored
     */
    constructor(timer: Timer, options: IOChainOptions = DEFAULT_OPTIONS) {
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

        // If layout option provided as string, restore state from export
        if (this.#options.layout && typeof this.#options.layout === 'string') {
            try {
                this.importString(this.#options.layout)
            } catch (error) {
                console.error('Failed to restore layout from constructor options:', error)
            }
        }

        this.#transformerManager.addEventListener(EVENT_TRANSFORMERS_UPDATED, this.onTransformersChanged, { signal: this.#abortController.signal })
        this.#inputManager.addEventListener(INPUT_EVENT, this.onInputEvent, { signal: this.#abortController.signal })
        this.#inputManager.addEventListener(EVENT_INPUTS_UPDATED, this.onInputsUpdated, { signal: this.#abortController.signal })
        this.#outputManager.addEventListener(OUTPUT_EVENT, this.onOutputEvent, { signal: this.#abortController.signal })
        this.#outputManager.addEventListener(EVENT_OUTPUTS_UPDATED, this.onOutputsUpdated, { signal: this.#abortController.signal })
    }

    // Transformers ---------------------------------------
    appendTransformer(transformer: Transformer) {
        this.#transformerManager.appendTransformer(transformer)
    }

    removeTransformer(transformer: Transformer) {
        this.#transformerManager.removeTransformer(transformer)
    }

    setTransformers(transformers: Transformer[]) {
        this.#transformerManager.setTransformers(transformers)
    }

    /**
     * Transform all commands and add them to our commandQueue
     * @param audioCommands 
     * @param timer 
     * @returns 
     */
    transform(audioCommands: IAudioCommand[], timer: Timer) {
        return this.#transformerManager.transform(audioCommands, timer)
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
    addCommand(command: IAudioCommand) {
        this.#audioCommandQueue.push(command)
    }

    /**
     * Add multiple commands
     * @param commands 
     */
    addCommands(commands: IAudioCommand[]) {
        this.#audioCommandQueue.push(...commands)
    }

    /**
     * Remove all note on and note off commands
     * (leave all other commands)
     * cancel any scheduled commands
     * cancel any playing sounds
     */
    clearNoteCommands(): void {
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
    executeQueueAndClearComplete(now: number, accumulatorLimit: number = 24 * 12): IAudioCommand[] {

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
     * @param options  
     * @returns IAudioCommand[]
     */
    updateTimeForCommandQueue(now: number, divisionsElapsed: number, options: {}): IAudioCommand[] {
        let activeCommands: IAudioCommand[]

        // Always process the queue, with or without quantisation
        if (this.transformerManager.isQuantised) {
            //console.info("TICK:QUANTISED", { divisionsElapsed, quantisationFidelity: chain.transformerManager.quantiseFidelity })
            // When quantised, only trigger events on the grid
            const gridSize = this.transformerManager.quantiseFidelity
            if ((this.#pausedQueue === 0) && (divisionsElapsed % gridSize) === 0) {
                activeCommands = this.executeQueueAndClearComplete(now)

                // if grid is set to true in options, we can only ever play one
                // note at a time on this grid point
                this.#pausedQueue = options && options["grid"] ? gridSize - 1 : 0
                // console.info( pausedQueue, "TICK:QUANTISED", {buffer: audioCommandQueue, divisionsElapsed, quantisationFidelity:transformerManager.quantiseFidelity})
            } else {
                // reset duplicator
                this.#pausedQueue = Math.max(0, this.#pausedQueue - 1)
                activeCommands = []
                // console.info( pausedQueue, "TICK:IGNORED", {buffer: audioCommandQueue, divisionsElapsed, quantisationFidelity:transformerManager.quantiseFidelity})
            }

        } else {

            // When not quantised, process queue immediately on every tick
            activeCommands = this.executeQueueAndClearComplete(now)

            // if (activeCommands.length) {
            //     console.info("TICK:IMMEDIATE", { activeCommands, divisionsElapsed })
            // }
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
    async addCommandToQueue(audioCommand: IAudioCommand, transform: boolean = this.#enabled) {
        if (transform) {
            this.transformerManager.transform([audioCommand], this.timer)
                .then((transformedAudioCommands: IAudioCommand[]) => {
                    this.addCommands(transformedAudioCommands)
                })
                .catch((error) => {
                    // console.info('Transform failed:', error)
                    this.addCommand(audioCommand)
                }).finally(p => {
                    // now handle this input through the transformerManager
                    // console.info( "IOChain:onInputEvent", {audioCommand} )
                })
        } else {
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
    addCommandToFuture(commands: IAudioCommand[], timer: Timer, transform: boolean = false, startDelay: number = 3): IAudioCommand[] {
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
    triggerAudioCommandsOnDevice(commands: IAudioCommand[]) {
        return this.outputManager.triggerAudioCommandsOnOutputs(commands)
    }

    // Inputs -------------------------------------------
    addInput(input: AbstractInput) {
        this.#inputManager.add(input)
    }
    addInputs(inputs: AbstractInput[]) {
        inputs.forEach(input => this.#inputManager.add(input))
    }
    removeInput(input: AbstractInput) {
        this.#inputManager.remove(input)
    }

    /**
     * Fetch a specific input by ID
     * @param name 
     * @returns 
     */
    getInput(name: string): AbstractInput {
        return this.#inputManager.getInput(name)
    }

    // Outputs -------------------------------------------
    addOutput(output: IAudioOutput) {
        this.#outputManager.add(output)
    }
    addOutputs(outputs: IAudioOutput[]) {
        outputs.forEach(output => this.addOutput(output))
    }
    removeOutput(output: IAudioOutput) {
        this.#outputManager.remove(output)
    }

    /**
     * Cancel any playing notes and let them settle
     */
    allNotesOff(): void {
        // Clear the audio command queue of pending note commands
        this.clearNoteCommands()
        // Cancel any currently playing notes
        this.outputManager.allNotesOff()
    }

    /**
     * Export the entire IOChain state to a compressed, URL-safe string
     * The string can be stored, transmitted, or used in URLs
     * @returns Compressed base64 string containing all chain data
     */
    exportString(): string {
        const data: IOChainSerializedData = {
            version: 1,
            options: this.#options,
            transformersConfig: this.#transformerManager.exportData(),
            timerState: {
                BPM: this.#timer.BPM,
                isRunning: this.#timer.isRunning,
                position: this.#timer.position
            },
            audioCommandQueue: this.#audioCommandQueue
        }

        const json = JSON.stringify(data)
        // Use compressToBase64 which handles Unicode characters properly
        const compressed = compressToBase64(json)

        return compressed
    }

    /**
     * Import an IOChain state from an exported string
     * This will restore all transformers, timer state, and queued commands
     * @param encodedString Compressed base64 string from exportString()
     * @param options Optional configuration to merge with imported state:
     *   - Passed to restore methods for internal processing
     *   - Merged with restored options from the export
     * @throws Error if the string is invalid or cannot be decompressed
     */
    importString(encodedString: string, options?: Record<string, any>): void {
        try {
            // Decompress using lz-string which handles base64 properly
            const json = decompressFromBase64(encodedString)

            if (!json) {
                throw new Error('Failed to decompress data')
            }

            const data: IOChainSerializedData = JSON.parse(json)

            if (data.version !== 1) {
                throw new Error(`Unsupported IOChain version: ${data.version}`)
            }

            // Restore options: imported options, exported data options, then passed options
            this.#options = { ...this.#options, ...data.options, ...(options || {}) }

            // Restore transformers configuration
            this.#transformerManager.importData(data.transformersConfig)

            // Restore timer state
            if (data.timerState) {
                this.#timer.BPM = data.timerState.BPM
                if (data.timerState.isRunning) {
                    this.#timer.start()
                } else {
                    this.#timer.stop()
                }
                this.#timer.position = data.timerState.position
            }

            // Restore audio command queue
            this.#audioCommandQueue = data.audioCommandQueue || []

        } catch (error) {
            console.error('Failed to import IOChain state:', error)
            throw new Error(`Invalid IOChain export string: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * Export transformer configurations
     * @returns JSON string of all active transformer configurations
     */
    exportTransformers(): string {
        return this.#transformerManager.exportConfig()
    }

    /**
     * Import transformer configurations
     * Recreates transformers from saved configurations
     * @param configString JSON string from exportTransformers()
     * @param options Optional configuration passed to transformer manager
     */
    importTransformers(configString: string, options?: Record<string, any>): void {
        try {
            this.#transformerManager.importData(configString)
            // Merge provided options into chain options
            if (options) {
                this.#options = { ...this.#options, ...options }
            }
        } catch (error) {
            console.error('Failed to import transformers:', error)
            throw new Error(`Invalid transformer config: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * Export available input device types for this platform
     * Only exports input types that are available on the current system
     * @returns Array of input type IDs that can run on this platform
     */
    async exportInputTypes(): Promise<string[]> {
        const { INPUT_FACTORIES } = await import('./input-factory.ts')
        return INPUT_FACTORIES
            .filter((factory: any) => factory.isAvailable())
            .map((factory: any) => factory.id)
    }

    /**
     * Import and create input devices from available types
     * Only creates inputs that are available on the current platform
     * Skips unavailable inputs with a console warning
     * @param inputTypeIds Array of input type IDs to attempt to create
     * @param options Options passed to input factories
     */
    async importInputTypes(inputTypeIds: string[], options?: Record<string, any>): Promise<void> {
        const { INPUT_FACTORIES, createInputById } = await import('./input-factory.ts')

        for (const typeId of inputTypeIds) {
            const factory = INPUT_FACTORIES.find((f: any) => f.id === typeId)

            if (!factory) {
                console.warn(`Input type not found: ${typeId}`)
                continue
            }

            if (!factory.isAvailable()) {
                console.info(`Input not available on this platform: ${factory.name} (${typeId})`)
                continue
            }

            try {
                const input = await createInputById(typeId, options)
                this.addInput(input)
                console.info(`Added input: ${factory.name}`)
            } catch (error) {
                console.error(`Failed to create input ${typeId}:`, error)
            }
        }
    }

    /**
     * Export available output device types for this platform
     * Only exports output types that are available on the current system
     * @returns Array of output type IDs that can run on this platform
     */
    async exportOutputTypes(): Promise<string[]> {
        const { OUTPUT_FACTORIES } = await import('./output-factory.ts')
        return OUTPUT_FACTORIES
            .filter((factory: any) => factory.isAvailable())
            .map((factory: any) => factory.id)
    }

    /**
     * Import and create output devices from available types
     * Only creates outputs that are available on the current platform
     * Skips unavailable outputs with a console warning
     * @param outputTypeIds Array of output type IDs to attempt to create
     * @param options Options passed to output factories
     */
    async importOutputTypes(outputTypeIds: string[], options?: Record<string, any>): Promise<void> {
        const { OUTPUT_FACTORIES, createOutputById } = await import('./output-factory.ts')

        for (const typeId of outputTypeIds) {
            const factory = OUTPUT_FACTORIES.find((f: any) => f.id === typeId)

            if (!factory) {
                console.warn(`Output type not found: ${typeId}`)
                continue
            }

            if (!factory.isAvailable()) {
                console.info(`Output not available on this platform: ${factory.name} (${typeId})`)
                continue
            }

            try {
                const output = await createOutputById(typeId, options)
                this.addOutput(output)
                console.info(`Added output: ${factory.name}`)
            } catch (error) {
                console.error(`Failed to create output ${typeId}:`, error)
            }
        }
    }

    /**
     * Kill this and clean up
     */
    destroy(): void {
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
    onInputEvent(inputEvent: InputAudioEvent) {

        inputEvent.preventDefault()

        // extract command and add to queue for consumption later
        const audioCommand: IAudioCommand = inputEvent.command
        switch (audioCommand.type) {

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
        this.addCommandToQueue(audioCommand).then(t => {
            // redispatch event (do not update UI yet)
            this.dispatchEvent(inputEvent.clone())
        })
    }

    /**
     * The Input array has changed
     * @param inputEvent 
     */
    onInputsUpdated(inputEvent: CustomEvent) {
        inputEvent.preventDefault()
        this.dispatchEvent(new CustomEvent(inputEvent.type))
    }

    /**
     * Transformer has moved, been added or removed
     * @param transformerEvent 
     */
    onTransformersChanged(transformerEvent: CustomEvent): void {
        transformerEvent.preventDefault()
        this.dispatchEvent(new CustomEvent(transformerEvent.type, { detail: transformerEvent.detail }))
    }

    /**
     * An Output event has occurred in OutputManager
     * @param outputEvent 
     */
    onOutputEvent(outputEvent: OutputAudioEvent): void {
        const command: IAudioCommand = outputEvent.command
        outputEvent.preventDefault()
        this.dispatchEvent(outputEvent.clone())
    }

    /**
     * Outputs have been updated in the OutputManager
     * @param outputEvent 
     */
    onOutputsUpdated(outputEvent: CustomEvent): void {
        outputEvent.preventDefault()
        this.dispatchEvent(new CustomEvent(outputEvent.type))
    }
}


