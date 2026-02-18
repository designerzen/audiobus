// MIDI Status Byte Constants

// Channel Voice Messages
// <<4 for MIDI commands rahter than these nibbles
export const MIDI_NOTE_OFF = 0x8
export const MIDI_NOTE_ON = 0x9
export const MIDI_POLYPHONIC_KEY_PRESSURE = 0xA
export const MIDI_CONTROL_CHANGE = 0xB
export const MIDI_PROGRAM_CHANGE = 0xC
export const MIDI_CHANNEL_PRESSURE = 0xD
export const MIDI_PITCH_BEND = 0xE

/**
 * MIDI uses channels 0-15, but users specify 1-16, so subtract 1
 * and return as a 4 bit value
 * @param channel 
 * @returns {number}
 */
export const getMIDIChannelEncoded = (channel:number=1) => Math.max(0, channel - 1) & 0x0f

export const getMIDIBytesFromNibble = (nibble:number) => nibble << 4
export const getMIDIStatusBytesFromByteAndChannel = (byte:number, channel:number) => getMIDIChannelEncoded(channel) | byte
export const getMIDIStatusBytesFromNibbleAndChannel = (nibble:number, channel:number) => getMIDIChannelEncoded(channel) | getMIDIBytesFromNibble( nibble )

// System Common Messages
export const MIDI_SYSTEM_EXCLUSIVE = 0xF0   // SYSEX!
export const MIDI_TIME_CODE_QUARTER_FRAME = 0xF1
export const MIDI_SONG_POSITION = 0xF2
export const MIDI_SONG_SELECT = 0xF3
export const MIDI_TUNE_REQUEST = 0xF6
export const MIDI_END_OF_EXCLUSIVE = 0xF7

// System Real-Time Messages
export const MIDI_TIMING_CLOCK = 0xF8
export const MIDI_START = 0xFA
export const MIDI_CONTINUE = 0xFB
export const MIDI_STOP = 0xFC

export const MIDI_ACTIVE_SENSING = 0xFE
export const MIDI_RESET = 0xFF

// useful for debugging
export const MIDI_TYPES: Record<number, string> = {
    [MIDI_NOTE_OFF]: 'noteoff',
    [MIDI_NOTE_ON]: 'noteon',
    [MIDI_POLYPHONIC_KEY_PRESSURE]: 'polyat',
    [MIDI_CONTROL_CHANGE]: 'controlchange',
    [MIDI_PROGRAM_CHANGE]: 'programchange',
    [MIDI_CHANNEL_PRESSURE]: 'channelat',
    [MIDI_PITCH_BEND]: 'pitchbend',
    
    [MIDI_SYSTEM_EXCLUSIVE]: 'sysex',
    [MIDI_TIME_CODE_QUARTER_FRAME]: 'timecode',
    [MIDI_SONG_POSITION]: 'songposition',
    [MIDI_SONG_SELECT]: 'songselect',
    [MIDI_TUNE_REQUEST]: 'tunerequest',
    [MIDI_END_OF_EXCLUSIVE]: 'eox',

    [MIDI_TIMING_CLOCK]: 'timingclock',
    [MIDI_START]: 'start',
    [MIDI_CONTINUE]: 'continue',
    [MIDI_STOP]: 'stop',

    [MIDI_ACTIVE_SENSING]: 'activesensing',
    [MIDI_RESET]: 'reset'
}

