import type { IAudioCommand } from '../audio-command-interface'
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON, PITCH_BEND } from '../commands'
import { musicalCommand } from './event-clip'

export interface OscMessage { address: string; args: Array<number | string> }
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true })
const align = (size: number) => Math.ceil(size / 4) * 4
export const MAX_OSC_PACKET_BYTES = 65536

export function encodeOSC(message: OscMessage): Uint8Array {
    const stringBytes = (value: string) => { const bytes = encoder.encode(value); const padded = new Uint8Array(align(bytes.length + 1)); padded.set(bytes); return padded }
    if (!message.address.startsWith('/') || message.address.includes('\0')) throw new Error('Invalid OSC address')
    const chunks = [stringBytes(message.address), stringBytes(',' + message.args.map(value => typeof value === 'string' ? 's' : Number.isInteger(value) ? 'i' : 'f').join(''))]
    for (const value of message.args) {
        if (typeof value === 'string') { if (value.includes('\0')) throw new Error('Invalid OSC string'); chunks.push(stringBytes(value)); continue }
        if (!Number.isFinite(value)) throw new Error('Invalid OSC argument')
        const bytes = new Uint8Array(4), view = new DataView(bytes.buffer)
        if (Number.isInteger(value)) {
            if (value < -2147483648 || value > 2147483647) throw new Error('OSC integer out of range')
            view.setInt32(0, value)
        } else view.setFloat32(0, value)
        chunks.push(bytes)
    }
    const length = chunks.reduce((sum, bytes) => sum + bytes.length, 0)
    if (length > MAX_OSC_PACKET_BYTES) throw new Error('OSC packet exceeds 64 KB')
    const bytes = new Uint8Array(length); let cursor = 0
    for (const chunk of chunks) { bytes.set(chunk, cursor); cursor += chunk.length }
    return bytes
}

/** Bundles are delivered in packet order on arrival; remote timetags are not a clock source. */
export function decodeOSC(bytes: Uint8Array, depth = 0): OscMessage[] {
    if (bytes.length < 4 || bytes.length > MAX_OSC_PACKET_BYTES || bytes.length % 4 || depth > 8) throw new Error('Invalid OSC packet')
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let cursor = 0
    const readString = () => {
        const start = cursor
        while (cursor < bytes.length && bytes[cursor] !== 0) cursor++
        if (cursor === bytes.length) throw new Error('Unterminated OSC string')
        const value = decoder.decode(bytes.subarray(start, cursor)); cursor = align(cursor + 1)
        if (cursor > bytes.length) throw new Error('Truncated OSC string')
        return value
    }
    const address = readString()
    if (address === '#bundle') {
        if (cursor + 8 > bytes.length) throw new Error('Truncated OSC bundle')
        cursor += 8; const messages: OscMessage[] = []
        while (cursor < bytes.length) {
            if (cursor + 4 > bytes.length) throw new Error('Truncated OSC bundle size')
            const size = view.getInt32(cursor); cursor += 4
            if (size <= 0 || cursor + size > bytes.length) throw new Error('Invalid OSC bundle size')
            messages.push(...decodeOSC(bytes.subarray(cursor, cursor + size), depth + 1)); cursor += size
        }
        return messages
    }
    if (!address.startsWith('/')) throw new Error('Invalid OSC address')
    const tags = readString(); if (!tags.startsWith(',')) throw new Error('OSC type tags are required')
    const args: Array<number | string> = []
    for (const type of tags.slice(1)) {
        if (type === 's') { args.push(readString()); continue }
        if (!['i', 'f'].includes(type) || cursor + 4 > bytes.length) throw new Error('Unsupported or truncated OSC argument')
        const value = type === 'i' ? view.getInt32(cursor) : view.getFloat32(cursor)
        if (!Number.isFinite(value)) throw new Error('Invalid OSC number')
        args.push(value); cursor += 4
    }
    if (cursor !== bytes.length) throw new Error('Unexpected OSC packet data')
    return [{ address, args }]
}

export function oscPrefix(value: unknown): string {
    if (typeof value !== 'string' || !/^\/[a-zA-Z0-9_/-]*$/.test(value) || value.length > 128) throw new Error('Use an OSC prefix such as /harmoneasy')
    return value.replace(/\/+$/, '')
}

export function commandToOSC(command: IAudioCommand, prefix: string): OscMessage | undefined {
    const channel = Number.isInteger(command.channel) && command.channel >= 1 && command.channel <= 16 ? command.channel : 1
    if (command.type === NOTE_ON && command.velocity > 0) return { address: `${prefix}/note/on`, args: [command.number, command.velocity, channel] }
    if (command.type === NOTE_OFF || command.type === NOTE_ON) return { address: `${prefix}/note/off`, args: [command.number, channel] }
    if (command.type === CONTROL_CHANGE) return { address: `${prefix}/cc`, args: [command.number, command.value, channel] }
    if (command.type === PITCH_BEND) return { address: `${prefix}/pitch`, args: [command.value, channel] }
}

export function oscToCommand(message: OscMessage, prefix: string, now: number, from: string): IAudioCommand | undefined {
    const { args, address } = message
    let fields: Partial<IAudioCommand>
    if (address === `${prefix}/note/on` && args.length === 3) fields = { type: NOTE_ON, number: args[0] as number, velocity: args[1] as number, channel: args[2] as number }
    else if (address === `${prefix}/note/off` && args.length === 2) fields = { type: NOTE_OFF, number: args[0] as number, velocity: 0, channel: args[1] as number }
    else if (address === `${prefix}/cc` && args.length === 3) fields = { type: CONTROL_CHANGE, number: args[0] as number, value: args[1] as number, channel: args[2] as number }
    else if (address === `${prefix}/pitch` && args.length === 2) fields = { type: PITCH_BEND, number: 0, value: args[0] as number, channel: args[1] as number }
    else return
    const inRange = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    if (!inRange(fields.number, 0, 127) || !inRange(fields.channel, 1, 16)
        || (fields.velocity !== undefined && !inRange(fields.velocity, 0, 127))
        || (fields.value !== undefined && !inRange(fields.value, 0, fields.type === PITCH_BEND ? 16383 : 127))) throw new Error('OSC MIDI values are out of range')
    return musicalCommand({ ...fields, from, startAt: now, time: now })
}
