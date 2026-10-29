/**
 * Adds a bit of off grid wobble to your timinig
 */

import type { Timer } from "netronome"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_TIMING_HUMANISER = "TimingHumaniser"

export class TransformerTimingHumaniser extends Transformer<{}> implements ITransformer {
	type = ID_TIMING_HUMANISER

	category = TRANSFORMER_CATEGORY_TIMING

	get name(): string {
		return "Timing Humaniser"
	}

	get description(): string {
		return "Adds a bit of off grid wobble to your timings."
	}

	transform(commands: IAudioCommand[], _timer: Timer): IAudioCommand[] {
		return commands.map((command) => {
			command.number = Math.max(0, command.number + Number(this.config.distance ?? 0))
			return command
		})
	}
}