/**
 * Adds a bit of off grid wobble to your timinig
 */

import type AudioCommand from "../../audio-command.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_TIMING_HUMANISER = "TimingHumaniser"

export class TransformerTimingHumaniser extends Transformer<{}> implements ITransformer{
    
	protected type = ID_TIMING_HUMANISER

	category = TRANSFORMER_CATEGORY_TIMING
	
	get name(): string {
        return 'Timing Humaniser'
    }

	get description():string{
        return "Adds a bit of off grid wobble to your timings."
    }
	
    transform(command: IAudioCommand[], timer:Timer): AudioCommand[] {
		return commands.map(command => {
            command.number = Math.max( 0, command.number + parseFloat(this.config.distance) )
            return command
        })
    }
}

