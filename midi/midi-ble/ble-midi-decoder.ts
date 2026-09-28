// BLE packets contain a header followed by timestamped MIDI messages. Keep SysEx
// across notifications and expand running status before command conversion.
export class BleMidiDecoder {
    private sysex: number[] = []
    reset(): void { this.sysex = [] }
    decode(value: DataView): number[][] {
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        const messages: number[][] = []
        if (bytes.length < 2 || !(bytes[0] & 0x80)) return messages
        let index = 1
        let running = 0
        while (index < bytes.length) {
            if (bytes[index] & 0x80) index++ // timestamp low
            if (index >= bytes.length) break
            if (this.sysex.length) {
                if (bytes[index] === 0xf7) {
                    this.sysex.push(bytes[index++])
                    messages.push(this.sysex)
                    this.sysex = []
                } else if (bytes[index] >= 0xf8) {
                    messages.push([bytes[index++]])
                } else {
                    while (index < bytes.length && bytes[index] < 0x80) this.sysex.push(bytes[index++])
                }
                continue
            }
            let status = bytes[index]
            if (status & 0x80) {
                index++
                if (status < 0xf0) running = status
                else if (status < 0xf8) running = 0
            } else status = running
            if (!status) break
            if (status === 0xf0) { this.sysex = [status]; continue }
            const kind = status >> 4
            const length = status < 0xf0 ? (kind === 0xc || kind === 0xd ? 1 : 2)
                : status === 0xf1 || status === 0xf3 ? 1 : status === 0xf2 ? 2 : 0
            const message = [status]
            while (message.length <= length && index < bytes.length) {
                if (bytes[index] < 0x80) message.push(bytes[index++])
                else if (index + 1 < bytes.length && bytes[index + 1] >= 0xf8) {
                    // Timestamped realtime events can interrupt a channel message.
                    messages.push([bytes[index + 1]])
                    index += 2
                } else break
            }
            if (message.length === length + 1) messages.push(message)
        }
        return messages
    }
}
