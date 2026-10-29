import type { IAudioOutput } from "./output-interface"
import type { IAudioCommand } from "../../audio-command-interface"
import { MIDI_STOP, PLAYBACK_STOP, NOTE_ON, NOTE_OFF } from "../../commands"
import { EVENT_CONFIGURATION_CHANGED } from "../../event-constants"
import { commandToMidi } from "../../midi/midi-command-conversion"
import { getAudioDestination } from "../../audio-destination"
import { loadCaptureWorklet } from "../inputs/load-capture-worklet"
import { bounded, devicePanel, numberControl } from "../device-controls"
import { musicalCommand } from "../event-clip"
import registerSynth303Processor from "../../instruments/303/processor.js"
import { SYNTH_303_PARAMETERS, type Synth303Settings } from "../../instruments/303/parameters"

let wavetable: Promise<Float32Array> | undefined
function loadWavetable(): Promise<Float32Array> {
	return (wavetable ??= fetch(new URL("../../instruments/303/wavetable.bin", import.meta.url))
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(`303 wavetable: HTTP ${response.status}`)
			}
			const bytes = await response.arrayBuffer()
			if (bytes.byteLength !== 4194304) {
				throw new Error("Invalid 303 wavetable size")
			}
			const view = new DataView(bytes)
			const table = new Float32Array(1048576)
			for (let i = 0; i < table.length; i++) {
				table[i] = view.getFloat32(i * 4, true)
				if (!Number.isFinite(table[i]) || Math.abs(table[i]) > 2) {
					throw new Error("Invalid 303 wavetable sample")
				}
			}
			return table
		})
		.catch((error) => {
			wavetable = undefined
			throw error
		}))
}

export default class Output303 extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-Synth303-${crypto.randomUUID()}`
	readonly name = "303"
	readonly description =
		"Original AudioBus wavetable bass synth with foldback distortion and delay"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly output: GainNode
	private readonly context: AudioContext
	private settings: Synth303Settings
	private node?: AudioWorkletNode
	private loading?: Promise<AudioWorkletNode>
	private connected = true
	private destroyed = false
	private generation = 0
	private gui?: HTMLElement
	private guiEvents?: AbortController
	get isConnected(): boolean {
		return this.connected
	}
	get options(): Synth303Settings {
		return { ...this.settings }
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}

	constructor(
		options: Partial<Synth303Settings> & { audioContext: AudioContext; mixer?: AudioNode }
	) {
		super()
		if (!options?.audioContext) {
			throw new Error("303 requires an audio context")
		}
		this.context = options.audioContext
		this.settings = Object.fromEntries(
			Object.entries(SYNTH_303_PARAMETERS).map(([key, config]) => [key, config.defaultValue])
		) as Synth303Settings
		this.output = this.context.createGain()
		this.output.connect(options.mixer ?? getAudioDestination(this.context))
		this.configure(options)
	}
	configure(patch: Partial<Synth303Settings>): void {
		for (const key of Object.keys(SYNTH_303_PARAMETERS) as (keyof Synth303Settings)[]) {
			const config = SYNTH_303_PARAMETERS[key]
			const value = bounded(patch[key], this.settings[key], config.minValue, config.maxValue)
			this.settings[key] = key === "waveform" ? Math.round(value) : value
			this.node?.parameters
				.get(key)
				?.setValueAtTime(this.settings[key], this.context.currentTime)
		}
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}
	private initialize(): Promise<AudioWorkletNode> {
		if (this.destroyed) {
			return Promise.reject(new Error("303 has been destroyed"))
		}
		if (this.node) {
			return Promise.resolve(this.node)
		}
		return (this.loading ??= (async () => {
			const [table] = await Promise.all([
				loadWavetable(),
				loadCaptureWorklet(
					this.context,
					"303",
					`(${registerSynth303Processor.toString()})(${JSON.stringify(SYNTH_303_PARAMETERS)})`
				)
			])
			if (this.destroyed) {
				throw new Error("303 has been destroyed")
			}
			const node = new AudioWorkletNode(this.context, "303", {
				numberOfInputs: 0,
				numberOfOutputs: 1,
				outputChannelCount: [2],
				parameterData: this.settings,
				processorOptions: { wavetable: table }
			})
			node.connect(this.output)
			this.node = node
			return node
		})().finally(() => {
			this.loading = undefined
		}))
	}
	async connect(): Promise<void> {
		if (this.destroyed) {
			return
		}
		const generation = this.generation
		if (this.context.state === "suspended") {
			await this.context.resume()
		}
		await this.initialize()
		if (!this.destroyed && generation === this.generation) {
			this.connected = true
		}
	}
	async disconnect(): Promise<void> {
		this.connected = false
		this.allNotesOff()
	}
	getNoteKey(command: IAudioCommand): string {
		return `${command.channel}:${command.number}`
	}
	async sendCommand(command: IAudioCommand): Promise<void> {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.allNotesOff()
			return
		}
		if (!this.connected || this.destroyed) {
			return
		}
		const bytes = commandToMidi(command)
		if (!bytes) {
			return
		}
		const generation = this.generation
		const node = await this.initialize()
		if (this.connected && !this.destroyed && generation === this.generation) {
			node.port.postMessage({ type: "midi", bytes })
		}
	}
	noteOn(number: number, velocity = 100): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_OFF, number, channel: 1 }))
	}
	allNotesOff(): void {
		this.generation++
		this.node?.port.postMessage({ type: "panic" })
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel()
		panel.setAttribute("aria-label", "303 controls")
		const info = document.createElement("p")
		info.textContent =
			"Original 303 by Emil Loer. Overlap notes for slide; velocity 100–127 adds accent."
		panel.append(info)
		const inputs = Object.entries(SYNTH_303_PARAMETERS).map(([id, config]) => {
			const key = id as keyof Synth303Settings
			const input = numberControl(
				panel,
				config.label,
				this.settings[key],
				config.minValue,
				config.maxValue,
				(value) => this.configure({ [key]: value }),
				config.step
			)
			input.name = id
			return { key, input }
		})
		this.guiEvents = new AbortController()
		this.addEventListener(
			EVENT_CONFIGURATION_CHANGED,
			() => {
				for (const { key, input } of inputs) {
					input.value = String(this.settings[key])
				}
			},
			{ signal: this.guiEvents.signal }
		)
		const source = document.createElement("a")
		source.href =
			"https://github.com/designerzen/audiobus/blob/ts2wp2es6pug/source/code/typescript/audiobus/instruments/TB303/TB303.ts"
		source.textContent = "Original source · GPL-3.0-or-later"
		source.target = "_blank"
		source.rel = "noopener noreferrer"
		panel.append(source)
		this.gui = panel
		return panel
	}
	async destroyGui(): Promise<void> {
		this.guiEvents?.abort()
		this.gui?.remove()
		this.gui = undefined
	}
	destroy(): void {
		if (this.destroyed) {
			return
		}
		this.destroyed = true
		this.connected = false
		this.allNotesOff()
		this.node?.port.postMessage({ type: "destroy" })
		this.node?.disconnect()
		this.node?.port.close()
		this.node = undefined
		this.output.disconnect()
		void this.destroyGui()
	}
}