/**
 * Lets you play many synths at once.
 * Can be of any instrument but defaults
 * to the single oscillator
 */
import SynthOscillator, { OSCILLATORS } from "./oscillators/synth-oscillator.ts"

import type { IAudioOutput } from "../io/outputs/output-interface.ts"

export default class PolySynth implements IAudioOutput{

	static ID = 0

    options = {
        maxPolyphony: 24,
        class:SynthOscillator
    }

    instruments = []
    instrumentActivity = new Map()

    #gainNode: GainNode
	#audioContext: AudioContext
	#activeVoices = 0

	#uuid : string = 'polyphonic-' + (PolySynth.ID++)
	
    InstrumentClass

    get output():AudioNode{
        return this.#gainNode
    }

	get name():string{
		return 'PolySynth'
	}

	get uuid():string{
		return this.#uuid
	}

	get description():string{
		return 'A polyphonic synthesizer that can play many notes at once.'
	}

	get isConnected(): boolean {
		return this.instruments.length > 0
	}

	get isHidden(): boolean {
		return false
	}

    constructor(audioContext: AudioContext,  options = {}) {
        this.#audioContext = audioContext
        this.options = Object.assign({}, this.options, options)
       
        this.InstrumentClass = this.options.class
        this.#gainNode = audioContext.createGain()
		this.#gainNode.gain.value = 2 // Start at 2 for single voice
        this.factory( this.InstrumentClass, this.options.maxPolyphony)
    }

    /**
     * 
     * @param {Class} InstrumentClass 
     * @param {Number} quantity 
     */
    factory(InstrumentClass: typeof SynthOscillator, quantity: number){
        for ( let i=0; i < quantity; ++i){
            const instrument = new InstrumentClass( this.#audioContext, { ...this.options, title:'osc-0'+i } )
            this.instruments.push( instrument )
            instrument.output.connect( this.#gainNode )
        }
    }
    
    /**
     * Note ON
     * @param {Number} noteNumber - Model data
     * @param {Number} velocity - strength of the note
     * @param {Array<Number>} arp - intervals
     * @param {Number} delay - number to pause before playing
     */
    noteOn( noteNumber: number, velocity=1, arp=null, delay=0 ){
       
        if ( this.instrumentActivity.has(noteNumber) )
        {
            // already playing!
        }else{

            this.instruments.every( instrument => {
                if (!instrument.isNoteDown)
                {
                    instrument.noteOn( noteNumber, velocity, arp, delay )
                    this.instrumentActivity.set( noteNumber, instrument )
                    this.#activeVoices++
                    this.updateMasterGain()
                    return false
                }
                return true
            })

            return this.instrumentActivity.get( noteNumber )
        }
        return null
    }
    
    /**
     * Note OFF
     * This starts the process of stopping the note
     * by creating a smooth transition to silence from 
     * the current amplitude via release time.
     * @param {Number} noteNumber - Model data
     * @returns 
     */
    noteOff( noteNumber: number ){
        const instrument = this.instrumentActivity.get( noteNumber )
        if ( instrument )
        {
            instrument.noteOff( noteNumber )
            this.instrumentActivity.delete( noteNumber )
            this.#activeVoices--
            this.updateMasterGain()
        } 
        return instrument
    }

    /**
     * Stop all notes on all instruments
     */
    allNotesOff(){
        this.instrumentActivity.forEach( (instrument, noteNumber) => instrument.allNotesOff() )
        this.#activeVoices = 0
        this.updateMasterGain()
        // If the synth has an all notes off method, use it
        // Otherwise, iterate through all possible notes
        // for (let noteNumber = 0; noteNumber < 128; noteNumber++)
        // {
        //     synth.noteOff(noteNumber)
        // }
    }

    /**
     * Update master gain based on active voice count
     * Ensures consistent volume across different polyphony levels
     */
    updateMasterGain(){
        const activeCount = Math.max(1, this.#activeVoices)
        this.#gainNode.gain.value = 2 / activeCount
    }

    /**
     * Set a random oscillator timbre from the collection
     */
    setRandomTimbre(){
		const randomShape = OSCILLATORS[Math.floor(Math.random() * (OSCILLATORS.length - 1))]
		this.instruments.forEach( instrument => instrument.shape = randomShape )
    }
}
