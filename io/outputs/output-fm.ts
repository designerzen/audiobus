import type { IAudioOutput } from "./output-interface"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import {
	MIDI_STOP,
	PLAYBACK_STOP,
	NOTE_ON,
	NOTE_OFF,
	CONTROL_CHANGE,
	PITCH_BEND,
	PROGRAM_CHANGE
} from "../../commands/commands"
import { EVENT_CHANGE, EVENT_CONFIGURATION_CHANGED } from "../../events/event-constants"
import { getAudioDestination } from "../audio-destination"
import { loadCaptureWorklet } from "../inputs/load-capture-worklet"
import { bounded, devicePanel, numberControl } from "../device-controls"
import { musicalCommand } from "../event-clip"
import registerFMProcessor from "../../instruments/fm/processor.js"
import { FM_GENERAL_MIDI_PRESETS, type FMPatch } from "../../instruments/fm/presets"
import { parseDX7Presets, type DX7Voice } from "../../instruments/fm/dx7"

/** A General MIDI patch or a voice read from a DX7 file. */
export type FMBankPatch = FMPatch | DX7Voice

const PROCESSOR_NAME = "harmoneasy-fm"
const PARTS = 16

export interface FMOutputSettings {
	preset: number
	volume: number
	pitchBendRange: number
	polyphony: number
}

/**
 * PhotoSYNTH's DX7-style FM engine with its 128-program General MIDI patch bank.
 * The worklet loads on first connect or note; each MIDI channel is an independent
 * part with its own bend, volume and expression.
 */
export default class OutputFM extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-FM-${crypto.randomUUID()}`
	readonly name = "FM"
	readonly description = "DX7-style FM synthesizer with 128 General MIDI patches"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly output: GainNode
	private readonly context: AudioContext
	private settings: FMOutputSettings
	private node?: AudioWorkletNode
	private loading?: Promise<AudioWorkletNode>
	private volumes = new Float32Array(PARTS).fill(1)
	private expressions = new Float32Array(PARTS).fill(1)
	private bends = new Float32Array(PARTS)
	private bank: readonly FMBankPatch[] = FM_GENERAL_MIDI_PRESETS
	private sentPatches: (FMBankPatch | undefined)[] = Array(PARTS).fill(undefined)
	/** Programs chosen by MIDI on one channel; unset channels follow the preset setting. */
	private programs: (number | undefined)[] = Array(PARTS).fill(undefined)
	/** Messages sent while the worklet loads, kept in order so releases follow their notes. */
	private pending: Record<string, unknown>[] = []
	private sustained = new Set<number>()
	private released = new Set<string>()
	private connected = true
	private destroyed = false
	private generation = 0
	private gui?: HTMLElement
	private presetSelect?: HTMLSelectElement

	constructor(options: {
		audioContext: AudioContext
		mixer?: AudioNode
		preset?: number
		volume?: number
		pitchBendRange?: number
		polyphony?: number
	}) {
		super()
		if (!options?.audioContext) {
			throw new Error("FM requires an audio context")
		}
		this.context = options.audioContext
		this.settings = {
			preset: Math.round(bounded(options.preset, 0, 0, 127)),
			volume: bounded(options.volume, 0.8, 0, 2),
			pitchBendRange: bounded(options.pitchBendRange, 2, 0, 24),
			polyphony: Math.round(bounded(options.polyphony, 16, 1, 64))
		}
		this.output = this.context.createGain()
		this.output.gain.value = this.settings.volume
		this.output.connect(options.mixer ?? getAudioDestination(this.context))
	}
	get isConnected(): boolean {
		return this.connected && !this.destroyed
	}
	get options(): FMOutputSettings {
		return { ...this.settings }
	}
	get presets(): { program: number; name: string }[] {
		return this.bank.map(({ name }, program) => ({ program, name }))
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}
	configure(patch: Partial<FMOutputSettings>): void {
		const settings = this.settings
		if (patch.preset !== undefined) {
			// Choosing a preset here applies to every channel
			this.programs.fill(undefined)
		}
		settings.preset = Math.round(
			bounded(patch.preset, settings.preset, 0, this.bank.length - 1)
		)
		settings.volume = bounded(patch.volume, settings.volume, 0, 2)
		settings.pitchBendRange = bounded(patch.pitchBendRange, settings.pitchBendRange, 0, 24)
		const polyphony = Math.round(bounded(patch.polyphony, settings.polyphony, 1, 64))
		if (polyphony !== settings.polyphony) {
			settings.polyphony = polyphony
			this.post({ type: "polyphony", value: polyphony })
		}
		this.output.gain.value = settings.volume
		if (this.presetSelect) {
			this.presetSelect.value = String(settings.preset)
		}
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}
	loadPreset(program: number): void {
		this.configure({ preset: program })
	}
	/** Replaces the patch bank, e.g. with voices from a DX7 file; an empty bank restores General MIDI. */
	setPresets(bank: readonly FMBankPatch[]): void {
		this.allNotesOff()
		this.bank = bank.length ? bank : FM_GENERAL_MIDI_PRESETS
		this.settings.preset = 0
		this.programs.fill(undefined)
		if (this.presetSelect) {
			this.fillPresets(this.presetSelect)
		}
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}
	/** Loads a DX7 .syx single voice or 32-voice bank and returns the names of its voices. */
	async loadDX7File(file: Blob | ArrayBuffer | ArrayBufferView): Promise<string[]> {
		if (file instanceof Blob && file.size > 1024 * 1024) {
			throw new Error("DX7 files must be smaller than 1 MB.")
		}
		const voices = parseDX7Presets(file instanceof Blob ? await file.arrayBuffer() : file)
		this.setPresets(voices)
		return voices.map((voice) => voice.name)
	}
	private fillPresets(select: HTMLSelectElement): void {
		select.replaceChildren(
			...this.presets.map(({ program, name }) => {
				const item = document.createElement("option")
				item.value = String(program)
				item.textContent = `${program + 1}. ${name}`
				return item
			})
		)
		select.value = String(this.settings.preset)
	}
	private post(message: Record<string, unknown>): void {
		if (this.node) {
			this.node.port.postMessage(message)
		} else if (this.loading) {
			this.pending.push(message)
		}
	}
	private initialize(): Promise<AudioWorkletNode> {
		if (this.destroyed) {
			return Promise.reject(new Error("FM has been destroyed"))
		}
		if (this.node) {
			return Promise.resolve(this.node)
		}
		return (this.loading ??= (async () => {
			await loadCaptureWorklet(
				this.context,
				PROCESSOR_NAME,
				`(${registerFMProcessor.toString()})(${JSON.stringify({ name: PROCESSOR_NAME })})`
			)
			if (this.destroyed) {
				throw new Error("FM has been destroyed")
			}
			const node = new AudioWorkletNode(this.context, PROCESSOR_NAME, {
				numberOfInputs: 0,
				numberOfOutputs: 1,
				outputChannelCount: [2],
				processorOptions: { polyphony: this.settings.polyphony }
			})
			node.connect(this.output)
			this.node = node
			// Channel state set before the worklet existed
			for (let part = 0; part < PARTS; part++) {
				this.postGain(part)
				if (this.bends[part]) {
					this.post({ type: "bend", part, value: this.bends[part] })
				}
			}
			for (const message of this.pending.splice(0)) {
				node.port.postMessage(message)
			}
			return node
		})().finally(() => {
			this.loading = undefined
		}))
	}
	private postGain(part: number): void {
		const value = this.volumes[part] * this.expressions[part]
		if (value !== 1) {
			this.post({ type: "gain", part, value })
		}
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
		if (!this.isConnected) {
			return
		}
		const part = Math.round(bounded(command.channel, 1, 1, PARTS)) - 1
		const note = command.number
		if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity <= 0)) {
			if (this.sustained.has(part)) {
				this.released.add(`${part}:${note}`)
			} else {
				this.post({ type: "off", part, note, time: this.context.currentTime })
			}
			return
		}
		if (command.type === PROGRAM_CHANGE) {
			this.programs[part] = Math.round(bounded(command.value ?? command.number, 0, 0, 127))
			return
		}
		if (command.type === CONTROL_CHANGE) {
			this.control(part, command.number, command.value)
			return
		}
		if (command.type === PITCH_BEND) {
			const value =
				((bounded(command.value ?? command.pitchBend, 8192, 0, 16383) - 8192) / 8192) *
				this.settings.pitchBendRange
			this.bends[part] = value
			this.post({ type: "bend", part, value, time: this.context.currentTime })
			return
		}
		if (
			command.type !== NOTE_ON ||
			!Number.isInteger(note) ||
			note < 0 ||
			note > 127 ||
			!Number.isFinite(command.velocity)
		) {
			return
		}
		this.released.delete(`${part}:${note}`)
		if (this.context.state === "suspended") {
			void this.context.resume()
		}
		// Start loading before queueing so a release sent meanwhile is queued behind its note
		const ready = this.node ? undefined : this.initialize()
		// The worklet snapshots the patch on receipt, so held notes keep theirs
		const patch =
			this.bank[Math.min(this.bank.length - 1, this.programs[part] ?? this.settings.preset)]
		if (this.sentPatches[part] !== patch) {
			this.post({ type: "patch", part, patch })
			this.sentPatches[part] = patch
		}
		this.post({
			type: "on",
			part,
			note,
			velocity: Math.min(1, bounded(command.velocity, 100, 0, 127) / 127),
			time: this.context.currentTime
		})
		await ready
	}
	private control(part: number, controller: number, value: number): void {
		if (controller === 64) {
			if (value >= 64) {
				this.sustained.add(part)
				return
			}
			this.sustained.delete(part)
			for (const id of this.released) {
				const [held, note] = id.split(":").map(Number)
				if (held === part) {
					this.post({ type: "off", part, note, time: this.context.currentTime })
					this.released.delete(id)
				}
			}
		} else if (controller === 120 || controller === 123) {
			this.sustained.delete(part)
			for (const id of this.released) {
				if (id.startsWith(`${part}:`)) {
					this.released.delete(id)
				}
			}
			this.bends[part] = 0
			this.post({ type: "panic", part })
		} else if (controller === 7 || controller === 11) {
			;(controller === 7 ? this.volumes : this.expressions)[part] =
				bounded(value, 127, 0, 127) / 127
			this.post({
				type: "gain",
				part,
				value: this.volumes[part] * this.expressions[part]
			})
		}
	}
	noteOn(number: number, velocity = 100): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): void {
		void this.sendCommand(musicalCommand({ type: NOTE_OFF, number, channel: 1 }))
	}
	allNotesOff(): void {
		this.generation++
		this.sustained.clear()
		this.released.clear()
		this.bends.fill(0)
		// Notes still waiting for the worklet must never start
		this.pending.length = 0
		this.sentPatches.fill(undefined)
		this.post({ type: "panic" })
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const gui = devicePanel()
		const label = document.createElement("label")
		const select = document.createElement("select")
		this.fillPresets(select)
		select.addEventListener(EVENT_CHANGE, () => this.loadPreset(Number(select.value)))
		label.append("Instrument ", select)
		gui.append(label)
		numberControl(
			gui,
			"Volume",
			this.settings.volume,
			0,
			2,
			(volume) => {
				this.configure({ volume })
			},
			0.01
		)
		numberControl(
			gui,
			"Pitch bend (semitones)",
			this.settings.pitchBendRange,
			0,
			24,
			(pitchBendRange) => {
				this.configure({ pitchBendRange })
			}
		)
		this.presetSelect = select
		this.gui = gui
		return gui
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
		this.presetSelect = undefined
	}
	destroy(): void {
		if (this.destroyed) {
			return
		}
		this.destroyed = true
		this.connected = false
		this.allNotesOff()
		this.post({ type: "destroy" })
		this.node?.disconnect()
		this.node?.port.close()
		this.node = undefined
		this.output.disconnect()
		void this.destroyGui()
	}
}