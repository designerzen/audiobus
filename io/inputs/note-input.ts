import AbstractInput from "./abstract-input"
import { musicalCommand } from "../event-clip"
import { NOTE_OFF, NOTE_ON } from "../../commands"

/** Live controllers own their note releases, including cancellation and disconnect. */
export default abstract class NoteInput extends AbstractInput {
	private held = new Map<string, { number: number; channel: number; count: number }>()
	private releases = new Set<ReturnType<typeof setTimeout>>()

	constructor(options: Record<string, any> = {}) {
		super({ now: () => performance.now() / 1000, ...options })
	}

	hasMidiInput() {
		return true
	}

	protected noteOn(number: number, velocity = 100, channel = 1): void {
		if (!this.isConnected || !Number.isInteger(number) || number < 0 || number > 127) {
			return
		}
		const key = `${channel}:${number}`,
			held = this.held.get(key)
		if (held) {
			held.count++
			return
		}
		this.held.set(key, { number, channel, count: 1 })
		this.sendNote(NOTE_ON, number, velocity, channel)
	}

	protected noteOff(number: number, channel = 1): void {
		const key = `${channel}:${number}`,
			held = this.held.get(key)
		if (!held) {
			return
		}
		if (--held.count > 0) {
			return
		}
		this.held.delete(key)
		this.sendNote(NOTE_OFF, number, 0, channel)
	}

	protected pulse(number: number, velocity = 100, durationMs = 100, channel = 1): void {
		if (!this.isConnected) {
			return
		}
		this.noteOn(number, velocity, channel)
		const timer = setTimeout(() => {
			this.releases.delete(timer)
			this.noteOff(number, channel)
		}, durationMs)
		this.releases.add(timer)
	}

	private sendNote(type: string, number: number, velocity: number, channel: number): void {
		const command = musicalCommand({
			type,
			number,
			velocity: Math.round(Math.max(0, Math.min(127, velocity))),
			channel,
			from: this.uuid,
			startAt: this.now,
			time: this.now
		})
		this.dispatch(command)
	}

	allNotesOff(): void {
		for (const timer of this.releases) {
			clearTimeout(timer)
		}
		this.releases.clear()
		for (const { number, channel } of this.held.values()) {
			this.sendNote(NOTE_OFF, number, 0, channel)
		}
		this.held.clear()
	}

	async connect(): Promise<void> {
		this.setAsConnected()
	}
	async disconnect(): Promise<void> {
		this.allNotesOff()
		this.setAsDisconnected()
	}
	destroy(): void {
		this.allNotesOff()
		this.setAsDisconnected()
	}
}