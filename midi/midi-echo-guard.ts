import { umpToMidiBytes } from "./ump-codec.ts"

// A device must not be sent back a message it played within this many milliseconds,
// and a device with MIDI thru that returns a message sent to it is ignored for as long
export const MIDI_ECHO_TIME = 150
// More identical messages to one device than this within the window is a feedback loop
export const MIDI_REPEAT_WINDOW = 250
export const MIDI_REPEAT_LIMIT = 24
export const MIDI_PANIC_REPEAT_LIMIT = 2

export const EVENT_MIDI_SUPPRESSED = "midiSuppressed"

export type MidiSuppressionReason = "echo" | "repeat"

export interface MidiSuppression {
	reason: MidiSuppressionReason
	device: string
	data: number[]
}

const normalise = (value: unknown): string =>
	String(value ?? "")
		.trim()
		.toLowerCase()

const names = (devices: unknown[]): string[] => [...new Set(devices.map(normalise).filter(Boolean))]

const isPanic = (data: ArrayLike<number>): boolean =>
	data[0] >> 4 === 11 && (data[1] === 120 || data[1] === 123)

/**
 * Identifies a message by its type and note, ignoring channel and velocity,
 * so an echo that a device sends back on another channel still matches
 */
function signature(data: ArrayLike<number>): string | undefined {
	const status = data?.[0]
	if (!Number.isInteger(status) || status < 0x80 || status > 0xff) {
		return
	}
	if (status >= 0xf0) {
		return status.toString(16)
	}
	const kind = status >> 4
	// A note-on with no velocity is a note-off
	const type = kind === 9 && data[2] === 0 ? 8 : kind
	return type === 13 || type === 14 ? String(type) : `${type}:${data[1]}`
}

/**
 * Stops MIDI feedback loops by never playing a device's own notes back to it.
 * Inputs report what each device plays, and outputs then refuse to send that
 * message straight back to the same device. Inputs also ignore a device returning
 * what was just sent to it, and outputs cap identical messages as a last resort.
 * Devices are matched by any of their ids or port names, since a device's input
 * and output ports often differ.
 */
export class MidiEchoGuard extends EventTarget {
	echoTime = MIDI_ECHO_TIME
	repeatWindow = MIDI_REPEAT_WINDOW
	repeatLimit = MIDI_REPEAT_LIMIT
	panicRepeatLimit = MIDI_PANIC_REPEAT_LIMIT
	now = (): number => performance.now()
	#sent = new Map<string, Map<string, number>>()
	#played = new Map<string, Map<string, number>>()
	#repeats = new Map<string, { count: number; start: number }>()

	/** Whether a message may go to a device, remembering it when it may so its echo is recognised */
	allowOutput(devices: unknown[], data: ArrayLike<number>): boolean {
		const sign = signature(data)
		if (!sign) {
			return true
		}
		const ids = names(devices),
			now = this.now()
		if (this.recent(this.#played.get(sign), ids, now)) {
			this.suppressed("echo", ids[0], data)
			return false
		}
		// Clock and other realtime messages repeat by design
		if (data[0] < 0xf8) {
			const key = `${ids[0] ?? ""}|${data[0]}|${data[1] ?? ""}`
			let repeat = this.#repeats.get(key)
			if (!repeat || now - repeat.start > this.repeatWindow) {
				repeat = { count: 0, start: now }
				this.#repeats.set(key, repeat)
			}
			if (++repeat.count > (isPanic(data) ? this.panicRepeatLimit : this.repeatLimit)) {
				this.suppressed("repeat", ids[0], data)
				return false
			}
		}
		const sent = this.#sent.get(sign) ?? new Map<string, number>()
		for (const id of ids) {
			sent.set(id, now)
		}
		this.#sent.set(sign, sent)
		return true
	}
	allowOutputPacket(devices: unknown[], words: number[]): boolean {
		const bytes = umpToMidiBytes(words)
		return bytes ? this.allowOutput(devices, bytes) : true
	}

	/**
	 * Whether a message a device played should be used, remembering it when it should
	 * so it is not sent back to that device. A device returning what was just sent to
	 * it is not; with no device to match, any recent send counts.
	 */
	acceptInput(devices: unknown[], data: ArrayLike<number>): boolean {
		const sign = signature(data)
		if (!sign) {
			return true
		}
		const ids = names(devices),
			now = this.now()
		if (this.recent(this.#sent.get(sign), ids, now)) {
			this.suppressed("echo", ids[0], data)
			return false
		}
		const played = this.#played.get(sign) ?? new Map<string, number>()
		for (const id of ids) {
			played.set(id, now)
		}
		this.#played.set(sign, played)
		return true
	}
	acceptInputPacket(devices: unknown[], words: number[]): boolean {
		const bytes = umpToMidiBytes(words)
		return bytes ? this.acceptInput(devices, bytes) : true
	}

	private recent(times: Map<string, number> | undefined, ids: string[], now: number): boolean {
		const within = (at = -Infinity) => now - at <= this.echoTime
		return (
			!!times &&
			(ids.length
				? ids.some((id) => within(times.get(id)))
				: [...times.values()].some(within))
		)
	}

	suppressed(reason: MidiSuppressionReason, device = "", data: ArrayLike<number>): void {
		this.dispatchEvent(
			new CustomEvent<MidiSuppression>(EVENT_MIDI_SUPPRESSED, {
				detail: { reason, device, data: Array.from(data) }
			})
		)
	}
	clear(): void {
		this.#sent.clear()
		this.#played.clear()
		this.#repeats.clear()
	}
}

/** Shared by every MIDI input and output so echoes are caught across transports */
export const midiEchoGuard = new MidiEchoGuard()

/** Outputs and inputs guard unless their options set echoGuard to false */
export const usesMidiEchoGuard = (options?: Record<string, any>): boolean =>
	options?.echoGuard !== false