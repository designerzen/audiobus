import type AudioCommand from "../../audio-command.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_SWINGER = 'Swinger'

export class TransformerSwinger extends Transformer<{}> implements ITransformer{
	
	protected type = ID_SWINGER

	category = TRANSFORMER_CATEGORY_TIMING

	get name(): string {
		return 'Swinger'
	}
	
	get description():string{
        return "Adds swing to a groove"
    }

	transform(command: IAudioCommandudioCommand[], timer:Timer): AudioCommand[] {
		return command
	}
}
