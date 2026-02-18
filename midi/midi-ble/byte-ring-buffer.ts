import { MIDI_CONTROL_CHANGE, MIDI_NOTE_OFF, MIDI_NOTE_ON, MIDI_PITCH_BEND, MIDI_POLYPHONIC_KEY_PRESSURE, MIDI_SONG_POSITION, MIDI_SONG_SELECT, MIDI_TIME_CODE_QUARTER_FRAME, MIDI_TUNE_REQUEST } from "./midi-constants"

export const getChannelMessageLength = (status: number): number => {
    const messageType = (status & 0xf0) >> 4
    switch (messageType) {
        case MIDI_NOTE_OFF:
        case MIDI_NOTE_ON:
        case MIDI_POLYPHONIC_KEY_PRESSURE:
        case MIDI_CONTROL_CHANGE:
        case MIDI_PITCH_BEND:
            return 3
        default:
            return 2
    }
}

export const getSystemCommonLength = (status: number): number => {
    switch (status) {
        case MIDI_TIME_CODE_QUARTER_FRAME:
        case MIDI_SONG_SELECT:
            return 2
        case MIDI_SONG_POSITION:
            return 3
        case MIDI_TUNE_REQUEST:
            return 1
        default:
            return 1
    }
}

const extractUint8Range = ( view: DataView, start: number, length: number ): Uint8Array => {
    return new Uint8Array(view.buffer, view.byteOffset + start, length)
}

export class ByteRingBuffer {

    private position: number = 0
    private dataView: DataView

    constructor( dataView: DataView) { 
        this.dataView = dataView
    }

    eof(): boolean {
        return this.position >= this.dataView.byteLength
    }

    // Returns the byte in the current position without advancing the position
    peek(): number {
        if (this.position >= this.dataView.byteLength) {
            throw new Error("Attempted to peek beyond the end of the DataView")
        }
        return this.dataView.getUint8(this.position)
    }

    readByte(): number {
        const byte = this.peek()
        this.position++
        return byte
    }

    parseHeader(): number {
        const b = this.readByte()
        if ((b & 0xc0) !== 0x80) {
            throw new Error(
                `Invalid MIDI packet: expected header byte to start with 10, got ${b.toString(
                    16,
                )}`,
            )
        }
        return b & 0x3f
    }

    parseTimestamp(): number {
        const b = this.readByte()
        if ((b & 0x80) !== 0x80) {
            throw new Error(
                `Invalid MIDI packet: expected timestamp byte to start with 10, got ${b.toString(
                    16,
                )}`,
            )
        }
        return b & 0x7f
    }

    parseChannelMessage() {
        const firstByte = this.dataView.getUint8(this.position)
        const length = getChannelMessageLength(firstByte)
        return this.read(length)
    }

    parseSystemMessage(): Uint8Array {
        const firstByte = this.dataView.getUint8(this.position)
        let length: number
        if ((firstByte & 0xf0) === 0xf0) {
            // System Common Message
            length = getSystemCommonLength(firstByte)
        } else {
            // System Real-Time Message
            length = 1
        }
        return this.read(length)
    }

    read(length: number): Uint8Array {
        if (this.position + length > this.dataView.byteLength) {
            throw new Error(
                `Invalid read: requested ${length} bytes, but only ${this.dataView.byteLength - this.position
                } bytes available`,
            )
        }
        const bytes = extractUint8Range(this.dataView, this.position, length)
        this.position += length
        return bytes
    }
}
