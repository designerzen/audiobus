/**
 * This simply adds a noteOff to any noteOn that has lasted more 
 * than the specified bar lengths
 */
import type AudioCommand from "../../audio-command.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

const ID_KILL_OLD = 'kill-old'

export class KillOldTransformer extends Transformer<{}> implements ITransformer{
   
	id = ID_KILL_OLD
    protected type = ID_KILL_OLD
	category = TRANSFORMER_CATEGORY_TIMING

    get name(): string {
        return 'Kill Old Transformer'
    }
   
    get description():string{
        return "Remove stale & everlasting notes"
    }

    transform(commands: IAudioCommandCommand[], timer:Timer): AudioCommand[] {
         if (!this.config.enabled || commands.length === 0)
        {
            return commands
        }

        // check to see how old this command is
        return commands
    }
}

