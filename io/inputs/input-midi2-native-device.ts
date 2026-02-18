/**
 * Native MIDI 2.0 Input Device
 * Uses 64-bit UMP (Universal MIDI Packet) format
 * Supports per-note controllers, high-resolution values, and native OS APIs
 * Windows: MM API, macOS: CoreMIDI, Linux: ALSA
 */

import AbstractInput from "./abstract-input.ts"
import type { IAudioInput } from "./input-interface.ts"
import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels.ts"

export const MIDI2_NATIVE_INPUT_ID = "MIDI 2.0 Native"

interface NativeDevice {
	index: number
	name: string
}

interface PerNoteData {
	velocity: number // 0-65535 (16-bit)
	controllers: Map<number, number>
	timestamp: number
}

let nativeMIDI: any = null

// Try to load native MIDI module (dynamically loaded in constructor)
async function loadNativeMIDI(): Promise<any> {
	if (nativeMIDI !== null) return nativeMIDI
	
	try {
		// Use import() for ES modules compatibility
		const mod = await import('../../../build/Release/midi2-native.node' as any)
		nativeMIDI = mod
		return nativeMIDI
	} catch (e) {
		console.warn('[InputMIDI2Native] Native MIDI module not available:', e)
		return null
	}
}

const DEFAULT_OPTIONS = {
	channels: ALL_MIDI_CHANNELS,
	devices: []
}

/**
 * MIDI 2.0 Per-Note Controller types
 */
enum PerNoteController {
	VELOCITY = 0x01,
	NOTE_ON_VELOCITY = 0x02,
	BRIGHTNESS = 0x03,
	TIMBRE = 0x04,
	RELEASE_TENSION = 0x05,
	ATTACK_TIME = 0x06,
	DECAY_TIME = 0x07,
	SUSTAIN_LEVEL = 0x08,
	RELEASE_TIME = 0x09,
	VIBRATO_RATE = 0x0A,
	VIBRATO_DEPTH = 0x0B,
	VIBRATO_DELAY = 0x0C,
	BRIGHTNESS_RANGE = 0x0D
}

export default class InputMIDI2Native extends AbstractInput implements IAudioInput {
	
	#devices: NativeDevice[] = []
	#activeDevices: Set<number> = new Set()
	#listeners: Map<number, Function> = new Map()
	#nativeMIDIEnabled: boolean = false
	#activeNotes: Map<number, PerNoteData> = new Map()

	get name(): string {
		return MIDI2_NATIVE_INPUT_ID
	}

	get description(): string {
		return "MIDI 2.0 input with per-note controllers via native OS MIDI"
	}

	get isEnabled(): boolean {
		return this.#nativeMIDIEnabled
	}

	get inputDevices(): NativeDevice[] {
		return [...this.#devices]
	}

	constructor(options: Record<string, any> = DEFAULT_OPTIONS) {
		super(options)
	}

	/**
	 * Initialize and enumerate available MIDI input devices
	 */
	async connect(): Promise<void> {
		// Load native module if not already loaded
		if (nativeMIDI === null) {
			await loadNativeMIDI()
		}

		if (!nativeMIDI) {
			this.setAsDisconnected()
			throw new Error('[InputMIDI2Native] Native MIDI module not available')
		}

		try {
			this.#devices = nativeMIDI.getUmpInputs()
			console.log('[InputMIDI2Native] Available MIDI inputs:', this.#devices)

			if (this.#devices.length === 0) {
				console.warn('[InputMIDI2Native] No MIDI input devices found')
				this.setAsConnected()
				this.#nativeMIDIEnabled = true
				return
			}

			// Listen to all devices by default
			for (const device of this.#devices) {
				await this.#listenToDevice(device.index)
			}

			this.setAsConnected()
			this.#nativeMIDIEnabled = true
			console.info('[InputMIDI2Native] Connected to', this.#devices.length, 'MIDI 2.0 input device(s)')
		} catch (error) {
			this.setAsDisconnected()
			console.error('[InputMIDI2Native] Failed to connect:', error)
			throw error
		}
	}

	/**
	 * Disconnect from all MIDI devices
	 */
	async disconnect(): Promise<void> {
		for (const deviceIndex of this.#activeDevices) {
			this.#stopListeningToDevice(deviceIndex)
		}
		this.#activeDevices.clear()
		this.#listeners.clear()
		this.#activeNotes.clear()
		this.#nativeMIDIEnabled = false
		this.setAsDisconnected()
	}

	/**
	 * Start listening to a specific MIDI device
	 */
	private async #listenToDevice(deviceIndex: number): Promise<void> {
		if (!nativeMIDI) return

		const listener = (inDeviceIndex: number, umpPacket: number) => {
			if (inDeviceIndex === deviceIndex) {
				this.#handleUmpPacket(deviceIndex, umpPacket)
			}
		}

		try {
			this.#listeners.set(deviceIndex, listener)
			this.#activeDevices.add(deviceIndex)
			nativeMIDI.onUmpInput(listener)
			console.info('[InputMIDI2Native] Listening to device', deviceIndex)
		} catch (error) {
			console.error('[InputMIDI2Native] Error listening to device:', error)
		}
	}

	/**
	 * Stop listening to a specific MIDI device
	 */
	private #stopListeningToDevice(deviceIndex: number): void {
		if (!nativeMIDI) return

		try {
			this.#listeners.delete(deviceIndex)
			console.info('[InputMIDI2Native] Stopped listening to device', deviceIndex)
		} catch (error) {
			console.error('[InputMIDI2Native] Error stopping listener:', error)
		}
	}

	/**
	 * Handle incoming UMP packet (MIDI 2.0 format)
	 */
	private #handleUmpPacket(deviceIndex: number, packet: number): void {
		const status = packet & 0xFF
		const data1 = (packet >> 8) & 0xFF
		const data2 = (packet >> 16) & 0xFF
		const channel = (status & 0x0F) + 1

		const command = status >> 4
		const timestamp = performance.now()

		switch (command) {
			case 0x9: // Note On (MIDI 2.0 - 16-bit velocity)
				const noteOnVelocity = (data2 << 8) | data1 // Combine for 16-bit velocity
				this.#activeNotes.set(data1, {
					velocity: noteOnVelocity,
					controllers: new Map(),
					timestamp
				})

				this.emit('noteon', {
					note: data1,
					velocity: noteOnVelocity,
					velocityMidi1: Math.round((noteOnVelocity / 65535) * 127), // Convert to MIDI 1 for compatibility
					channel,
					deviceIndex,
					timestamp
				})
				break

			case 0x8: // Note Off (MIDI 2.0 - 16-bit velocity)
				const noteData = this.#activeNotes.get(data1)
				const noteOffVelocity = noteData?.velocity || 0

				this.emit('noteoff', {
					note: data1,
					velocity: noteOffVelocity,
					velocityMidi1: Math.round((noteOffVelocity / 65535) * 127),
					channel,
					controllers: noteData?.controllers,
					deviceIndex,
					timestamp
				})

				this.#activeNotes.delete(data1)
				break

			case 0xB: // Control Change (MIDI 2.0 - 16-bit resolution)
				const ccValue = (data2 << 8) | data1
				this.emit('controlchange', {
					controller: data1,
					value: ccValue,
					valueMidi1: Math.round((ccValue / 65535) * 127),
					channel,
					deviceIndex,
					timestamp
				})
				break

			case 0xE: // Pitch Bend (MIDI 2.0 - 32-bit precision)
				const pitchBend = (data2 << 8) | data1
				// Convert from MIDI 2.0 32-bit (-8192 to +8192 cents) to MIDI 1.0 range
				const pitchBendMidi1 = Math.round(((pitchBend - 0x80000000) / 0x80000000) * 8192) + 8192

				this.emit('pitchbend', {
					value: pitchBend,
					valueMidi1: pitchBendMidi1,
					cents: ((pitchBend - 0x80000000) / 0x80000000) * 8192,
					channel,
					deviceIndex,
					timestamp
				})
				break

			case 0xC: // Program Change
				this.emit('programchange', {
					program: data1,
					bank: data2,
					channel,
					deviceIndex,
					timestamp
				})
				break

			case 0xA: // Polyphonic Aftertouch (MIDI 2.0 - 16-bit)
				const polyPressure = (data2 << 8) | data1
				this.emit('polyaftertouch', {
					note: data1,
					pressure: polyPressure,
					pressureMidi1: Math.round((polyPressure / 65535) * 127),
					channel,
					deviceIndex,
					timestamp
				})
				break

			case 0xD: // Channel Aftertouch (MIDI 2.0 - 16-bit)
				const channelPressure = (data2 << 8) | data1
				this.emit('channelaftertouch', {
					pressure: channelPressure,
					pressureMidi1: Math.round((channelPressure / 65535) * 127),
					channel,
					deviceIndex,
					timestamp
				})
				break

			case 0x0: // Per-Note Controller (MIDI 2.0 exclusive)
				const controllerType = data1
				const controllerValue = (data2 << 8) | data1
				const note = packet & 0xFF // Note is in lower byte

				const notePerNoteData = this.#activeNotes.get(note)
				if (notePerNoteData) {
					notePerNoteData.controllers.set(controllerType, controllerValue)
				}

				this.emit('pernoteccontroller', {
					note,
					controllerType,
					value: controllerValue,
					channel,
					deviceIndex,
					timestamp
				})
				break
		}
	}

	/**
	 * Get list of available devices
	 */
	getAvailableDevices(): NativeDevice[] {
		return [...this.#devices]
	}

	/**
	 * Get active notes with their MIDI 2.0 per-note controller data
	 */
	getActiveNotesWithControllers(): Map<number, PerNoteData> {
		return new Map(this.#activeNotes)
	}

	/**
	 * Enable listening to a specific device
	 */
	async enableDevice(deviceIndex: number): Promise<void> {
		if (!this.#activeDevices.has(deviceIndex)) {
			await this.#listenToDevice(deviceIndex)
		}
	}

	/**
	 * Disable listening to a specific device
	 */
	disableDevice(deviceIndex: number): void {
		if (this.#activeDevices.has(deviceIndex)) {
			this.#stopListeningToDevice(deviceIndex)
			this.#activeDevices.delete(deviceIndex)
		}
	}

	/**
	 * Emit event to listeners
	 */
	private emit(eventType: string, detail: any): void {
		const event = new CustomEvent(eventType, { detail })
		this.dispatchEvent(event)
	}

	hasMidiInput(): boolean {
		return true
	}

	hasAudioInput(): boolean {
		return false
	}

	hasAutomationInput(): boolean {
		return false
	}

	hasMpeInput(): boolean {
		return true // MIDI 2.0 Per-Note Controllers = MPE-like functionality
	}

	hasOscInput(): boolean {
		return false
	}

	hasSysexInput(): boolean {
		return false
	}

	/**
	 * Disconnect and cleanup
	 */
	destroy(): void {
		this.disconnect()
	}
}
