// oxlint-disable-next-line typescript/triple-slash-reference -- Standalone CSS declaration.
/// <reference path="../star-controller/assets.d.ts" />
import { EVENT_CLICK, EVENT_KEY_DOWN, EVENT_KEY_UP, EVENT_LOST_POINTER_CAPTURE, EVENT_POINTER_CANCEL, EVENT_POINTER_DOWN, EVENT_POINTER_MOVE, EVENT_POINTER_UP } from "../../../event-constants.ts"
import styles from "./sound-wheel.css?inline"
import { ChordController } from "../../shared/chord-controller.ts"
import { instrumentNote } from "../../interfaces/instrument.ts"

interface Dot {
    id: number
    x: number
    y: number
    note: number
    velocity: number
    colour: string
}
type Drag = { dot: number; momentary: boolean } | { angle: number }
const radius = 210
const centre = 260
const tau = Math.PI * 2
let nextVoice = 2000000

/** The Sound-Wheel colour instrument, expressed entirely as shared instrument events. */
export class SoundWheel extends ChordController {
    private dots = new Map<number, Dot>()
    private drags = new Map<number, Drag>()
    private rotation = -Math.PI / 4

    /** Read-only snapshot in normalized wheel coordinates (-1 to 1). */
    get nodes() {
        return [...this.dots.values()].map(({ id, x, y, note, velocity }) => ({
            id,
            x,
            y,
            note,
            velocity,
        }))
    }

    protected render() {
        this.root.innerHTML = `<style>${styles}</style><section part="panel" aria-labelledby="title">
          <h2 id="title" part="label">Sound wheel</h2>
          <p id="help" part="help">Mouse: click to add a sustained note; drag a dot to change pitch or drag outside to remove it. Touch: each finger adds a note, slides to change pitch, and lifts to remove it. Drag the diamond to rotate all notes. Sound is supplied by the host.</p>
          <div class="controls" part="controls">
            <button type="button" data-add part="add">Add note</button>
            <button type="button" data-clear part="clear">Clear notes</button>
            <label>Octave <input data-control="octave" type="number" min="0" max="8"></label>
            <label>Patch <input data-control="program" type="number" min="0" max="127"></label>
          </div>
          <p id="keys">Keyboard: Add note, then use arrows to move it (Shift for fine movement). Enter, Space or Delete removes a dot. Focus Rotate all notes and use Left/Right. Escape clears the wheel.</p>
          <div class="wheel"><svg part="surface" viewBox="0 0 520 520" role="group" aria-label="Sound wheel" aria-describedby="help keys">
            <circle class="edge" part="edge" cx="260" cy="260" r="210"/>
            <g class="dots"></g>
            <g data-rotate role="button" tabindex="0" aria-label="Rotate all notes" part="rotator"><path d="M0 -24 L24 0 L0 24 L-24 0 Z"/><text y="1" aria-hidden="true">↻</text></g>
          </svg></div>
          <output part="status" role="status" aria-live="polite"></output>
        </section>`
    }

    protected update() {
        if (!this.root.childElementCount) return
        for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-control]")) {
            input.value = String(input.dataset.control === "octave" ? this.octave : this.patch)
            input.disabled = this.disabled
        }
        this.root.querySelector<HTMLButtonElement>("[data-add]")!.disabled =
            this.disabled || this.muted
        this.root.querySelector<HTMLButtonElement>("[data-clear]")!.disabled = this.disabled
        const rotator = this.root.querySelector<SVGElement>("[data-rotate]")!
        rotator.setAttribute("tabindex", this.disabled || this.muted ? "-1" : "0")
        rotator.setAttribute("aria-disabled", String(this.disabled || this.muted))
        this.updatePressed()
    }

    protected connectControls(options: { signal: AbortSignal }) {
        const svg = this.root.querySelector("svg")!
        this.root.querySelector("[data-add]")!.addEventListener(
            EVENT_CLICK,
            () => {
                const angle = this.dots.size * 2.4
                const dot = this.addDot(Math.cos(angle) * 0.65, Math.sin(angle) * 0.65, 0.8)
                if (dot) this.element(dot.id)?.focus()
            },
            options,
        )
        this.root
            .querySelector("[data-clear]")!
            .addEventListener(EVENT_CLICK, () => this.stop(), options)
        for (const type of [
            EVENT_POINTER_DOWN,
            EVENT_POINTER_MOVE,
            EVENT_POINTER_UP,
            EVENT_POINTER_CANCEL,
            EVENT_LOST_POINTER_CAPTURE,
        ] as const)
            svg.addEventListener(type, (event) => this.handlePointer(event), {
                ...options,
                capture: true,
            })
        this.root.addEventListener(
            EVENT_KEY_DOWN,
            (event) => {
                const key = event as KeyboardEvent
                key.stopPropagation()
                if (key.key === "Escape") {
                    key.preventDefault()
                    this.stop()
                    return
                }
                if (this.disabled || this.muted) return
                const target = key.target as Element
                const dot = this.dots.get(
                    Number(target.closest<SVGElement>("[data-node]")?.dataset.node),
                )
                if (dot) {
                    if (["Delete", "Backspace", "Enter", " "].includes(key.key)) {
                        key.preventDefault()
                        if (!key.repeat) this.removeDot(dot.id)
                    } else if (key.key.startsWith("Arrow")) {
                        key.preventDefault()
                        const step = key.shiftKey ? 0.01 : 0.06
                        let x =
                            dot.x +
                            (key.key === "ArrowLeft" ? -step : key.key === "ArrowRight" ? step : 0)
                        let y =
                            dot.y +
                            (key.key === "ArrowUp" ? -step : key.key === "ArrowDown" ? step : 0)
                        const distance = Math.max(1, Math.hypot(x, y))
                        x /= distance
                        y /= distance
                        this.moveDot(dot.id, x, y)
                    }
                } else if (
                    target.closest("[data-rotate]") &&
                    ["ArrowLeft", "ArrowRight", "Enter", " "].includes(key.key)
                ) {
                    key.preventDefault()
                    const delta =
                        ((key.key === "ArrowLeft" ? -1 : 1) * (key.shiftKey ? 1 : 15) * Math.PI) /
                        180
                    this.rotate(delta)
                }
            },
            options,
        )
        this.root.addEventListener(EVENT_KEY_UP, (event) => event.stopPropagation(), options)
    }

    private handlePointer(event: PointerEvent) {
        event.stopImmediatePropagation()
        const { pointerId: id, type } = event
        const svg = this.root.querySelector("svg")!
        let drag = this.drags.get(id)
        if (type === "pointerdown") {
            if (this.disabled || this.muted || event.button !== 0 || drag) return
            event.preventDefault()
            const target = event.target as Element
            const point = this.point(event)
            if (target.closest("[data-rotate]")) {
                if (this.drags.size) return
                drag = { angle: Math.atan2(point.y, point.x) }
                this.root.querySelector<SVGElement>("[data-rotate]")!.focus()
            } else {
                const dotId = Number(target.closest<SVGElement>("[data-node]")?.dataset.node)
                if (
                    [...this.drags.values()].some(
                        (active) => !("dot" in active) || active.dot === dotId,
                    )
                )
                    return
                const velocity =
                    event.pointerType === "mouse" || event.pressure <= 0 ? 0.8 : event.pressure
                const dot = this.dots.get(dotId) ?? this.addDot(point.x, point.y, velocity)
                if (!dot) return
                drag = { dot: dot.id, momentary: event.pointerType === "touch" }
                this.element(dot.id)?.focus()
            }
            this.drags.set(id, drag)
            svg.setPointerCapture(id)
            return
        }
        if (!drag) return
        // Touch contacts own momentary nodes; mouse/pen gestures leave latched nodes.
        if (type !== "pointermove" && "dot" in drag && (type !== "pointerup" || drag.momentary)) {
            this.drags.delete(id)
            this.removeDot(drag.dot)
            return
        }
        if (type === "pointermove" || type === "pointerup") {
            const point = this.point(event)
            if ("dot" in drag) this.moveDot(drag.dot, point.x, point.y)
            else {
                const angle = Math.atan2(point.y, point.x)
                this.rotate(angle - drag.angle)
                drag.angle = angle
            }
        } else if ("dot" in drag) this.removeDot(drag.dot)
        else this.stop()
        if (type !== "pointermove") this.drags.delete(id)
    }

    private point(event: PointerEvent) {
        const svg = this.root.querySelector("svg")!
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
            svg.getScreenCTM()!.inverse(),
        )
        return { x: (point.x - centre) / radius, y: (point.y - centre) / radius }
    }

    private addDot(x: number, y: number, velocity: number) {
        if (
            !this.isConnected ||
            this.disabled ||
            this.muted ||
            this.dots.size >= 16 ||
            Math.hypot(x, y) > 1
        )
            return
        const dot: Dot = { id: ++nextVoice, x, y, velocity, ...this.tone(x, y) }
        this.dots.set(dot.id, dot)
        this.noteOn(dot.note, dot.velocity, dot.id)
        return this.dots.get(dot.id)
    }

    private moveDot(id: number, x: number, y: number) {
        const dot = this.dots.get(id)
        if (!dot) return
        if (Math.hypot(x, y) > 1.000001) {
            this.removeDot(id)
            return
        }
        const previous = dot.note
        Object.assign(dot, { x, y }, this.tone(x, y))
        if (dot.note !== previous) {
            this.noteOff(previous, 0, id)
            if (this.dots.has(id)) this.noteOn(dot.note, dot.velocity, id)
        }
        this.updatePressed()
    }

    private removeDot(id: number) {
        const dot = this.dots.get(id)
        if (!dot) return
        const focused = this.root.activeElement === this.element(id)
        this.dots.delete(id)
        this.noteOff(dot.note, 0, id)
        this.updatePressed()
        if (focused) this.root.querySelector<HTMLButtonElement>("[data-add]")!.focus()
    }

    private rotate(angle: number) {
        for (const { id, x, y } of this.nodes)
            this.moveDot(
                id,
                x * Math.cos(angle) - y * Math.sin(angle),
                x * Math.sin(angle) + y * Math.cos(angle),
            )
        this.rotation += angle
        this.updatePressed()
    }

    /** Original Sound-Wheel HSV/RGB frequency mapping, snapped to shared MIDI notes. */
    private tone(x: number, y: number) {
        const hue = ((Math.atan2(y, x) + Math.PI) / tau) % 1
        const saturation = Math.min(1, Math.hypot(x, y))
        const h = hue * 6,
            i = Math.floor(h),
            f = h - i
        const p = 1 - saturation,
            q = 1 - f * saturation,
            t = 1 - (1 - f) * saturation
        const r = Math.floor([1, q, p, p, t, 1][i % 6]! * 255)
        const g = Math.floor([t, 1, 1, q, p, p][i % 6]! * 255)
        const b = Math.floor([p, p, t, 1, 1, q][i % 6]! * 255)
        const frequency = Math.sqrt((r + 255 + g * g + 255 * 255 + b * b * b) * 0.5)
        const note = Math.max(
            0,
            Math.min(
                127,
                Math.round(69 + 12 * Math.log2(frequency / 440)) + (this.octave - 4) * 12,
            ),
        )
        return { note, colour: `rgb(${r}, ${g}, ${b})` }
    }

    private element(id: number) {
        return this.root.querySelector<SVGElement>(`[data-node="${id}"]`)
    }

    protected updatePressed() {
        const layer = this.root.querySelector(".dots")
        if (!layer) return
        for (const element of layer.querySelectorAll<SVGElement>("[data-node]"))
            if (!this.dots.has(Number(element.dataset.node))) element.remove()
        for (const dot of this.dots.values()) {
            let element = this.element(dot.id)
            if (!element) {
                element = document.createElementNS("http://www.w3.org/2000/svg", "g")
                element.dataset.node = String(dot.id)
                element.setAttribute("role", "button")
                element.setAttribute("tabindex", "0")
                element.setAttribute("part", "node")
                element.innerHTML = '<circle r="23"/><text aria-hidden="true"></text>'
                layer.append(element)
            }
            const name = instrumentNote(dot.note).noteName
            element.setAttribute(
                "transform",
                `translate(${centre + dot.x * radius} ${centre + dot.y * radius})`,
            )
            element.setAttribute(
                "aria-label",
                `${name}. Arrows move; Enter or Delete removes note.`,
            )
            element.setAttribute("aria-pressed", String(this.held.has(dot.id)))
            element.toggleAttribute("data-active", this.activeNotes.has(dot.note))
            element.querySelector("circle")!.setAttribute("fill", dot.colour)
            element.querySelector("text")!.textContent = name
        }
        this.root
            .querySelector("[data-rotate]")!
            .setAttribute(
                "transform",
                `translate(${centre + 248 * Math.cos(this.rotation)} ${centre + 248 * Math.sin(this.rotation)})`,
            )
        const status = this.root.querySelector("output")!
        const text = this.dots.size
            ? `${this.dots.size} note${this.dots.size === 1 ? "" : "s"}: ${[...this.dots.values()].map((dot) => instrumentNote(dot.note).noteName).join(", ")}`
            : "No notes requested."
        if (status.textContent !== text) status.textContent = text
    }

    stop() {
        this.dots.clear()
        const pointers = [...this.drags.keys()]
        this.drags.clear()
        const svg = this.root.querySelector("svg")
        for (const id of pointers) if (svg?.hasPointerCapture(id)) svg.releasePointerCapture(id)
        super.stop()
    }
}

if (!customElements.get("sound-wheel")) customElements.define("sound-wheel", SoundWheel)

declare global {
    interface HTMLElementTagNameMap {
        "sound-wheel": SoundWheel
    }
}