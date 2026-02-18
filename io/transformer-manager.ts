/**
 * TRANSFORMER -----------------------------------------------
 * GOBOTS IN DISGUISE
 */
import { compress, decompress } from 'lz-string'

import { Transformer } from "./transformers/abstract-transformer.ts"
import { TransformerHarmoniser } from "./transformers/transformer-harmoniser.ts"
import { TransformerTransposer } from "./transformers/transformer-transposer.ts"
import { ID_QUANTISE, TransformerQuantise } from "./transformers/transformer-quantise.ts"

import type Timer from "../timing/timer.ts"
import type { FieldConfig, ITransformer } from "./transformers/interface-transformer.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"

type Callback = () => void

export const EVENT_TRANSFORMERS_UPDATED = "EVENT_TRANSFORMERS_UPDATED"
export const EVENT_TRANSFORMERS_ADDED = "EVENT_TRANSFORMER_ADDED"
export const EVENT_TRANSFORMERS_REMOVED = "EVENT_TRANSFORMER_REMOVED"

const DEFAULT_TRANSFORMERS = [
    new TransformerHarmoniser()
]

export default class TransformerManager extends EventTarget implements ITransformer {
     
    protected name: string = 'TransformerManager'
	protected id: string = Transformer.getUniqueID( this.name )
    protected timer:Timer|undefined // Reference to AudioTimer for BPM-synced transformers

    #transformersMap:Map<string, Array<Transformer> > = new Map()
    #transformers: Array<Transformer> = []

    // FIXME: Make a compositie of all the transformers
    get fields(): FieldConfig[] {
        return this.#transformers.flatMap(t => t.config)
    }

    get isQuantised():boolean{
        return this.#transformersMap.has(ID_QUANTISE) && this.quantiseTransformer?.isEnabled
    }

    get quantiseTransformer():TransformerQuantise|undefined{
        // NB. it doesn't matter how many you add, they shouldn't double up
        return this.#transformersMap.get(ID_QUANTISE)?.[0] as TransformerQuantise
    }

    get quantiseFidelity():number{
        return this.quantiseTransformer?.options.step ?? 0
    }

	get description():string{
		return "Transformers Manager:\n" + this.#transformers.map(t => t.description).join('\n')
	}

	get activeTransformers(){
		return this.#transformers
	}

	get quantity(){
		return this.#transformers.length
	}
  
    constructor(initialTransformers?: Array<Transformer>=DEFAULT_TRANSFORMERS) {
        super()
        this.setTransformers([ ...this.#transformers, ...(initialTransformers??[]) ])     
    }
    
    /**
     * Append to the end of the queue the specified transformer
     * @param transformerToAdd 
     */
    appendTransformer(transformerToAdd: Transformer, dispatchEvents:boolean=true ) {
      
		// don't add a quantiser if one is already set
		if (this.isQuantised && transformerToAdd.type === ID_QUANTISE){
			return
		}
			
		const collection:Transformer[] = this.#transformersMap.has(transformerToAdd.type) ? [...this.#transformersMap.get(transformerToAdd.type), transformerToAdd] : [transformerToAdd]
        this.#transformersMap.set(transformerToAdd.type, collection )
		transformerToAdd.index = this.#transformers.push(transformerToAdd) - 1
       
        if (dispatchEvents) {
            this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_ADDED, {detail:{transformer:transformerToAdd}}))
            this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_UPDATED, {detail:{ added:[transformerToAdd], removed:[], transformers:this.#transformers}} ))
        }
    }

    /**
     * Remove a transformer from the pipeline
     * @param transformerToRemove 
     */
    removeTransformer(transformerToRemove: Transformer, dispatchEvents:boolean=true) {
        this.#transformers = this.#transformers.filter(transformer => transformer.uuid !== transformerToRemove.uuid)
        
		transformerToRemove.index = -1

        // Update the map: filter out the removed transformer, delete key if no more exist
        const remaining = this.#transformersMap.get(transformerToRemove.type)?.filter(t => t.uuid !== transformerToRemove.uuid)
        if (remaining && remaining.length > 0) {
            this.#transformersMap.set(transformerToRemove.type, remaining)
        } else {
            this.#transformersMap.delete(transformerToRemove.type)
        }
		
		if (dispatchEvents){
			this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_REMOVED, {detail:{transformer:transformerToRemove}}))
			this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_UPDATED, {detail:{ added:[], removed:[transformerToRemove], transformers:this.#transformers}}))
		}
    }

    /**
     * Overwrite the whole transformers queue stack
     * @param transformers 
     */
    setTransformers(transformers: Array<Transformer>): void {
        this.clear()
        transformers.forEach( (transformer:Transformer) => this.appendTransformer( transformer, false) )
        this.dispatchEvent( new CustomEvent(EVENT_TRANSFORMERS_UPDATED) )
    }

    /**
     * 
     * @param id 
     * @returns specific registered Transformer
     */
    getTransformer( id:string ): Transformer|undefined {
        return this.#transformersMap.get(id)
    }

    /**
     * 
     * @returns All transformers
     */
    getTransformers(): Array<Transformer> {
        return this.#transformers
    }

	// FIXME: This is done in a very slow fashion creating a whole new sequence everytime
    moveOneStepBefore(transformer: Transformer) {
        const index:number = this.#transformers.indexOf(transformer)
        if (index <= 0){ 
			return // already at the start or not found
		}
        const newList = [...this.#transformers]
        // swap el with the one before it
        const temp = newList[index - 1]
        newList[index - 1] = newList[index]
        newList[index] = temp

        this.setTransformers(newList)
    }

	/**
	 * 
	 * @param transformer 
	 * @returns 
	 */
	moveOneStepAfter(transformer: Transformer) {
        const index = this.#transformers.indexOf(transformer)
        if (index === -1 || index >= this.#transformers.length - 1){
			return // end or not found
		}
        const newList = [...this.#transformers]
        // swap el with the one after it
        const temp = newList[index + 1]
        newList[index + 1] = newList[index]
        newList[index] = temp

        this.setTransformers(newList)
    }

    /**
     * INTERFACE :
     * Advance through every single registered transformer and pass the
     * command. Returns a Promise for API compatibility with TransformerManagerWorker.
     * @param commands
     * @returns Promise<IAudioCommand[]>
     */
    transform(commands: IAudioCommand[], timer:Timer ): Promise<IAudioCommand[]> {
        return Promise.resolve(this.#transformers.reduce((v, t) => t.transform(v, timer), commands))
    }

    /**
     * INTERFACE :
     * Reset the state of all Transformers
     */
    reset():void{
       this.#transformers.forEach(t => t.reset())
    }

	exportConfig(): string {
		return JSON.stringify(this.#transformers.map(t => t.exportConfig()))
	}

	// TODO:
	importData( encoded: string ): void {
		// const encoded = new URLSearchParams(location.search).get('state')
		const compressed = atob(encoded)
		const json = decompress(compressed)
		const data = JSON.parse(json)
		// const transformers = data.map(t => this.#transformersMap.get(t.type))
		// this.setTransformers(transformers)
	}

	exportData(): string {
		const json = this.exportConfig()
		const compressed = compress(json)
		return btoa(compressed)  // Base64 (wont work in node)
	}

    clear(){
        this.#transformers = []
        this.#transformersMap = new Map()
    }
}

