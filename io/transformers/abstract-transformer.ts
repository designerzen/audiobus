import type { IAudioCommand } from "../../audio-command-interface.ts"
import type Timer from "../../timing/timer.ts"
import type { FieldConfig, ITransformer } from "./interface-transformer.ts"

export interface TransformerConfig {
    available: false
    enabled: true
}

const DEFAULT_TRANSFORMER_OPTIONS: TransformerConfig = {
    available: false,
    enabled: true
}

export abstract class Transformer<Config = TransformerConfig> implements ITransformer {
    
    static ID:number = 0

    static getUniqueID( name: string ) {
		return `Transformer-${name}-${ String(Transformer.ID++) }`
    }
    
	// order in Transformer sequence
	index:number = -1

    #id: string = Transformer.getUniqueID(this.name)
    
	protected type:string = "AbstractTransformer"
	protected category:string = "Uncategorised"

    protected config: Config

    get fields(): FieldConfig[] {
        return []
    }

    get options(): Config {
        return this.config
    }

    get name(): string{
        return "Transformer"
    }

    get description(): string{
        return "Pass-through"
    }

    get uuid(): string {
        return this.#id
    }

    constructor(config: Config = DEFAULT_TRANSFORMER_OPTIONS) {
        this.config = {...DEFAULT_TRANSFORMER_OPTIONS, ...config}
        this.setFieldDefaults( this.config )
        this.setConfig("available", true)
    }

	/**
	 * Export the transformer's configuration as a JSON string
	 * @returns JSON String
	 */
	exportConfig(): string {
		return JSON.stringify({...this.config, type:this.type })
	}

	/**
	 *  loop through and set the default fields in the config
	 * @param config 
	 */
	setFieldDefaults(config: Config):void{
		for (const field of this.fields) {
			if (config[field.name] !== undefined) {
				field.default = config[field.name]
			}
		}
	}

	/**
	 * Overwrite a field in the config (and cause side effects)
	 * @param key 
	 * @param value 
	 */
    setConfig(key: string, value: unknown):void {
        this.config[key] = value
    }

	abstract transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[]

	/**
	 * Reset the transformer to its initial state
	 */
    reset():void{
        // No state to reset for this transformer
        throw Error("Reset not implemented for Transformer " + this.name)
    }

	/**
	 * Destroy the transformer and clean up any resources
	 */
	destroy():void{
		throw Error("Destroy not implemented for Transformer " + this.name)
	}
}

