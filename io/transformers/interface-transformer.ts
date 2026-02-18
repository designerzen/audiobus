import type { IAudioCommand } from "../../audio-command-interface.ts"
import type Timer from "../../timing/timer.ts"

export interface ITransformer {
    uuid: string
	fields: FieldConfig[]
	name:string
    description:string
	
    transform(commands: IAudioCommand[], timer:Timer ): IAudioCommand[]
    reset():void
    destroy():void
	exportConfig():string
}

export interface FieldConfig {
    name: string
    type: string
    enabled:boolean
    values: Array<string | number | { name: string; value: string | number }>
    default?: string | number
}

