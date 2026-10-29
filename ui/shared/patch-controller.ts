import { PROGRAM_CHANGE } from "../../commands.ts"
import {
    dispatchInstrumentEvent,
    midi2Header,
    range,
    type UMP64,
} from "../interfaces/instrument.ts"

/** Shared patch selection for event-only audio controllers. */
export abstract class PatchController extends HTMLElement {
    static observedAttributes = ["patch", "program"]
    private reflectedPatch?: { name: string; value: string | null }
    private patchReady = false

    connectedCallback() {
        this.patchReady = true
    }

    get patch() {
        return this.patchNumber(this.getAttribute("patch") ?? this.getAttribute("program"))
    }
    set patch(value: number) {
        this.setAttribute("patch", String(range(value, 0, 127, "patch", true)))
    }
    get program() {
        return this.patch
    }
    set program(value: number) {
        this.setAttribute("program", String(range(value, 0, 127, "program", true)))
    }

    private patchNumber(value: string | null) {
        const number = value === null || !value.trim() ? 0 : Number(value)
        return Number.isInteger(number) && number >= 0 && number <= 127 ? number : 0
    }

    attributeChangedCallback(name: string, previous: string | null, next: string | null) {
        if (!["patch", "program"].includes(name) || previous === next) return
        // Upgrade reactions can run after connectedCallback, and reflection can
        // enqueue another reaction rather than invoking it synchronously.
        if (next !== this.getAttribute(name)) return
        if (this.reflectedPatch?.name === name && this.reflectedPatch.value === next) {
            this.reflectedPatch = undefined
            return
        }
        // Reflection can flush the queued connectedCallback during an upgrade.
        const notify = this.patchReady && this.isConnected
        this.stop()
        const alias = name === "patch" ? "program" : "patch"
        if (this.getAttribute(alias) !== next) {
            this.reflectedPatch = { name: alias, value: next }
            if (next === null) this.removeAttribute(alias)
            else this.setAttribute(alias, next)
        }
        if (notify && this.isConnected && this.patchNumber(previous) !== this.patch)
            this.programChange(this.patch)
    }

    /** Request a MIDI patch using the same event consumed by the audio engine. */
    programChange(program: number, bank?: number) {
        range(program, 0, 127, "program", true)
        if (bank !== undefined) range(bank, 0, 16383, "bank", true)
        const address = {
            group: this.addressNumber("group"),
            channel: this.addressNumber("channel"),
        }
        const ump: UMP64 = Object.freeze([
            (midi2Header(0xc, address) | (bank === undefined ? 0 : 1)) >>> 0,
            ((program << 24) | (bank === undefined ? 0 : ((bank >> 7) << 8) | (bank & 127))) >>> 0,
        ])
        dispatchInstrumentEvent(this, PROGRAM_CHANGE, { ...address, program, bank, ump })
    }

    private addressNumber(name: string) {
        const value = Number(this.getAttribute(name) ?? 0)
        return Number.isInteger(value) && value >= 0 && value <= 15 ? value : 0
    }

    abstract stop(): void
}