/**
 * MIDI 2.0 Utility Functions
 * Pure utility methods for UMP packet creation and conversion
 */

/**
 * MIDI 2.0 UMP Packet (32-bit word)
 */
export type UMPPacket = number

/**
 * UMP Message Types
 */
export enum UMPMessageType {
    UTILITY = 0x0,              // Utility Message
    SYSTEM_REALTIME = 0x1,      // System Real Time
    SYSTEM_COMMON = 0x2,        // System Common
    MIDI1_CHANNEL_VOICE = 0x3,  // MIDI 1 Channel Voice
    DATA = 0x4,                 // Data Message
    FLEX_DATA = 0x5,            // Flex Data Message
    EXTENDED_DATA = 0x6,        // Extended Data Message
    RESERVED = 0x7,             // Reserved
    CHANNEL_VOICE = 0x8,        // MIDI 2.0 Channel Voice (64-bit)
    STREAM = 0x9,               // Stream Message (64-bit)
    SYSEX = 0xA,                // System Exclusive
    RESERVED_B = 0xB,           // Reserved
    RESERVED_C = 0xC,           // Reserved
    RESERVED_D = 0xD,           // Reserved
    RESERVED_E = 0xE,           // Reserved
    RESERVED_F = 0xF            // Reserved
}

/**
 * Channel Voice Status (MIDI 2.0)
 */
export enum ChannelVoiceStatus {
    NOTE_OFF = 0x0,
    NOTE_ON = 0x1,
    POLY_PRESSURE = 0x2,
    CONTROL_CHANGE = 0x3,
    PROGRAM_CHANGE = 0x4,
    CHANNEL_PRESSURE = 0x5,
    PITCH_BEND = 0x6,
    PER_NOTE_CC = 0x7
}

/**
 * MIDI 2.0 Per-Note Controller Numbers
 */
export const PER_NOTE_CONTROLLERS = {
    VIBRATO: 0x01,
    BRIGHTNESS: 0x02,
    TIMBRE: 0x03,
    RELEASE_TENSION: 0x04
} as const

/**
 * 
 * @param byte0 
 * @param byte1 
 * @param data 
 * @returns 
 */
export const createUMPPacket = ( byte0: number, byte1: number, data: number ): UMPPacket => {
    return (byte0 << 24) | (byte1 << 16) | (data & 0xFFFF)
}

/**
 * Create Note On UMP packet
 */
export const createNoteOn = (
    group: number,
    channel: number,
    note: number,
    velocity: number
): UMPPacket => {
    const messageType = UMPMessageType.CHANNEL_VOICE
    const status = ChannelVoiceStatus.NOTE_ON

    const byte0 = (messageType << 4) | group
    const byte1 = (status << 4) | channel
    const data = (note << 24) | (velocity & 0xFFFF)

    return createUMPPacket(byte0, byte1, data)
}

/**
 * Create Note Off UMP packet
 */
export const createNoteOff = (
    group: number,
    channel: number,
    note: number,
    velocity: number
): UMPPacket => {
    const messageType = UMPMessageType.CHANNEL_VOICE
    const status = ChannelVoiceStatus.NOTE_OFF

    const byte0 = (messageType << 4) | group
    const byte1 = (status << 4) | channel
    const data = (note << 24) | (velocity & 0xFFFF)

    return createUMPPacket(byte0, byte1, data)
}

/**
 * Create Control Change UMP packet (16-bit value)
 */
export const createControlChange = (
    group: number,
    channel: number,
    controller: number,
    value: number
): UMPPacket => {
    const messageType = UMPMessageType.CHANNEL_VOICE
    const status = ChannelVoiceStatus.CONTROL_CHANGE

    const byte0 = (messageType << 4) | group
    const byte1 = (status << 4) | channel
    const data = (controller << 24) | (value & 0xFFFF)

    return createUMPPacket(byte0, byte1, data)
}

/**
 * Create Per-Note Controller UMP packet
 */
export const createPerNoteController = (
    group: number,
    channel: number,
    note: number,
    controller: number,
    value: number
): UMPPacket => {
    const messageType = UMPMessageType.CHANNEL_VOICE
    const status = ChannelVoiceStatus.PER_NOTE_CC

    const byte0 = (messageType << 4) | group
    const byte1 = (status << 4) | channel
    const data = (note << 24) | (controller << 16) | (value & 0xFFFF)

    return createUMPPacket(byte0, byte1, data)
}

/**
 * Create Pitch Bend UMP packet (32-bit precision)
 */
export const createPitchBend = (
    group: number,
    channel: number,
    pitch: number
): UMPPacket => {
    const messageType = UMPMessageType.CHANNEL_VOICE
    const status = ChannelVoiceStatus.PITCH_BEND

    const byte0 = (messageType << 4) | group
    const byte1 = (status << 4) | channel

    return createUMPPacket(byte0, byte1, pitch)
}

/**
 * Create Program Change UMP packet
 */
export const createProgramChange = (
    group: number,
    channel: number,
    program: number
): UMPPacket => {
    const messageType = UMPMessageType.CHANNEL_VOICE
    const status = ChannelVoiceStatus.PROGRAM_CHANGE

    const byte0 = (messageType << 4) | group
    const byte1 = (status << 4) | channel
    const data = program & 0x00FFFFFF

    return createUMPPacket(byte0, byte1, data)
}

/**
 * Create Channel Pressure UMP packet
 */
export const createChannelPressure = (
    group: number,
    channel: number,
    pressure: number
): UMPPacket => {
    const messageType = UMPMessageType.CHANNEL_VOICE
    const status = ChannelVoiceStatus.CHANNEL_PRESSURE

    const byte0 = (messageType << 4) | group
    const byte1 = (status << 4) | channel

    return ((byte0 << 24) | (byte1 << 16) | pressure) >>> 0
}

/**
 * Convert MIDI 1 velocity (0-127) to MIDI 2.0 (0-65535)
 */
export const velocityMidi1ToMidi2 = (velocity: number): number => {
    return Math.round((velocity / 127) * 65535)
}

/**
 * Convert MIDI 2.0 velocity (0-65535) to MIDI 1 (0-127)
 */
export const velocityMidi2ToMidi1 = (velocity: number): number => {
    return Math.round((velocity / 65535) * 127)
}

/**
 * Convert MIDI 1 controller value (0-127) to MIDI 2.0 (0-65535)
 */
export const controlValueMidi1ToMidi2 = (value: number): number => {
    return Math.round((value / 127) * 65535)
}

/**
 * Convert MIDI 2.0 controller value (0-65535) to MIDI 1 (0-127)
 */
export const controlValueMidi2ToMidi1 = (value: number): number => {
    return Math.round((value / 65535) * 127)
}

/**
 * Clamp channel to valid range (0-15)
 */
export const clampChannel = (channel: number): number => {
    return Math.min(15, Math.max(0, channel))
}

/**
 * Clamp group to valid range (0-15)
 */
export const clampGroup = (group: number): number => {
    return Math.min(15, Math.max(0, group))
}

/**
 * Clamp note to valid range (0-127)
 */
export const clampNote = (note: number): number => {
    return Math.min(127, Math.max(0, note))
}

/**
 * Clamp program to valid range (0-127)
 */
export const clampProgram = (program: number): number => {
    return Math.min(127, Math.max(0, program))
}
