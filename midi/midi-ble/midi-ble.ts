// https://midi.org/midi-over-bluetooth-low-energy-ble-midi
/**
 * In transmitting MIDI data over Bluetooth, a series of MIDI messages of various sizes must be
 * encoded into packets no larger than the negotiated MTU minus 3 bytes (typically 20 bytes or
 * larger.)
 * 
 * The first byte of all BLE packets must be a header byte. This is followed by timestamp bytes and
 * MIDI messages.
 * Header Byte
 * bit 7 Set to 1.
 * bit 6 Set to 0. (Reserved for future use)
 * bits 5-0 timestampHigh:Most significant 6 bits of timestamp information.
 * The header byte contains the topmost 6 bits of timing information for MIDI events in the BLE
 * packet. The remaining 7 bits of timing information for individual MIDI messages encoded in a
 * packet is expressed by timestamp bytes. Timestamps are discussed in detail in a later section.
 * Timestamp Byte
 * bit 7 Set to 1.
 * bits 6-0 timestampLow: Least Significant 7 bits of timestamp information.
 * The 13-bit timestamp for the first MIDI message in a packet is calculated using 6 bits from the
 * header byte and 7 bits from the timestamp byte.
 */
import {
    MIDI_ACTIVE_SENSING, MIDI_CHANNEL_PRESSURE, MIDI_CONTROL_CHANGE, MIDI_TYPES, MIDI_NOTE_OFF, MIDI_NOTE_ON, MIDI_PITCH_BEND, MIDI_POLYPHONIC_KEY_PRESSURE, MIDI_PROGRAM_CHANGE,
    getMIDIChannelEncoded, getMIDIStatusBytesFromNibbleAndChannel, getMIDIStatusBytesFromByteAndChannel
} from './midi-constants.ts'

// Type Definitions & Interfaces
interface MidiCallback {
    setCharacteristicChannel(uuid: string, channel: number): void
    setCharacteristic(characteristic: BluetoothRemoteGATTCharacteristic): void
    noteOff(data: { note: number; channel: number }): void
    noteOn(data: { note: number; velocity: number; channel: number }): void
    controlChange(data: { controlNumber: number; value: number; channel: number }): void
    programChange(data: { controlNumber: number; value: number; channel: number }): void
}

interface ParsedMidiData {
    type: number
    channel: number
    data1: number
    data2: number
}

interface TimestampBytes {
    header: number
    messageTimestamp: number
}

const MIDI_LOG_PREFIX = '[MIDI-BLE]'

// TX MIDI Data Creator --------------------------------------------------------------------------------------

/**
 * Specification for MIDI over Bluetooth Low Energy (BLE-MIDI) 1.0
 * (Version 1.0 Page 7 November 1, 2015)
 * Generate MIDI timestamp bytes for BLE packet from a timestamp
 * otherwise create the timestamp bytes for the current time
 * BLE MIDI timestamp is 13 bits, split into 2 bytes: 
 * 
 *  header (MSB)
 *  messageTimestamp (LSB)
 * 
 * Timestamps are 13-bit values in milliseconds, and therefore the maximum value is 8,191 ms.
 * Timestamps must be issued by the sender in a monotonically increasing fashion.
 * 
 * The 13-bit timestamp for a MIDI message is composed of two parts, a timestampHigh containing
 * the most significant 6 bits and a timestampLow containing the least significant 7 bits. The
 * timestampHigh is initially set using the lower 6 bits from the header byte while the timestampLow is
 * formed of the lower 7 bits from the timestamp byte. Should the timestamp value of a subsequent
 * MIDI message in the same packet overflow/wrap (i.e., the timestampLow is smaller than a
 * preceding timestampLow), the receiver is responsible for tracking this by incrementing the
 * timestampHigh by one (the incremented value is not transmitted, only understood as a result of the
 * overflow condition).
 * 
 * In practice, the time difference between MIDI messages in the same BLE packet should not span
 * more than twice the connection interval. As a result, a maximum of one overflow/wrap may occur
 * per BLE packet.
 * 
 * Timestamps are in the sender’s clock domain and are not allowed to be scheduled in the future.
 * Correlation between the receiver’s clock and the received timestamps must be performed to
 * ensure accurate rendering of MIDI messages, and is not addressed in this document.
 * 
 * @param time 
 * @returns TimestampBytes
 */
const getTimestampBytes = (time?: number | undefined): TimestampBytes => {
    // BLE MIDI timestamp is 13 bits, split into 2 bytes: header (MSB) + messageTimestamp (LSB)
    // NB. Use a small relative timestamp instead of Date.now() to avoid truncation issues
    const timestamp = (time ?? performance.now()) & 8191
    return {
        // timestampHigh
        header: ((timestamp >> 7) | 0x80) & 0xBF,
        // timestampLow
        messageTimestamp: (timestamp & 0x7F) | 0x80
    }
}

const toHex = (n: number, prependOx:boolean=false): string => `${prependOx ? '0x' : ''}${n.toString(16).padStart(2, '0')}`

// MIDI Transactions --------------------------------------------------------------------------------------

/**
 * Take a packet and inspect it for what it is meant to achieve
 * and debug any issues that may be present
 * TODO: add extra functionality
 * 
 * @param characteristic 
 * @param header 
 * @param messageTimestamp 
 * @param midiStatus 
 * @param midiFirstCommand 
 * @param midiSecondCommand 
 * @param packet 
 * @param _runningTotal 
 */
export const describePacket = (
    characteristic:BluetoothRemoteGATTCharacteristic, 
    header: number, messageTimestamp: number, 
    midiStatus: number, midiFirstCommand: number, midiSecondCommand: number, 
    packet:Array<number>, _runningTotal?:Array<number>
) => {
    console.log(MIDI_LOG_PREFIX, 'Packet:', {
        header:toHex(header, true),
        messageTimestamp:toHex(messageTimestamp, true),
        midiStatus: toHex(midiStatus, true),
        midiAction: MIDI_TYPES[midiStatus],
        midiFirstCommand,
        midiSecondCommand,
        packetBytes: Array.from(packet).map(b => toHex(b, true)),
        packet,
        characteristic,
        queue:_runningTotal ? _runningTotal : []
    })
}

/**
 * TODO: Create MIDI 2.0 compliant packets
 * https://midi.org/midi-over-bluetooth-low-energy-ble-midi
 * Create a BLE MIDI Packet from components
 * 
 * @param header 
 * @param messageTimestamp 
 * @param midiStatus 
 * @param midiFirstCommand 
 * @param midiSecondCommand 
 * @returns 
 */
export const createBLEPacket = (messageTimestamp: number, midiStatus: number, midiFirstCommand: number, midiSecondCommand: number, header?: number):Array<number> => {
    const packet = [
        messageTimestamp,
        midiStatus,
        midiFirstCommand & 0x7f,
        midiSecondCommand & 0x7f
    ]
    if (header !== undefined) {
        packet.unshift(header)
    }
    return packet
}

/**
 * Send Bluetooth Light Packet to Bluetooth Characteristic
 * @param characteristic 
 * @param packet 
 * @returns 
 */
export const sendBLEPacket = async (characteristic: BluetoothRemoteGATTCharacteristic, packet: Uint8Array) => {
    try {
        await characteristic.writeValue(packet)
        console.log(MIDI_LOG_PREFIX, 'Packet sent successfully', packet)
        return true
    } catch (err: any) {

        console.error(MIDI_LOG_PREFIX, 'Failed to send packet:', {
            error: err && err.message ? err.message : String(err),
            packet,
            characteristic: characteristic ? characteristic.uuid : 'no uuid'
        })
    }
    return false
}

/**
 * Add data to the runningTotal which allows for many
 * commands to be sent within the specified resolution
 * 
 * @param runningTotal 
 * @param characteristic 
 * @param midiStatus 
 * @param midiFirstCommand
 * @param midiSecondCommand 
 * @param timestamp
 * @returns 
 */
export const queueBLEPacket = async (runningTotal: Array<number>, characteristic: BluetoothRemoteGATTCharacteristic, midiStatus: number, midiFirstCommand: number, midiSecondCommand: number = 0, timestamp: number | undefined = undefined) => {
    const { header, messageTimestamp }: TimestampBytes = getTimestampBytes(timestamp)
    const packet: Array<number> = createBLEPacket(messageTimestamp, midiStatus, midiFirstCommand, midiSecondCommand, runningTotal.length === 0 ? header : undefined)

    describePacket(characteristic, header, messageTimestamp, midiStatus, midiFirstCommand, midiSecondCommand, packet, runningTotal)
    // add to running sequence
    runningTotal.push(...packet)
    return true
}

/**
 * Take all the commands in the queue and send them at once
 * then clear out the queue ready for next expressions
 * @param characteristic 
 * @param runningTotal 
 */
export const dispatchBLEQueue = async (characteristic:BluetoothRemoteGATTCharacteristic, runningTotal: Array<number>) => {
    sendBLEPacket(characteristic, new Uint8Array(runningTotal))
    runningTotal.length = 0
}

/**
 * Send data to the BTLE characteristic
 * BLE-MIDI packets are a repetition of 
 * [header][timestamp][data...][timestamp][data...] ...
 * so we can either send many one after another but any simultaneous
 * messages need to be packed into a single packet so we create a 
 * single rynning thread
 * 
 * @param characteristic 
 * @param midiStatus 
 * @param midiFirstCommand 
 * @param midiSecondCommand 
 * @param timestamp
 * @returns 
 */
export const dispatchBLEPacket = async (
    characteristic: BluetoothRemoteGATTCharacteristic, 
    midiStatus: number, 
    midiFirstCommand: number, 
    midiSecondCommand: number = 0, 
    timestamp: number | undefined = undefined
) => {

    const { header, messageTimestamp }: TimestampBytes = getTimestampBytes(timestamp)
    const packet: Array<number> = createBLEPacket(messageTimestamp, midiStatus, midiFirstCommand, midiSecondCommand, header)
    describePacket(characteristic, header, messageTimestamp, midiStatus, midiFirstCommand, midiSecondCommand, packet )
    return sendBLEPacket(characteristic, new Uint8Array(packet))
}

/**
 * Note, for sending single commands you do not need to use 
 * the runningTotal but if you want to stream data as recommended 
 * by the Bluetooth Spec, which recommends sending data at regular 
 * intervals so that the data does not congest the airwaves,
 * a method for that is below. Call this method *before* calling 
 * the sendBLE methods and use the output from this method as the 
 * final argument parameter "_runningTotal" in the subsequent calls
 * 
 * @param characteristic 
 * @param interval - anything above 1 is allowed (4-10 is a good compromise)
 */
export const startBLECharacteristicStream = ( characteristic:BluetoothRemoteGATTCharacteristic, interval:number = 10, runningTotal:Array<number> = []  ):Array<number> => {
    const intervalId:number = setInterval( ()=>{
        // this happens after every "interval"
        if (runningTotal.length > 0){
            console.info("SENDING MIDI stack", runningTotal)
            dispatchBLEQueue( characteristic, runningTotal)
        }

    }, Math.max(interval, 1))
    return runningTotal
}

/**
 * 
 * @param intervalId - set by above method
 */
export const stopBLECharacteristicStream = () => {

}

export const parseToUint8 = (s:string) :Uint8Array=> {
    if (!s) return new Uint8Array()
    const nums = s.split(',').map(x=>x.trim()).filter(x=>x.length>0).map(x=>Number(x))
    const bytes = nums.map(n => ((n|0) & 0xFF))
    return new Uint8Array(bytes)
}

/**
 * 
 * @param characteristic 
 * @param midiStatus 
 * @param midiFirstCommand 
 * @param midiSecondCommand 
 * @param _runningTotal 
 * @returns 
 */
const sendOrQueueBLEPacket = (
    characteristic: BluetoothRemoteGATTCharacteristic,
    midiStatus: number,
    midiFirstCommand: number,
    midiSecondCommand: number = 0,
    _runningTotal: Array<number> | undefined = undefined
) => {
    if (_runningTotal) {
        return queueBLEPacket(_runningTotal, characteristic, midiStatus, midiFirstCommand, midiSecondCommand)
    } else {
        return dispatchBLEPacket(characteristic, midiStatus, midiFirstCommand, midiSecondCommand)
    }
}

/**
 * Send MIDI Note On message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param note 
 * @param velocity (0-127)
 * @param _runningTotal if you want to send lots of data in one packet
 * @returns {Promise}
 */
export const sendBLECommand = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    data: string,
    value: number = 127,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    // no channel to send to, so exit early
    if (channel === null) { return null }
    const t = parseToUint8(data)
    if (t.length > 0) 
    {
        return null
    }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromNibbleAndChannel(MIDI_NOTE_ON, channel), t, value, _runningTotal)
}

/**
 * Send MIDI Note On message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param note 
 * @param velocity (0-127)
 * @param _runningTotal if you want to send lots of data in one packet
 * @returns {Promise}
 */
export const sendBLENoteOn = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    note: number,
    velocity: number = 127,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromNibbleAndChannel(MIDI_NOTE_ON, channel), note, velocity, _runningTotal)
}

/**
 * Send MIDI Note Off message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param note 
 * @param velocity 
 * @returns {Promise}
 */
export const sendBLENoteOff = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    note: number,
    velocity: number = 0,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromNibbleAndChannel(MIDI_NOTE_OFF, channel), note, velocity, _runningTotal)
}

/**
 * Send MIDI Note Off message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param note 
 * @param velocity 
 * @returns {Promise}
 */
export const sendBLEAllNoteOff = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    note: number = 123,
    velocity: number = 0,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromNibbleAndChannel(MIDI_NOTE_OFF, channel), note, velocity, _runningTotal)
}

/**
 * Send MIDI Control Change message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param controlNumber 
 * @param value 
 * @returns {Promise}
 */
export const sendBLEControlChange = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    controlNumber: number,
    value: number,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromByteAndChannel(MIDI_CONTROL_CHANGE, channel), controlNumber, value, _runningTotal)
}

/**
 * Send MIDI Program Change message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param program 
 * @returns {Promise}
 */
export const sendBLEProgramChange = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    program: number,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromByteAndChannel(MIDI_PROGRAM_CHANGE, channel), program, 0, _runningTotal)
}

/**
 * Send MIDI Polyphonic Aftertouch message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param note 
 * @param pressure 
 * @returns {Promise}
 */
export const sendBLEPolyphonicAftertouch = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    note: number,
    pressure: number,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromByteAndChannel(MIDI_POLYPHONIC_KEY_PRESSURE, channel), note, pressure, _runningTotal)
}

/**
 * Send MIDI Channel Aftertouch message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param pressure 
 * @returns {Promise}
 */
export const sendBLEChannelAftertouch = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    pressure: number,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromByteAndChannel(MIDI_CHANNEL_PRESSURE, channel), pressure, 0, _runningTotal)
}

/**
 * Send MIDI Pitch Bend message via BLE
 * 
 * @param characteristic 
 * @param channel (1-16)
 * @param lsb Least Significant Byte (0-127)
 * @param msb Most Significant Byte (0-127)
 * @returns {Promise}
 */
export const sendBLEPitchBend = async (
    characteristic: BluetoothRemoteGATTCharacteristic,
    channel: number | null,
    lsb: number,
    msb: number,
    _runningTotal: Array<number> | undefined = undefined
): Promise<boolean | null> => {
    if (channel === null) { return null }
    return await sendOrQueueBLEPacket(characteristic, getMIDIStatusBytesFromByteAndChannel(MIDI_PITCH_BEND, channel), lsb, msb, _runningTotal)
}



// RX MIDI Incoming Data Handler --------------------------------------------------------------------------------------


/**
 * Parse MIDI data from BLE characteristic
 * 
 * @param data array of numbers from BLE characteristic
 * @returns {Object}
 */
const parseBluetoothLightDataPacket = (data: number[]): ParsedMidiData | false => {
    const status: number = data[2]

    if (status === MIDI_ACTIVE_SENSING) {
        return false
    }

    const channel: number = (status & 0xf) + 1
    const type: number = status >> 4

    const data1: number = data[3]
    const data2: number = data[4]

    return { type, channel, data1, data2 }
}

/**
 * Handle incoming MIDI data from BLE characteristic
 * via this delicous curry
 * 
 * @param uuid 
 * @param callback 
 * @returns Function
 */
const createBlueToothLightDataReceivedCallback = (uuid: string, callback: MidiCallback) => (data: any): void => {
    const array: number[] = Array.from(data)
    const result: ParsedMidiData | false = parseBluetoothLightDataPacket(array)

    if (!result) {
        return
    }

    const { type, channel, data1, data2 }: ParsedMidiData = result

    console.log(`type: ${MIDI_TYPES[type]} channel: ${channel} data1: ${data1} data2: ${data2}`)

    if (channel !== null) {
        callback.setCharacteristicChannel(uuid, channel)
    }

    if (type === MIDI_NOTE_ON) {

        if (data2 === 0) {
            callback.noteOff({ note: data1, channel })
        } else {
            callback.noteOn({ note: data1, velocity: data2, channel })
        }

    } else if (type === MIDI_NOTE_OFF) {
        callback.noteOff({ note: data1, channel })
    } else if (type === MIDI_CONTROL_CHANGE) {
        callback.controlChange({ controlNumber: data1, value: data2, channel })
    } else if (type === MIDI_POLYPHONIC_KEY_PRESSURE) {
        // TODO: Polyphonic aftertouch not implemented
    } else if (type === MIDI_PROGRAM_CHANGE) {
        callback.programChange({ controlNumber: data1, value: data2, channel })
    } else if (type === MIDI_CHANNEL_PRESSURE) {
        // TODO: Channel aftertouch not implemented
    } else if (type === MIDI_PITCH_BEND) {
        // TODO: Pitch bend not implemented
    }
}

