import { EVENT_AUDIO_VIZ_READY } from "../../event-constants.ts"
import { instrumentNote, type InstrumentNote } from "./instrument.ts"
import type { CanvasAudioViz } from "../visualisers/audio-viz/audio-viz.ts"
import { registerAudioContextOutput } from "./audio-context-output.ts"

/** Fan out engine activity to passive renderers, independently of controller input. */
export function bindAudioVisualisers(root: Document) {
    const registered = new Set<CanvasAudioViz>()
    const active = new Map<string, { note: InstrumentNote; velocity: number; id: number }>()
    let context: BaseAudioContext | undefined
    const register = () => {
        const current = new Set(root.querySelectorAll<CanvasAudioViz>("[data-audio-viz]"))
        for (const viz of registered)
            if (!current.has(viz)) {
                viz.disconnectSource()
                registered.delete(viz)
            }
        for (const viz of current) {
            if (registered.has(viz) || typeof viz.connectSource !== "function") continue
            registered.add(viz)
            if (context && !viz.audioContext) viz.audioContext = context
            for (const voice of active.values()) viz.noteOn(voice.note, voice.velocity, 0, voice.id)
        }
    }
    const observer = new MutationObserver(register)
    observer.observe(root.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["data-audio-viz"],
    })
    const ready = (event: Event) => {
        registered.delete(event.target as CanvasAudioViz)
        register()
    }
    root.addEventListener(EVENT_AUDIO_VIZ_READY, ready)
    register()
    return {
        connectSource(audioContext: BaseAudioContext, node: AudioNode) {
            context = audioContext
            registerAudioContextOutput(audioContext, node)
            for (const viz of registered) viz.audioContext = audioContext
        },
        noteOn(input: InstrumentNote | number, velocity = 1, id = 0) {
            const note = instrumentNote(input)
            active.set(`${id}:${note.noteNumber}`, { note, velocity, id })
            for (const viz of registered) viz.noteOn(input, velocity, 0, id)
        },
        noteOff(input: InstrumentNote | number, velocity = 0, id = 0) {
            const note = instrumentNote(input)
            active.delete(`${id}:${note.noteNumber}`)
            for (const viz of registered) viz.noteOff(input, velocity, 0, id)
        },
        dispose() {
            observer.disconnect()
            root.removeEventListener(EVENT_AUDIO_VIZ_READY, ready)
            for (const viz of registered) {
                viz.disconnectSource()
                viz.clearActiveNotes()
            }
            registered.clear()
            active.clear()
            context = undefined
        },
    }
}