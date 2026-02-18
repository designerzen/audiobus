/**
 * MIDI 2.0 Output - Universal MIDI Packet (UMP) Implementation
 * Supports high-resolution controllers, per-note effects, and MIDI-CI
 */

import { centsToPitch } from '../../conversion/cents-to-pitch.ts'
import AudioCommand from '../../audio-command.ts'
import type { IAudioOutput } from './output-interface.ts'
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON, PITCH_BEND, PROGRAM_CHANGE } from '../../commands'
import {
    type UMPPacket,
    PER_NOTE_CONTROLLERS,
    createNoteOn,
    createNoteOff,
    createControlChange,
    createPerNoteController,
    createPitchBend,
    createProgramChange,
    createChannelPressure,
    velocityMidi1ToMidi2,
    controlValueMidi1ToMidi2,
    clampChannel,
    clampGroup,
    clampNote,
    clampProgram
} from '../../midi/midi2-utils.ts'

/**
 * MIDI 2.0 specific audio command extensions
 */
export interface MIDI2AudioCommand extends AudioCommand {
    // Note number (aliased from AudioCommand.number)
    note?: number

    // Controller number for CC messages
    controller?: number

    midi2?: {
        // High-resolution velocity (0-65535, vs MIDI 1: 0-127)
        velocity?: number

        // 32-bit fixed point pitch
        pitch?: number

        // Per-note controllers
        performanceData?: {
            vibrato?: number;      // 0-65535 (16-bit)
            brightness?: number;   // 0-65535 (16-bit)
            timbre?: number;       // 0-65535 (16-bit)
            releaseTension?: number; // 0-65535 (16-bit)
            attackTime?: number;   // milliseconds
        }

        // Velocity performance (MIDI 2.0)
        velocityPerformance?: {
            attackTime?: number;   // Attack time
            releaseVelocity?: number; // 0-65535
        }

        // Timestamp (for jitter reduction)
        timestamp?: number
    }
}

/**
 * MIDI 2.0 UMP Packet Structure
 * 32-bit word with:
 * - Bits 0-3: Message Type
 * - Bits 4-7: Group (0-15)
 * - Bits 8-11: Status
 * - Bits 12-15: Channel
 * - Bits 16-31: Data
 */

/**
 * MIDI 2.0 Output Implementation
 * Sends UMP (Universal MIDI Packet) messages
 */
export default class OutputMIDI2 implements IAudioOutput {

    static ID: number = 0

    private deviceIndex: number
    private deviceInfo: any
    private midi2Native: any = null

    private currentGroup: number = 0

    #connected: boolean = false
    #uuid: string = 'output-midi2-' + OutputMIDI2.ID++
    #currentChannel: number = 0

    get uuid(): string {
        return this.#uuid
    }

    get name(): string {
        return this.deviceInfo?.name ?? 'MIDI 2.0 Output'
    }

    get description(): string {
        return this.deviceInfo?.description ?? 'MIDI 2.0 Output Device'
    }

    get isConnected(): boolean {
        return this.#connected
    }

    get isHidden(): boolean {
        return false
    }


    /**
     * Get device information
     */
    get info(): any {
        return this.deviceInfo
    }

    constructor(deviceIndex: number, deviceInfo: any) {
        this.deviceIndex = deviceIndex
        this.deviceInfo = deviceInfo

        // Try to load native MIDI2 binding
        try {
            // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
            // @ts-expect-error - Native module type not available
            this.midi2Native = require('../../../build/Release/midi2-native.node')
        } catch (error) {
            console.warn('[OutputMIDI2] Native module not available, falling back to MIDI 1 API')
            // Fallback to WebMIDI or other available API
        }
    }


    /**
     * Send Note On message
     */
    noteOn(note: number, velocity: number = 100): void {
        if (!this.#connected) {
            console.warn('[OutputMIDI2] Device not connected for Note On')
            return
        }

        try {
            const midiVelocity = Math.max(0, Math.min(127, velocity))
            const packet = createNoteOn(
                this.currentGroup,
                clampChannel(this.#currentChannel),
                clampNote(note),
                velocityMidi1ToMidi2(midiVelocity)
            )
            this.sendUmp(packet)
        } catch (error) {
            console.error(`[OutputMIDI2] Failed to send Note On: ${error}`)
        }
    }

    /**
     * Send Note Off message
     */
    noteOff(note: number): void {
        if (!this.#connected) {
            console.warn('[OutputMIDI2] Device not connected for Note Off')
            return
        }

        try {
            const packet = createNoteOff(
                this.currentGroup,
                clampChannel(this.#currentChannel),
                clampNote(note),
                0
            )
            this.sendUmp(packet)
        } catch (error) {
            console.error(`[OutputMIDI2] Failed to send Note Off: ${error}`)
        }
    }

    /**
     * Send All Notes Off (CC#123)
     */
    allNotesOff(): void {
        if (!this.#connected) {
            console.warn('[OutputMIDI2] Device not connected for All Notes Off')
            return
        }

        try {
            const packet = createControlChange(
                this.currentGroup,
                clampChannel(this.#currentChannel),
                123,
                0
            )
            this.sendUmp(packet)
        } catch (error) {
            console.error(`[OutputMIDI2] Failed to send All Notes Off: ${error}`)
        }
    }

    /**
     * Get supported MIDI 2.0 features
     */
    getSupportedFeatures(): string[] {
        return [
            'midi2-channel-voice',
            'midi2-per-note-controllers',
            'midi2-high-resolution-velocity',
            'midi2-32bit-pitch',
            'midi2-midi-ci'
        ]
    }

    /**
     * Set MIDI channel (0-15)
     */
    setChannel(channel: number): void {
        this.#currentChannel = clampChannel(channel)
    }

    /**
     * Get current MIDI channel
     */
    getChannel(): number {
        return this.#currentChannel
    }

    hasMidiOutput(): boolean {
        return true
    }

    hasAudioOutput(): boolean {
        return false
    }

    hasAutomationOutput(): boolean {
        return false
    }

    hasMpeOutput(): boolean {
        return true
    }

    hasOscOutput(): boolean {
        return false
    }

    hasSysexOutput(): boolean {
        return false
    }

    /**
     * Open the MIDI 2.0 output device
     */
    // @ts-expect-error - Interface signature mismatch
    async connect(): Promise<void> {
        if (this.#connected) return;

        if (this.midi2Native) {
            try {
                this.midi2Native.openUmpOutput(this.deviceIndex);
                this.#connected = true;
                console.log(`[OutputMIDI2] Opened: ${this.deviceInfo.name}`);
            } catch (error) {
                console.error(`[OutputMIDI2] Failed to open device: ${error}`);
                throw error;
            }
        } else {
            throw new Error('MIDI 2.0 native module not available');
        }
    }

    /**
     * Close the MIDI 2.0 output device
     */
    async disconnect(): Promise<void> {
        if (!this.#connected) return;

        if (this.midi2Native) {
            try {
                this.midi2Native.closeUmpOutput(this.deviceIndex);
                this.#connected = false;
                console.log(`[OutputMIDI2] Closed: ${this.deviceInfo.name}`);
            } catch (error) {
                console.error(`[OutputMIDI2] Failed to close device: ${error}`);
            }
        }
    }

    /**
     * Send audio command as MIDI 2.0 UMP packets
     */
    async send(command: AudioCommand | MIDI2AudioCommand): Promise<void> {
        if (!this.#connected) {
            throw new Error('MIDI 2.0 output not open');
        }

        const midi2Cmd = command as MIDI2AudioCommand;
        const packets: UMPPacket[] = [];

        switch (command.type) {
            case NOTE_ON:
            case 'note':
                packets.push(...this.noteToUmp(midi2Cmd));
                break;

            case NOTE_OFF:
            case 'note-off':
                packets.push(...this.noteOffToUmp(midi2Cmd));
                break;

            case CONTROL_CHANGE:
            case 'control-change':
                packets.push(...this.ccToUmp(midi2Cmd));
                break;

            case PROGRAM_CHANGE:
            case 'program-change':
                packets.push(...this.pcToUmp(midi2Cmd));
                break;

            case PITCH_BEND:
            case 'pitch-bend':
                packets.push(...this.pitchBendToUmp(midi2Cmd))
                break

            // case PRESSURE:
            case 'pressure':
                packets.push(...this.pressureToUmp(midi2Cmd))
                break

            default:
                console.warn(`[OutputMIDI2] Unsupported command type: ${(command as any).type}`)
                return
        }

        // Send all packets
        for (const packet of packets) {
            this.sendUmp(packet)
        }
    }

    /**
     * Send raw UMP packet
     */
    private sendUmp(packet: UMPPacket): void {
        if (!this.midi2Native) return;

        try {
            this.midi2Native.sendUmp(this.deviceIndex, packet);
        } catch (error) {
            console.error(`[OutputMIDI2] Failed to send UMP: ${error}`);
        }
    }

    /**
     * Convert Note On command to UMP packets
     */
    private noteToUmp(command: MIDI2AudioCommand): UMPPacket[] {
        const packets: UMPPacket[] = []
        const velocity = command.midi2?.velocity ?? velocityMidi1ToMidi2(command.velocity || 100)
        const channel = clampChannel(command.channel || 0)
        const note = clampNote(command.note ?? command.number ?? 0)

        // Send Note On with high-res velocity
        packets.push(createNoteOn(this.currentGroup, channel, note, velocity))

        // Send per-note controllers if provided
        if (command.midi2?.performanceData) {
            const perf = command.midi2.performanceData

            if (perf.vibrato !== undefined) {
                packets.push(createPerNoteController(this.currentGroup, channel, note, PER_NOTE_CONTROLLERS.VIBRATO, perf.vibrato))
            }

            if (perf.brightness !== undefined) {
                packets.push(createPerNoteController(this.currentGroup, channel, note, PER_NOTE_CONTROLLERS.BRIGHTNESS, perf.brightness))
            }

            if (perf.timbre !== undefined) {
                packets.push(createPerNoteController(this.currentGroup, channel, note, PER_NOTE_CONTROLLERS.TIMBRE, perf.timbre))
            }

            if (perf.releaseTension !== undefined) {
                packets.push(createPerNoteController(this.currentGroup, channel, note, PER_NOTE_CONTROLLERS.RELEASE_TENSION, perf.releaseTension))
            }
        }

        return packets
    }

    /**
     * Convert Note Off command to UMP packets
     */
    private noteOffToUmp(command: MIDI2AudioCommand): UMPPacket[] {
        const velocity = command.midi2?.velocity ?? velocityMidi1ToMidi2(command.velocity || 0)
        const channel = clampChannel(command.channel || 0)
        const note = clampNote(command.note ?? command.number ?? 0)

        return [createNoteOff(this.currentGroup, channel, note, velocity)]
    }

    /**
     * Convert Control Change to UMP (16-bit resolution)
     */
    private ccToUmp(command: MIDI2AudioCommand): UMPPacket[] {
        const channel = clampChannel(command.channel || 0)
        const controller = command.controller ?? 0
        // MIDI 1: 0-127 → MIDI 2: 0-65535
        const value = controlValueMidi1ToMidi2(command.value || 0)

        return [createControlChange(this.currentGroup, channel, controller, value)]
    }

    /**
     * Convert Program Change to UMP
     */
    private pcToUmp(command: MIDI2AudioCommand): UMPPacket[] {
        const channel = clampChannel(command.channel || 0)
        const program = clampProgram(command.value || 0)

        return [createProgramChange(this.currentGroup, channel, program)]
    }

    /**
     * Convert Pitch Bend to UMP (32-bit precision)
     */
    private pitchBendToUmp(command: MIDI2AudioCommand): UMPPacket[] {
        const channel = clampChannel(command.channel || 0)
        // Convert cents to pitch value
        const pitch = centsToPitch(command.value || 0)

        return [createPitchBend(this.currentGroup, channel, pitch)]
    }

    /**
     * Convert Pressure/Channel Pressure to UMP
     */
    private pressureToUmp(command: MIDI2AudioCommand): UMPPacket[] {
        const channel = clampChannel(command.channel || 0)
        // Pressure is 16-bit in MIDI 2
        const pressure = controlValueMidi1ToMidi2(command.value || 0)

        return [createChannelPressure(this.currentGroup, channel, pressure)]
    }

    /**
     * Set UMP group (0-15)
     */
    setGroup(group: number): void {
        this.currentGroup = clampGroup(group)
    }

    /**
     * Get current UMP group
     */
    getGroup(): number {
        return this.currentGroup
    }
}




