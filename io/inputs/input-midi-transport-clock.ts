import {
	INPUT_EVENT,
	EVENT_DEVICE_LIST_CHANGED,
	EVENT_CONFIGURATION_CHANGED,
	EVENT_CONNECTION_CHANGED,
	EVENT_TRANSPORT_COMMAND
} from "../../event-constants.ts"
import AbstractInput from "./abstract-input"
import InputWebMIDIDevice from "./input-webmidi-device"
import InputMIDI2Native from "./input-midi2-native-device"
import type InputAudioEvent from "../events/input-audio-event"
import { MIDI_CLOCK, MIDI_START, MIDI_STOP, MIDI_CONTINUE, NOTE_ON, NOTE_OFF } from "../../commands"

export const MIDI_TRANSPORT_CLOCK_INPUT_ID = "MIDI Transport Clock"

export default class InputMIDITransportClock extends AbstractInput {
	#input: InputWebMIDIDevice | InputMIDI2Native
	#stats = { clockCount: 0, lastClockTime: 0, calculatedBPM: 0, quarterNoteCount: 0 }
	#lastQuarter: number | undefined
	#subscription = new AbortController()
	get name() {
		return MIDI_TRANSPORT_CLOCK_INPUT_ID
	}
	get description() {
		return "MIDI transport and clock (24 pulses per quarter note)"
	}
	get isEnabled() {
		return this.isConnected
	}
	get inputDevices() {
		return this.#input.inputDevices
	}
	get midiInput() {
		return this.#input
	}
	get options(): Record<string, any> {
		return this.#input?.options ?? super.options
	}
	get clockStats() {
		return { ...this.#stats }
	}
	get calculatedBPM() {
		return this.#stats.calculatedBPM
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.#input = options.useNativeInput
			? new InputMIDI2Native(this.options)
			: new InputWebMIDIDevice(this.options)
		this.#input.addEventListener(INPUT_EVENT, this.receive, {
			signal: this.#subscription.signal
		})
		for (const type of [
			EVENT_DEVICE_LIST_CHANGED,
			EVENT_CONFIGURATION_CHANGED,
			EVENT_CONNECTION_CHANGED
		]) {
			this.#input.addEventListener(
				type,
				() => {
					if (this.#input.isConnected) {
						this.setAsConnected()
					} else {
						this.setAsDisconnected()
					}
					this.dispatchEvent(new Event(type))
				},
				{ signal: this.#subscription.signal }
			)
		}
	}
	private receive = (received: Event) => {
		const event = received as unknown as InputAudioEvent
		const command = event.command
		const realTime = [MIDI_CLOCK, MIDI_START, MIDI_CONTINUE, MIDI_STOP].includes(command.type)
		const mackie =
			command.channel === 1 &&
			[91, 93, 94, 95].includes(command.number) &&
			[NOTE_ON, NOTE_OFF].includes(command.type)
		if (!realTime && !mackie) {
			return
		}
		if (command.type === MIDI_START) {
			this.resetStats()
		}
		if (command.type === MIDI_CLOCK) {
			const now = performance.now()
			this.#stats.clockCount++
			this.#stats.lastClockTime = now
			if (this.#stats.clockCount % 24 === 0) {
				this.#stats.quarterNoteCount++
				if (this.#lastQuarter !== undefined && now > this.#lastQuarter) {
					this.#stats.calculatedBPM = 60000 / (now - this.#lastQuarter)
				}
				this.#lastQuarter = now
			}
		}
		// Forward every pulse, rather than reducing the stream to one command per beat.
		this.dispatch(command, event.origin)
		this.dispatchEvent(new CustomEvent(EVENT_TRANSPORT_COMMAND, { detail: command }))
	}
	async connect(): Promise<void> {
		await this.#input.connect()
		if (this.#input.isConnected) {
			this.setAsConnected()
		} else {
			this.setAsDisconnected()
		}
	}
	async disconnect(): Promise<void> {
		await this.#input.disconnect()
		this.setAsDisconnected()
	}
	createGui(): Promise<HTMLElement> {
		return this.#input.createGui()
	}
	destroyGui(): Promise<void> {
		return this.#input.destroyGui()
	}
	resetStats(): void {
		this.#stats = { clockCount: 0, lastClockTime: 0, calculatedBPM: 0, quarterNoteCount: 0 }
		this.#lastQuarter = undefined
	}
	getClockCount() {
		return this.#stats.clockCount
	}
	getClockProgress() {
		return this.#stats.clockCount % 24
	}
	hasMidiInput() {
		return true
	}
	hasAutomationInput() {
		return true
	}
	async destroy(): Promise<void> {
		this.#subscription.abort()
		await this.disconnect()
		await this.#input.destroy()
	}
}