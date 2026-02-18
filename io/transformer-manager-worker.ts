/**
 * TRANSFORMER MANAGER WITH WORKER SUPPORT -----------------------------------------------
 * Delegates transform operations to Web Workers to avoid blocking the main thread
 */
import { compress, decompress } from 'lz-string'

import { Transformer } from "./transformers/abstract-transformer.ts"
import { TransformerHarmoniser } from "./transformers/transformer-harmoniser.ts"
import { ID_QUANTISE, TransformerQuantise } from "./transformers/transformer-quantise.ts"

import type Timer from "../timing/timer.ts"
import type { FieldConfig, ITransformer } from "./transformers/interface-transformer.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"

const EVENT_TRANSFORMERS_UPDATED = "EVENT_TRANSFORMERS_UPDATED"
const EVENT_TRANSFORMERS_ADDED = "EVENT_TRANSFORMER_ADDED"
const EVENT_TRANSFORMERS_REMOVED = "EVENT_TRANSFORMER_REMOVED"

const DEFAULT_TRANSFORMERS = [
    new TransformerHarmoniser()
]

export default class TransformerManagerWorker extends EventTarget implements ITransformer {

    public id: string = Transformer.getUniqueID()
    public name: string = 'TransformerManager'
    public timer: Timer | undefined

    #transformersMap: Map<string, Array<Transformer>> = new Map()
    #transformers: Array<Transformer> = []

    get fields(): FieldConfig[] {
        return this.#transformers.flatMap(t => t.config)
    }

    get isQuantised(): boolean {
        return this.#transformersMap.has(ID_QUANTISE) && this.quantiseTransformer?.isEnabled
    }

    get quantiseTransformer(): TransformerQuantise | undefined {
        return this.#transformersMap.get(ID_QUANTISE)?.[0] as TransformerQuantise
    }

    get quantiseFidelity(): number {
        return this.quantiseTransformer?.options.step ?? 0
    }

    get description(): string {
        return "Transformers Manager (Worker):\n" + this.#transformers.map(t => t.description).join('\n')
    }

    get activeTransformers() {
        return this.#transformers
    }

    get quantity() {
        return this.#transformers.length
    }

    constructor(initialTransformers?: Array<Transformer> = DEFAULT_TRANSFORMERS) {
        super()
        this.setTransformers([...this.#transformers, ...(initialTransformers ?? [])])
    }




    /**
     * Append to the end of the queue the specified transformer
     */
    appendTransformer(transformerToAdd: Transformer, dispatchEvents: boolean = true) {
        const collection: Transformer[] = this.#transformersMap.has(transformerToAdd.type)
            ? [...this.#transformersMap.get(transformerToAdd.type)!, transformerToAdd]
            : [transformerToAdd]
        this.#transformersMap.set(transformerToAdd.type, collection)
        transformerToAdd.index = this.#transformers.push(transformerToAdd) - 1

        if (dispatchEvents) {
            this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_ADDED, { detail: { transformer: transformerToAdd } }))
            this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_UPDATED, { detail: { added: [transformerToAdd], removed: [], transformers: this.#transformers } }))
        }
    }

    /**
     * Remove a transformer from the pipeline
     */
    removeTransformer(transformerToRemove: Transformer, dispatchEvents: boolean = true) {
        this.#transformers = this.#transformers.filter(transformer => transformer.uuid !== transformerToRemove.uuid)
        transformerToRemove.index = -1

        const remaining = this.#transformersMap.get(transformerToRemove.type)?.filter(t => t.uuid !== transformerToRemove.uuid)
        if (remaining && remaining.length > 0) {
            this.#transformersMap.set(transformerToRemove.type, remaining)
        } else {
            this.#transformersMap.delete(transformerToRemove.type)
        }

        if (dispatchEvents) {
            this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_REMOVED, { detail: { transformer: transformerToRemove } }))
            this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_UPDATED, { detail: { added: [], removed: [transformerToRemove], transformers: this.#transformers } }))
        }
    }

    /**
     * Overwrite the whole transformers queue stack
     */
    setTransformers(transformers: Array<Transformer>): void {
        this.clear()
        transformers.forEach((transformer: Transformer) => this.appendTransformer(transformer, false))
        this.dispatchEvent(new CustomEvent(EVENT_TRANSFORMERS_UPDATED))
    }

    /**
     * Get specific registered Transformer
     */
    getTransformer(id: string): Transformer | undefined {
        return this.#transformersMap.get(id)?.[0]
    }

    /**
     * Get all transformers
     */
    getTransformers(): Array<Transformer> {
        return this.#transformers
    }

    /**
     * Move transformer one step before
     */
    moveOneStepBefore(el: Transformer) {
        const index: number = this.#transformers.indexOf(el)
        if (index <= 0) return

        const newList = [...this.#transformers]
        const temp = newList[index - 1]
        newList[index - 1] = newList[index]
        newList[index] = temp

        this.setTransformers(newList)
    }

    /**
     * Move transformer one step after
     */
    moveOneStepAfter(el: Transformer) {
        const idx = this.#transformers.indexOf(el)
        if (idx === -1 || idx >= this.#transformers.length - 1) return

        const newList = [...this.#transformers]
        const temp = newList[idx + 1]
        newList[idx + 1] = newList[idx]
        newList[idx] = temp

        this.setTransformers(newList)
    }

    /**
     * INTERFACE:
     * Run transforms asynchronously
     * Returns a Promise that resolves to the transformed commands
     * Defers to next tick to avoid blocking
     */
    async transform(commands: IAudioCommand[], timer: Timer): Promise<IAudioCommand[]> {
        // Defer to main thread on next tick to avoid blocking
        return this.transformMainThreadAsync(commands, timer)
    }

    /**
     * Fallback: Transform on main thread (synchronous)
     */
    private transformMainThread(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {
        return this.#transformers.reduce((v, t) => t.transform(v, timer), commands)
    }

    /**
     * Fallback: Transform on main thread (asynchronous - defers to next tick)
     */
    private transformMainThreadAsync(commands: IAudioCommand[], timer: Timer): Promise<IAudioCommand[]> {
        return new Promise((resolve) => {
            // Use requestIdleCallback if available, otherwise setTimeout
            const defer = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 0)

            defer(() => {
                try {
                    const result = this.transformMainThread(commands, timer)
                    resolve(result)
                } catch (error) {
                    console.error('Transform error:', error)
                    // Return untransformed commands on error
                    resolve(commands)
                }
            })
        })
    }



    /**
     * INTERFACE:
     * Reset the state of all Transformers
     */
    reset(): void {
        this.#transformers.forEach(t => t.reset())
    }

    exportConfig(): string {
        return JSON.stringify(this.#transformers.map(t => t.exportConfig()))
    }

    importData(encoded: string): void {
        const compressed = atob(encoded)
        const json = decompress(compressed)
        // Implementation would go here
    }

    exportData(): string {
        const json = this.exportConfig()
        const compressed = compress(json)
        return btoa(compressed)
    }

    clear(): void {
        this.#transformers = []
        this.#transformersMap = new Map()
    }

    /**
     * Cleanup
     */
    destroy(): void {
        // No worker resources to clean up
    }
}

