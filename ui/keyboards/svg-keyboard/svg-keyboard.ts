// oxlint-disable-next-line typescript/triple-slash-reference -- Bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { EVENT_CONTEXT_MENU } from "../../../event-constants.ts"
import { EVENT_CLICK, EVENT_KEY_DOWN, EVENT_KEY_UP } from "../../../event-constants.ts"
import styles from "./svg-keyboard.css?inline"
import { instrumentNote, type InstrumentNote } from "../../interfaces/instrument.ts"
import { ChordController } from "../../shared/chord-controller.ts"
import { createKeyboardSVG } from "./artwork.ts"

/** The existing piano artwork as an event-only, polyphonic instrument component. */
export class SVGKeyboardElement extends ChordController {
	static observedAttributes = [
		...ChordController.observedAttributes,
		"min",
		"max",
		"first-note",
		"key-count",
		"label",
		"disabled",
		"muted",
		"group",
		"channel",
		"orientation"
	]
	private focusedNote = 60
	private activationTimer?: ReturnType<typeof setTimeout>

	get orientation(): "horizontal" | "vertical" {
		return this.getAttribute("orientation") === "vertical" ? "vertical" : "horizontal"
	}
	set orientation(value: "horizontal" | "vertical") {
		this.setAttribute("orientation", value)
	}

	get min() {
		return this.hasAttribute("first-note")
			? this.bound("first-note", 48)
			: this.bound("min", 48)
	}
	set min(value: number) {
		this.setAttribute("min", String(value))
	}
	get max() {
		if (this.hasAttribute("key-count") || this.hasAttribute("first-note")) {
			const count = this.numberOfKeys(25)
			return Math.min(127, this.min + count - 1)
		}
		return Math.max(this.min, this.bound("max", 72))
	}
	set max(value: number) {
		this.setAttribute("max", String(value))
	}
	get firstNote() {
		return this.min
	}
	set firstNote(value: number) {
		this.setAttribute("first-note", String(value))
	}
	get keyCount() {
		return this.max - this.min + 1
	}
	set keyCount(value: number) {
		this.setAttribute("key-count", String(value))
	}
	private numberOfKeys(fallback: number) {
		const raw = this.getAttribute("key-count")
		const value = raw === null || !raw.trim() ? fallback : Number(raw)
		return Number.isFinite(value) ? Math.max(1, Math.min(128, Math.round(value))) : fallback
	}
	get keyElements() {
		return [...this.root.querySelectorAll<SVGElement>(".piano-key")]
	}
	get asElement() {
		return this
	}
	get notes() {
		return Array.from({ length: this.max - this.min + 1 }, (_, i) =>
			instrumentNote(this.min + i)
		)
	}
	get firstNoteNumber() {
		return this.min
	}
	set title(value: string) {
		this.setAttribute("label", value)
	}

	private bound(name: string, fallback: number) {
		const raw = this.getAttribute(name)
		const value = raw === null || !raw.trim() ? fallback : Number(raw)
		return Number.isFinite(value) ? Math.max(0, Math.min(127, Math.round(value))) : fallback
	}

	protected chord(root: number) {
		return [root]
	}

	protected render() {
		this.root.innerHTML = `<style>${styles}</style>
          <div class="heading" part="heading"><strong part="label"></strong></div>
          <div class="viewport" part="viewport"><svg role="group" part="keyboard"></svg></div>
          <p part="help">Use arrow keys to move between notes, Home or End for the limits. Hold Enter or Space to play. Touch several keys for chords, or drag between keys.</p>`
	}

	protected update() {
		const svg = this.root.querySelector<SVGSVGElement>("svg")!
		const focused = this.root.activeElement as SVGElement | null
		const restoreFocus = !!focused?.matches("[data-pad]")
		const rebuild =
			svg.dataset.min !== String(this.min) ||
			svg.dataset.max !== String(this.max) ||
			svg.dataset.orientation !== this.orientation
		if (rebuild) {
			const artwork = createKeyboardSVG(this.notes, { orientation: this.orientation })
			const template = document.createElement("template")
			template.innerHTML = artwork.svg
			const replacement = template.content.querySelector("svg")!
			for (const name of ["viewBox", "aria-labelledby", "aria-describedby"]) {
				svg.setAttribute(name, replacement.getAttribute(name)!)
			}
			svg.setAttribute("preserveAspectRatio", "none")
			svg.innerHTML = replacement.innerHTML
			svg.dataset.min = String(this.min)
			svg.dataset.max = String(this.max)
			svg.dataset.orientation = this.orientation
			this.root.querySelector<HTMLElement>(".viewport")!.dataset.orientation =
				this.orientation
			svg.style.setProperty("--keyboard-width", `${(artwork.width * 44) / 13}px`)
			for (const key of this.keyElements) {
				key.dataset.pad = key.dataset.number
				key.dataset.note = key.dataset.number
				key.setAttribute(
					"part",
					`key ${key.classList.contains("piano-key-black") ? "black-key" : "white-key"}`
				)
			}
		}
		const label = this.getAttribute("label") || "Piano keyboard"
		this.root.querySelector("strong")!.textContent = label
		svg.querySelector("title")!.textContent = `${label}: ${this.notes.length} keys`
		this.focusedNote = Math.max(this.min, Math.min(this.max, this.focusedNote))
		for (const key of this.keyElements) {
			key.setAttribute("aria-disabled", String(this.disabled))
			key.setAttribute(
				"tabindex",
				!this.disabled && Number(key.dataset.number) === this.focusedNote ? "0" : "-1"
			)
		}
		this.updatePressed()
		if (rebuild) {
			this.focusNote(this.focusedNote, restoreFocus)
		}
	}

	protected connectControls(options: { signal: AbortSignal }) {
		this.root.addEventListener(
			EVENT_KEY_DOWN,
			(event) => {
				const key = event as KeyboardEvent
				key.stopPropagation()
				const pad = (key.target as Element).closest<SVGElement>("[data-pad]")
				if (!pad || this.disabled) {
					return
				}
				const pitch = Number(pad.dataset.number)
				let next: number | undefined
				if (
					[
						"ArrowRight",
						this.orientation === "vertical" ? "ArrowUp" : "ArrowDown"
					].includes(key.key)
				) {
					next = pitch === this.max ? this.min : pitch + 1
				}
				if (
					[
						"ArrowLeft",
						this.orientation === "vertical" ? "ArrowDown" : "ArrowUp"
					].includes(key.key)
				) {
					next = pitch === this.min ? this.max : pitch - 1
				}
				if (key.key === "Home") {
					next = this.min
				}
				if (key.key === "End") {
					next = this.max
				}
				if (next !== undefined) {
					key.preventDefault()
					this.focusNote(next)
				}
				if (key.key === "Escape") {
					this.stop()
				}
			},
			options
		)
		this.root.addEventListener(EVENT_KEY_UP, (event) => event.stopPropagation(), options)
		this.root.addEventListener(
			"focusin",
			(event) => {
				const pad = (event.target as Element).closest<SVGElement>("[data-pad]")
				if (pad) {
					this.focusNote(Number(pad.dataset.number), false)
				}
			},
			options
		)
		this.root.addEventListener(EVENT_CONTEXT_MENU, (event) => event.preventDefault(), options)
		// Screen-reader/voice-control activation may arrive as a click without key events.
		this.root.addEventListener(
			EVENT_CLICK,
			(event) => {
				const click = event as MouseEvent
				const pad = (click.target as Element).closest<SVGElement>("[data-pad]")
				if (!pad || click.detail !== 0 || this.disabled) {
					return
				}
				clearTimeout(this.activationTimer)
				const note = Number(pad.dataset.number)
				this.noteOn(note, 1, 0)
				this.activationTimer = setTimeout(() => this.noteOff(note, 0, 0), 160)
			},
			options
		)
	}

	private focusNote(note: number, focus = true) {
		this.focusedNote = note
		const pad = this.keyElements.find((key) => Number(key.dataset.number) === note)
		for (const key of this.keyElements) {
			key.setAttribute("tabindex", !this.disabled && key === pad ? "0" : "-1")
		}
		if (!pad) {
			return
		}
		if (focus) {
			pad.focus({ preventScroll: true })
		}
		const viewport = this.root.querySelector<HTMLElement>(".viewport")!
		const bounds = viewport.getBoundingClientRect(),
			keyBounds = pad.getBoundingClientRect()
		if (keyBounds.left < bounds.left + 8) {
			viewport.scrollLeft += keyBounds.left - bounds.left - 8
		} else if (keyBounds.right > bounds.right - 8) {
			viewport.scrollLeft += keyBounds.right - bounds.right + 8
		}
		if (keyBounds.top < bounds.top + 8) {
			viewport.scrollTop += keyBounds.top - bounds.top - 8
		} else if (keyBounds.bottom > bounds.bottom - 8) {
			viewport.scrollTop += keyBounds.bottom - bounds.bottom + 8
		}
	}

	protected updatePressed() {
		super.updatePressed()
		const held = new Set([...this.held.values()].map((detail) => detail.note.noteNumber))
		for (const key of this.keyElements) {
			const note = Number(key.dataset.number)
			const active = held.has(note) || this.activeNotes.has(note)
			key.classList.toggle("active", active)
			key.toggleAttribute("data-active", active)
			key.setAttribute("aria-pressed", String(held.has(note)))
			if (active) {
				key.setAttribute("aria-description", "Note is sounding")
			} else {
				key.removeAttribute("aria-description")
			}
		}
		for (const indicator of this.root.querySelectorAll<SVGElement>(".piano-note-indicator")) {
			indicator.classList.toggle(
				"active",
				held.has(Number(indicator.dataset.number)) ||
					this.activeNotes.has(Number(indicator.dataset.number))
			)
		}
	}

	/** Compatibility with the old SVGKeyboard's silent highlighting API. */
	setKeyAsActive(note: InstrumentNote | number) {
		this.setActiveNote(note)
	}
	setKeyAsInactive(note: InstrumentNote | number) {
		this.setActiveNote(note, false)
	}
	stop() {
		clearTimeout(this.activationTimer)
		this.activationTimer = undefined
		super.stop()
	}
}

if (!customElements.get("svg-keyboard-audio-controller")) {
	customElements.define("svg-keyboard-audio-controller", SVGKeyboardElement)
}
// Keep previously embedded keyboards working with the same implementation.
if (!customElements.get("svg-keyboard")) {
	customElements.define("svg-keyboard", class extends SVGKeyboardElement {})
}
declare global {
	interface HTMLElementTagNameMap {
		"svg-keyboard": SVGKeyboardElement
		"svg-keyboard-audio-controller": SVGKeyboardElement
	}
}