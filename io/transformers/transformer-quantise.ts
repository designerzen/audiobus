/**
 * Put into time domain
 */
import type { IAudioCommand } from "../../audio-command-interface.ts";
import type Timer from "../../timing/timer.ts";
import { Transformer } from "./abstract-transformer.ts"
import type { ITransformer } from "./interface-transformer.ts";
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts";

export const ID_QUANTISE = "Quantiser"

interface Config {
    step: number
    expiration: number
    swing: number
}

const DEFAULT_OPTIONS: Config = {
   step: 4,
   expiration: 16,
   swing: 0
}

export class TransformerQuantise extends Transformer<Config> implements ITransformer{

    protected type = ID_QUANTISE
	category = TRANSFORMER_CATEGORY_TIMING

    get name(): string {
        return 'Quantiser'
    }

    get fields() {
        return [
             {
                name: 'enabled',
                type: 'select',
                values: [
                    { name: 'On', value: 1 },
                    { name: 'Off', value: 0 }
                ],
                default: 1
            },
            { 
                name: 'step', 
                type: 'select', 
                values: [
                    1, 2, 3, 4, 6, 8, 12, 16 
                ],
                default: DEFAULT_OPTIONS.step
            }
        ]
    }

    get description():string{
        return "Locks all notes to the nearest time groove."
    }

    get isEnabled():boolean{
        return this.config.enabled === true
    }

    constructor(config = { step: 4 }) {
        super( {...DEFAULT_OPTIONS, ...config} )
    }

    // Quanitisation is mainly handled in onTick in index
    transform(commands:IAudioCommand[], timer: Timer):IAudioCommand[] {
        return commands
    }
}

