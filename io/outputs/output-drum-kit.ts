import type { IAudioCommand } from '../../audio-command-interface.ts'
import type { IAudioOutput } from './output-interface.ts'
import type { IPercussionOutput } from '../../timing/percussion-types.ts'
import { NOTE_ON, CONTROL_CHANGE, MIDI_STOP, PLAYBACK_STOP } from '../../commands.ts'
import { EVENT_CLICK, EVENT_CONFIGURATION_CHANGED, EVENT_POINTER_DOWN } from '../../event-constants.ts'
import { getAudioDestination } from '../../audio-destination.ts'
import { PercussionSynth } from '../../instruments/percussion/percussion-synth.ts'
import { GENERAL_MIDI_PERCUSSION_NOTES } from '../../timing/percussion-note-map.ts'
import { bounded, devicePanel, numberControl } from '../device-controls.ts'

const PARTS_BY_NOTE = new Map<number, string>()
for (const [part, note] of Object.entries(GENERAL_MIDI_PERCUSSION_NOTES)) {
	if (!PARTS_BY_NOTE.has(note)) PARTS_BY_NOTE.set(note, part)
}

const PADS = [
	['Kick', 36], ['Snare', 38], ['Closed hi-hat', 42], ['Open hi-hat', 46],
	['Low tom', 45], ['High tom', 50], ['Clap', 39], ['Crash', 49],
	['Cowbell', 56], ['High conga', 63], ['Low conga', 64], ['Ride', 51],
] as const

export interface DrumKitSettings {
	volume: number
	/** Zero accepts every channel; 1–16 selects a MIDI channel. */
	channel: number
	/** Semitones relative to the kit's original tuning. */
	tuning: number
	decay: number
}

export interface DrumKitOptions extends Partial<DrumKitSettings> {
	audioContext: AudioContext
	mixer?: AudioNode
	percussionOutput?: IPercussionOutput
}

/** A directly playable, sample-free kit, independent of the transport. */
export default class OutputDrumKit extends EventTarget implements IAudioOutput {
	private static nextId = 0
	readonly uuid = 'Output-DrumKit-' + OutputDrumKit.nextId++
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	private settings: DrumKitSettings = { volume: 0.55, channel: 0, tuning: 0, decay: 1 }
	private readonly context: AudioContext
	private readonly synth?: PercussionSynth
	private readonly percussion: IPercussionOutput
	private connected = true
	private destroyed = false
	private gui?: HTMLElement
	private guiEvents?: AbortController
	get name(): string { return 'Drum Kit' }
	get description(): string { return 'Play a synthesized General MIDI drum kit from notes or touch pads' }
	get isConnected(): boolean { return this.connected }
	get isHidden(): boolean { return false }
	get output(): AudioNode | undefined { return this.synth?.output }
	get options(): DrumKitSettings { return { ...this.settings } }
	hasAudioOutput(): boolean { return true }
	hasMidiOutput(): boolean { return false }

	constructor(options: DrumKitOptions) {
		super()
		if (!options?.audioContext) throw new Error('Drum Kit requires an audio context')
		this.context = options.audioContext
		this.synth = options.percussionOutput ? undefined : new PercussionSynth(
			this.context, options.mixer ?? getAudioDestination(this.context),
		)
		this.percussion = options.percussionOutput ?? this.synth!
		this.configure(options)
	}

	configure(patch: Partial<DrumKitSettings>): void {
		this.settings = {
			volume: bounded(patch.volume, this.settings.volume, 0, 1),
			channel: Math.round(bounded(patch.channel, this.settings.channel, 0, 16)),
			tuning: bounded(patch.tuning, this.settings.tuning, -24, 24),
			decay: bounded(patch.decay, this.settings.decay, 0.1, 4),
		}
		this.synth?.setVolume(this.settings.volume)
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}

	noteOn(note: number, velocity = 100): void {
		const part = PARTS_BY_NOTE.get(note)
		if (!this.connected || !part || !Number.isFinite(velocity) || velocity <= 0 ||
			this.context.state !== 'running') return
		this.percussion.trigger({
			part,
			velocity: Math.min(127, velocity) / 127 * (this.synth ? 1 : this.settings.volume),
			triggerAt: this.context.currentTime,
			lengthScale: this.settings.decay,
			tuningNote: 69 + 12 * Math.log2(42 / 440) + this.settings.tuning,
		})
	}
	// One-shot percussion rings out after releasing the key.
	noteOff(_note: number): void {}
	getNoteKey(command: IAudioCommand): string { return command.channel + ':' + command.number }
	sendCommand(command: IAudioCommand): void {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.allNotesOff()
			return
		}
		if (this.settings.channel && command.channel !== this.settings.channel) return
		if (command.type === NOTE_ON) this.noteOn(command.number, command.velocity)
		else if (command.type === CONTROL_CHANGE && (command.number === 120 || command.number === 123))
			this.allNotesOff()
	}
	allNotesOff(): void { this.percussion.allNotesOff() }
	async connect(): Promise<void> {
		if (this.destroyed) return
		if (this.context.state === 'suspended') await this.context.resume()
		if (!this.destroyed) this.connected = true
	}
	async disconnect(): Promise<void> { this.connected = false; this.allNotesOff() }

	async createGui(): Promise<HTMLElement> {
		if (this.gui) return this.gui
		const panel = devicePanel()
		panel.setAttribute('aria-label', 'Drum kit controls')
		this.guiEvents = new AbortController()
		const { signal } = this.guiEvents
		const info = document.createElement('p')
		info.textContent = 'Play MIDI drum notes (35–87) on any channel, or tap a pad. Channel 0 accepts all channels.'
		panel.append(info)
		const controls = [
			['volume', 'Volume', 0, 1, 0.01], ['channel', 'MIDI channel', 0, 16, 1],
			['tuning', 'Tuning (semitones)', -24, 24, 1], ['decay', 'Decay', 0.1, 4, 0.1],
		] as const
		const inputs = controls.map(([key, title, min, max, step]) => {
			const input = numberControl(panel, title, this.settings[key], min, max,
				value => this.configure({ [key]: value }), step)
			input.name = key
			return { key, input }
		})
		this.addEventListener(EVENT_CONFIGURATION_CHANGED, () => {
			for (const { key, input } of inputs) input.value = String(this.settings[key])
		}, { signal })
		const pads = document.createElement('div')
		pads.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px'
		const status = document.createElement('output')
		status.setAttribute('aria-live', 'polite')
		for (const [name, note] of PADS) {
			const button = document.createElement('button')
			button.type = 'button'
			button.textContent = name
			button.title = `${name} (MIDI ${note})`
			button.style.cssText = 'min-height:48px;touch-action:none'
			const play = async (velocity: number) => {
				try {
					await this.connect()
					if (!signal.aborted) this.noteOn(note, velocity)
				} catch (error) {
					if (!signal.aborted) status.textContent = error instanceof Error ? error.message : String(error)
				}
			}
			button.addEventListener(EVENT_POINTER_DOWN, event => {
				if (event.button !== 0) return
				event.preventDefault()
				void play(event.pointerType !== 'mouse' && event.pressure > 0 ? event.pressure * 127 : 100)
			}, { signal })
			button.addEventListener(EVENT_CLICK, event => {
				if (event.detail === 0) void play(100)
			}, { signal })
			pads.append(button)
		}
		panel.append(pads, status)
		this.gui = panel
		return panel
	}
	async destroyGui(): Promise<void> {
		this.guiEvents?.abort()
		this.guiEvents = undefined
		this.gui?.remove()
		this.gui = undefined
	}
	destroy(): void {
		if (this.destroyed) return
		this.destroyed = true
		this.connected = false
		if (this.synth) this.synth.destroy()
		else this.allNotesOff()
		void this.destroyGui()
	}
}
