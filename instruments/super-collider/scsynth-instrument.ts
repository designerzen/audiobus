import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"

const SILENCE = 0.00000000009

/**
 * SuperCollider Synth Instrument
 * Uses supersonic-scsynth-bundle for SC synthesis
 */
export default class SCSynthInstrument {

    options = {
        // default amplitude
        gain: 0.2,           // ratio 0-1

        attack: 0.4,         // in s
        decay: 0.9,          // in s
        sustain: 0.85,       // ratio 0-1
        release: 0.3,        // in s
        
        minDuration: 0.6,

        arpeggioDuration: 0.2,
        slideDuration: 0.00006,
        fadeDuration: 0.2,

        filterGain: 0.7,
        filterCutOff: 2200,
        filterOverdrive: 2.5,
        filterResonance: 1.8,

        filterAttack: 0.2,
        filterDecay: 0.08,
        filterSustain: 0.8,
        filterRelease: 0.2,

        reuseOscillators: true,

        // SuperCollider specific
        synthDef: 'sine_synth',  // default SynthDef name
        numChannels: 1
    }

    #id = "SCSynthInstrument"
    synthNodes = new Map()  // Map of note IDs to synth nodes
    
    startedAt = -1
    activeNote = null

    get isNoteDown() {
        return this.activeNote !== null
    }

    get id() {
        return this.#id
    }

    set id(value) {
        this.#id = value
    }

    get now() {
        return this.audioContext.currentTime
    }

    get gain() {
        return this.options.gain
    }

    set gain(value) {
        this.options.gain = value
    }

    get volume() {
        return this.gainNode.gain.value
    }

    set volume(value) {
        const now = this.now
        this.gainNode.gain.cancelScheduledValues(now)
        this.gainNode.gain.linearRampToValueAtTime(value, now + this.options.fadeDuration)
    }

    get output() {
        return this.dcFilterNode
    }

    get title() {
        return this.options.title ?? "SCSynthInstrument"
    }

    constructor(audioContext, scsynth, options = {}) {
        this.audioContext = audioContext
        this.scsynth = scsynth  // supersonic-scsynth instance
        this.options = Object.assign({}, this.options, options)

        // Add a highpass filter at 20Hz to remove DC offset
        this.dcFilterNode = new BiquadFilterNode(audioContext, {
            type: 'highpass',
            frequency: 20,
            Q: 0.707
        })

        this.filterNode = new BiquadFilterNode(audioContext, {
            type: 'lowpass',
            Q: this.options.filterResonance,
            frequency: this.options.filterCutOff,
            detune: 0,
            gain: 1
        })

        this.gainNode = audioContext.createGain()
        this.gainNode.gain.value = 0  // start silently

        // Connect: filterNode -> gainNode -> dcFilterNode
        this.filterNode.connect(this.gainNode)
        this.gainNode.connect(this.dcFilterNode)
    }

    /**
     * Create a synth node via SuperCollider
     * OSC: /s_new synthDefName nodeID addAction targetNodeID [controlName controlValue ...]
     * addAction: 0=add to head, 1=add to tail, 2=add before target, 3=add after target
     * @param {Number} frequency 
     * @param {Number} startTime 
     * @returns {Number} synth node ID
     */
    createSynthNode(frequency = 440, startTime = this.audioContext.currentTime) {
        if (!this.scsynth) {
            console.warn("SuperCollider synth not available")
            return null
        }

        try {
            const synthId = Math.floor(Math.random() * 10000)
            const msg = [
                '/s_new',
                this.options.synthDef,  // synthdef name
                synthId,                // node ID
                0,                      // add action (0 = add to head of default group)
                1,                      // target node ID (1 = default group)
                'freq', frequency,
                'amp', this.options.gain
            ]

            this.scsynth.send(msg)
            this.synthNodes.set(synthId, { frequency, startTime })
            return synthId

        } catch (e) {
            console.error("Failed to create synth node:", e)
            return null
        }
    }

    /**
     * Set synth parameter via SuperCollider
     * OSC: /n_set nodeID control value [control value ...]
     * @param {Number} synthId 
     * @param {String} paramName 
     * @param {Number} value 
     */
    setSynthParam(synthId, paramName, value) {
        if (!this.scsynth || !synthId) return

        try {
            const msg = [
                '/n_set',
                synthId,
                paramName, value
            ]
            this.scsynth.send(msg)
        } catch (e) {
            console.error("Failed to set synth param:", e)
        }
    }

    /**
     * Stop a synth node
     * OSC: /n_free nodeID [nodeID ...]
     * @param {Number} synthId 
     */
    destroySynthNode(synthId) {
        if (!this.scsynth || !synthId) return

        try {
            const msg = ['/n_free', synthId]
            this.scsynth.send(msg)
            this.synthNodes.delete(synthId)
        } catch (e) {
            console.error("Failed to free synth node:", e)
        }
    }

    /**
     * Note ON
     * @param {Number} noteNumber - Model data
     * @param {Number} velocity - strength of the note
     * @param {Array<Number>} arp - intervals
     * @param {Number} delay - number to pause before playing
     */
    noteOn(noteNumber:number, velocity:number = 1, arp = null, delay:number = 0) {
        const frequency = noteNumberToFrequency( noteNumber )
        const startTime = this.now + delay
        const amplitude = velocity * this.options.gain

        // Fade in envelope ADSR
        const amplitudeSustain = amplitude * this.options.sustain

        clearInterval(this.timerInterval)

        this.gainNode.gain.cancelScheduledValues(startTime)
        // Attack
        this.gainNode.gain.linearRampToValueAtTime(amplitude, startTime + this.options.attack)
        // Decay to Sustain
        this.gainNode.gain.linearRampToValueAtTime(amplitudeSustain, startTime + this.options.attack + this.options.decay)

        if (!this.isNoteDown) {
            const synthId = this.createSynthNode(frequency, startTime)
            this.synthNodeId = synthId
        } else {
            // Change frequency of existing synth
            if (this.synthNodeId) {
                this.setSynthParam(this.synthNodeId, 'freq', frequency, this.options.slideDuration)
            }
        }

        this.activeNote = noteNumber
        this.startedAt = startTime
        return this
    }

    /**
     * Note OFF
     * Uses SuperCollider gate parameter to trigger release envelope
     * OSC: /n_set synthID gate 0
     * @param {Note} noteNumber:number - Model data
     */
    noteOff(noteNumber:number) {
        if (!this.isNoteDown) {
            console.warn("noteOff IGNORED - note NOT playing", noteNumber, this)
            return
        }

        const releaseDuration = Math.max(this.options.release, this.options.filterRelease)
        const now = this.now
        const elapsed = now - this.startedAt

        // Ensure minimum duration
        const extendNow = elapsed < this.options.minDuration ?
            now + this.options.minDuration - elapsed :
            now

        const stopTime = extendNow + releaseDuration

        // Trigger release envelope in SuperCollider synth via gate parameter
        // gate: 0 tells the SynthDef to start its release envelope
        if (this.synthNodeId) {
            this.setSynthParam(this.synthNodeId, 'gate', 0)
            
            // Free the synth after release time (unless reusing synths)
            if (!this.options.reuseOscillators) {
                setTimeout(() => {
                    this.destroySynthNode(this.synthNodeId)
                    this.synthNodeId = null
                }, releaseDuration * 1000)
            }
        }

        // Fade out the Web Audio gainNode in parallel
        this.gainNode.gain.cancelScheduledValues(extendNow)
        this.gainNode.gain.linearRampToValueAtTime(SILENCE, extendNow + releaseDuration)

        this.timerInterval = setTimeout(() => this.activeNote = null, releaseDuration)
        this.startedAt = -1

        return this
    }

    /**
     * Stop all notes on this instrument
     * Sends gate=0 to all active synths and frees them if not reusing
     */
    allNotesOff() {
        // Stop the currently active note
        if (this.activeNote?.noteNumber) {
            this.noteOff( this.activeNote.noteNumber )
        }

        // Free all remaining synth nodes
        for (const [synthId] of this.synthNodes) {
            if (synthId !== this.synthNodeId) {  // Don't free the active one twice
                this.setSynthParam(synthId, 'gate', 0)
                
                if (!this.options.reuseOscillators) {
                    this.destroySynthNode(synthId)
                }
            }
        }

        // Cancel any scheduled gain changes
        const now = this.now
        this.gainNode.gain.cancelScheduledValues(now)
        this.gainNode.gain.linearRampToValueAtTime(SILENCE, now + this.options.release)
    }
}
