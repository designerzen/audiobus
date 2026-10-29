import { EVENT_TRANSFORMERS_UPDATED, EVENT_TRANSFORMERS_ADDED, EVENT_TRANSFORMERS_REMOVED } from '../event-constants.ts'
/**
 * Runs the live transform pipeline in input order. Expensive transformers manage
 * their own workers; live note delivery must never wait for browser idle time.
 */
import { compressToBase64, decompressFromBase64 } from 'lz-string'

import { Transformer } from "./transformers/abstract-transformer.ts"
import { TransformerHarmoniser } from "./transformers/transformer-harmoniser.ts"
import { ID_QUANTISE, TransformerQuantise } from "./transformers/transformer-quantise.ts"
import { tranformerFactory } from './transformer-factory'
import { applyTransformer, advanceTransformers, transformMidiControls } from './transformer-pipeline.ts'

import type { ITimerControl as Timer } from "netronome"
import type { FieldConfig, ITransformer } from "./transformers/interface-transformer.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"





export default class TransformerManagerWorker extends EventTarget implements ITransformer {

    public id: string = Transformer.getUniqueID()
    public name: string = 'TransformerManager'
    public timer: Timer | undefined

    #transformersMap: Map<string, Array<Transformer<any>>> = new Map()
    #transformers: Array<Transformer<any>> = []

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

    constructor(initialTransformers: Array<Transformer<any>> = [new TransformerHarmoniser()]) {
        super()
        this.setTransformers([...this.#transformers, ...(initialTransformers ?? [])])
    }




    /**
     * Append to the end of the queue the specified transformer
     */
    appendTransformer(transformerToAdd: Transformer<any>, dispatchEvents: boolean = true) {
        const collection: Transformer<any>[] = this.#transformersMap.has(transformerToAdd.type)
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
    removeTransformer(transformerToRemove: Transformer<any>, dispatchEvents: boolean = true) {
        transformerToRemove.destroy()
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
    setTransformers(transformers: Array<Transformer<any>>): void {
        for (const transformer of this.#transformers) {
            if (!transformers.includes(transformer)) transformer.destroy()
        }
        this.#transformers = []
        this.#transformersMap = new Map()
        transformers.forEach((transformer: Transformer<any>) => this.appendTransformer(transformer, false))
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
    getTransformers(): Array<Transformer<any>> {
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
     */
    async transform(commands: IAudioCommand[], timer: Timer): Promise<IAudioCommand[]> {
        try {
            return this.#transformers.reduce((value, transformer) => applyTransformer(transformer, value, timer), commands)
        } catch (error) {
            console.error('Transform error:', error)
            return commands
        }
    }



    /**
     * INTERFACE:
     * Reset the state of all Transformers
     */
    reset(): void {
        this.#transformers.forEach(t => t.reset?.())
    }

    advanceTime(now: number, timer: Timer): IAudioCommand[] {
        return advanceTransformers(this.#transformers, now, timer)
    }

    transformMidiControls(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {
        return transformMidiControls(this.#transformers, commands, timer)
    }

    exportConfig(): string {
        return JSON.stringify(this.#transformers.map(t => t.exportConfig()))
    }

    importData(encoded: string): void {
        try {
            const json = decompressFromBase64(encoded)

            if (!json) {
                throw new Error('Failed to decompress transformer data')
            }

            const configArray = JSON.parse(json)

            if (!Array.isArray(configArray)) {
                throw new Error('Invalid transformer configuration format')
            }

            this.importConfig(JSON.stringify(configArray))
        } catch (error) {
            console.error('Failed to import transformer data:', error)
            throw new Error(`Invalid transformer data: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    exportData(): string {
        const json = this.exportConfig()
        return compressToBase64(json)
    }

    importConfig(json: string): void {
        const configs = JSON.parse(json)
        if (!Array.isArray(configs)) throw new Error('Invalid transformer configuration')
        const transformers = configs.map(value => {
            const config = typeof value === 'string' ? JSON.parse(value) : value
            if (!config || typeof config.type !== 'string') throw new Error('Missing transformer type')
            const transformer = tranformerFactory(config.type, config)
            if (JSON.parse(transformer.exportConfig()).type !== config.type) {
                throw new Error(`Unknown transformer type: ${config.type}`)
            }
            return transformer
        })
        this.setTransformers(transformers)
    }

    clear(): void {
        this.#transformers.forEach(transformer => transformer.destroy())
        this.#transformers = []
        this.#transformersMap = new Map()
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.clear()
    }
}
