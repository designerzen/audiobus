import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { IAudioOutput } from "./output-interface.ts"
import type { ControlDescriptor, ControlValue, UiDescriptor } from "control-surface/types"
import { subscribeControls } from "../component-ui"
import type { IPercussionOutput } from "../../timing/percussion-types.ts"
import type { AudioClockTick } from "../../timing/audio-clock-tick.ts"
import { NOTE_ON, MIDI_STOP, PLAYBACK_STOP } from "../../commands.ts"
import { EVENT_CONFIGURATION_CHANGED, EVENT_CONTROL_SCHEMA_CHANGED } from "../../event-constants.ts"
import { DRUM_GROOVES } from "../../timing/drum-patterns.ts"
import { DrumBreakPlayer } from "../../timing/drum-break-player.ts"
import { PercussionSynth } from "../../instruments/percussion/percussion-synth.ts"
import { DRUM_COMPRESSOR_PARAMETERS } from "../../effects/drum-compressor.ts"
import { createDrumAccompanimentGui, type DrumAccompanimentGui } from "./drum-accompaniment-gui.ts"
import {
	DEFAULT_DRUM_ACCOMPANIMENT_SETTINGS,
	DRUM_GENRES,
	type DrumAccompanimentSettings
} from "./drum-accompaniment-settings.ts"

export interface DrumAccompanimentOptions extends Partial<DrumAccompanimentSettings> {
	audioContext: AudioContext
	mixer?: AudioNode
	percussionOutput?: IPercussionOutput
}

export default class OutputDrumAccompaniment extends EventTarget implements IAudioOutput {
	private static nextId = 0
	readonly uuid = "Output-DrumAccompaniment-" + OutputDrumAccompaniment.nextId++
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	private settings: DrumAccompanimentSettings = { ...DEFAULT_DRUM_ACCOMPANIMENT_SETTINGS }
	private readonly context: AudioContext
	private readonly synth?: PercussionSynth
	private readonly percussion: IPercussionOutput
	private readonly player = new DrumBreakPlayer()
	private connected = true
	private playing = false
	private gui?: DrumAccompanimentGui
	get name(): string {
		return "Drum Accompaniment"
	}
	get description(): string {
		return "A continuous break on the global clock, with subtle activity-driven variations"
	}
	get isConnected(): boolean {
		return this.connected
	}
	get isHidden(): boolean {
		return false
	}
	get output(): AudioNode | undefined {
		return this.synth?.output
	}
	get options(): DrumAccompanimentSettings {
		return { ...this.settings }
	}
	getUiDescriptor(): UiDescriptor {
		const controls: ControlDescriptor[] = Object.entries(this.settings)
			.filter(([id]) => !["genre", "groove"].includes(id))
			.map(([id, value]) => {
				const compressor =
					DRUM_COMPRESSOR_PARAMETERS[id as keyof typeof DRUM_COMPRESSOR_PARAMETERS]
				return {
					id,
					label: id.replace(/([A-Z])/g, " $1"),
					group: id.startsWith("compressor") ? "Compressor" : "Performance",
					widget:
						typeof value === "boolean" ? "toggle" : id === "volume" ? "slider" : "dial",
					min: compressor?.min ?? 0,
					max: compressor?.max ?? (id === "tuningNote" ? 127 : 1),
					step: compressor?.step ?? (id === "tuningNote" ? 1 : 0.01),
					defaultValue:
						DEFAULT_DRUM_ACCOMPANIMENT_SETTINGS[id as keyof DrumAccompanimentSettings]
				}
			})
		controls.unshift(
			{
				id: "genre",
				label: "Genre",
				widget: "select",
				choices: Object.entries(DRUM_GENRES).map(([value, genre]) => ({
					label: genre.title,
					value
				}))
			},
			{
				id: "groove",
				label: "Groove",
				widget: "select",
				choices: DRUM_GENRES[this.settings.genre].grooves.map((value) => ({
					label: value,
					value
				}))
			}
		)
		return { title: this.name, controls }
	}
	getControlValue(id: string): ControlValue | undefined {
		return this.settings[id as keyof DrumAccompanimentSettings]
	}
	setControlValue(id: string, value: ControlValue): void {
		this.configure({ [id]: value })
	}
	subscribeControls(listener: () => void): () => void {
		return subscribeControls(this, listener)
	}
	get isPlaying(): boolean {
		return this.playing
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}
	constructor(options: DrumAccompanimentOptions) {
		super()
		if (!options?.audioContext) {
			throw new Error("Drum Accompaniment requires an audio context")
		}
		this.context = options.audioContext
		this.synth = options.percussionOutput
			? undefined
			: new PercussionSynth(this.context, options.mixer)
		this.percussion = options.percussionOutput ?? this.synth!
		this.configure(options)
	}
	configure(patch: Partial<DrumAccompanimentSettings>): void {
		const previous = this.settings
		const next = { ...previous }
		if (patch.genre !== undefined && Object.hasOwn(DRUM_GENRES, patch.genre)) {
			next.genre = patch.genre
		}
		const grooves: readonly string[] = DRUM_GENRES[next.genre].grooves
		if (patch.groove && grooves.includes(patch.groove) && DRUM_GROOVES[patch.groove]) {
			next.groove = patch.groove
		} else if (!grooves.includes(next.groove)) {
			next.groove = grooves[0]
		}
		const ranges = {
			tuningNote: [0, 127],
			volume: [0, 1],
			activityResponse: [0, 1],
			energy: [0, 1],
			density: [0, 1],
			tension: [0, 1],
			fillChance: [0, 1],
			chaos: [0, 1]
		} as const
		for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
			const value = patch[key]
			if (value !== undefined && Number.isFinite(value)) {
				next[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], value))
			}
		}
		for (const key of [
			"compressorEnabled",
			"rapidPercussion",
			"muteKick",
			"muteSnare",
			"muteHat",
			"muteClap"
		] as const) {
			if (typeof patch[key] === "boolean") {
				next[key] = patch[key]
			}
		}
		for (const key of Object.keys(
			DRUM_COMPRESSOR_PARAMETERS
		) as (keyof typeof DRUM_COMPRESSOR_PARAMETERS)[]) {
			const value = patch[key]
			const { min, max } = DRUM_COMPRESSOR_PARAMETERS[key]
			if (value !== undefined && Number.isFinite(value)) {
				next[key] = Math.max(min, Math.min(max, value))
			}
		}
		this.settings = next
		this.synth?.setVolume(next.volume)
		this.synth?.setCompressor(next)
		this.settings.tuningNote = Math.round(this.settings.tuningNote)
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
		if (previous.genre !== next.genre) {
			this.dispatchEvent(new Event(EVENT_CONTROL_SCHEMA_CHANGED))
		}
	}

	onClockTick(tick: Readonly<AudioClockTick>): void {
		if (
			!this.connected ||
			this.context.state === "suspended" ||
			this.context.state === "closed"
		) {
			return
		}
		this.playing = true
		for (const hit of this.player.render(
			tick,
			DRUM_GROOVES[this.settings.groove],
			this.settings
		)) {
			this.percussion.trigger({
				...hit,
				velocity: hit.velocity * (this.synth ? 1 : this.settings.volume)
			})
		}
	}
	noteOn(_note: number, velocity = 100): void {
		if (this.connected) {
			this.player.recordActivity(velocity)
		}
	}
	noteOff(_note: number): void {}
	getNoteKey(command: IAudioCommand): string {
		return command.channel + ":" + command.number
	}
	sendCommand(command: IAudioCommand): void {
		if (command.type === NOTE_ON) {
			this.noteOn(command.number, command.velocity)
		} else if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.stopClock()
		}
	}
	requestFill(): void {
		this.player.requestFill()
	}
	stopClock(): void {
		this.playing = false
		this.player.reset()
		this.percussion.allNotesOff()
	}
	allNotesOff(): void {
		this.stopClock()
	}
	async connect(): Promise<void> {
		this.connected = true
	}
	async disconnect(): Promise<void> {
		this.connected = false
		this.stopClock()
	}
	async createGui(): Promise<HTMLElement> {
		this.gui ??= createDrumAccompanimentGui(this)
		return this.gui.element
	}
	async destroyGui(): Promise<void> {
		this.gui?.dispose()
		this.gui = undefined
	}
	destroy(): void {
		this.connected = false
		this.stopClock()
		this.synth?.destroy()
		void this.destroyGui()
	}
}