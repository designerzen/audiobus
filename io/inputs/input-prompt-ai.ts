import { EVENT_CHANGE, EVENT_CLICK } from '../../event-constants'
import NoteInput from './note-input'
import { devicePanel, numberControl, changed } from '../device-controls'
import { MIDI_NOTES_SCHEMA, promptBrowserAI, validateMidiNotes } from '../browser-ai'

export const PROMPT_AI_INPUT_ID = 'PromptAI'
const MODES = ['melody', 'bass', 'drums', 'chord']

export default class InputPromptAI extends NoteInput {
    private panel?: HTMLElement
    private request?: AbortController
    private playback = new Set<ReturnType<typeof setTimeout>>()
    private disposed = false
    get name(): string { return PROMPT_AI_INPUT_ID }
    get description(): string { return 'Describe a melody, bass line, drum pattern or chord using built-in browser AI' }

    constructor(options: Record<string, any> = {}) {
        super(options)
        this.options.prompt = String(options.prompt ?? '')
        this.options.mode = MODES.includes(options.mode) ? options.mode : 'melody'
        this.options.bpm = Number.isFinite(options.bpm) ? Math.max(30, Math.min(300, options.bpm)) : 120
        this.setAsConnected()
    }

    async createGui(): Promise<HTMLElement> {
        if (this.panel) return this.panel
        const panel = devicePanel()
        panel.classList.add('prompt-ai-panel')
        const container = document.createElement('div')
        container.className = 'prompt-ai-container'
        const help = document.createElement('p')
        help.textContent = 'Describe music in English. Runs on your device, without an API key. First use may download a browser model.'
        const label = document.createElement('label')
        label.textContent = 'Musical idea '
        const prompt = document.createElement('textarea')
        prompt.id = 'prompt-input'; prompt.rows = 4; prompt.value = this.options.prompt
        prompt.placeholder = 'A gentle descending melody in D minor'
        prompt.addEventListener(EVENT_CHANGE, () => { this.options.prompt = prompt.value; changed(this) })
        label.append(prompt)
        const modeLabel = document.createElement('label'), mode = document.createElement('select')
        modeLabel.textContent = 'Generate '
        for (const value of MODES) {
            const option = document.createElement('option'); option.value = value; option.textContent = value
            mode.append(option)
        }
        mode.value = this.options.mode
        mode.addEventListener(EVENT_CHANGE, () => { this.options.mode = mode.value; changed(this) })
        modeLabel.append(mode)
        const generate = document.createElement('button'), stop = document.createElement('button')
        generate.type = stop.type = 'button'
        generate.id = 'generate-sequence'; generate.textContent = 'Generate and play'
        stop.id = 'stop-generation'; stop.textContent = 'Stop'
        generate.addEventListener(EVENT_CLICK, () => { void this.generateSequenceFromPrompt(prompt.value) })
        stop.addEventListener(EVENT_CLICK, () => this.stopGeneration())
        const status = document.createElement('p'), notes = document.createElement('p')
        status.id = 'generation-status'; status.setAttribute('role', 'status'); notes.id = 'generated-notes'
        container.append(help, label, modeLabel)
        numberControl(container, 'Tempo (BPM)', this.options.bpm, 30, 300, value => { this.options.bpm = value; changed(this) })
        container.append(generate, stop, status, notes); panel.append(container)
        return this.panel = panel
    }

    async generateSequenceFromPrompt(prompt: string): Promise<void> {
        if (this.disposed) return
        this.stopGeneration()
        if (!prompt.trim()) { this.updateStatus('Please describe some music.', 'error'); return }
        this.options.prompt = prompt.slice(0, 4000); changed(this)
        const request = this.request = new AbortController()
        const mode = this.options.mode, bpm = this.options.bpm
        const button = this.panel?.querySelector<HTMLButtonElement>('#generate-sequence')
        if (button) button.disabled = true
        try {
            const response = await promptBrowserAI(
                `Return only a JSON array of 1-64 integer MIDI note numbers (0-127). Create a ${mode} from the following musical description. ` +
                (mode === 'drums' ? 'Use General MIDI percussion pitches. ' : '') +
                'Notes play in order as eighth notes, except chord mode plays all notes together. Description: ' + this.options.prompt,
                MIDI_NOTES_SCHEMA, request.signal, message => this.updateStatus(message))
            if (request.signal.aborted || this.disposed) return
            const notes = validateMidiNotes(response)
            const display = this.panel?.querySelector('#generated-notes')
            if (display) display.textContent = `MIDI notes: ${notes.join(', ')}`
            const stepMs = 30000 / bpm, channel = mode === 'drums' ? 10 : 1
            notes.forEach((note, index) => {
                const play = () => this.pulse(note, 100, stepMs * 0.85, channel)
                if (mode === 'chord' || index === 0) play()
                else {
                    const timer = setTimeout(() => { this.playback.delete(timer); play() }, index * stepMs)
                    this.playback.add(timer)
                }
            })
            this.updateStatus('Generated. Playing sequence.', 'success')
        } catch (error) {
            if (!request.signal.aborted) this.updateStatus(error instanceof Error ? error.message : String(error), 'error')
        } finally {
            if (this.request === request) { this.request = undefined; if (button) button.disabled = false }
        }
    }

    protected updateStatus(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
        const status = this.panel?.querySelector<HTMLElement>('#generation-status')
        if (status) { status.textContent = message; status.className = `status-message status-${type}` }
    }

    stopGeneration(): void {
        this.request?.abort(); this.request = undefined
        for (const timer of this.playback) clearTimeout(timer)
        this.playback.clear(); this.allNotesOff()
        const button = this.panel?.querySelector<HTMLButtonElement>('#generate-sequence')
        if (button) button.disabled = false
        this.updateStatus('Stopped')
    }
    stopClock(): void { this.stopGeneration() }
    async destroyGui(): Promise<void> { this.stopGeneration(); this.panel?.remove(); this.panel = undefined }
    async disconnect(): Promise<void> { this.stopGeneration(); await super.disconnect() }
    override destroy(): void { this.disposed = true; void this.destroyGui(); super.destroy() }
}
