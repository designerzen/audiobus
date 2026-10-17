import { KokoroTTS } from 'kokoro-js'
import { savedSpeech, saveSpeech } from './speech-audio-cache.ts'
import { pronounceSpeech, speechCacheKey, SPEECH_VOCABULARY } from './speech-vocabulary.ts'
import { SPEECH_AUDIO, SPEECH_ERROR, SPEECH_GENERATE, SPEECH_PRELOAD } from './speech-messages.ts'
import type { SpeechAudio } from './kokoro-speech.ts'

let model: Promise<KokoroTTS> | undefined
const foreground: { id: number; text: string }[] = []
const background = new Set<string>()
let busy = false

self.onmessage = ({ data }: MessageEvent<{ kind: string; id: number; text: string }>) => {
    if (data.kind === SPEECH_PRELOAD) {
        for (const text of SPEECH_VOCABULARY) background.add(text)
    } else if (data.kind === SPEECH_GENERATE) {
        foreground.push(data)
        background.delete(data.text)
    } else return
    void drain()
}

async function generate(text: string): Promise<SpeechAudio> {
    const key = speechCacheKey(text)
    let result = await savedSpeech(key)
    if (!result) {
        model ??= KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' })
        const tts = await model
        const generated = await tts.generate(pronounceSpeech(text), { voice: 'bf_emma', speed: 1.03 })
        result = { audio: generated.audio, sampling_rate: generated.sampling_rate }
        await saveSpeech(key, result)
    }
    return result
}

async function drain(): Promise<void> {
    if (busy) return
    busy = true
    try {
        while (foreground.length || background.size) {
            const request = foreground.shift()
            const text = request?.text ?? background.values().next().value!
            background.delete(text)
            try {
                const audio = await generate(text)
                self.postMessage({ kind: SPEECH_AUDIO, id: request?.id, text, ...audio })
            } catch (error) {
                model = undefined
                self.postMessage({ kind: SPEECH_ERROR, id: request?.id, error: String(error) })
                // Do not repeatedly download a model that is unavailable.
                background.clear()
            }
            // Let incoming live notes take priority over the next preload.
            await new Promise(resolve => setTimeout(resolve, 0))
        }
    } finally {
        busy = false
    }
}
