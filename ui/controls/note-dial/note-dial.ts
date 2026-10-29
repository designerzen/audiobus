// oxlint-disable-next-line typescript/triple-slash-reference -- Bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { EVENT_POINTER_LOCK_CHANGE } from "../../../event-constants.ts"
import { EVENT_BLUR, EVENT_CHANGE, EVENT_FOCUS_OUT, EVENT_INPUT, EVENT_KEY_DOWN, EVENT_LOST_POINTER_CAPTURE, EVENT_PAGE_HIDE, EVENT_POINTER_CANCEL, EVENT_POINTER_DOWN, EVENT_POINTER_MOVE, EVENT_POINTER_UP, EVENT_VISIBILITY_CHANGE } from "../../../event-constants.ts"
import styles from "./note-dial.css?inline"
import { NoteSlider } from "../note-slider/note-slider.ts"

interface Drag {
    id: number
    type: string
    x: number
    y: number
    remainder: number
    start: number
}

/** Relative audio dial: mouse pointer lock, touch/pen capture, native range keyboard semantics. */
export class NoteDial extends NoteSlider {
    static observedAttributes = [...NoteSlider.observedAttributes, "sensitivity", "no-pointer-lock"]
    private dialListeners?: AbortController
    private drag?: Drag
    private lockRequest?: Drag
    private wasLocked = false

    constructor() {
        super()
        const style = document.createElement("style")
        style.textContent = styles
        this.root.append(style)
        const face = document.createElement("div")
        face.className = "dial-face"
        face.setAttribute("part", "dial")
        face.setAttribute("aria-hidden", "true")
        face.innerHTML =
            '<span class="needle-arm" part="needle-arm"><span class="needle" part="needle"></span></span><span class="hub"></span>'
        this.input.before(face)
    }

    /** CSS pixels of relative travel per semitone. Shift makes mouse/pen movement ten times finer. */
    get sensitivity() {
        const value = Number(this.getAttribute("sensitivity") ?? 6)
        return Number.isFinite(value) && value > 0 ? Math.max(0.25, Math.min(100, value)) : 6
    }
    set sensitivity(value: number) {
        this.setAttribute("sensitivity", String(value))
    }

    private get locked() {
        return this.root.pointerLockElement === this.input
    }

    connectedCallback() {
        super.connectedCallback()
        this.dialListeners?.abort()
        this.dialListeners = new AbortController()
        const options = { signal: this.dialListeners.signal }
        this.input.addEventListener(EVENT_POINTER_DOWN, (event) => this.begin(event), options)
        // Some native range implementations also seek from legacy touch events,
        // even when pointerdown was canceled. Keep all touch editing relative.
        for (const type of ["touchstart", "touchmove"])
            this.input.addEventListener(type, (event) => event.preventDefault(), {
                ...options,
                passive: false,
            })
        this.ownerDocument.addEventListener(
            EVENT_POINTER_MOVE,
            (event) => {
                const drag = this.drag
                if (!drag || event.pointerId !== drag.id || this.locked) return
                const dx = event.clientX - drag.x,
                    dy = event.clientY - drag.y
                drag.x = event.clientX
                drag.y = event.clientY
                this.move(dx, dy, event.shiftKey)
            },
            options,
        )
        // Mouse events are guaranteed by Pointer Lock; pointer events vary between browsers.
        this.ownerDocument.addEventListener(
            "mousemove",
            (event) => {
                if (this.locked && this.drag?.type === "mouse")
                    this.move(event.movementX, event.movementY, event.shiftKey)
            },
            options,
        )
        this.ownerDocument.addEventListener(
            EVENT_POINTER_UP,
            (event) => {
                if (event.pointerId === this.drag?.id) this.finish(true)
            },
            options,
        )
        this.ownerDocument.addEventListener(
            "mouseup",
            (event) => {
                if (event.button === 0 && this.drag?.type === "mouse") this.finish(true)
            },
            options,
        )
        this.ownerDocument.addEventListener(
            EVENT_POINTER_CANCEL,
            (event) => {
                if (event.pointerId === this.drag?.id) this.finish(true, true)
            },
            options,
        )
        this.input.addEventListener(
            EVENT_LOST_POINTER_CAPTURE,
            (event) => {
                if (event.pointerId === this.drag?.id && !this.locked && !this.lockRequest)
                    this.finish(true, true)
            },
            options,
        )
        this.ownerDocument.addEventListener(EVENT_POINTER_LOCK_CHANGE, () => this.lockChanged(), options)
        this.ownerDocument.addEventListener(
            "pointerlockerror",
            () => {
                this.lockRequest = undefined
            },
            options,
        )
        this.input.addEventListener(
            EVENT_KEY_DOWN,
            (event) => {
                if (event.key === "Escape") this.finish(true, true)
                if (["Enter", " "].includes(event.key)) {
                    event.preventDefault()
                    if (!event.repeat) this.play()
                }
            },
            options,
        )
        this.root.addEventListener(
            EVENT_FOCUS_OUT,
            (event) => {
                if (!this.root.contains((event as FocusEvent).relatedTarget as Node | null))
                    this.finish(true, true)
            },
            options,
        )
        window.addEventListener(EVENT_BLUR, () => this.finish(true, true), options)
        window.addEventListener(EVENT_PAGE_HIDE, () => this.finish(false, true), options)
        this.ownerDocument.addEventListener(
            EVENT_VISIBILITY_CHANGE,
            () => {
                if (this.ownerDocument.hidden) this.finish(true, true)
            },
            options,
        )
    }

    attributeChangedCallback(name: string, previous: string | null, next: string | null) {
        if (previous !== next && ["disabled", "min", "max", "no-pointer-lock"].includes(name))
            this.finish(false, true)
        super.attributeChangedCallback(name, previous, next)
    }

    disconnectedCallback() {
        this.finish(false, true)
        this.dialListeners?.abort()
        this.dialListeners = undefined
        super.disconnectedCallback()
    }

    protected update() {
        super.update()
        if (!this.getAttribute("label")) this.root.querySelector("label")!.textContent = "Note dial"
        this.root.querySelector("#help")!.textContent =
            "Drag up or right for higher notes; down or left for lower notes. Mouse dragging locks the pointer where supported. Release or press Escape to unlock. Hold Shift for fine adjustment. Touch and pen use drag capture. Arrow keys move one tick; Home and End reach the limits. Lower note and Higher note also work. Turn off Sound feedback to move in silence."
        const fraction = this.max === this.min ? 0 : (this.value - this.min) / (this.max - this.min)
        this.root
            .querySelector<HTMLElement>(".needle-arm")
            ?.style.setProperty("--dial-angle", `${-135 + fraction * 270}deg`)
    }

    private begin(event: PointerEvent) {
        if (this.disabled || event.button !== 0) return
        // Disable native track seeking: grabbing a knob must never jump its value.
        event.preventDefault()
        if (this.drag || !event.isPrimary) return
        this.input.focus({ preventScroll: true })
        const drag: Drag = {
            id: event.pointerId,
            type: event.pointerType,
            x: event.clientX,
            y: event.clientY,
            remainder: 0,
            start: this.value,
        }
        this.drag = drag
        this.input.setPointerCapture(event.pointerId)
        if (
            event.pointerType !== "mouse" ||
            this.hasAttribute("no-pointer-lock") ||
            this.lockRequest ||
            !this.input.requestPointerLock
        )
            return
        this.lockRequest = drag
        try {
            const result = this.input.requestPointerLock()
            // Older implementations return void and report failure only via pointerlockerror.
            if (result)
                void result.catch(() => {
                    if (this.lockRequest === drag) this.lockRequest = undefined
                })
        } catch {
            this.lockRequest = undefined
        }
    }

    private lockChanged() {
        if (this.locked) {
            // A request can succeed after mouseup/removal or a subsequent drag.
            if (
                !this.drag ||
                this.drag !== this.lockRequest ||
                this.disabled ||
                !this.isConnected
            ) {
                this.ownerDocument.exitPointerLock()
                this.lockRequest = undefined
                return
            }
            this.wasLocked = true
            this.lockRequest = undefined
            return
        }
        if (this.wasLocked) {
            this.wasLocked = false
            this.finish(true, true)
        }
    }

    private move(dx: number, dy: number, fine: boolean) {
        const drag = this.drag
        if (!drag || this.disabled) return
        drag.remainder += ((dx - dy) / this.sensitivity) * (fine ? 0.1 : 1)
        // Ten fine-adjustment deltas of 0.1 should reach one tick despite floating-point error.
        const steps = Math.trunc(drag.remainder + Math.sign(drag.remainder) * 1e-9)
        if (!steps) return
        drag.remainder -= steps
        const value = Math.max(this.min, Math.min(this.max, this.value + steps))
        if (value === this.min || value === this.max) drag.remainder = 0
        if (value === this.value) return
        this.input.value = String(value)
        // Reuse the slider's sound, value semantics and public input event exactly once.
        this.input.dispatchEvent(new Event(EVENT_INPUT, { bubbles: true }))
    }

    private finish(commit: boolean, stopSound = false) {
        const drag = this.drag
        this.drag = undefined
        if (drag && this.input.hasPointerCapture(drag.id)) this.input.releasePointerCapture(drag.id)
        if (this.locked) this.ownerDocument.exitPointerLock()
        this.wasLocked = false
        if (stopSound) this.stop()
        if (commit && drag && drag.start !== this.value)
            this.input.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true }))
    }
}

if (!customElements.get("note-dial")) customElements.define("note-dial", NoteDial)
declare global {
    interface HTMLElementTagNameMap {
        "note-dial": NoteDial
    }
}
