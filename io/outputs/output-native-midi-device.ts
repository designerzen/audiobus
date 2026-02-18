/**
 * Native OS MIDI Device Output Adapter
 * Uses Windows MIDI Services, CoreMIDI (macOS), or ALSA (Linux)
 * Replaces webmidi dependency with OS-native APIs
 */

import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels.ts"
import type { IAudioOutput } from "./output-interface.ts"

export const NATIVE_MIDI_OUTPUT_ID = "Native MIDI"

interface NativeDevice {
	index: number
	name: string
}

let nativeMIDI: any = null

// Try to load native MIDI module (dynamically loaded in constructor)
async function loadNativeMIDI(): Promise<any> {
	if (nativeMIDI !== null) return nativeMIDI
	
	// Native module only available in Electron/Node.js, not in browser
	if (typeof window !== 'undefined') {
		console.warn('[OutputNativeMIDIDevice] Native MIDI module not available in browser environment')
		return null
	}
	
	try {
		// Use import() for ES modules compatibility
		const mod = await import('../../../build/Release/midi2-native.node' as any)
		nativeMIDI = mod
		return nativeMIDI
	} catch (e) {
		console.warn('[OutputNativeMIDIDevice] Native MIDI module not available:', e)
		return null
	}
}

const DEFAULT_OPTIONS = {
	channels: ALL_MIDI_CHANNELS
}

export default class OutputNativeMIDIDevice extends EventTarget implements IAudioOutput {
	static ID: number = 0

	#uuid: string
	#deviceIndex: number | null = null
	#activeNotes: Set<number> = new Set()
	#options: any
	#devices: NativeDevice[] = []
	#isConnected: boolean = false

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return NATIVE_MIDI_OUTPUT_ID
	}

	get description(): string {
		return "Sends MIDI messages to a connected native OS MIDI device"
	}

	get isConnected(): boolean {
		return this.#isConnected
	}

	get isHidden(): boolean {
		return false
	}

	constructor(options = DEFAULT_OPTIONS) {
		super()
		this.#uuid = "Output-NativeMIDI-" + (OutputNativeMIDIDevice.ID++)
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
			throw new Error('[OutputNativeMIDIDevice] Native MIDI module not available')
		}

		try {
			this.#devices = nativeMIDI.getUmpOutputs()
			console.log('[OutputNativeMIDIDevice] Available MIDI outputs:', this.#devices)

			if (this.#devices.length === 0) {
				console.warn('[OutputNativeMIDIDevice] No MIDI output devices found')
				this.#isConnected = false
				return
			}

			// Use first device by default
			this.#deviceIndex = 0
			nativeMIDI.openUmpOutput(this.#deviceIndex)
			this.#isConnected = true

			console.info('[OutputNativeMIDIDevice] Connected to device:', this.#devices[this.#deviceIndex])
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Failed to connect:', error)
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
				console.error('[OutputNativeMIDIDevice] Error closing device:', error)
			}
		}
		this.#deviceIndex = null
		this.#isConnected = false
	}

	/**
	 * Get the set of currently active note numbers
	 */
	getActiveNotes(): Set<number> {
		return new Set(this.#activeNotes)
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
	 * Send MIDI note on
	 */
	noteOn(noteNumber: number, velocity: number = 100, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		this.#activeNotes.add(noteNumber)

		try {
			const status = 0x90 | (channel - 1)
			const msg = status | (noteNumber << 8) | (velocity << 16)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] Note On sent', {
				note: noteNumber,
				velocity,
				channel
			})
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending Note On:', error)
		}
	}

	/**
	 * Send MIDI note off
	 */
	noteOff(noteNumber: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		this.#activeNotes.delete(noteNumber)

		try {
			const status = 0x80 | (channel - 1)
			const msg = status | (noteNumber << 8)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] Note Off sent', {
				note: noteNumber,
				channel
			})
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending Note Off:', error)
		}
	}

	/**
	 * Send All Notes Off (CC#123)
	 */
	allNotesOff(channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		try {
			const status = 0xB0 | (channel - 1)
			const msg = status | (123 << 8) | (0 << 16)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] All Notes Off sent', {
				channel
			})
			this.#activeNotes.clear()
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending All Notes Off:', error)
		}
	}

	/**
	 * Send MIDI control change
	 */
	sendControlChange(controlNumber: number, value: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		try {
			const status = 0xB0 | (channel - 1)
			const msg = status | (controlNumber << 8) | (value << 16)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] Control Change sent', {
				controller: controlNumber,
				value,
				channel
			})
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending Control Change:', error)
		}
	}

	/**
	 * Send MIDI program change
	 */
	sendProgramChange(program: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		try {
			const status = 0xC0 | (channel - 1)
			const msg = status | (program << 8)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] Program Change sent', {
				program,
				channel
			})
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending Program Change:', error)
		}
	}

	/**
	 * Send MIDI pitch bend
	 */
	sendPitchBend(value: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		try {
			const status = 0xE0 | (channel - 1)
			const lsb = value & 0x7F
			const msb = (value >> 7) & 0x7F
			const msg = status | (lsb << 8) | (msb << 16)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] Pitch Bend sent', {
				value,
				channel
			})
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending Pitch Bend:', error)
		}
	}

	/**
	 * Send Polyphonic Aftertouch (Key Pressure)
	 */
	sendPolyphonicAftertouch(note: number, pressure: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		try {
			const status = 0xA0 | (channel - 1)
			const msg = status | (note << 8) | (pressure << 16)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] Polyphonic Aftertouch sent', {
				note,
				pressure,
				channel
			})
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending Polyphonic Aftertouch:', error)
		}
	}

	/**
	 * Send Channel Aftertouch (Channel Pressure)
	 */
	sendChannelAftertouch(pressure: number, channel: number = 1): void {
		if (this.#deviceIndex === null || !nativeMIDI) {
			console.warn('[OutputNativeMIDIDevice] No active device')
			return
		}

		try {
			const status = 0xD0 | (channel - 1)
			const msg = status | (pressure << 8)
			nativeMIDI.sendUmp(this.#deviceIndex, msg)

			console.info('[OutputNativeMIDIDevice] Channel Aftertouch sent', {
				pressure,
				channel
			})
		} catch (error) {
			console.error('[OutputNativeMIDIDevice] Error sending Channel Aftertouch:', error)
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
			throw new Error('[OutputNativeMIDIDevice] Native MIDI module not available')
		}

		if (deviceIndex >= this.#devices.length) {
			throw new Error('Device index out of range')
		}

		if (this.#deviceIndex !== null) {
			nativeMIDI.closeUmpOutput(this.#deviceIndex)
		}

		this.#deviceIndex = deviceIndex
		nativeMIDI.openUmpOutput(this.#deviceIndex)
		console.info('[OutputNativeMIDIDevice] Switched to device:', this.#devices[deviceIndex])
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
		return false
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
