// oxlint-disable-next-line typescript/triple-slash-reference -- Standalone CSS declaration.
/// <reference path="../star-controller/assets.d.ts" />
import { EVENT_CHANGE, EVENT_KEY_DOWN, EVENT_KEY_UP, EVENT_LOST_POINTER_CAPTURE, EVENT_POINTER_CANCEL, EVENT_POINTER_DOWN, EVENT_POINTER_MOVE, EVENT_POINTER_UP } from "../../../event-constants.ts"
import styles from "./pitch-surfaces.css?inline"
import { ChordController } from "../../shared/chord-controller.ts"
import { instrumentNote } from "../../interfaces/instrument.ts"

type Kind = "relative" | "xy" | "bend"
interface Contact {
    x: number
    y: number
    anchorX: number
    note: number
    velocity: number
}
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
let voice = 1000000

/** Event-only pitch surfaces, sharing the existing MIDI/UMP and patch interface. */
export abstract class PitchSurface extends ChordController {
    static observedAttributes = [...ChordController.observedAttributes, "inverted"]
    protected abstract kind: Kind
    private contacts = new Map<number, Contact>()
    private voices = new Map<number, number>()
    private bend = 0
    private resizeObserver?: ResizeObserver

    connectedCallback() {
        super.connectedCallback()
        this.resizeObserver?.disconnect()
        this.resizeObserver = new ResizeObserver(() => {
            const svg = this.root.querySelector("svg")!
            const box = svg.getBoundingClientRect()
            if (
                Math.abs(svg.viewBox.baseVal.width - box.width) < 0.5 &&
                Math.abs(svg.viewBox.baseVal.height - box.height) < 0.5
            )
                return
            this.stop()
            this.update()
        })
        this.resizeObserver.observe(this.root.querySelector("svg")!)
    }

    disconnectedCallback() {
        this.resizeObserver?.disconnect()
        super.disconnectedCallback()
    }

    get inverted() {
        return this.hasAttribute("inverted")
    }
    set inverted(value: boolean) {
        this.toggleAttribute("inverted", value)
    }
    private get columns() {
        return this.kind === "xy" && this.inverted ? 3 : 12
    }
    private get rows() {
        return this.kind === "xy" && this.inverted ? 12 : 3
    }
    private get surfaceTitle() {
        return this.kind === "relative"
            ? "Relative touch chords"
            : this.kind === "xy"
              ? "X–Y pitch and octaves"
              : "Pitch bend grid"
    }
    private noteAt(x: number, y: number) {
        const pitch = this.inverted && this.kind === "xy" ? 11 - y : x
        const octave = this.inverted && this.kind === "xy" ? x : 2 - y
        return clamp((this.octave + 1) * 12 + octave * 12 + pitch, 0, 127)
    }
    protected chord(note: number) {
        return [note]
    }

    protected render() {
        this.root.innerHTML = `<style>${styles}</style><section part="panel" aria-labelledby="title">
          <h2 id="title" part="label">${this.surfaceTitle}</h2>
          <div class="controls" part="controls">
            <label>Base octave <input data-control="octave" type="number" min="0" max="8"></label>
            <label>Patch <input data-control="program" type="number" min="0" max="127"></label>
            ${this.kind === "xy" ? '<label><input data-invert type="checkbox">Invert axes</label>' : ""}
          </div>
          <p id="help" part="help">${
              this.kind === "relative"
                  ? "First finger sets the root. Other fingers add notes relative to it: one column is a semitone, one row is an octave. Move any finger to reshape the chord. When the root lifts, the oldest remaining finger becomes the root."
                  : this.kind === "xy"
                    ? "Pitch increases to the right; octaves increase upwards. Invert axes to put octaves across and pitch upwards. Hold multiple cells and slide to change notes."
                    : "Hold a cell to play its note. The middle half stays in tune; move towards its left or right edge to bend down or up. The note stays anchored until release. One finger at a time: bend affects the MIDI channel."
          }
            Focus a cell and hold Enter or Space to play; arrow keys move focus. Sound is supplied by the host.</p>
          <svg part="surface" viewBox="0 0 1200 360" preserveAspectRatio="none" role="group" aria-label="${this.surfaceTitle}" aria-describedby="help"></svg>
          <output part="status" aria-live="polite"></output>
        </section>`
    }

    protected update() {
        if (!this.root.querySelector("svg")) return
        for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-control]")) {
            input.value = String(input.dataset.control === "octave" ? this.octave : this.patch)
            input.disabled = this.disabled
        }
        const invert = this.root.querySelector<HTMLInputElement>("[data-invert]")
        if (invert) {
            invert.checked = this.inverted
            invert.disabled = this.disabled
        }
        const svg = this.root.querySelector("svg")!
        const box = svg.getBoundingClientRect()
        const width = box.width || 1200,
            height = box.height || 360
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`)
        const focused = (this.root.activeElement as SVGElement | null)?.dataset.pad
        const w = width / this.columns,
            h = height / this.rows
        svg.style.fontSize = `${Math.min(16, w / 2.2)}px`
        svg.innerHTML = Array.from({ length: this.columns * this.rows }, (_, index) => {
            const x = index % this.columns,
                y = Math.floor(index / this.columns)
            const note = this.noteAt(x, y),
                name = instrumentNote(note).noteName
            return `<g data-pad="${index}" data-note="${note}" role="button" tabindex="${this.disabled ? -1 : 0}" aria-disabled="${this.disabled}" aria-label="${name}"><rect part="cell" x="${x * w + 2}" y="${y * h + 2}" width="${w - 4}" height="${h - 4}" rx="6"/>${this.kind === "bend" ? `<path class="bend-zone" d="M${x * w + w / 4} ${y * h + 5}v${h - 10} M${x * w + (3 * w) / 4} ${y * h + 5}v${h - 10}"/>` : ""}<text x="${x * w + w / 2}" y="${y * h + h / 2}">${name}</text></g>`
        }).join("")
        if (focused) svg.querySelector<SVGElement>(`[data-pad="${focused}"]`)?.focus()
        this.updatePressed()
    }

    protected connectControls(options: { signal: AbortSignal }) {
        const svg = this.root.querySelector("svg")!
        // These surfaces use coordinates and continuous motion rather than chord-pad hit testing.
        for (const type of [
            EVENT_POINTER_DOWN,
            EVENT_POINTER_MOVE,
            EVENT_POINTER_UP,
            EVENT_POINTER_CANCEL,
            EVENT_LOST_POINTER_CAPTURE,
        ] as const) {
            svg.addEventListener(
                type,
                (event) => {
                    event.stopImmediatePropagation()
                    if (type === "pointerdown") {
                        if (
                            this.disabled ||
                            this.muted ||
                            event.button !== 0 ||
                            (this.kind === "bend" && this.contacts.size)
                        )
                            return
                        event.preventDefault()
                        const point = this.point(event)
                        const x = Math.floor(point.x),
                            y = Math.floor(point.y)
                        const contact = {
                            ...point,
                            anchorX: x + 0.5,
                            note: this.noteAt(x, y),
                            velocity:
                                event.pointerType === "mouse" || event.pressure <= 0
                                    ? 1
                                    : event.pressure,
                        }
                        this.contacts.set(event.pointerId, contact)
                        svg.setPointerCapture(event.pointerId)
                        // Moving focus during a second touch must not end keyboard gestures.
                        this.root
                            .querySelector<SVGElement>(`[data-pad="${y * this.columns + x}"]`)
                            ?.focus()
                        this.refreshContacts()
                    } else if (type === "pointermove") {
                        const contact = this.contacts.get(event.pointerId)
                        if (!contact) return
                        Object.assign(contact, this.point(event))
                        this.refreshContacts()
                    } else if (this.contacts.delete(event.pointerId)) {
                        this.refreshContacts()
                    }
                },
                { ...options, capture: true },
            )
        }
        this.root.querySelector("[data-invert]")?.addEventListener(
            EVENT_CHANGE,
            (event) => {
                this.inverted = (event.target as HTMLInputElement).checked
            },
            options,
        )
        this.root.addEventListener(
            EVENT_KEY_DOWN,
            (event) => {
                event.stopPropagation()
                const key = event as KeyboardEvent
                const pad = (key.target as Element).closest<SVGElement>("[data-pad]")
                if (!pad || this.disabled) return
                const delta = (
                    {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -this.columns,
                        ArrowDown: this.columns,
                    } as Record<string, number>
                )[key.key]
                if (delta !== undefined) {
                    key.preventDefault()
                    const index = clamp(
                        Number(pad.dataset.pad) + delta,
                        0,
                        this.rows * this.columns - 1,
                    )
                    this.root.querySelector<SVGElement>(`[data-pad="${index}"]`)?.focus()
                }
            },
            options,
        )
        this.root.addEventListener(EVENT_KEY_UP, (event) => event.stopPropagation(), options)
    }

    private point(event: PointerEvent) {
        const rect = this.root.querySelector("svg")!.getBoundingClientRect()
        return {
            x: clamp(
                ((event.clientX - rect.left) / rect.width) * this.columns,
                0,
                this.columns - 0.0001,
            ),
            y: clamp(((event.clientY - rect.top) / rect.height) * this.rows, 0, this.rows - 0.0001),
        }
    }

    private refreshContacts() {
        const root = this.contacts.values().next().value as Contact | undefined
        const desired = new Map<number, number>()
        if (root) {
            const rootNote = this.noteAt(Math.floor(root.x), Math.floor(root.y))
            for (const contact of this.contacts.values()) {
                const note =
                    this.kind === "bend"
                        ? contact.note
                        : this.kind === "relative"
                          ? clamp(
                                rootNote +
                                    Math.round(contact.x - root.x) -
                                    12 * Math.round(contact.y - root.y),
                                0,
                                127,
                            )
                          : this.noteAt(Math.floor(contact.x), Math.floor(contact.y))
                desired.set(note, contact.velocity)
            }
        }
        for (const [note, id] of this.voices) {
            if (!desired.has(note)) {
                this.noteOff(note, 0, id)
                this.voices.delete(note)
            }
        }
        for (const [note, velocity] of desired) {
            if (!this.voices.has(note)) {
                const id = ++voice
                this.voices.set(note, id)
                this.noteOn(note, velocity, id)
            }
        }
        if (this.kind === "bend") {
            const offset = root ? root.x - root.anchorX : 0
            const value = Math.sign(offset) * clamp((Math.abs(offset) - 0.25) / 0.25, 0, 1)
            if (value !== this.bend) {
                this.bend = value
                this.pitchBend(value)
            }
        }
        this.root.querySelector("output")!.textContent =
            [...desired.keys()].map((n) => instrumentNote(n).noteName).join(" · ") || "Ready"
        this.updatePressed()
    }

    stop() {
        const svg = this.root.querySelector("svg")
        const pointers = [...this.contacts.keys()]
        this.contacts.clear()
        this.voices.clear()
        for (const pointer of pointers)
            if (svg?.hasPointerCapture(pointer)) svg.releasePointerCapture(pointer)
        super.stop()
        if (this.bend !== 0) {
            this.bend = 0
            this.pitchBend(0)
        }
        const status = this.root.querySelector("output")
        if (status) status.textContent = "Ready"
    }

    protected updatePressed() {
        super.updatePressed()
        for (const pad of this.root.querySelectorAll<SVGElement>("[data-pad]")) {
            const note = Number(pad.dataset.note)
            const held = [...this.held.values()].some((detail) => detail.note.noteNumber === note)
            pad.setAttribute("aria-pressed", String(held))
            pad.toggleAttribute("data-active", held || this.activeNotes.has(note))
        }
    }
}

