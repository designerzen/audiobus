import type AudioCommand from "../../audio-command.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_CHANNELER = "Channeler"

export class TransformerChanneler extends Transformer<{}> implements ITransformer{
    
    protected type = ID_CHANNELER
    
	category = TRANSFORMER_CATEGORY_TUNING

    get name(): string {
        return 'Channeler'
    }

    get description(): string {
        return 'Alter the channel of incoming notes or copy it to all channels.'
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
                name: 'channel',
                type: 'select',
                values: [
                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 
                    "ALL"
                ]
            }
        ]
    }

    transform(command: IAudioCommandudioCommand[], timer:Timer): AudioCommand[] {
        return command.map((cmd) => {
            if (this.config.channel === "ALL") {
                cmd.channel = 0
            }else{
                cmd.channel = parseInt( this.config.channel )
            }
            return cmd
        })
    }
}
