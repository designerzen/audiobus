/**
 * Filter Transformer
 *
 * Filters notes based on a specified range with include/exclude mode.
 * - mode: 'include' (only pass notes in range) or 'exclude' (block notes in range)
 * - lower: Lower bound of the note range (0-127)
 * - upper: Upper bound of the note range (0-127)
 */

import type { IAudioCommand } from "../../audio-command-interface.ts"
import { Transformer } from "./abstract-transformer.ts"
import * as Commands from '../../commands'
import type { ITransformer } from "./interface-transformer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"

export const ID_FILTER = "Filter"

interface Config {
	mode: "include" | "exclude"
	lower: number // Lower bound (0-127)
	upper: number // Upper bound (0-127)
}

const DEFAULT_OPTIONS: Config = {
	mode: "include",
	lower: 0,
	upper: 127
}

export class TransformerFilter extends Transformer<Config> implements ITransformer {
	protected type = ID_FILTER

	category = TRANSFORMER_CATEGORY_TUNING

	get name(): string {
		return "Filter"
	}

	get description(): string {
		return "Filters notes based on a specified range (include or exclude)."
	}

	get fields() {
		return [
			{
				name: "enabled",
				type: "select",
				values: [
					{ name: "On", value: 1 },
					{ name: "Off", value: 0 }
				],
				default: 1
			},
			{
				name: "mode",
				type: "select",
				values: [
					{ name: "Include", value: "include" },
					{ name: "Exclude", value: "exclude" }
				],
				default: DEFAULT_OPTIONS.mode
			},
			{
				name: "lower",
				type: "select",
				values: Array.from({ length: 128 }, (_, i) => ({
					name: `${i}`,
					value: i
				})),
				default: DEFAULT_OPTIONS.lower
			},
			{
				name: "upper",
				type: "select",
				values: Array.from({ length: 128 }, (_, i) => ({
					name: `${i}`,
					value: i
				})),
				default: DEFAULT_OPTIONS.upper
			}
		]
	}

	constructor(config: Partial<Config> = {}) {
		super({ ...DEFAULT_OPTIONS, ...config })
	}

	transform(commands: IAudioCommand[], timer?: any): IAudioCommand[] {
		if (!this.config.enabled || commands.length === 0) {
			return commands
		}

		const { mode, lower, upper } = this.config

		return commands.filter(command => {
			// Only filter NOTE_ON and NOTE_OFF commands
			if (command.type !== Commands.NOTE_ON && command.type !== Commands.NOTE_OFF) {
				return true
			}

			const noteNumber = command.number
			const inRange = noteNumber >= lower && noteNumber <= upper

			// Include mode: pass notes in range
			if (mode === "include") {
				return inRange
			}

			// Exclude mode: pass notes outside range
			return !inRange
		})
	}

	reset(): void {
		// No state to reset
	}
}




