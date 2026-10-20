import type { IAudioCommand } from '../../audio-command-interface.ts'
import type { IAudioOutput } from './output-interface.ts'
import type { IPercussionOutput } from '../../timing/percussion-types.ts'
import { NOTE_ON, NOTE_OFF, MIDI_STOP, PLAYBACK_STOP, MIDI_CLOCK } from '../../commands.ts'
import { EVENT_CONFIGURATION_CHANGED } from '../../event-constants.ts'
import { DrumArranger } from '../../timing/drum-arranger.ts'
import { DRUM_GROOVES } from '../../timing/drum-patterns.ts'
import { PercussionSequencer } from '../../timing/percussion-sequencer.ts'
import { PercussionSynth } from '../../instruments/percussion/percussion-synth.ts'
import { DRUM_COMPRESSOR_PARAMETERS } from '../../effects/drum-compressor.ts'
import { createDrumAccompanimentGui, type DrumAccompanimentGui } from './drum-accompaniment-gui.ts'
import {
	DEFAULT_DRUM_ACCOMPANIMENT_SETTINGS,
	DRUM_GENRES,
	type DrumAccompanimentSettings,
} from './drum-accompaniment-settings.ts'

export interface DrumAccompanimentOptions extends Partial<DrumAccompanimentSettings> {
	audioContext: AudioContext
	mixer?: AudioNode
	percussionOutput?: IPercussionOutput
}

export default class OutputDrumAccompaniment extends EventTarget implements IAudioOutput {
	private static nextId = 0
	readonly uuid = `Output-DrumAccompaniment-${OutputDrumAccompaniment.nextId++}`
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	private settings: DrumAccompanimentSettings = { ...DEFAULT_DRUM_ACCOMPANIMENT_SETTINGS }
	private readonly context: AudioContext
	private readonly synth?: PercussionSynth
	private readonly percussion: IPercussionOutput
	private readonly held = new Map<string, number>()
	private arranger!: DrumArranger
	private sequencer!: PercussionSequencer
	private interval?: ReturnType<typeof setInterval>
	private nextStepAt = 0
	private step = 0
	private connected = true
	private gui?: DrumAccompanimentGui

	get name(): string {
		return 'Drum Accompaniment'
	}
	get description(): string {
		return 'Adds genre-based drum grooves while incoming notes are held'
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
	get isPlaying(): boolean {
		return this.interval !== undefined
	}
	get isPreviewing(): boolean {
		return this.held.has('preview')
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}

	constructor(options: DrumAccompanimentOptions) {
		super()
		if (!options?.audioContext) throw new Error('Drum Accompaniment requires an audio context')
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
		if (patch.genre !== undefined && Object.hasOwn(DRUM_GENRES, patch.genre))
			next.genre = patch.genre
		const grooves: readonly string[] = DRUM_GENRES[next.genre].grooves
		if (patch.groove && grooves.includes(patch.groove) && DRUM_GROOVES[patch.groove])
			next.groove = patch.groove
		else if (!grooves.includes(next.groove)) next.groove = grooves[0]
		const ranges = {
			bpm: [30, 300],
			volume: [0, 1],
			swing: [0, 0.9],
			energy: [0, 1],
			density: [0, 1],
			tension: [0, 1],
			fillChance: [0, 1],
			chaos: [0, 1],
		} as const
		for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
			const value = patch[key]
			if (value !== undefined && Number.isFinite(value))
				next[key] = Math.max(ranges[key][0], Math.min(ranges[key][1], value))
		}
		for (const key of [
			'compressorEnabled',
			'rapidPercussion',
			'followDynamics',
			'muteKick',
			'muteSnare',
			'muteHat',
			'muteClap',
		] as const) {
			if (typeof patch[key] === 'boolean') next[key] = patch[key]
		}
		if (
			patch.performancePreset &&
			['auto', 'steady', 'crescendo', 'bridge', 'snare-roll', 'breakdown', 'drop'].includes(
				patch.performancePreset,
			)
		)
			next.performancePreset = patch.performancePreset
		for (const key of Object.keys(
			DRUM_COMPRESSOR_PARAMETERS,
		) as (keyof typeof DRUM_COMPRESSOR_PARAMETERS)[]) {
			const value = patch[key]
			const { min, max } = DRUM_COMPRESSOR_PARAMETERS[key]
			if (value !== undefined && Number.isFinite(value))
				next[key] = Math.max(min, Math.min(max, value))
		}
		this.settings = next
		this.synth?.setVolume(next.volume)
		this.synth?.setCompressor(next)
		if (!this.arranger || previous.groove !== next.groove) this.resetArrangement()
		this.arranger.setRapidPercussion(next.rapidPercussion)
		this.arranger.setPerformancePreset(next.performancePreset)
		this.updateIntent()
		if (previous.bpm !== next.bpm || previous.swing !== next.swing) {
			this.percussion.allNotesOff()
			this.nextStepAt = this.context.currentTime + 0.01
		}
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}

	private updateIntent(): void {
		const velocity = this.held.size ? Math.max(...this.held.values()) / 127 : 1
		const energy = this.settings.energy * (this.settings.followDynamics ? velocity : 1)
		this.arranger.updatePerson(
			{ noteVelocity: energy, pitchBend: this.settings.tension },
			this.context.currentTime,
		)
		this.arranger.setIntent({
			energy,
			density: this.settings.density,
			tension: this.settings.tension,
			fillChance: this.settings.fillChance,
			chaos: this.settings.chaos,
			// Apply strict, independent lane mutes at the IO boundary, after fills and ornaments.
			muteKick: false,
			muteSnare: false,
			muteHat: false,
			muteClap: false,
		})
	}

	private resetArrangement(): void {
		this.percussion.allNotesOff()
		this.arranger = new DrumArranger({
			groove: this.settings.groove,
			stepsPerBar: 16,
			phraseBars: 4,
			seed: this.uuid,
		})
		this.sequencer = new PercussionSequencer(
			this.context,
			{
				trigger: (hit) => {
					if (
						(hit.part === 'kick' && this.settings.muteKick) ||
						(hit.part === 'snare' && this.settings.muteSnare) ||
						(hit.part === 'hat' && this.settings.muteHat) ||
						(hit.part === 'clap' && this.settings.muteClap)
					)
						return
					const variation =
						((this.step * 13 +
							[...hit.part].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) *
								7) %
							100) /
						100
					if (this.settings.density < 0.5 && variation >= this.settings.density * 2)
						return
					this.percussion.trigger({
						...hit,
						velocity: hit.velocity * (this.synth ? 1 : this.settings.volume),
					})
				},
				allNotesOff: () => this.percussion.allNotesOff(),
			},
			{ arranger: this.arranger },
		)
		this.step = 0
		this.nextStepAt = this.context.currentTime + 0.01
	}

	private async press(key: string, velocity: number): Promise<void> {
		if (!this.connected || !Number.isFinite(velocity) || velocity <= 0) return
		this.held.set(key, Math.min(127, velocity))
		this.updateIntent()
		if (this.context.state === 'suspended') await this.context.resume()
		if (!this.held.size || !this.connected || this.interval !== undefined) return
		this.nextStepAt = this.context.currentTime + 0.01
		this.interval = setInterval(() => this.pump(), 25)
		this.pump()
	}

	private release(key: string): void {
		this.held.delete(key)
		this.updateIntent()
		if (!this.held.size) this.stop()
	}

	private pump(): void {
		if (this.context.state === 'suspended' || !this.held.size) return
		const now = this.context.currentTime
		const duration = 60 / this.settings.bpm / 4
		if (this.nextStepAt < now - 0.1) this.nextStepAt = now + 0.01
		while (this.nextStepAt < now + 0.1) {
			const swing = this.step % 2 ? duration * this.settings.swing * 0.5 : 0
			const triggerAt = this.nextStepAt + swing
			const hits = this.sequencer.next(triggerAt, this.settings.bpm, duration)
			if (
				this.settings.density > 0.5 &&
				!this.settings.muteHat &&
				this.step % 2 === 1 &&
				!hits.some((hit) => hit.part === 'hat') &&
				((this.step * 17) % 100) / 100 < (this.settings.density - 0.5) * 2
			) {
				this.percussion.trigger({
					part: 'hat',
					velocity:
						(0.12 + this.settings.energy * 0.15) *
						(this.synth ? 1 : this.settings.volume),
					triggerAt,
				})
			}
			this.nextStepAt += duration
			this.step++
		}
	}

	noteOn(note: number, velocity = 100): Promise<void> {
		if (velocity === 0) {
			this.noteOff(note)
			return Promise.resolve()
		}
		return this.press(`note:${note}`, velocity)
	}

	noteOff(note: number): void {
		this.release(`note:${note}`)
	}

	getNoteKey(command: IAudioCommand): string {
		return `${command.channel}:${command.number}`
	}

	async sendCommand(command: IAudioCommand): Promise<void> {
		const key = `command:${this.getNoteKey(command)}`
		if (command.type === NOTE_ON && command.velocity > 0)
			await this.press(key, command.velocity)
		else if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0))
			this.release(key)
		else if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) this.allNotesOff()
		else if (command.type === MIDI_CLOCK && command.bpm !== undefined)
			this.configure({ bpm: command.bpm })
	}

	requestFill(): void {
		this.arranger.requestFill()
	}

	async togglePreview(): Promise<void> {
		if (this.isPreviewing) this.release('preview')
		else await this.press('preview', 100)
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}

	private stop(): void {
		if (this.interval !== undefined) clearInterval(this.interval)
		this.interval = undefined
		this.percussion.allNotesOff()
	}

	allNotesOff(): void {
		const previewing = this.isPreviewing
		this.held.clear()
		this.stop()
		if (previewing) this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}

	async connect(): Promise<void> {
		this.connected = true
	}
	async disconnect(): Promise<void> {
		this.connected = false
		this.allNotesOff()
	}

	async createGui(): Promise<HTMLElement> {
		this.gui ??= createDrumAccompanimentGui(this)
		return this.gui.element
	}

	async destroyGui(): Promise<void> {
		this.gui?.dispose()
		this.gui = undefined
		if (this.isPreviewing) this.release('preview')
	}

	destroy(): void {
		this.connected = false
		this.allNotesOff()
		this.synth?.destroy()
		void this.destroyGui()
	}
}