import { CONTROL_CHANGE } from "../../commands.ts"
import { EVENT_BLUR, EVENT_CHANGE, EVENT_FOCUS_OUT, EVENT_INSTRUMENT_CHANGE, EVENT_INSTRUMENT_DISCONNECT, EVENT_KEY_DOWN, EVENT_KEY_UP, EVENT_PAGE_HIDE, EVENT_POINTER_DOWN, EVENT_POINTER_MOVE, EVENT_VISIBILITY_CHANGE } from "../../event-constants.ts"
import {
    dispatchInstrumentEvent,
    instrumentEvents,
    instrumentNote,
    midi2Header,
    noteDetail,
    range,
    type InstrumentInterface,
    type InstrumentEventMap,
    type InstrumentNote,
    type NoteDetail,
    type UMP64,
} from "../interfaces/instrument.ts"
import { PatchController } from "./patch-controller.ts"

interface Gesture {
    pad: SVGElement | null
    ids: number[]
}
let voiceId = 0

/** Shared silent chord gestures, event protocol, feedback and lifecycle. */
export abstract class ChordController extends PatchController implements InstrumentInterface {
    static observedAttributes = [
        "octave",
        "mode",
        "scale",
        ...PatchController.observedAttributes,
        "group",
        "channel",
        "disabled",
        "muted",
    ]
    declare addEventListener: (<K extends keyof InstrumentEventMap>(
        type: K,
        listener: (event: InstrumentEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions,
    ) => void) &
        HTMLElement["addEventListener"]
    protected root = this.attachShadow({ mode: "open" })
    private listeners?: AbortController
    protected held = new Map<number, NoteDetail>()
    protected activeNotes = new Set<number>()
    private references = new Map<number, number>()
    private gestures = new Map<string, Gesture>()

    get octave() {
        return this.numberAttribute("octave", 4, 0, 8)
    }
    set octave(value: number) {
        this.setAttribute("octave", String(range(value, 0, 8, "octave", true)))
    }
    get mode() {
        return this.numberAttribute("mode", 0, 0, 6)
    }
    set mode(value: number) {
        this.setAttribute("mode", String(range(value, 0, 6, "mode", true)))
    }
    get scale(): "Major" | "Minor" {
        return this.getAttribute("scale")?.toLowerCase() === "minor" ? "Minor" : "Major"
    }
    set scale(value: "Major" | "Minor") {
        this.setAttribute("scale", value)
    }
    get group() {
        return this.numberAttribute("group", 0, 0, 15)
    }
    set group(value: number) {
        this.setAttribute("group", String(range(value, 0, 15, "group", true)))
    }
    get channel() {
        return this.numberAttribute("channel", 0, 0, 15)
    }
    set channel(value: number) {
        this.setAttribute("channel", String(range(value, 0, 15, "channel", true)))
    }
    get disabled() {
        return this.hasAttribute("disabled")
    }
    set disabled(value: boolean) {
        this.toggleAttribute("disabled", value)
    }
    get muted() {
        return this.hasAttribute("muted")
    }
    set muted(value: boolean) {
        this.toggleAttribute("muted", value)
    }

    private numberAttribute(name: string, fallback: number, min: number, max: number) {
        const text = this.getAttribute(name)
        const value = text === null || !text.trim() ? fallback : Number(text)
        return Number.isInteger(value) && value >= min && value <= max ? value : fallback
    }

    connectedCallback() {
        super.connectedCallback()
        if (!this.root.childElementCount) this.render()
        this.listeners?.abort()
        this.listeners = new AbortController()
        const options = { signal: this.listeners.signal }
        const svg = this.root.querySelector("svg")!
        svg.addEventListener(
            EVENT_POINTER_DOWN,
            (event) => {
                if (this.disabled || event.button !== 0) return
                const pad = (event.target as Element).closest<SVGElement>("[data-pad]")
                if (!pad) return
                event.preventDefault()
                pad.focus()
                svg.setPointerCapture(event.pointerId)
                this.begin(`pointer:${event.pointerId}`, pad, this.pressure(event))
            },
            options,
        )
        svg.addEventListener(
            EVENT_POINTER_MOVE,
            (event) => {
                const token = `pointer:${event.pointerId}`
                const gesture = this.gestures.get(token)
                if (!gesture) return
                const hit = this.root.elementFromPoint(event.clientX, event.clientY)
                const pad = hit?.closest<SVGElement>("[data-pad]") ?? null
                if (pad !== gesture.pad) {
                    this.end(token)
                    this.begin(token, pad, this.pressure(event))
                }
            },
            options,
        )
        for (const name of ["pointerup", "pointercancel", "lostpointercapture"] as const)
            svg.addEventListener(
                name,
                (event) => {
                    const token = `pointer:${event.pointerId}`
                    const pad = this.gestures.get(token)?.pad
                    if (name !== "pointerup" && pad) this.end(`latched:${pad.dataset.pad}`)
                    this.end(token)
                },
                options,
            )
        this.root.addEventListener(
            EVENT_KEY_DOWN,
            (event) => {
                const key = event as KeyboardEvent
                const pad = (key.target as Element).closest<SVGElement>("[data-pad]")
                if (!pad || !["Enter", " "].includes(key.key) || this.disabled) return
                key.preventDefault()
                if (!key.repeat) this.begin(`key:${key.code}`, pad, 1)
            },
            options,
        )
        this.root.addEventListener(
            EVENT_KEY_UP,
            (event) => {
                const key = event as KeyboardEvent
                if (!["Enter", " "].includes(key.key)) return
                if (this.gestures.has(`key:${key.code}`)) key.preventDefault()
                this.end(`key:${key.code}`)
            },
            options,
        )
        this.root.addEventListener(
            EVENT_FOCUS_OUT,
            (event) => {
                for (const [token, gesture] of this.gestures)
                    if (token.startsWith("key:") && gesture.pad === event.target) this.end(token)
            },
            options,
        )
        this.root.addEventListener(
            EVENT_CHANGE,
            (event) => {
                const input = event.target as HTMLInputElement
                const name = input.dataset.control
                if (name) this.setAttribute(name, input.value)
            },
            options,
        )
        this.connectControls(options)
        window.addEventListener(EVENT_BLUR, () => this.stop(), options)
        window.addEventListener(EVENT_PAGE_HIDE, () => this.stop(), options)
        document.addEventListener(
            EVENT_VISIBILITY_CHANGE,
            () => {
                if (document.hidden) this.stop()
            },
            options,
        )
        this.update()
    }

    disconnectedCallback() {
        this.listeners?.abort()
        this.listeners = undefined
        dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
        this.stop()
        this.clearActiveNotes()
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
        if (oldValue === newValue) return
        if (!this.root.childElementCount) {
            super.attributeChangedCallback(name, oldValue, newValue)
            return
        }
        // Release using the original note/address before reflecting a new setting.
        this.stop()
        this.update()
        super.attributeChangedCallback(name, oldValue, newValue)
        if (!this.isConnected) return
        if (name === "octave" || name === "mode" || name === "scale")
            dispatchInstrumentEvent(this, EVENT_INSTRUMENT_CHANGE, { control: name, value: this[name] })
    }

    /** Silent display API used by the central engine and other instruments. */
    setActiveNote(note: InstrumentNote | number, active = true) {
        const number = instrumentNote(note).noteNumber
        if (active) this.activeNotes.add(number)
        else this.activeNotes.delete(number)
        this.updatePressed()
    }

    setActiveNotes(notes: Iterable<InstrumentNote | number>) {
        this.activeNotes = new Set([...notes].map((note) => instrumentNote(note).noteNumber))
        this.updatePressed()
    }

    clearActiveNotes() {
        this.activeNotes.clear()
        this.updatePressed()
    }

    noteOn(note: InstrumentNote | number, velocity = 1, id = 0) {
        if (this.disabled || this.muted || !this.isConnected) return
        const detail = noteDetail("noteOn", note, velocity, id, this.address())
        const previous = this.held.get(id)
        if (previous) this.noteOff(previous.note, 0, id)
        this.held.set(id, detail)
        this.updatePressed()
        dispatchInstrumentEvent(this, instrumentEvents.noteOn, detail)
    }

    noteOff(note: InstrumentNote | number, velocity = 0, id = 0) {
        const original = this.held.get(id)
        if (!original || original.note.noteNumber !== instrumentNote(note).noteNumber) return
        const detail = noteDetail("noteOff", original.note, velocity, id, original)
        this.held.delete(id)
        this.updatePressed()
        dispatchInstrumentEvent(this, instrumentEvents.noteOff, detail)
    }

    pitchBend(value: number) {
        range(value, -1, 1, "pitch bend")
        const value32 = Math.round(
            value < 0 ? (value + 1) * 0x80000000 : 0x80000000 + value * 0x7fffffff,
        )
        const address = this.address()
        const ump: UMP64 = Object.freeze([midi2Header(0xe, address), value32])
        dispatchInstrumentEvent(this, instrumentEvents.pitchBend, {
            ...address,
            value,
            value32,
            ump,
        })
    }

    controlChange(controller: number, value: number) {
        range(controller, 0, 127, "controller", true)
        range(value, 0, 1, "controller value")
        // These compound MIDI 1.0 controls have dedicated MIDI 2.0 messages.
        if ([0, 6, 32, 38, 88, 98, 99, 100, 101].includes(controller))
            throw new RangeError(
                "Use MIDI 2.0 Program Change, RPN/NRPN or note velocity for this controller",
            )
        if (controller >= 120)
            throw new RangeError(
                "Channel mode messages need discrete values; this method accepts continuous controls 0–119",
            )
        const address = this.address()
        const value32 = Math.round(value * 0xffffffff)
        const ump: UMP64 = Object.freeze([
            (midi2Header(0xb, address) | (controller << 8)) >>> 0,
            value32,
        ])
        dispatchInstrumentEvent(this, CONTROL_CHANGE, {
            ...address,
            controller,
            value,
            value32,
            ump,
        })
    }

    stop() {
        const svg = this.root.querySelector("svg")
        for (const token of this.gestures.keys()) {
            if (!token.startsWith("pointer:")) continue
            const pointer = Number(token.slice(8))
            if (svg?.hasPointerCapture(pointer)) svg.releasePointerCapture(pointer)
        }
        this.gestures.clear()
        this.references.clear()
        for (const [id, detail] of this.held) this.noteOff(detail.note, 0, id)
        this.updatePressed()
    }

    private address() {
        return { group: this.group, channel: this.channel }
    }
    private pressure(event: PointerEvent) {
        return event.pointerType === "mouse" || event.pressure <= 0 ? 1 : event.pressure
    }

    /** Subclasses can opt into sustained gestures without replacing input/lifecycle handling. */
    protected get holdBehavior(): "hold" | "toggle" | "latch" {
        return "hold"
    }

    protected gestureVelocity(velocity: number, _pad: SVGElement) {
        return velocity
    }

    protected gestureChord(root: number, pad: SVGElement) {
        return this.chord(root, pad)
    }

    private begin(token: string, pad: SVGElement | null, velocity: number) {
        if (this.gestures.has(token) || this.disabled || this.muted) return
        if (this.holdBehavior === "hold") {
            this.start(token, pad, velocity)
            return
        }
        // Keep a physical gesture for drag tracking. Its sustained partner owns the notes.
        this.gestures.set(token, { pad, ids: [] })
        if (!pad) return
        const sustained = `latched:${pad.dataset.pad}`
        if (this.gestures.has(sustained)) {
            if (this.holdBehavior === "toggle") this.end(sustained)
            return
        }
        if (this.holdBehavior === "latch")
            for (const key of this.gestures.keys()) if (key.startsWith("latched:")) this.end(key)
        this.start(sustained, pad, velocity)
    }

    private start(token: string, pad: SVGElement | null, velocity: number) {
        if (this.disabled || this.muted || !this.isConnected) return
        const gesture: Gesture = { pad, ids: [] }
        this.gestures.set(token, gesture)
        if (!pad) return
        const attack = this.gestureVelocity(velocity, pad)
        for (const note of this.gestureChord(Number(pad.dataset.note), pad)) {
            if (this.gestures.get(token) !== gesture || !this.isConnected) break
            // A MIDI channel addresses notes by pitch, not application voice ID.
            // Share overlapping chord tones until the last gesture releases them.
            const existing = [...this.held.values()].find(
                (detail) =>
                    detail.note.noteNumber === note &&
                    detail.group === this.group &&
                    detail.channel === this.channel,
            )
            const id = existing?.id ?? ++voiceId
            gesture.ids.push(id)
            this.references.set(id, (this.references.get(id) ?? 0) + 1)
            if (!existing) this.noteOn(note, attack, id)
        }
        this.updatePressed()
    }

    private end(token: string) {
        const gesture = this.gestures.get(token)
        if (!gesture) return
        this.gestures.delete(token)
        for (const id of gesture.ids) {
            const references = (this.references.get(id) ?? 1) - 1
            if (references > 0) {
                this.references.set(id, references)
                continue
            }
            this.references.delete(id)
            const note = this.held.get(id)
            if (note) this.noteOff(note.note, 0, id)
        }
        this.updatePressed()
    }

    protected chord(root: number, _pad?: SVGElement) {
        const scale = this.scale === "Minor" ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]
        return [0, 2, 4]
            .map(
                (degree) =>
                    root + ((scale[(degree + this.mode) % 7]! - scale[this.mode]! + 12) % 12),
            )
            .filter((note) => note >= 0 && note <= 127)
    }

    protected updatePressed() {
        for (const pad of this.root.querySelectorAll<SVGElement>("[data-pad]")) {
            const pressed = [...this.gestures.values()].some(
                (gesture) => gesture.pad === pad && gesture.ids.some((id) => this.held.has(id)),
            )
            pad.setAttribute("aria-pressed", String(pressed))
            const sounding = this.isPadSounding(pad)
            pad.toggleAttribute("data-active", sounding)
            if (sounding) pad.setAttribute("aria-description", "Note is sounding")
            else pad.removeAttribute("aria-description")
        }
    }

    protected abstract render(): void
    protected abstract update(): void
    protected isPadSounding(pad: SVGElement): boolean {
        return this.activeNotes.has(Number(pad.dataset.note))
    }
    protected connectControls(_options: { signal: AbortSignal }): void {}
}