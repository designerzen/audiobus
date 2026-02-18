/**
 * Forces by transposition the entered note into
 * the specified key and scale by finding the nearest note
 */
import { Transformer, type TransformerConfig } from "./abstract-transformer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import type Timer from "../../timing/timer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"

export const ID_TRANSPOSER = "Transposer"

interface Config extends TransformerConfig {
    distance: number
}

const DEFAULT_OPTIONS: Config = {
	enabled:true,
    distance: 0
}

export class TransformerTransposer extends Transformer<Config> implements ITransformer {

    protected type = ID_TRANSPOSER
	category = TRANSFORMER_CATEGORY_TUNING

    get name(): string {
        return 'Transposer'
    }

	get description(): string{
        return "Transposes the note by the specified amount."
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
                name: 'distance',
                type: 'select',
                values: [
                    { name: 'Pass-through', value: 0 },

                    { name: 'Up Octave', value: 12 },
                    { name: 'Down Octave', value: -12 },

                    { name: 'Up Half Octave', value: 6 },
                    { name: 'Down Half Octave', value: -6 },

                    { name: 'Up Semitone', value: 1 },
                    { name: 'Down Semitone', value: -1 },

                    { name: 'Up Fifth', value: 7 },
                    { name: 'Down Fifth', value: -7 }
                ],
                default: DEFAULT_OPTIONS.distance
            }
        ]
    }

    constructor(config = DEFAULT_OPTIONS) {
        super( { ...DEFAULT_OPTIONS, ...config } )
    }

    /**
     * Moves a note by the specified quantity
     * @param commands 
     * @param timer 
     * @returns 
     */
    transform(commands:IAudioCommand[], timer:Timer ):IAudioCommand[] {
           
        if (!this.config.enabled || commands.length === 0)
        {
            return commands
        }

        // Quantise each command's note to the closest scale note
        return commands.map(command => {
            command.number = Math.max( 0, command.number + parseFloat(this.config.distance) )
            return command
        })
    }
}

