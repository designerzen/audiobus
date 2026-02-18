/**
 * This is a WebMIDI Device output adapter
 * that takes audio commands and converts them
 * into WebMIDI messages and sends them to a connected device
 */

import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels.ts"
import { Output, WebMidi } from "webmidi"
import type { IAudioOutput } from "./output-interface.ts"

export const WEBMIDI_OUTPUT_ID = "WebMIDI"

const DEFAULT_OPTIONS = {
	midiOutput: Output, 
	channels:ALL_MIDI_CHANNELS
}

export default class OutputWebMIDIDevice extends EventTarget implements IAudioOutput {
	
	static ID:number = 0

	#uuid: string
	#midiOutput: Output | undefined
	#midiOutputs: Output[] = []
	#activeNotes: Set<number> = new Set()

	#options
	#deviceChangeHandler: ((event: any) => void) | null = null
	#sendToAllDevices: boolean = false

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return WEBMIDI_OUTPUT_ID
	}

	get description(): string {
		return "Sends MIDI messages to a connected WebMIDI device"
	}

	get isConnected(): boolean {
		return this.#midiOutput !== undefined
	}

	get output(): Output | undefined {
		return this.#midiOutput
	}

	get outputDevices(): Output[] {
		return this.#midiOutputs
	}

	get sendToAllDevices(): boolean {
		return this.#sendToAllDevices
	}

	setOutput(deviceId: string): void {
		const device = this.#midiOutputs.find(d => d.id === deviceId)
		if (device) {
			this.#midiOutput = device
			this.#sendToAllDevices = false
			console.info("[WebMIDI Output] Output device changed", { name: device.name })
		}
	}

	setSendToAllDevices(sendToAll: boolean): void {
		this.#sendToAllDevices = sendToAll
		console.info("[WebMIDI Output] Send to all devices changed", { sendToAll })
	}

	constructor(options=DEFAULT_OPTIONS) {
		super()
		this.#uuid = "Output-WebMIDI-"+(OutputWebMIDIDevice.ID++)
		this.#options = {...DEFAULT_OPTIONS, ...options}
	}

	/**
	 * Enable WebMIDI and connect to output devices
	 */
	async connect(): Promise<void> {
		try {
			await WebMidi.enable()
			
			// Store all output devices
			this.#midiOutputs = [...WebMidi.outputs]
			
			// Set the first device as default
			if (this.#midiOutputs.length > 0) {
				this.#midiOutput = this.#midiOutputs[0]
				console.info("[WebMIDI Output] Connected to device", { name: this.#midiOutput.name })
			}

			// Listen for device connect/disconnect events
			this.#deviceChangeHandler = (event: any) => this.onDeviceStateChange(event)
			WebMidi.addListener("connected", this.#deviceChangeHandler)
			WebMidi.addListener("disconnected", this.#deviceChangeHandler)
			
		} catch (error: any) {
			console.error("[WebMIDI Output] Failed to enable WebMIDI", error)
			throw error
		}
	}

	/**
	 * Disconnect from output devices
	 */
	async disconnect(): Promise<void> {
		try {
			// Remove device change listeners
			if (this.#deviceChangeHandler) {
				WebMidi.removeListener("connected", this.#deviceChangeHandler)
				WebMidi.removeListener("disconnected", this.#deviceChangeHandler)
				this.#deviceChangeHandler = null
			}

			this.#midiOutputs = []
			this.#midiOutput = undefined
			
			console.info("[WebMIDI Output] Disconnected")
		} catch (error: any) {
			console.error("[WebMIDI Output] Failed to disconnect", error)
			throw error
		}
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
	setChannel(channel: number|number[]): void {
		this.#options.channels = channel
	}

	/**
	 * Send Note On message to WebMIDI device(s)
	 */
	noteOn(noteNumber: number, velocity: number = 1): void {
		const outputs = this.#sendToAllDevices ? this.#midiOutputs : (this.#midiOutput ? [this.#midiOutput] : [])
		
		if (outputs.length === 0) {
			console.warn("[WebMIDI Output] No output device available for Note On")
			return
		}

		this.#activeNotes.add(noteNumber)

		outputs.forEach((output) => {
			try {
				output.sendNoteOn(
					noteNumber,
					{ 
						attack:velocity, 
						channels:this.#options.channels 
					}
				)
			} catch (err) {
				console.error("[WebMIDI Output] Failed to send Note On", {
					device: output.name,
					note: noteNumber,
					velocity,
					channel: this.#options.channels,
					error: err && err instanceof Error ? err.message : String(err)
				})
			}
		})
		
		console.info("[WebMIDI Output] Note On sent", {
			note: noteNumber,
			velocity,
			devices: outputs.length,
			channel: this.#options.channels
		})
	}

	/**
	 * Send Note Off message to WebMIDI device(s)
	 */
	noteOff(noteNumber: number): void {
		const outputs = this.#sendToAllDevices ? this.#midiOutputs : (this.#midiOutput ? [this.#midiOutput] : [])
		
		if (outputs.length === 0) {
			console.warn("[WebMIDI Output] No output device available for Note Off")
			return
		}

		this.#activeNotes.delete(noteNumber)

		outputs.forEach((output) => {
			try {
				output.sendNoteOff(
					noteNumber,
					{ channels:this.#options.channels }
				)
			} catch (err) {
				console.error("[WebMIDI Output] Failed to send Note Off", {
					device: output.name,
					note: noteNumber,
					channel: this.#options.channels,
					error: err && err instanceof Error ? err.message : String(err)
				})
			}
		})
		
		console.info("[WebMIDI Output] Note Off sent", {
			note: noteNumber,
			devices: outputs.length,
			channel: this.#options.channels
		})
	}

	/**
	 * Send All Notes Off (CC#123) to clear all active notes
	 */
	allNotesOff(): void {
		const outputs = this.#sendToAllDevices ? this.#midiOutputs : (this.#midiOutput ? [this.#midiOutput] : [])
		
		if (outputs.length === 0) {
			console.warn("[WebMIDI Output] No output device available for All Notes Off")
			return
		}

		outputs.forEach((output) => {
			try {
				output.sendAllNotesOff(
					{ channels:this.#options.channels }
				)
			} catch (err) {
				console.error("[WebMIDI Output] Failed to send All Notes Off", {
					device: output.name,
					channel: this.#options.channels,
					error: err && err instanceof Error ? err.message : String(err)
				})
			}
		})
		
		console.info("[WebMIDI Output] All Notes Off sent", {
			devices: outputs.length,
			channel: this.#options.channels
		})
		
		this.#activeNotes.clear()
	}

	/**
	 * Send Control Change message
	 */
	sendControlChange(controlNumber: number, value: number): void {
		const outputs = this.#sendToAllDevices ? this.#midiOutputs : (this.#midiOutput ? [this.#midiOutput] : [])
		
		if (outputs.length === 0) {
			console.warn("[WebMIDI Output] No output device available for Control Change")
			return
		}

		outputs.forEach((output) => {
			try {
				output.sendControlChange(
					controlNumber,
					Math.round((value / 127) * 127),
					{ channels:this.#options.channels}
				)
			} catch (err) {
				console.error("[WebMIDI Output] Failed to send Control Change", {
					device: output.name,
					controlNumber,
					value,
					channel: this.#options.channels,
					error: err && err instanceof Error ? err.message : String(err)
				})
			}
		})
		
		console.info("[WebMIDI Output] Control Change sent", {
			controlNumber,
			value,
			devices: outputs.length,
			channel: this.#options.channels
		})
	}

	/**
	 * Send Program Change message
	 */
	sendProgramChange(program: number): void {
		if (!this.#midiOutput) {
			console.warn("[WebMIDI Output] No output device available for Program Change")
			return
		}

		try {
			this.#midiOutput.sendProgramChange(
				program,
				{ channels:this.#options.channels}
			)
			console.info("[WebMIDI Output] Program Change sent", {
				program,
				channel: this.#options.channels
			})
		} catch (err) {
			console.error("[WebMIDI Output] Failed to send Program Change", {
				program,
				channel: this.#options.channels,
				error: err && err instanceof Error ? err.message : String(err)
			})
		}
	}

	/**
	 * Send Polyphonic Aftertouch (Key Pressure)
	 */
	sendPolyphonicAftertouch(note: number, pressure: number): void {
		if (!this.#midiOutput) {
			console.warn("[WebMIDI Output] No output device available for Polyphonic Aftertouch")
			return
		}

		try {
			this.#midiOutput.sendKeyAftertouch(
				note,
				pressure / 127,
				{ channels:this.#options.channels}
			)
			console.info("[WebMIDI Output] Polyphonic Aftertouch sent", {
				note,
				pressure,
				channel: this.#options.channels
			})
		} catch (err) {
			console.error("[WebMIDI Output] Failed to send Polyphonic Aftertouch", {
				note,
				pressure,
				channel: this.#options.channels,
				error: err && err instanceof Error ? err.message : String(err)
			})
		}
	}

	/**
	 * Send Channel Aftertouch (Channel Pressure)
	 */
	sendChannelAftertouch(pressure: number): void {
		if (!this.#midiOutput) {
			console.warn("[WebMIDI Output] No output device available for Channel Aftertouch")
			return
		}

		try {
			this.#midiOutput.sendChannelAftertouch(
				pressure / 127,
				{ channels:this.#options.channels}
			)
			console.info("[WebMIDI Output] Channel Aftertouch sent", {
				pressure,
				channel: this.#options.channels
			})
		} catch (err) {
			console.error("[WebMIDI Output] Failed to send Channel Aftertouch", {
				pressure,
				channel: this.#options.channels,
				error: err && err instanceof Error ? err.message : String(err)
			})
		}
	}

	/**
	 * Send Pitch Bend message
	 */
	sendPitchBend(value: number): void {
		if (!this.#midiOutput) {
			console.warn("[WebMIDI Output] No output device available for Pitch Bend")
			return
		}

		try {
			this.#midiOutput.sendPitchBend(
				value / 8192 - 1,
				{ channels:this.#options.channels}
			)
			console.info("[WebMIDI Output] Pitch Bend sent", {
				value,
				channel: this.#options.channels
			})
		} catch (err) {
			console.error("[WebMIDI Output] Failed to send Pitch Bend", {
				value,
				channel: this.#options.channels,
				error: err && err instanceof Error ? err.message : String(err)
			})
		}
	}

	
	/**
	 * Create a GUI that is wired into this Output
	 * that can be used to control this output's config
	 */
	async createGui(): Promise<HTMLElement> {
		const container = document.createElement("div")
		
		const label = document.createElement("label")
		label.innerText = "WebMIDI Output"
		label.style.fontWeight = "bold"
		container.appendChild(label)

		// Create a wrapper for dynamic content
		const contentWrapper = document.createElement("div")
		contentWrapper.id = "midi-output-content-wrapper"
		container.appendChild(contentWrapper)

		// Function to populate the content
		const populateContent = () => {
			contentWrapper.innerHTML = ""

			if (this.#midiOutputs.length === 0) {
				const noDevicesMsg = document.createElement("p")
				noDevicesMsg.classList.add("no-midi-output-devices-available")
				noDevicesMsg.innerText = "No MIDI output devices available"
				contentWrapper.appendChild(noDevicesMsg)
				return
			}

			// Send to All Devices Toggle
			const sendAllLabel = document.createElement("label")
			const sendAllCheckbox = document.createElement("input")
			sendAllCheckbox.type = "checkbox"
			sendAllCheckbox.id = "midi-send-to-all-devices"
			sendAllCheckbox.checked = this.#sendToAllDevices
			sendAllLabel.appendChild(sendAllCheckbox)
			sendAllLabel.appendChild(document.createTextNode(" Send to all devices"))
			contentWrapper.appendChild(sendAllLabel)

			const sendAllChangeHandler = (event: Event) => {
				const target = event.target as HTMLInputElement
				this.setSendToAllDevices(target.checked)
				// Refresh GUI to show/hide device selector
				setTimeout(() => populateContent(), 0)
			}
			sendAllCheckbox.addEventListener("change", sendAllChangeHandler)

			// Device Selection (only if not sending to all)
			if (!this.#sendToAllDevices) {
				const deviceLabel = document.createElement("label")
				deviceLabel.innerText = "MIDI Output Device:"
				contentWrapper.appendChild(deviceLabel)

				const deviceSelect = document.createElement("select")
				deviceSelect.id = "midi-output-device-select"
				this.#midiOutputs.forEach((device) => {
					const option = document.createElement("option")
					option.value = device.id
					option.innerText = `${device.manufacturer} ${device.name}`
					if (this.#midiOutput && device.id === this.#midiOutput.id) {
						option.selected = true
					}
					deviceSelect.appendChild(option)
				})
				contentWrapper.appendChild(deviceSelect)

				const onDeviceChange = (event: Event) => {
					const target = event.target as HTMLSelectElement
					this.setOutput(target.value)
				}
				deviceSelect.addEventListener("change", onDeviceChange)
			}
		}

		populateContent()
		return container
	}

	/**
	 * Handle MIDI device connection/disconnection
	 */
	private onDeviceStateChange(event: any): void {
		console.info("[WebMIDI Output] Device state changed", {
			port: event.port?.name,
			type: event.type
		})

		if (event.type === "connected") {
			const device = event.port
			if (device.type === "output") {
				console.info("[WebMIDI Output] New output device connected", { name: device.name })
				this.#midiOutputs = [...WebMidi.outputs]
				
				// Dispatch custom event so UI components can update
				this.dispatchEvent(new CustomEvent("deviceListChanged", {
					detail: { outputs: this.#midiOutputs, device }
				}))
			}
		} else if (event.type === "disconnected") {
			const device = event.port
			if (device.type === "output") {
				console.info("[WebMIDI Output] Output device disconnected", { name: device.name })
				this.#midiOutputs = [...WebMidi.outputs]
				
				// If disconnected device was the selected one, switch to the first available
				if (this.#midiOutput?.id === device.id) {
					this.#midiOutput = this.#midiOutputs.length > 0 ? this.#midiOutputs[0] : undefined
				}
				
				// Dispatch custom event so UI components can update
				this.dispatchEvent(new CustomEvent("deviceListChanged", {
					detail: { outputs: this.#midiOutputs, device }
				}))
			}
		}
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
		this.#midiOutput = undefined
		this.#midiOutputs = []
		this.#activeNotes.clear()
		
		if (this.#deviceChangeHandler) {
			WebMidi.removeListener("connected", this.#deviceChangeHandler)
			WebMidi.removeListener("disconnected", this.#deviceChangeHandler)
			this.#deviceChangeHandler = null
		}
	}
}

