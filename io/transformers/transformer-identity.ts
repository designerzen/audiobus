import type AudioCommand from "../../audio-command.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_IDENTITY = 'identity'

export class IdentityTransformer extends Transformer<{}> implements ITransformer{
    
	protected type = ID_IDENTITY

	get name(): string {
        return 'Identity'
    }
    transform(command:IAudioCommandudioCommand[], timer:Timer): AudioCommand[] {
        return command
    }
}
