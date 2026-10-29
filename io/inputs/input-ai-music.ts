import NoteInput from './note-input'
import { AI_MODELS, AI_MODEL_INDEX_URL } from './ai-model-catalogue'
import { AI_IMPROV } from './input-types'
import { AI_MUSIC_GENERATE, AI_MUSIC_RESULT, AI_MUSIC_STATUS, AI_MUSIC_ERROR, validateMusicNotes } from './ai-music-messages'
import type { AIMusicNote, AIMusicResponse } from './ai-music-messages'
import { action, bounded, changed, devicePanel, numberControl } from '../device-controls'
import { EVENT_CHANGE } from '../../event-constants'

export function parseAIPrimer(value: string): number[] {
    const notes = value.trim().split(/[\s,]+/).filter(Boolean).map(Number)
    if (!notes.length || notes.length > 32 || !notes.every(note => Number.isInteger(note) && note >= 0 && note <= 127)) {
        throw new Error('Enter 1–32 MIDI notes (0–127), separated by commas or spaces.')
    }
    return notes
}

export default class InputAIMusic extends NoteInput {
    private worker?: Worker
    private requestId = 0
    private gui?: HTMLElement
    private statusElement?: HTMLElement
    private disposed = false
    private playing = false
    private previous?: number
    private position = 0
    private cycle = 0
    private cursor = 0
    private events: Array<{ step: number; note: AIMusicNote; on: boolean }> = []
    private active = new Set<AIMusicNote>()
    status = 'Generate a phrase, then use transport Play. First use downloads the selected model.'
    get model() { return AI_MODELS[this.options.modelId] }
    get name() { return this.model?.name ?? 'AI Music' }
    get description() { return this.model.description }

    constructor(options: Record<string, any> = {}) {
        super(options)
        this.options.modelId = options.modelId ?? AI_IMPROV
        if (!Object.hasOwn(AI_MODELS, this.options.modelId)) throw new Error('Unknown AI music model')
        this.options.primer = String(options.primer ?? (this.model.drums ? '36, 42, 38, 42' : '60, 64, 67, 72'))
        this.options.chords = String(options.chords ?? 'C, Am, F, G')
        this.options.temperature = bounded(options.temperature, 1, 0.1, 2)
        this.options.bpm = bounded(options.bpm, 120, 30, 300)
        this.options.steps = this.model.steps
        this.options.notes = options.notes === undefined || (Array.isArray(options.notes) && options.notes.length === 0)
            ? [] : validateMusicNotes(options.notes, this.model.steps)
        this.rebuildEvents()
        if (this.options.notes.length) this.status = 'Saved phrase ready. Use transport Play.'
        this.setAsConnected()
    }

    private setStatus(message: string): void {
        this.status = message
        if (this.statusElement) this.statusElement.textContent = message
    }
    private rebuildEvents(): void {
        this.events = (this.options.notes as AIMusicNote[]).flatMap(note => [
            { step: note.start, note, on: true }, { step: note.end, note, on: false },
        ]).sort((a, b) => a.step - b.step || Number(a.on) - Number(b.on))
    }

    generate(): void {
        if (this.disposed) return
        this.cancelGeneration(); this.stopClock()
        try {
            const seed = this.model.engine === 'rnn' ? parseAIPrimer(this.options.primer) : []
            const chords = String(this.options.chords).trim().split(/[\s,]+/).filter(Boolean)
            if (this.model.chords && (!chords.length || chords.length > 32 || chords.some(chord => chord.length > 24))) {
                throw new Error('Enter 1–32 chord symbols, such as C, Am, F, G.')
            }
            const worker = this.worker = new Worker(new URL('./ai-music.worker.ts', import.meta.url), { type: 'module' })
            const id = ++this.requestId
            worker.onmessage = ({ data }: MessageEvent<AIMusicResponse>) => {
                if (this.disposed || this.worker !== worker || data.id !== id) return
                if (data.kind === AI_MUSIC_STATUS) this.setStatus(data.status)
                else if (data.kind === AI_MUSIC_ERROR) { this.setStatus(`Generation failed: ${data.error}. Generate again to retry.`); this.cancelGeneration() }
                else if (data.kind === AI_MUSIC_RESULT) {
                    try {
                        if (data.steps !== this.model.steps) throw new Error('Unexpected phrase length')
                        const notes = validateMusicNotes(data.notes, data.steps)
                        this.stopClock(); this.options.notes = notes; this.rebuildEvents(); changed(this)
                        this.setStatus(`${notes.length} notes ready. Use transport Play.` + (this.model.trio ? ' Melody, bass and drums use channels 1, 2 and 10.' : ''))
                    } catch (error) { this.setStatus(`Generation failed: ${error instanceof Error ? error.message : String(error)}`) }
                    this.cancelGeneration()
                }
            }
            worker.onerror = () => {
                if (this.worker !== worker) return
                this.setStatus('The AI worker failed to load. Check your connection and generate again.'); this.cancelGeneration()
            }
            this.setStatus(`Preparing ${this.model.name}…`)
            worker.postMessage({ kind: AI_MUSIC_GENERATE, id, modelId: this.model.id, seed, chords, temperature: this.options.temperature })
        } catch (error) { this.cancelGeneration(); this.setStatus(error instanceof Error ? error.message : String(error)) }
    }
    private cancelGeneration(): void { this.requestId++; this.worker?.terminate(); this.worker = undefined }
    stop(): void { this.cancelGeneration(); this.stopClock(); this.setStatus('Stopped. Saved phrase can be played again.') }
    startClock(): void { this.stopClock(); this.playing = true }
    stopClock(): void {
        this.allNotesOff(); this.active.clear(); this.playing = false; this.previous = undefined
        this.position = 0; this.cursor = 0; this.cycle = 0
    }
    updateTime(now: number): void {
        if (!this.playing || !this.isConnected || !Number.isFinite(now) || !this.events.length) return
        const bpm = bounded(this.options.getBpm?.(), this.options.bpm, 30, 300)
        this.position += this.previous === undefined ? 0 : Math.max(0, now - this.previous) * bpm / 60 * 4
        this.previous = now
        const cycle = Math.floor((this.position + 1e-8) / this.model.steps)
        if (cycle !== this.cycle) { this.allNotesOff(); this.active.clear(); this.cursor = 0; this.cycle = cycle }
        const step = Math.max(0, this.position - cycle * this.model.steps)
        while (this.cursor < this.events.length && this.events[this.cursor].step <= step + 1e-8) {
            const { note, on } = this.events[this.cursor++]
            if (on && note.end > step) { this.active.add(note); this.noteOn(note.pitch, note.velocity, note.channel) }
            else if (!on && this.active.delete(note)) this.noteOff(note.pitch, note.channel)
        }
    }

    async createGui(): Promise<HTMLElement> {
        if (this.gui) return this.gui
        const panel = devicePanel(), help = document.createElement('p'), status = document.createElement('p')
        help.textContent = `${this.model.description} Runs locally in a worker after an initial download of about ${this.model.sizeMB} MB. No API key. Generate first, then use transport Play / Stop.`
        status.setAttribute('role', 'status'); status.textContent = this.status; this.statusElement = status
        panel.append(help)
        const text = (title: string, key: string) => {
            const label = document.createElement('label'), input = document.createElement('input')
            input.type = 'text'; input.value = this.options[key]; label.append(`${title} `, input)
            input.addEventListener(EVENT_CHANGE, () => { this.options[key] = input.value.slice(0, 1000); changed(this) })
            panel.append(label)
        }
        if (this.model.engine === 'rnn') text('Primer (MIDI notes)', 'primer')
        if (this.model.chords) text('Chord progression', 'chords')
        numberControl(panel, 'Creativity', this.options.temperature, 0.1, 2, value => { this.options.temperature = value; changed(this) }, 0.1)
        numberControl(panel, 'Tempo (BPM; follows shared transport when available)', this.options.bpm, 30, 300, value => { this.options.bpm = value; changed(this) })
        action(panel, 'Generate phrase', () => this.generate(), status)
        action(panel, 'Cancel generation / stop notes', () => this.stop(), status)
        panel.append(status)
        const attribution = document.createElement('p')
        attribution.className = 'ai-model-attribution'
        attribution.append(`By ${this.model.attribution.author}. `)
        const link = (label: string, url: string) => {
            const anchor = document.createElement('a'); anchor.textContent = label; anchor.href = url
            anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; attribution.append(anchor, ' ')
        }
        link('Source', this.model.attribution.sourceUrl)
        link('Model and checkpoint credits', AI_MODEL_INDEX_URL)
        link(this.model.attribution.license, this.model.attribution.licenseUrls[0])
        link('Checkpoint configuration', `${this.model.checkpoint}/config.json`)
        panel.append(attribution)
        return this.gui = panel
    }
    async destroyGui(): Promise<void> { this.stop(); this.gui?.remove(); this.gui = undefined; this.statusElement = undefined }
    async disconnect(): Promise<void> { this.stop(); await super.disconnect() }
    destroy(): void { this.disposed = true; void this.destroyGui(); super.destroy() }
}
