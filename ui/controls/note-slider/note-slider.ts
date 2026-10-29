// oxlint-disable-next-line typescript/triple-slash-reference -- Bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { NOTE_OFF, NOTE_ON } from "../../../commands.ts"
import {
	EVENT_BLUR,
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_FOCUS_OUT,
	EVENT_INPUT,
	EVENT_INSTRUMENT_DISCONNECT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_PAGE_HIDE,
	EVENT_VISIBILITY_CHANGE
} from "../../../event-constants.ts"
import styles from "./note-slider.css?inline"
import { PatchController } from "../../shared/patch-controller.ts"
import {
	dispatchInstrumentEvent,
	instrumentNote,
	noteDetail,
	type InstrumentNote,
	type NoteDetail
} from "../../interfaces/instrument.ts"

/** A native accessible range control; all sound is delegated to the host engine. */
export class NoteSlider extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"min",
		"max",
		"value",
		"label",
		"disabled",
		"vertical",
		"muted"
	]
	protected root = this.attachShadow({ mode: "open", delegatesFocus: true })
	protected input: HTMLInputElement
	private output: HTMLOutputElement
	private replay: HTMLButtonElement
	private lower: HTMLButtonElement
	private higher: HTMLButtonElement
	private sound: HTMLInputElement
	private held?: NoteDetail
	private timer?: ReturnType<typeof setTimeout>
	private listeners?: AbortController
	private activeNotes = new Set<number>()

	constructor() {
		super()
		this.root.innerHTML = `
          <style>${styles}</style>
          <div class="panel" role="group" aria-labelledby="slider-label">
            <div class="heading"><label id="slider-label" for="pitch">Note slider</label><output for="pitch" aria-hidden="true"></output></div>
            <div class="travel">
              <div class="track"><input id="pitch" type="range" step="1" aria-describedby="help"><div class="ticks" aria-hidden="true"></div></div>
              <div class="ends" aria-hidden="true"><span data-low></span><span data-high></span></div>
            </div>
            <p id="help">Move towards the end for higher notes. Use arrow keys for one tick, Home for the lowest note, or End for the highest. Each tick plays a short note.</p>
            <div class="actions">
              <button type="button" data-lower>Lower note</button>
              <button type="button" data-higher>Higher note</button>
              <button type="button" data-replay>Play selected note</button>
            </div>
            <label class="sound"><input type="checkbox" checked>Sound feedback</label>
            <p class="sr-only" role="status" aria-atomic="true"></p>
            <p class="playing" aria-hidden="true"></p>
          </div>`
		for (const [selector, part] of Object.entries({
			".panel": "panel",
			".heading": "heading",
			"#slider-label": "label",
			output: "value",
			".travel": "travel",
			".track": "track",
			"#pitch": "range",
			".ticks": "ticks",
			".ends": "endpoints",
			"#help": "help",
			".actions": "actions",
			"[data-lower]": "lower",
			"[data-higher]": "higher",
			"[data-replay]": "replay",
			".sound": "sound",
			"input[type=checkbox]": "checkbox",
			'[role="status"]': "status",
			".playing": "playing"
		})) {
			this.root.querySelector(selector)!.setAttribute("part", part)
		}
		this.input = this.root.querySelector("input[type=range]")!
		this.output = this.root.querySelector("output")!
		this.replay = this.root.querySelector("[data-replay]")!
		this.lower = this.root.querySelector("[data-lower]")!
		this.higher = this.root.querySelector("[data-higher]")!
		this.sound = this.root.querySelector("input[type=checkbox]")!
	}

	get min() {
		return this.numberAttribute("min", 36)
	}
	get max() {
		return Math.max(this.min, this.numberAttribute("max", 84))
	}
	get value() {
		return Math.max(this.min, Math.min(this.max, this.numberAttribute("value", 60)))
	}
	set value(value: number) {
		this.setAttribute("value", String(value))
	}
	get disabled() {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}
	get vertical() {
		return this.hasAttribute("vertical")
	}
	set vertical(value: boolean) {
		this.toggleAttribute("vertical", value)
	}
	get muted() {
		return this.hasAttribute("muted")
	}
	set muted(value: boolean) {
		this.toggleAttribute("muted", value)
	}

	private numberAttribute(name: string, fallback: number) {
		const text = this.getAttribute(name)
		const value = text === null || !text.trim() ? fallback : Number(text)
		return Number.isFinite(value) ? Math.max(0, Math.min(127, Math.round(value))) : fallback
	}

	connectedCallback() {
		super.connectedCallback()
		this.listeners?.abort()
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }
		this.input.addEventListener(
			EVENT_INPUT,
			(event) => {
				event.stopPropagation()
				if (this.disabled) {
					return
				}
				const next = Number(this.input.value)
				if (next === this.value) {
					return
				}
				this.value = next
				this.play()
				this.dispatchEvent(new Event(EVENT_INPUT, { bubbles: true, composed: true }))
			},
			options
		)
		this.input.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				if (!this.disabled) {
					this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
				}
			},
			options
		)
		this.replay.addEventListener(EVENT_CLICK, () => this.play(), options)
		this.lower.addEventListener(EVENT_CLICK, () => this.step(-1), options)
		this.higher.addEventListener(EVENT_CLICK, () => this.step(1), options)
		this.sound.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.sound.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.muted = !this.sound.checked
			},
			options
		)
		// Keep the application's musical keyboard shortcuts out of native controls.
		for (const type of [EVENT_KEY_DOWN, EVENT_KEY_UP]) {
			this.root.addEventListener(type, (event) => event.stopPropagation(), options)
		}
		this.root.addEventListener(
			EVENT_FOCUS_OUT,
			(event) => {
				if (!this.root.contains((event as FocusEvent).relatedTarget as Node | null)) {
					this.stop()
				}
			},
			options
		)
		window.addEventListener(EVENT_BLUR, () => this.stop(), options)
		window.addEventListener(EVENT_PAGE_HIDE, () => this.stop(), options)
		this.ownerDocument.addEventListener(
			EVENT_VISIBILITY_CHANGE,
			() => {
				if (this.ownerDocument.hidden) {
					this.stop()
				}
			},
			options
		)
		this.update()
	}

	disconnectedCallback() {
		this.stop()
		this.listeners?.abort()
		this.listeners = undefined
		this.clearActiveNotes()
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		if (previous === next) {
			return
		}
		if (name !== "label") {
			this.stop()
		}
		if (["value", "min", "max"].includes(name)) {
			this.root.querySelector('[role="status"]')!.textContent = ""
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	protected update() {
		this.input.min = String(this.min)
		this.input.max = String(this.max)
		this.input.value = String(this.value)
		this.input.disabled = this.disabled
		this.replay.disabled = this.disabled || this.muted
		this.lower.disabled = this.disabled
		this.higher.disabled = this.disabled
		// Keep endpoint buttons focusable so repeating a step never loses focus.
		this.lower.setAttribute("aria-disabled", String(this.disabled || this.value === this.min))
		this.higher.setAttribute("aria-disabled", String(this.disabled || this.value === this.max))
		this.sound.disabled = this.disabled
		this.sound.checked = !this.muted
		this.input.setAttribute("aria-orientation", this.vertical ? "vertical" : "horizontal")
		this.root.querySelector("#help")!.textContent =
			`${this.vertical ? "Move upwards" : "Move towards the end"} for higher notes. Use arrow keys for one tick, Home for the lowest note, or End for the highest. You can also use Lower note and Higher note. Turn off Sound feedback to move in silence.`
		this.root.querySelector("label")!.textContent = this.getAttribute("label") || "Note slider"
		const note = instrumentNote(this.value)
		const position = `${this.value - this.min + 1} of ${this.max - this.min + 1}`
		this.input.setAttribute(
			"aria-valuetext",
			`${this.spokenNote(note)}, tick ${position}${this.value === this.min ? ", lowest note" : this.value === this.max ? ", highest note" : ""}`
		)
		this.output.textContent = `${note.noteName} · ${position}`
		this.root.querySelector("[data-low]")!.textContent =
			`Low · ${instrumentNote(this.min).noteName}`
		this.root.querySelector("[data-high]")!.textContent =
			`High · ${instrumentNote(this.max).noteName}`
		const ticks = this.root.querySelector(".ticks")!
		const count = this.max - this.min + 1
		if (ticks.childElementCount !== count) {
			ticks.replaceChildren(
				...Array.from({ length: count }, () => document.createElement("span"))
			)
		}
		this.updateFeedback()
	}

	private spokenNote(note: InstrumentNote) {
		return `${note.noteKey.replace("#", " sharp")}, octave ${note.octave}`
	}

	private step(direction: number) {
		if (this.disabled) {
			return
		}
		const next = Math.max(this.min, Math.min(this.max, this.value + direction))
		if (next === this.value) {
			return
		}
		this.value = next
		this.play()
		this.root.querySelector('[role="status"]')!.textContent =
			`Selected ${this.input.getAttribute("aria-valuetext")}`
		for (const type of [EVENT_INPUT, EVENT_CHANGE]) {
			this.dispatchEvent(new Event(type, { bubbles: true, composed: true }))
		}
	}

	/** Audition the current tick via the same note protocol as the other controllers. */
	play() {
		if (this.disabled || this.muted || !this.isConnected) {
			return
		}
		this.stop()
		const detail = noteDetail("noteOn", this.value, 0.65, 0, { group: 0, channel: 0 })
		this.held = detail
		dispatchInstrumentEvent(this, NOTE_ON, detail)
		if (this.held === detail) {
			this.timer = setTimeout(() => this.stop(), 140)
		}
	}

	stop() {
		clearTimeout(this.timer)
		this.timer = undefined
		const held = this.held
		this.held = undefined
		if (held) {
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail("noteOff", held.note, 0, held.id, held)
			)
		}
	}

	setActiveNote(note: InstrumentNote | number, active = true) {
		const number = instrumentNote(note).noteNumber
		if (active) {
			this.activeNotes.add(number)
		} else {
			this.activeNotes.delete(number)
		}
		this.updateFeedback()
	}
	setActiveNotes(notes: Iterable<InstrumentNote | number>) {
		this.activeNotes = new Set([...notes].map((note) => instrumentNote(note).noteNumber))
		this.updateFeedback()
	}
	clearActiveNotes() {
		this.activeNotes.clear()
		this.updateFeedback()
	}
	private updateFeedback() {
		const playing = this.activeNotes.has(this.value)
		this.toggleAttribute("data-active", playing)
		this.root.querySelector(".playing")!.textContent = playing
			? `Playing ${instrumentNote(this.value).noteName}`
			: ""
	}
}

if (!customElements.get("note-slider")) {
	customElements.define("note-slider", NoteSlider)
}
declare global {
	interface HTMLElementTagNameMap {
		"note-slider": NoteSlider
	}
}