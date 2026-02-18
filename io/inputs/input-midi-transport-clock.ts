/**
 * MIDI Transport Clock Input
 * Sends out MIDI transport clock audio commands to control timing
 * Uses MIDI clock signals (24 per quarter note) to synchronize timing
 * Dispatches MIDI clock commands to IOChain for timing control
 */

import AbstractInput from "./abstract-input.ts"
import type { IAudioInput } from "./input-interface.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import { PLAYBACK_START, PLAYBACK_STOP, MIDI_CLOCK, MIDI_START, MIDI_STOP, MIDI_CONTINUE } from '../../commands'

export const MIDI_TRANSPORT_CLOCK_INPUT_ID = "MIDI Transport Clock"

interface IClockStats {
    clockCount: number
    lastClockTime: number
    calculatedBPM: number
    quarterNoteCount: number
}

const DEFAULT_OPTIONS = {
    enabled: false,
    clockResolution: 24,  // MIDI clocks per quarter note
    useNativeInput: false,  // Try to use native MIDI input if available
}

export default class InputMIDITransportClock extends AbstractInput implements IAudioInput {

    #enabled: boolean = false
    #isListening: boolean = false
    #clockStats: IClockStats = {
        clockCount: 0,
        lastClockTime: 0,
        calculatedBPM: 0,
        quarterNoteCount: 0
    }
    #nativeMIDI: any = null
    #listener: Function | null = null

    get name(): string {
        return MIDI_TRANSPORT_CLOCK_INPUT_ID
    }

    get description(): string {
        return "MIDI Transport Clock Input - Controls timing via MIDI clock signals (24 clocks per quarter note)"
    }

    get isEnabled(): boolean {
        return this.#enabled
    }

    get clockStats(): IClockStats {
        return { ...this.#clockStats }
    }

    get calculatedBPM(): number {
        return this.#clockStats.calculatedBPM
    }

    constructor(options: Record<string, any> = DEFAULT_OPTIONS) {
        super(options)
    }

    /**
     * Load native MIDI module for transport clock input
     */
    private async loadNativeMIDI(): Promise<any> {
        if (this.#nativeMIDI !== null) return this.#nativeMIDI

        try {
            const mod = await import('../../../build/Release/midi2-native.node' as any)
            this.#nativeMIDI = mod
            return this.#nativeMIDI
        } catch (e) {
            console.warn('[InputMIDITransportClock] Native MIDI module not available:', e)
            return null
        }
    }

    /**
     * Initialize and connect to MIDI transport clock
     */
    async connect(): Promise<void> {
        // Load native module if using native input
        const useNative = this.options.useNativeInput ?? DEFAULT_OPTIONS.useNativeInput

        if (useNative && this.#nativeMIDI === null) {
            await this.loadNativeMIDI()
        }

        try {
            if (useNative && this.#nativeMIDI) {
                this.#setupNativeClockListener()
            } else {
                this.#setupWebMIDIClockListener()
            }

            this.setAsConnected()
            this.#enabled = true
            this.#isListening = true
            console.info('[InputMIDITransportClock] Connected to MIDI transport clock input')
        } catch (error) {
            this.setAsDisconnected()
            console.error('[InputMIDITransportClock] Failed to connect:', error)
            throw error
        }
    }

    /**
     * Setup native MIDI clock listener (Windows MIDI Services)
     */
    #setupNativeClockListener(): void {
        if (!this.#nativeMIDI) return

        this.#listener = (inDeviceIndex: number, umpPacket: number) => {
            const status = umpPacket & 0xFF

            switch (status) {
                case MIDI_CLOCK:
                    this.#handleClock()
                    break
                case MIDI_START:
                    this.#handleStart()
                    break
                case MIDI_CONTINUE:
                    this.#handleContinue()
                    break
                case MIDI_STOP:
                    this.#handleStop()
                    break
            }
        }

        try {
            this.#nativeMIDI.onUmpInput(this.#listener)
            console.info('[InputMIDITransportClock] Native MIDI clock listener setup')
        } catch (error) {
            console.error('[InputMIDITransportClock] Error setting up native clock listener:', error)
        }
    }

    /**
     * Setup Web MIDI clock listener (fallback for browsers)
     */
    async #setupWebMIDIClockListener(): Promise<void> {
        try {
            const midiAccess = await (navigator as any).requestMIDIAccess?.()

            if (!midiAccess) {
                console.warn('[InputMIDITransportClock] Web MIDI not available')
                return
            }

            for (const input of midiAccess.inputs.values()) {
                input.onmidimessage = (message: MIDIMessageEvent) => {
                    const [status] = message.data

                    switch (status) {
                        case MIDI_CLOCK:
                            this.#handleClock()
                            break
                        case MIDI_START:
                            this.#handleStart()
                            break
                        case MIDI_CONTINUE:
                            this.#handleContinue()
                            break
                        case MIDI_STOP:
                            this.#handleStop()
                            break
                    }
                }
            }

            console.info('[InputMIDITransportClock] Web MIDI clock listener setup')
        } catch (error) {
            console.error('[InputMIDITransportClock] Error setting up Web MIDI clock listener:', error)
        }
    }

    /**
     * Handle incoming MIDI clock signal
     * MIDI sends 24 clock signals per quarter note
     */
    #handleClock(): void {
        const now = performance.now()

        // Update clock stats
        this.#clockStats.clockCount++

        // Calculate BPM every quarter note (24 clocks)
        if (this.#clockStats.clockCount % 24 === 0) {
            this.#clockStats.quarterNoteCount++

            if (this.#clockStats.lastClockTime > 0) {
                // Time elapsed since last quarter note in milliseconds
                const timeDelta = now - this.#clockStats.lastClockTime

                // BPM = 60000 / time per quarter note in ms
                this.#clockStats.calculatedBPM = Math.round(60000 / timeDelta)

                this.#dispatchCommand({
                    type: 'midiClock',
                    timestamp: now,
                    quarterNote: this.#clockStats.quarterNoteCount,
                    bpm: this.#clockStats.calculatedBPM,
                    clockCount: this.#clockStats.clockCount
                })
            }

            this.#clockStats.lastClockTime = now
        }
    }

    /**
     * Handle MIDI Start command
     */
    #handleStart(): void {
        this.#clockStats.clockCount = 0
        this.#clockStats.quarterNoteCount = 0
        this.#clockStats.lastClockTime = performance.now()

        this.#dispatchCommand({
            type: PLAYBACK_START,
            timestamp: performance.now(),
            transportCommand: 'start'
        })
    }

    /**
     * Handle MIDI Continue command
     */
    #handleContinue(): void {
        this.#clockStats.lastClockTime = performance.now()

        this.#dispatchCommand({
            type: 'midiContinue',
            timestamp: performance.now(),
            transportCommand: 'continue'
        })
    }

    /**
     * Handle MIDI Stop command
     */
    #handleStop(): void {
        this.#dispatchCommand({
            type: PLAYBACK_STOP,
            timestamp: performance.now(),
            transportCommand: 'stop'
        })
    }

    /**
     * Dispatch command as event to IOChain
     */
    #dispatchCommand(detail: any): void {
        // Create an audio command for the IOChain to process
        const audioCommand: IAudioCommand = {
            type: detail.type,
            timestamp: detail.timestamp,
            ...detail
        }

        // Use inherited dispatch method to send command through IOChain
        this.dispatch(audioCommand)

        // Also emit a custom event for listeners
        this.#emit('transportCommand', detail)
    }

    /**
     * Emit event to listeners
     */
    #emit(eventType: string, detail: any): void {
        const event = new CustomEvent(eventType, { detail })
        this.dispatchEvent(event)
    }

    /**
     * Disconnect from MIDI transport clock
     */
    async disconnect(): Promise<void> {
        this.#isListening = false
        this.#enabled = false

        if (this.#listener && this.#nativeMIDI) {
            try {
                // Note: native MIDI might not have an explicit unsubscribe method
                this.#listener = null
            } catch (error) {
                console.error('[InputMIDITransportClock] Error disconnecting:', error)
            }
        }

        this.setAsDisconnected()
        console.info('[InputMIDITransportClock] Disconnected from MIDI transport clock')
    }

    /**
     * Reset clock statistics
     */
    resetStats(): void {
        this.#clockStats = {
            clockCount: 0,
            lastClockTime: 0,
            calculatedBPM: 0,
            quarterNoteCount: 0
        }
    }

    /**
     * Get current clock count
     */
    getClockCount(): number {
        return this.#clockStats.clockCount
    }

    /**
     * Get quarter note progress (0-23 clocks)
     */
    getClockProgress(): number {
        return this.#clockStats.clockCount % 24
    }

    hasMidiInput(): boolean {
        return true
    }

    hasAudioInput(): boolean {
        return false
    }

    hasAutomationInput(): boolean {
        return true  // MIDI clock can be used for automation
    }

    hasMpeInput(): boolean {
        return false
    }

    hasOscInput(): boolean {
        return false
    }

    hasSysexInput(): boolean {
        return false
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.disconnect()
    }
}




