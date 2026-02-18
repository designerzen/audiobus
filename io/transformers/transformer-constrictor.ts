import type AudioCommand from "../../audio-command.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_CONSTRICTOR = 'Constrictor'

export class TransformerConstrictor extends Transformer<{}> implements ITransformer{
	
	protected type = ID_CONSTRICTOR
	category = TRANSFORMER_CATEGORY_TUNING
	

	get name(): string {
		return 'Constrictor'
	}
	
	get description():string{
        return "Constrict the range of notes that can be played and transpose all that fall outside."
    }
    
	get fields() {
        return [
             {
                name: 'enabled',
                type: 'select',
                values: [
                    { name: 'On', value: 1 },
                    { name: 'Off', value: 0 }
                ]
            },
            {
                name: 'lowest octave',
                type: 'select',
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
				default: 3
            },
            {
                name: 'highest octave',
                type: 'select',
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
				default: 8
            }
        ]
    }
	
	transform(command: IAudioCommand[], timer:Timer): IAudioCommand[] {
		return command
	}
}
