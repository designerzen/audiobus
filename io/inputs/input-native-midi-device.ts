/**
 * Native OS MIDI Device Input Adapter
 * Uses Windows MIDI Services, CoreMIDI (macOS), or ALSA (Linux)
 * Receives MIDI events from native OS MIDI APIs
 */

import AbstractInput from "./abstract-input.ts"
import type { IAudioInput } from "./input-interface.ts"
import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels.ts"

export const NATIVE_MIDI_INPUT_ID = "Native MIDI"

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
		console.warn('[InputNativeMIDIDevice] Native MIDI module not available:', e)
		return null
	}
}

const DEFAULT_OPTIONS = {
	channels: ALL_MIDI_CHANNELS,
	devices: []
}

export default class InputNativeMIDIDevice extends AbstractInput implements IAudioInput {
	
	#devices: NativeDevice[] = []
	#activeDevices: Set<number> = new Set()
	#listeners: Map<number, Function> = new Map()
	#nativeMIDIEnabled: boolean = false

	get name(): string {
		return NATIVE_MIDI_INPUT_ID
	}

	get description(): string {
		return "Native MIDI Device Input"
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
			throw new Error('[InputNativeMIDIDevice] Native MIDI module not available')
		}

		try {
			this.#devices = nativeMIDI.getUmpInputs()
			console.log('[InputNativeMIDIDevice] Available MIDI inputs:', this.#devices)

			if (this.#devices.length === 0) {
				console.warn('[InputNativeMIDIDevice] No MIDI input devices found')
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
			console.info('[InputNativeMIDIDevice] Connected to', this.#devices.length, 'MIDI input device(s)')
		} catch (error) {
			this.setAsDisconnected()
			console.error('[InputNativeMIDIDevice] Failed to connect:', error)
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
		this.#nativeMIDIEnabled = false
		this.setAsDisconnected()
	}

	/**
	 * Start listening to a specific MIDI device
	 */
	async #listenToDevice(deviceIndex: number): Promise<void> {
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
			console.info('[InputNativeMIDIDevice] Listening to device', deviceIndex)
		} catch (error) {
			console.error('[InputNativeMIDIDevice] Error listening to device:', error)
		}
	}

	/**
	 * Stop listening to a specific MIDI device
	 */
	#stopListeningToDevice(deviceIndex: number): void {
		if (!nativeMIDI) return

		try {
			this.#listeners.delete(deviceIndex)
			console.info('[InputNativeMIDIDevice] Stopped listening to device', deviceIndex)
		} catch (error) {
			console.error('[InputNativeMIDIDevice] Error stopping listener:', error)
		}
	}

	/**
	 * Handle incoming UMP packet
	 */
	#handleUmpPacket(deviceIndex: number, packet: number): void {
		const status = packet & 0xFF
		const data1 = (packet >> 8) & 0xFF
		const data2 = (packet >> 16) & 0xFF
		const channel = (status & 0x0F) + 1

		const command = status >> 4

		switch (command) {
			case 0x9: // Note On
				this.emit('noteon', {
					note: data1,
					velocity: data2,
					channel,
					deviceIndex,
					timestamp: performance.now()
				})
				break

			case 0x8: // Note Off
				this.emit('noteoff', {
					note: data1,
					velocity: data2,
					channel,
					deviceIndex,
					timestamp: performance.now()
				})
				break

			case 0xB: // Control Change
				this.emit('controlchange', {
					controller: data1,
					value: data2,
					channel,
					deviceIndex,
					timestamp: performance.now()
				})
				break

			case 0xE: // Pitch Bend
				this.emit('pitchbend', {
					value: (data2 << 7) | data1,
					channel,
					deviceIndex,
					timestamp: performance.now()
				})
				break

			case 0xC: // Program Change
				this.emit('programchange', {
					program: data1,
					channel,
					deviceIndex,
					timestamp: performance.now()
				})
				break

			case 0xA: // Polyphonic Aftertouch
				this.emit('polyaftertouch', {
					note: data1,
					pressure: data2,
					channel,
					deviceIndex,
					timestamp: performance.now()
				})
				break

			case 0xD: // Channel Aftertouch
				this.emit('channelaftertouch', {
					pressure: data1,
					channel,
					deviceIndex,
					timestamp: performance.now()
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
		return true
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
