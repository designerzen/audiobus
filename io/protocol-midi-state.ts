/** Musical ownership across byte MIDI, MIDI 1 UMP and MIDI 2 UMP. */
export interface ProtocolPacket {
	format: "midi" | "ump"
	data: number[]
}
interface Voice {
	format: "midi" | "ump1" | "ump2"
	group: number
	channel: number
	note: number
}
export class ProtocolMidiState {
	private held = new Map<string, Voice>()
	private sustain = new Map<string, Voice>()
	private noteOff(voice: Voice): ProtocolPacket {
		const status = 0x80 | (voice.channel - 1)
		if (voice.format === "midi") return { format: "midi", data: [status, voice.note, 0] }
		const first = ((voice.format === "ump2" ? 0x40000000 : 0x20000000) | (voice.group << 24) | (status << 16) | (voice.note << 8)) >>> 0
		return { format: "ump", data: voice.format === "ump2" ? [first, 0] : [first] }
	}
	private sustainOff(voice: Voice): ProtocolPacket {
		const status = 0xb0 | (voice.channel - 1)
		if (voice.format === "midi") return { format: "midi", data: [status, 64, 0] }
		const first = ((voice.format === "ump2" ? 0x40000000 : 0x20000000) | (voice.group << 24) | (status << 16) | (64 << 8)) >>> 0
		return { format: "ump", data: voice.format === "ump2" ? [first, 0] : [first] }
	}
	/** Returns balancing releases to emit before the original packet. */
	accept(packet: ProtocolPacket): ProtocolPacket[] {
		const { data } = packet
		const type = packet.format === "midi" ? 0 : data[0] >>> 28
		if (packet.format === "ump" && type !== 2 && type !== 4) return []
		const status = packet.format === "midi" ? data[0] : (data[0] >>> 16) & 255
		if (status >= 0xf0) return []
		const group = packet.format === "midi" ? 0 : (data[0] >>> 24) & 15
		const channel = (status & 15) + 1
		const note = packet.format === "midi" ? data[1] : (data[0] >>> 8) & 127
		const value = packet.format === "midi" ? data[2] : type === 4 ? data[1] : data[0] & 127
		const kind = status >> 4
		const voice: Voice = { format: packet.format === "midi" ? "midi" : type === 4 ? "ump2" : "ump1", group, channel, note }
		const key = `${group}:${channel}:${note}`, pedal = `${group}:${channel}`
		const releases: ProtocolPacket[] = []
		if (kind === 9 && (type === 4 || value > 0)) {
			const previous = this.held.get(key)
			if (previous) releases.push(this.noteOff(previous))
			this.held.set(key, voice)
		} else if (kind === 8 || kind === 9) this.held.delete(key)
		if (kind === 11) {
			if (note === 64) {
				if (value >= (type === 4 ? 0x80000000 : 64)) this.sustain.set(pedal, voice)
				else this.sustain.delete(pedal)
			} else if (note === 121) this.sustain.delete(pedal)
			else if (note === 120 || note === 123) {
				for (const [heldKey, held] of this.held) {
					if (held.group === group && held.channel === channel) {
						releases.push(this.noteOff(held)); this.held.delete(heldKey)
					}
				}
			}
		}
		return releases
	}
	release(): ProtocolPacket[] {
		const packets = [...this.sustain.values()].map(voice => this.sustainOff(voice))
		packets.push(...[...this.held.values()].map(voice => this.noteOff(voice)))
		this.sustain.clear(); this.held.clear()
		return packets
	}
}
