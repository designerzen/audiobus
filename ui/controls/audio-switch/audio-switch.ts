// oxlint-disable-next-line typescript/triple-slash-reference -- Bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { NOTE_OFF, NOTE_ON } from "../../../commands.ts"
import { EVENT_BLUR, EVENT_CHANGE, EVENT_FOCUS_OUT, EVENT_INPUT, EVENT_INSTRUMENT_DISCONNECT, EVENT_KEY_DOWN, EVENT_KEY_UP, EVENT_PAGE_HIDE, EVENT_VISIBILITY_CHANGE } from "../../../event-constants.ts"
import styles from "./audio-switch.css?inline"
import { PatchController } from "../../shared/patch-controller.ts"
import { dispatchInstrumentEvent, noteDetail, type NoteDetail } from "../../interfaces/instrument.ts"

/** Native switch semantics and form value, with state-change cues delegated to the host engine. */
export class AudioSwitch extends PatchController {
    static formAssociated = true
    static observedAttributes = [
        ...PatchController.observedAttributes,
        "checked",
        "disabled",
        "muted",
        "label",
        "name",
        "value",
    ]
    private root = this.attachShadow({ mode: "open", delegatesFocus: true })
    private internals = this.attachInternals()
    private input: HTMLInputElement
    private listeners?: AbortController
    private held?: NoteDetail
    private timer?: ReturnType<typeof setTimeout>
    private generation = 0
    private formDisabled = false
    private initialChecked?: boolean

    constructor() {
        super()
        this.root.innerHTML = `<style>${styles}</style>
          <label part="label">
            <input part="input" type="checkbox" switch role="switch" aria-describedby="help">
            <span class="indicator" part="indicator" aria-hidden="true"><span class="thumb" part="thumb"></span></span>
            <span class="text" part="text">Audio switch</span>
            <span class="state" part="state" aria-hidden="true">Off</span>
          </label>
          <p id="help" part="help">On plays two rising notes. Off plays two lower falling notes.</p>`
        this.input = this.root.querySelector("input")!
    }

    get checked() {
        return this.hasAttribute("checked")
    }
    set checked(value: boolean) {
        this.toggleAttribute("checked", value)
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
    get value() {
        return this.getAttribute("value") ?? "on"
    }
    set value(value: string) {
        this.setAttribute("value", value)
    }
    get name() {
        return this.getAttribute("name") ?? ""
    }
    set name(value: string) {
        this.setAttribute("name", value)
    }
    private get unavailable() {
        return this.disabled || this.formDisabled
    }

    connectedCallback() {
        super.connectedCallback()
        this.initialChecked ??= this.checked
        this.listeners?.abort()
        this.listeners = new AbortController()
        const options = { signal: this.listeners.signal }
        this.input.addEventListener(
            EVENT_INPUT,
            (event) => {
                event.stopPropagation()
                if (this.unavailable) return
                this.checked = this.input.checked
                this.dispatchEvent(new Event(EVENT_INPUT, { bubbles: true, composed: true }))
            },
            options,
        )
        this.input.addEventListener(
            EVENT_CHANGE,
            (event) => {
                event.stopPropagation()
                if (this.unavailable) return
                this.playCue()
                this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
            },
            options,
        )
        for (const type of [EVENT_KEY_DOWN, EVENT_KEY_UP])
            this.root.addEventListener(type, (event) => event.stopPropagation(), options)
        this.root.addEventListener(EVENT_FOCUS_OUT, () => this.stop(), options)
        window.addEventListener(EVENT_BLUR, () => this.stop(), options)
        window.addEventListener(EVENT_PAGE_HIDE, () => this.stop(), options)
        this.ownerDocument.addEventListener(
            EVENT_VISIBILITY_CHANGE,
            () => {
                if (this.ownerDocument.hidden) this.stop()
            },
            options,
        )
        this.update()
    }

    attributeChangedCallback(name: string, previous: string | null, next: string | null) {
        if (previous === next) return
        if (["checked", "disabled", "muted"].includes(name)) this.stop()
        this.update()
        super.attributeChangedCallback(name, previous, next)
    }

    disconnectedCallback() {
        this.stop()
        this.listeners?.abort()
        this.listeners = undefined
        dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
    }

    formDisabledCallback(disabled: boolean) {
        this.formDisabled = disabled
        if (disabled) this.stop()
        this.update()
    }
    formResetCallback() {
        this.stop()
        this.checked = this.initialChecked ?? false
    }
    formStateRestoreCallback(state: string | File | FormData | null) {
        this.stop()
        this.checked = state === "on"
    }

    private update() {
        this.input.checked = this.checked
        this.input.disabled = this.unavailable
        // A muted switch has no audible cue to describe (for example, a mixer mute).
        this.root.querySelector<HTMLElement>("#help")!.hidden = this.muted
        if (this.muted) this.input.removeAttribute("aria-describedby")
        else this.input.setAttribute("aria-describedby", "help")
        this.root.querySelector(".text")!.textContent = this.getAttribute("label") || "Audio switch"
        this.root.querySelector(".state")!.textContent = this.checked ? "On" : "Off"
        this.internals.setFormValue(
            this.checked && !this.unavailable ? this.value : null,
            this.checked ? "on" : "off",
        )
    }

    private release() {
        const held = this.held
        this.held = undefined
        if (held)
            dispatchInstrumentEvent(
                this,
                NOTE_OFF,
                noteDetail("noteOff", held.note, 0, held.id, held),
            )
    }

    /** Replay the current state's cue. Attribute/property changes alone are silent. */
    playCue() {
        this.stop()
        if (this.unavailable || this.muted || !this.isConnected) return
        const generation = this.generation
        const notes = this.checked ? [60, 67] : [55, 48]
        const play = (index: number) => {
            if (
                generation !== this.generation ||
                this.unavailable ||
                this.muted ||
                !this.isConnected
            )
                return
            const detail = noteDetail("noteOn", notes[index]!, 0.65, 0, { group: 0, channel: 0 })
            this.held = detail
            dispatchInstrumentEvent(this, NOTE_ON, detail)
            if (generation !== this.generation) return
            this.timer = setTimeout(() => {
                this.release()
                if (generation !== this.generation) return
                if (index === 0) this.timer = setTimeout(() => play(1), 35)
                else this.timer = undefined
            }, 130)
        }
        play(0)
    }

    stop() {
        this.generation++
        clearTimeout(this.timer)
        this.timer = undefined
        this.release()
    }
}

if (!customElements.get("audio-switch")) customElements.define("audio-switch", AudioSwitch)
declare global {
    interface HTMLElementTagNameMap {
        "audio-switch": AudioSwitch
    }
}