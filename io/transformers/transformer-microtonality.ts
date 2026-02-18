/**
 * Take note Ons and detune the note to match the specified
 * microtonal scale using the pitfalls library.
 * 
 * This transformer applies microtonal tuning by calculating detune values
 * in cents for each note based on the EDO (Equal Division of the Octave)
 * scale definition, compatible with MIDI 1.0 pitch bend control.
 */
import type AudioCommand from "../../audio-command.ts"
import type Timer from "../../timing/timer.ts"

import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { parseEdoScaleMicroTuningOctave } from "../../../pitfalls/ts/index.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import * as Commands from '../../commands'
import type Pitches from "../../../pitfalls/ts/pitches.ts"

export const ID_MICROTONALITY = "Micro-Tonality"

interface Config {
	enabled: number // 1 for on, 0 for off
	baseNoteMidi: number // MIDI note number for base note (0-127)
	rootOctave: number // Root octave number (0-10)
	sequence: string // L/s notation for scale (e.g., "LLsLLLs")
	large: number // Large step size (1-12)
	small: number // Small step size (1-12)
	rootFrequency: number // Reference frequency in Hz (20-20000)
}

const DEFAULT_OPTIONS: Config = {
	enabled: 1,
	baseNoteMidi: 60, // Middle C
	rootOctave: 3,
	sequence: "LLsLLLs", // 12 EDO major scale
	large: 2,
	small: 1,
	rootFrequency: 440 // A4
}

/**
 * Microtonality Transformer
 * 
 * Applies microtonal detuning to NOTE_ON commands using EDO scales.
 * The detune value is stored as cents offset, compatible with MIDI 1.0.
 */
export class TransformerMicroTonality extends Transformer<Config> implements ITransformer {

	protected type = ID_MICROTONALITY
	category = TRANSFORMER_CATEGORY_TUNING

	private microtones: Pitches | null = null

	get name(): string {
		return 'Microtonality'
	}

	get description(): string {
		return "Detune to a specific microtonal scale using EDO notation"
	}

	get fields() {
		return [
			{
				name: 'enabled',
				type: 'select',
				enabled: true,
				values: [
					{ name: 'On', value: 1 },
					{ name: 'Off', value: 0 }
				],
				default: DEFAULT_OPTIONS.enabled
			},
			{
				name: 'baseNoteMidi',
				type: 'number',
				enabled: true,
				min: 0,
				max: 127,
				default: DEFAULT_OPTIONS.baseNoteMidi
			},
			{
				name: 'rootOctave',
				type: 'select',
				enabled: true,
				values: [
					{ name: '0', value: 0 },
					{ name: '1', value: 1 },
					{ name: '2', value: 2 },
					{ name: '3', value: 3 },
					{ name: '4', value: 4 },
					{ name: '5', value: 5 },
					{ name: '6', value: 6 },
					{ name: '7', value: 7 },
					{ name: '8', value: 8 },
					{ name: '9', value: 9 },
					{ name: '10', value: 10 }
				],
				default: DEFAULT_OPTIONS.rootOctave
			},
			{
				name: 'sequence',
				type: 'text',
				enabled: true,
				default: DEFAULT_OPTIONS.sequence
			},
			{
				name: 'large',
				type: 'select',
				enabled: true,
				values: [
					{ name: '1', value: 1 },
					{ name: '2', value: 2 },
					{ name: '3', value: 3 },
					{ name: '4', value: 4 },
					{ name: '5', value: 5 },
					{ name: '6', value: 6 },
					{ name: '7', value: 7 },
					{ name: '8', value: 8 },
					{ name: '9', value: 9 },
					{ name: '10', value: 10 },
					{ name: '11', value: 11 },
					{ name: '12', value: 12 }
				],
				default: DEFAULT_OPTIONS.large
			},
			{
				name: 'small',
				type: 'select',
				enabled: true,
				values: [
					{ name: '1', value: 1 },
					{ name: '2', value: 2 },
					{ name: '3', value: 3 },
					{ name: '4', value: 4 },
					{ name: '5', value: 5 },
					{ name: '6', value: 6 },
					{ name: '7', value: 7 },
					{ name: '8', value: 8 },
					{ name: '9', value: 9 },
					{ name: '10', value: 10 },
					{ name: '11', value: 11 },
					{ name: '12', value: 12 }
				],
				default: DEFAULT_OPTIONS.small
			},
			{
				name: 'rootFrequency',
				type: 'number',
				enabled: true,
				min: 20,
				max: 20000,
				default: DEFAULT_OPTIONS.rootFrequency
			}
		]
	}

	constructor(config: Partial<Config> = {}) {
		super({ ...DEFAULT_OPTIONS, ...config })
		this.initializeMicrotones()
	}

	/**
	 * Initialize microtone pitches from current config
	 */
	private initializeMicrotones(): void {
		try {
			this.microtones = parseEdoScaleMicroTuningOctave(
				this.config.baseNoteMidi,
				this.config.rootOctave,
				this.config.sequence,
				this.config.large,
				this.config.small,
				this.config.rootFrequency
			)
		} catch (error) {
			console.error('[MICROTONALITY] Failed to initialize microtones:', error)
			this.microtones = null
		}
	}

	/**
	 * Calculate cents detune for a MIDI note number
	 * MIDI 1.0 compatible: returns cents offset (0-100 range within semitone)
	 */
	private getDetuneInCents(midiNote: number): number {
		if (!this.microtones) {
			return 0
		}

		try {
			// Get the octave tuning map for the octave containing this note
			const centsOffset = this.microtones.octaveTuning.get(midiNote)
			if (centsOffset !== undefined) {
				// Return cents as a fraction of a semitone (-50 to +50)
				return centsOffset - 50
			}
		} catch (error) {
			console.debug('[MICROTONALITY] Error getting detune for note', midiNote, error)
		}

		return 0
	}

	/**
	 * Transform audio commands by applying microtonal detuning to NOTE_ON commands
	 */
	transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {

		if (!this.config.enabled || !this.microtones || commands.length === 0) {
			return commands
		}

		return commands.map((command) => {
			// Only process NOTE_ON commands
			if (command.type !== Commands.NOTE_ON) {
				return command
			}

			// Clone the command to avoid mutating the original
			const detuned = { ...command }

			// Calculate detune in cents
			const detuneCents = this.getDetuneInCents(command.number)

			// Store detune as a custom property on the command
			// This can be used by synthesizers to apply pitch offset
			;(detuned as any).detune = detuneCents

			return detuned
		})
	}

	/**
	 * Update configuration and reinitialize microtones
	 */
	override setConfig(key: string, value: unknown): void {
		super.setConfig(key, value)

		// Reinitialize microtones when any configuration changes
		// that affects the scale calculation
		if (['baseNoteMidi', 'rootOctave', 'sequence', 'large', 'small', 'rootFrequency'].includes(key)) {
			this.initializeMicrotones()
		}
	}

	/**
	 * Reset transformer state
	 */
	override reset(): void {
		// Ensure microtones are properly initialized
		if (!this.microtones) {
			this.initializeMicrotones()
		}
	}
}




