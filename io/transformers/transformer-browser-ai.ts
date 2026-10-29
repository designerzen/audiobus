import { TransformerNoteMapper } from './transformer-note-mapper'
import type { Settings } from './performance-transformer'
import type { FieldConfig } from './interface-transformer'
import { promptBrowserAI } from '../browser-ai'

export const ID_BROWSER_AI = 'Browser-AI-Harmony'
const SCHEMA = { type: 'array', minItems: 12, maxItems: 12, items: {
    type: 'array', minItems: 1, maxItems: 4, items: { type: 'integer', minimum: -24, maximum: 24 },
} }

export function harmonyMapping(value: unknown): string {
    if (!Array.isArray(value) || value.length !== 12 || !value.every(intervals =>
        Array.isArray(intervals) && intervals.length >= 1 && intervals.length <= 4 &&
        intervals.every(interval => Number.isInteger(interval) && interval >= -24 && interval <= 24))) {
        throw new Error('AI must return twelve pitch-class voicings with 1–4 integer intervals between -24 and 24.')
    }
    return Array.from({ length: 128 }, (_, pitch) => {
        const targets = [...new Set<number>([pitch, ...value[pitch % 12].map((interval: number) => pitch + interval)])]
            .filter(target => target >= 0 && target <= 127)
        return `${pitch}:${targets.join('+')}`
    }).join('; ')
}

/** Inference runs only on explicit preparation; live MIDI uses the saved note map. */
export class TransformerBrowserAI extends TransformerNoteMapper {
    protected type = ID_BROWSER_AI
    category = 'Harmony'
    status = 'Describe a harmony, then click Generate harmony. First use may download a browser model.'
    private request?: AbortController
    private disposed = false
    get name() { return 'Browser AI Harmony' }
    get description() { return 'Describe harmonies in English, then play them live using a locally generated note map.' }
    get fields(): FieldConfig[] {
        return [
            ...super.fields.filter(field => !['mapping', 'output', 'unmatched'].includes(field.name)),
            { name: 'prompt', label: 'Harmony description', type: 'text', enabled: true, values: [],
                default: String(this.options?.prompt ?? 'Gentle diatonic triads in C major'),
                help: 'Generate again after editing. Live notes continue through while AI prepares the harmony.' },
            { name: 'generateHarmony', label: 'Generate harmony', type: 'button', enabled: true, values: [],
                help: 'Uses built-in browser AI without an API key. The generated map is saved with this transformer.' },
        ]
    }
    constructor(config: Settings = {}) {
        super({ ...config, mapping: config.mapping ?? '', output: 'notes', unmatched: 'pass' })
        this.config.prompt = String(config.prompt ?? 'Gentle diatonic triads in C major')
        if (this.config.mapping) this.status = 'Saved harmony ready. Play notes, or generate a new harmony.'
    }
    override setConfig(key: string, value: unknown): void | Promise<void> {
        if (key === 'generateHarmony') return this.prepareHarmony()
        if (key === 'prompt') {
            this.request?.abort(); this.request = undefined
            value = String(value).slice(0, 4000)
        }
        super.setConfig(key, value)
    }
    async prepareHarmony(): Promise<void> {
        if (this.disposed) return
        this.request?.abort()
        const request = this.request = new AbortController()
        try {
            const response = await promptBrowserAI(
                'Return a JSON array of exactly 12 arrays, ordered by input pitch class C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B. ' +
                'Each array has 1–4 integer semitone intervals (-24 to 24) above or below that input note to form a harmony. ' +
                'The original note is always retained. Choose intervals according to this description: ' + this.config.prompt,
                SCHEMA, request.signal, message => { this.status = message })
            if (request.signal.aborted || this.disposed) return
            this.setConfig('mapping', harmonyMapping(response))
            this.status = 'Harmony ready. Play notes to hear it.'
        } catch (error) {
            if (!request.signal.aborted) this.status = `Harmony generation failed: ${error instanceof Error ? error.message : String(error)} Click Generate harmony to retry.`
        } finally {
            if (this.request === request) this.request = undefined
        }
    }
    override reset(): void { this.request?.abort(); this.request = undefined; super.reset() }
    override destroy(): void { this.disposed = true; super.destroy() }
}
