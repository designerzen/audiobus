import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON, PITCH_BEND, PROGRAM_CHANGE } from "../../commands.ts"
import { EVENT_INSTRUMENT_CHANGE, EVENT_INSTRUMENT_DISCONNECT } from "../../event-constants.ts"
import {
    instrumentNote,
    noteDetail,
    type InstrumentEventMap,
    type InstrumentInterface,
    type InstrumentNote,
    type NoteDetail,
} from "./instrument.ts"

type AudioController = HTMLElement & Partial<InstrumentInterface>
interface Voice {
    note: InstrumentNote
    id: number
    detail: NoteDetail
}
interface Registration {
    abort: AbortController
    voices: Map<string, Voice>
    bends: Map<string, InstrumentEventMap["pitchBend"]["detail"]>
    definition?: PendingDefinition
}
interface PendingDefinition {
    callback?: () => void
}
function finishDefinition(pending: PendingDefinition) {
    const callback = pending.callback
    pending.callback = undefined
    callback?.()
}
function cancelDefinition(pending: PendingDefinition) {
    pending.callback = undefined
}
export interface AudioControllerHandlers {
    noteOn(note: InstrumentNote, velocity: number, id: number): unknown
    noteOff(note: InstrumentNote, velocity: number, id: number): unknown
    /** Adapt to the application's richer Note model once, preserving identity through noteOff. */
    createNote?(note: InstrumentNote): InstrumentNote
    pitchBend?(detail: InstrumentEventMap["pitchBend"]["detail"], voiceIds: number[]): void
    controlChange?(detail: InstrumentEventMap["controlChange"]["detail"], voiceIds: number[]): void
    programChange?(detail: InstrumentEventMap["programChange"]["detail"], signal: AbortSignal): void
    instrumentChange?(detail: InstrumentEventMap["instrumentChange"]["detail"]): void
    onError?(error: unknown): void
}

/** Connect marked controllers to one audio engine and distribute silent note feedback. */
export function bindAudioControllers(
    elements: Iterable<Element>,
    handlers: AudioControllerHandlers,
) {
    const registrations = new Map<AudioController, Registration>()
    const activity = new Map<string, InstrumentNote>()
    const freeIds: number[] = []
    // Existing mouse/touch/MIDI voices use nonnegative IDs. Reuse our negative IDs.
    let nextId = -1
    let observer: MutationObserver | undefined
    let observedRoot: Document | undefined
    let disposed = false
    const isEligible = (element: AudioController) =>
        !observedRoot ||
        (element.isConnected &&
            element.ownerDocument === observedRoot &&
            element.hasAttribute("data-audio-controller"))
    const report = (error: unknown) => {
        if (handlers.onError) handlers.onError(error)
        else console.error(error)
    }
    const snapshot = () => [
        ...new Map([...activity.values()].map((note) => [note.noteNumber, note])).values(),
    ]
    const update = (element: AudioController) => {
        if (!isEligible(element)) {
            unregister(element)
            return
        }
        try {
            element.setActiveNotes?.(snapshot())
        } catch (error) {
            report(error)
        }
    }
    const broadcast = () => {
        for (const element of registrations.keys()) update(element)
    }
    const voiceKey = (detail: NoteDetail) => `${detail.group}:${detail.channel}:${detail.id}`
    const release = (registration: Registration, key: string, velocity = 0) => {
        const voice = registration.voices.get(key)
        if (!voice) return
        registration.voices.delete(key)
        try {
            handlers.noteOff(voice.note, velocity, voice.id)
        } catch (error) {
            report(error)
        } finally {
            freeIds.push(voice.id)
            activity.delete(`${voice.id}:${voice.note.noteNumber}`)
            broadcast()
        }
    }
    const unregister = (element: AudioController) => {
        const registration = registrations.get(element)
        if (!registration) return
        registrations.delete(element)
        registration.abort.abort()
        if (registration.definition) cancelDefinition(registration.definition)
        registration.definition = undefined
        registration.bends.clear()
        for (const key of registration.voices.keys()) release(registration, key)
        try {
            element.clearActiveNotes?.()
        } catch (error) {
            report(error)
        }
    }
    const register = (element: AudioController) => {
        if (disposed || registrations.has(element) || !isEligible(element)) return
        const registration: Registration = {
            abort: new AbortController(),
            voices: new Map(),
            bends: new Map(),
        }
        registrations.set(element, registration)
        element.addEventListener(
            EVENT_INSTRUMENT_DISCONNECT,
            (event) => {
                if (event.composedPath()[0] === element) unregister(element)
            },
            { signal: registration.abort.signal },
        )
        for (const type of [
            NOTE_ON,
            NOTE_OFF,
            PITCH_BEND,
            CONTROL_CHANGE,
            PROGRAM_CHANGE,
            EVENT_INSTRUMENT_CHANGE,
        ] as const) {
            element.addEventListener(
                type,
                (event: Event) => {
                    // A nested marked controller owns its own events; do not play them twice.
                    if (event.composedPath()[0] !== element || !(event instanceof CustomEvent))
                        return
                    if (!isEligible(element)) {
                        unregister(element)
                        return
                    }
                    try {
                        if (type === "noteOn" || type === "noteOff") {
                            const input = event.detail as NoteDetail
                            const detail = noteDetail(
                                type,
                                input.note,
                                input.velocity,
                                input.id,
                                input,
                            )
                            const key = voiceKey(detail)
                            if (type === "noteOff") {
                                if (
                                    registration.voices.get(key)?.note.noteNumber ===
                                    detail.note.noteNumber
                                )
                                    release(registration, key, detail.velocity)
                            } else {
                                release(registration, key)
                                const note = handlers.createNote?.(detail.note) ?? detail.note
                                const id = freeIds.pop() ?? nextId--
                                registration.voices.set(key, { note, id, detail })
                                try {
                                    handlers.noteOn(note, detail.velocity, id)
                                    // A reusable audio voice must not inherit another controller's bend.
                                    const bend = registration.bends.get(
                                        `${detail.group}:${detail.channel}`,
                                    ) ?? {
                                        group: detail.group,
                                        channel: detail.channel,
                                        value: 0,
                                        value32: 0x80000000,
                                        ump: [
                                            0x40000000 |
                                                (detail.group << 24) |
                                                (0xe << 20) |
                                                (detail.channel << 16),
                                            0x80000000,
                                        ] as const,
                                    }
                                    handlers.pitchBend?.(bend, [id])
                                } catch (error) {
                                    release(registration, key)
                                    throw error
                                }
                            }
                        } else {
                            const detail = event.detail
                            const ids = [...registration.voices.values()]
                                .filter(
                                    (voice) =>
                                        voice.detail.group === detail.group &&
                                        voice.detail.channel === detail.channel,
                                )
                                .map((voice) => voice.id)
                            if (type === "pitchBend") {
                                registration.bends.set(`${detail.group}:${detail.channel}`, detail)
                                handlers.pitchBend?.(detail, ids)
                            }
                            if (type === "controlChange") handlers.controlChange?.(detail, ids)
                            if (type === "programChange")
                                handlers.programChange?.(detail, registration.abort.signal)
                            if (type === "instrumentChange") handlers.instrumentChange?.(detail)
                        }
                    } catch (error) {
                        report(error)
                    }
                },
                { signal: registration.abort.signal },
            )
        }
        update(element)
        // A marked custom element can exist before its module finishes loading.
        if (element.localName.includes("-") && !customElements.get(element.localName)) {
            // whenDefined cannot be canceled. Clear its callback on teardown so the
            // unresolved promise retains neither this element nor the audio binding.
            const pending: PendingDefinition = {
                callback: () => {
                    if (registrations.get(element) === registration) update(element)
                    registration.definition = undefined
                },
            }
            registration.definition = pending
            void customElements
                .whenDefined(element.localName)
                .then(finishDefinition.bind(null, pending), cancelDefinition.bind(null, pending))
        }
    }
    for (const element of elements) register(element as AudioController)
    return {
        /** Call from the central noteOn/noteOff callbacks, including keyboard and MIDI inputs. */
        setActiveNote(note: InstrumentNote | number, active = true, id = 0) {
            if (disposed) return
            const model = instrumentNote(note)
            const key = `${id}:${model.noteNumber}`
            if (active) activity.set(key, model)
            else activity.delete(key)
            broadcast()
        },
        observe(root: Document) {
            if (disposed) return
            observer?.disconnect()
            observedRoot = root
            const refresh = () => {
                if (disposed) return
                const marked = new Set(
                    root.querySelectorAll<AudioController>("[data-audio-controller]"),
                )
                for (const element of registrations.keys())
                    if (!marked.has(element)) unregister(element)
                for (const element of marked) register(element)
            }
            refresh()
            observer = new MutationObserver(refresh)
            observer.observe(root.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["data-audio-controller"],
            })
        },
        dispose() {
            disposed = true
            observer?.disconnect()
            observer = undefined
            for (const element of registrations.keys()) unregister(element)
            activity.clear()
            observedRoot = undefined
        },
    }
}