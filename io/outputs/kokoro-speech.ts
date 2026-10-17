import { SPEECH_AUDIO, SPEECH_ERROR, SPEECH_GENERATE, SPEECH_PRELOAD } from './speech-messages.ts'
import { SPEECH_VOCABULARY } from './speech-vocabulary.ts'

export interface SpeechAudio {
    audio: Float32Array
    sampling_rate: number
}

/** Inference and persistent caching run off the main thread. */
export class KokoroSpeech {
    private worker?: Worker
    private id = 0
    private pending = new Map<number, { resolve: (audio: SpeechAudio) => void; reject: (error: Error) => void }>()
    private cached = new Map<string, SpeechAudio>()
    private requests = new Map<string, Promise<SpeechAudio>>()
    private preloading = false

    preload(): void {
        if (this.preloading || typeof Worker === 'undefined') return
        this.startWorker()
        this.worker!.postMessage({ kind: SPEECH_PRELOAD })
        this.preloading = true
    }

    generate(text: string): Promise<SpeechAudio> {
        const cached = this.cached.get(text)
        if (cached) return Promise.resolve(cached)
        const existing = this.requests.get(text)
        if (existing) return existing
        this.startWorker()
        const request = new Promise<SpeechAudio>((resolve, reject) => {
            const id = ++this.id
            this.pending.set(id, { resolve, reject })
            this.worker!.postMessage({ kind: SPEECH_GENERATE, id, text })
        }).then(audio => {
            this.remember(text, audio)
            this.requests.delete(text)
            return audio
        }, error => {
            this.requests.delete(text)
            throw error
        })
        this.requests.set(text, request)
        return request
    }

    private remember(text: string, audio: SpeechAudio): void {
        // Keep the vocabulary resident, plus a bounded number of custom phrases.
        if (this.cached.size >= SPEECH_VOCABULARY.length + 128) {
            const custom = [...this.cached.keys()].find(key => !SPEECH_VOCABULARY.includes(key))
            if (custom) this.cached.delete(custom)
        }
        this.cached.set(text, audio)
    }

    private startWorker(): void {
        if (this.worker) return
        this.worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' })
        this.worker.onmessage = ({ data }) => {
            if (data.kind === SPEECH_AUDIO) this.remember(data.text, { audio: data.audio, sampling_rate: data.sampling_rate })
            const pending = this.pending.get(data.id)
            if (!pending) return
            this.pending.delete(data.id)
            if (data.kind === SPEECH_ERROR) pending.reject(new Error(data.error))
            else pending.resolve(data)
        }
        this.worker.onerror = () => this.dispose()
    }

    dispose(): void {
        this.worker?.terminate()
        this.worker = undefined
        this.preloading = false
        for (const pending of this.pending.values()) pending.reject(new Error('Voice worker stopped'))
        this.pending.clear()
        this.requests.clear()
        this.cached.clear()
    }
}
