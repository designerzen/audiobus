/**
 * Native MIDI 2.0 Output Device
 * Uses 64-bit UMP (Universal MIDI Packet) format
 * Supports per-note controllers, high-resolution values, and native OS APIs
 * Windows: MM API, macOS: CoreMIDI, Linux: ALSA
 */

import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels.ts"
import type { IAudioOutput } from "./output-interface.ts"

export const MIDI2_NATIVE_OUTPUT_ID = "MIDI 2.0 Native"

interface NativeDevice {
	index: number
	name: string
}

let nativeMIDI: any = null

// Try to load native MIDI module (dynamically loaded in constructor)
async function loadNativeMIDI(): Promise<any> {
	if (nativeMIDI !== null){ 
		return nativeMIDI
	}
		
	// Native module only available in Electron/Node.js, not in browser
	if (typeof window !== 'undefined') {
		console.warn('[OutputMIDI2Native] Native MIDI module not available in browser environment')
		return null
	}
	
	try {
		// Use import() for ES modules compatibility
		const mod = await import('../../../build/Release/midi2-native.node' as any)
		nativeMIDI = mod
		return nativeMIDI
	} catch (e) {
		console.warn('[OutputMIDI2Native] Native MIDI module not available:', e)
		return null
	}
}

const DEFAULT_OPTIONS = {
	channels: ALL_MIDI_CHANNELS
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

export default class OutputMIDI2Native extends EventTarget implements IAudioOutput {
	static ID: number = 0

	#uuid: string
	#deviceIndex: number | null = null
	#activeNotes: Map<number, { velocity: number; controllers: Map<number, number> }> = new Map()
	#options: any
	#devices: NativeDevice[] = []
	#isConnected: boolean = false

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return MIDI2_NATIVE_OUTPUT_ID
	}

	get description(): string {
		return "MIDI 2.0 output with per-note controllers via native OS MIDI"
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	constructor(options = DEFAULT_OPTIONS) {
		super()
		this.#uuid = "Output-MIDI2Native-" + (OutputMIDI2Native.ID++)
		this.#options = { ...DEFAULT_OPTIONS, ...options }
	}

	/**
	 * Initialize and enumerate available MIDI devices
	 */
	async connect(): Promise<void> {
		// Load native module if not already loaded
		if (nativeMIDI === null) {
			await loadNativeMIDI()
		}

		if (!nativeMIDI) {
			throw new Error('[OutputMIDI2Native] Native MIDI module not available')
		}

		try {
			this.#devices = nativeMIDI.getUmpOutputs()
			console.log('[OutputMIDI2Native] Available MIDI outputs:', this.#devices)

			if (this.#devices.length === 0) {
				console.warn('[OutputMIDI2Native] No MIDI output devices found')
				this.#isConnected = false
				return
			}

			// Use first device by default
			this.#deviceIndex = 0
			nativeMIDI.openUmpOutput(this.#deviceIndex)
			this.#isConnected = true

			console.info('[OutputMIDI2Native] Connected to device:', this.#devices[this.#deviceIndex])
		} catch (error) {
			console.error('[OutputMIDI2Native] Failed to connect:', error)
			this.#isConnected = false
			throw error
		}
	}

	/**
	 * Disconnect from MIDI device
	 */
	async disconnect(): Promise<void> {
		if (this.#deviceIndex !== null && nativeMIDI) {
			try {
				nativeMIDI.closeUmpOutput(this.#deviceIndex)
			} catch (error) {
				console.error('[OutputMIDI2Native] Error closing device:', error)
			}
		}
		this.#deviceIndex = null
		this.#isConnected = false
	}

	/**
	 * Get the set of currently active note numbers
	 */
	getActiveNotes(): Set<number> {
		return new Set(this.#activeNotes.keys())
	}

	/**
	 * Clear all active notes tracking
	 */
	clearActiveNotes(): void {
		this.#activeNotes.clear()
	}

	/**
	 * Set the MIDI channel for outgoing messages (1-16)
	 */
	setChannel(channel: number | number[]): void {
		this.#options.channels = channel
	}

	/**
	 * Send MIDI 2.0 Note On with 16-bit velocity and per-note controllers
	 */
	noteOn(noteNumber: number, velocity: number = 100, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		// Convert MIDI 1.0 velocity (0-127) to MIDI 2.0 (0-65535)
		const midi2Velocity = Math.round((velocity / 127) * 65535)

		this.#activeNotes.set(noteNumber, {
			velocity: midi2Velocity,
			controllers: new Map()
		})

		try {
			// MIDI 2.0 Note On: 64-bit UMP
			// Header (32-bit): Message type 0x4 (Channel Voice), Group, Status 0x9 (Note On), Channel
			// Data (32-bit): Note number, 16-bit velocity
			const status = 0x90 | (channel - 1)
			const msg32 = status | (noteNumber << 8) | ((midi2Velocity & 0xFF) << 16)
			const msg32_2 = (midi2Velocity >> 8) & 0xFF // Upper 8 bits of velocity

			nativeMIDI.sendUmp(this.#deviceIndex, msg32)
			nativeMIDI.sendUmp(this.#deviceIndex, msg32_2)

			console.info('[OutputMIDI2Native] MIDI 2.0 Note On sent', {
				note: noteNumber,
				velocity: midi2Velocity,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Note On:', error)
		}
	}

	/**
	 * Send MIDI 2.0 Note Off
	 */
	noteOff(noteNumber: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		const noteData = this.#activeNotes.get(noteNumber)
		const velocity = noteData?.velocity || 0

		this.#activeNotes.delete(noteNumber)

		try {
			const status = 0x80 | (channel - 1)
			const msg32 = status | (noteNumber << 8) | ((velocity & 0xFF) << 16)
			const msg32_2 = (velocity >> 8) & 0xFF

			nativeMIDI.sendUmp(this.#deviceIndex, msg32)
			nativeMIDI.sendUmp(this.#deviceIndex, msg32_2)

			console.info('[OutputMIDI2Native] MIDI 2.0 Note Off sent', {
				note: noteNumber,
				velocity,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Note Off:', error)
		}
	}

	/**
	 * Send All Notes Off (CC#123)
	 */
	allNotesOff(channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		try {
			const status = 0xB0 | (channel - 1)
			const msg = status | (123 << 8) | (0 << 16)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputMIDI2Native] All Notes Off sent', { channel })
			this.#activeNotes.clear()
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending All Notes Off:', error)
		}
	}

	/**
	 * Send MIDI 2.0 Control Change with 16-bit resolution
	 */
	sendControlChange(controlNumber: number, value: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		// Convert to 16-bit value
		const midi2Value = Math.round((value / 127) * 65535)

		try {
			const status = 0xB0 | (channel - 1)
			const msg32 = status | (controlNumber << 8) | ((midi2Value & 0xFF) << 16)
			const msg32_2 = (midi2Value >> 8) & 0xFF

			nativeMIDI.sendUmp(this.#deviceIndex, msg32)
			nativeMIDI.sendUmp(this.#deviceIndex, msg32_2)

			console.info('[OutputMIDI2Native] MIDI 2.0 Control Change sent', {
				controller: controlNumber,
				value: midi2Value,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Control Change:', error)
		}
	}

	/**
	 * Send MIDI 2.0 Per-Note Controller
	 */
	sendPerNoteController(
		noteNumber: number,
		controllerType: PerNoteController,
		value: number,
		channel: number = 1
	): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		const noteData = this.#activeNotes.get(noteNumber)
		if (!noteData) {
			console.warn('[OutputMIDI2Native] Per-note controller on inactive note:', noteNumber)
			return
		}

		// Store controller value
		noteData.controllers.set(controllerType, value)

		try {
			// MIDI 2.0 Per-Note Controller message
			const status = 0x00 // Per-note controller
			const msg32 = status | (noteNumber << 8) | (controllerType << 16) | ((value & 0xFF) << 24)
			const msg32_2 = (value >> 8) & 0xFF

			nativeMIDI.sendUmp(this.#deviceIndex, msg32)
			nativeMIDI.sendUmp(this.#deviceIndex, msg32_2)

			console.info('[OutputMIDI2Native] Per-Note Controller sent', {
				note: noteNumber,
				controller: controllerType,
				value,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Per-Note Controller:', error)
		}
	}

	/**
	 * Send MIDI 2.0 Program Change
	 */
	sendProgramChange(program: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		try {
			const status = 0xC0 | (channel - 1)
			const msg = status | (program << 8)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputMIDI2Native] MIDI 2.0 Program Change sent', {
				program,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Program Change:', error)
		}
	}

	/**
	 * Send MIDI 2.0 Pitch Bend with 32-bit precision
	 */
	sendPitchBend(value: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		// MIDI 2.0 pitch bend is 32-bit (0x00000000 = -8192 cents, 0x80000000 = center, 0xFFFFFFFF = +8192 cents)
		const midi2PitchBend = Math.round(((value - 8192) / 8192) * 0x80000000) + 0x80000000

		try {
			const status = 0xE0 | (channel - 1)
			const msg32 = status | ((midi2PitchBend & 0xFFFF) << 8)
			const msg32_2 = (midi2PitchBend >> 16) & 0xFFFF

			nativeMIDI.sendUmp(this.#deviceIndex, msg32)
			nativeMIDI.sendUmp(this.#deviceIndex, msg32_2)

			console.info('[OutputMIDI2Native] MIDI 2.0 Pitch Bend sent', {
				value: midi2PitchBend,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Pitch Bend:', error)
		}
	}

	/**
	 * Send MIDI 2.0 Channel Pressure
	 */
	sendChannelAftertouch(pressure: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		const midi2Pressure = Math.round((pressure / 127) * 65535)

		try {
			const status = 0xD0 | (channel - 1)
			const msg32 = status | ((midi2Pressure & 0xFF) << 8)
			const msg32_2 = (midi2Pressure >> 8) & 0xFF

			nativeMIDI.sendUmp(this.#deviceIndex, msg32)
			nativeMIDI.sendUmp(this.#deviceIndex, msg32_2)

			console.info('[OutputMIDI2Native] MIDI 2.0 Channel Aftertouch sent', {
				pressure: midi2Pressure,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Channel Aftertouch:', error)
		}
	}

	/**
	 * Send MIDI 2.0 Polyphonic Aftertouch
	 */
	sendPolyphonicAftertouch(note: number, pressure: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputMIDI2Native] No active device')
			return
		}

		const midi2Pressure = Math.round((pressure / 127) * 65535)

		try {
			const status = 0xA0 | (channel - 1)
			const msg32 = status | (note << 8) | ((midi2Pressure & 0xFF) << 16)
			const msg32_2 = (midi2Pressure >> 8) & 0xFF

			nativeMIDI.sendUmp(this.#deviceIndex, msg32)
			nativeMIDI.sendUmp(this.#deviceIndex, msg32_2)

			console.info('[OutputMIDI2Native] MIDI 2.0 Polyphonic Aftertouch sent', {
				note,
				pressure: midi2Pressure,
				channel
			})
		} catch (error) {
			console.error('[OutputMIDI2Native] Error sending Polyphonic Aftertouch:', error)
		}
	}

	/**
	 * Get list of available devices
	 */
	getAvailableDevices(): NativeDevice[] {
		return [...this.#devices]
	}

	/**
	 * Switch to a different device
	 */
	async selectDevice(deviceIndex: number): Promise<void> {
		if (!nativeMIDI) {
			throw new Error('[OutputMIDI2Native] Native MIDI module not available')
		}

		if (deviceIndex >= this.#devices.length) {
			throw new Error('Device index out of range')
		}

		if (this.#deviceIndex !== null) {
			nativeMIDI.closeUmpOutput(this.#deviceIndex)
		}

		this.#deviceIndex = deviceIndex
		nativeMIDI.openUmpOutput(this.#deviceIndex)
		console.info('[OutputMIDI2Native] Switched to device:', this.#devices[deviceIndex])
	}

	hasMidiOutput(): boolean {
		return true
	}

	hasAudioOutput(): boolean {
		return false
	}

	hasAutomationOutput(): boolean {
		return false
	}

	hasMpeOutput(): boolean {
		return true // MIDI 2.0 Per-Note Controllers = MPE-like functionality
	}

	hasOscOutput(): boolean {
		return false
	}

	hasSysexOutput(): boolean {
		return false
	}

	/**
	 * Disconnect and cleanup
	 */
	destroy(): void {
		this.allNotesOff()
		this.#activeNotes.clear()
		this.disconnect()
	}
}
