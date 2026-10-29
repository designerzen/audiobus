// oxlint-disable-next-line typescript/triple-slash-reference -- Standalone bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { EVENT_CLICK, EVENT_INSTRUMENT_CHANGE, EVENT_KEY_DOWN } from "../../../event-constants.ts"
import artwork from "./circular-controller.svg?raw"
import styles from "./circular-controller.css?inline"
import { TUNING_MODE_NAMES } from "../../shared/chords.js"
import { getEmojiForScaleAndMode } from "../../shared/emoji.js"
import Note from "../../../note-model.ts"
import { dispatchInstrumentEvent, instrumentNote, range } from "../../interfaces/instrument.ts"
import { ChordController } from "../../shared/chord-controller.ts"

if (typeof FontFace !== "undefined" && document.fonts) {
	const emojiFont = new FontFace(
		"circular-controller-emoji",
		`url("${new URL("./NotoEmoji-VariableFont_wght.ttf", import.meta.url).href}")`
	)
	document.fonts.add(emojiFont)
	void emojiFont
		.load()
		.catch((error) => console.warn("Circular controller emoji font failed to load", error))
}

/** The main-page circular SVG as a silent, reusable instrument controller. */
export class CircularController extends ChordController {
	static observedAttributes = [
		...ChordController.observedAttributes.filter((name) => name !== "scale"),
		"note-count"
	]

	get noteCount() {
		const value = Number(this.getAttribute("note-count") ?? 3)
		return Number.isInteger(value) && value >= 1 && value <= 5 ? value : 3
	}
	set noteCount(value: number) {
		this.setAttribute("note-count", String(range(value, 1, 5, "noteCount", true)))
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		super.attributeChangedCallback(name, previous, next)
		if (
			name === "note-count" &&
			previous !== next &&
			this.isConnected &&
			this.root.childElementCount
		) {
			dispatchInstrumentEvent(this, EVENT_INSTRUMENT_CHANGE, {
				control: "note-count",
				value: this.noteCount
			})
		}
	}

	protected chord(root: number) {
		// Stack diatonic thirds in the selected mode, retaining the octave of
		// extensions (the fifth voice is a ninth, rather than a folded second).
		const scale = [0, 2, 4, 5, 7, 9, 11]
		return Array.from({ length: this.noteCount }, (_, index) => {
			const degree = this.mode + index * 2
			return root + scale[degree % 7]! - scale[this.mode]! + Math.floor(degree / 7) * 12
		}).filter((note) => note <= 127)
	}

	protected connectControls(options: { signal: AbortSignal }) {
		this.root.querySelector(".fifths-emotion")!.addEventListener(
			EVENT_CLICK,
			() => {
				if (!this.disabled) {
					this.mode = (this.mode + 1) % 7
				}
			},
			options
		)
		this.root.querySelector(".fifths-emotion")!.addEventListener(
			"dblclick",
			() => {
				if (!this.disabled) {
					this.program = (this.program + 1) % 128
				}
			},
			options
		)
		for (const [selector, action] of [
			[
				".fifths-emotion",
				() => {
					this.mode = (this.mode + 1) % 7
				}
			],
			[
				".curved-text-frequency",
				() => {
					this.octave = this.octave <= 3 ? 5 : this.octave <= 5 ? 7 : 3
				}
			],
			[
				".curved-text-timbre",
				() => {
					this.program = (this.program + 1) % 128
				}
			]
		] as const) {
			const control = this.root.querySelector<SVGElement>(selector)!
			if (selector !== ".fifths-emotion") {
				control.addEventListener(
					EVENT_CLICK,
					() => {
						if (!this.disabled) {
							action()
						}
					},
					options
				)
			}
			control.addEventListener(
				EVENT_KEY_DOWN,
				(event) => {
					if (["Enter", " "].includes(event.key) && !event.repeat && !this.disabled) {
						event.preventDefault()
						action()
					}
				},
				options
			)
		}
	}

	protected render() {
		this.root.innerHTML = `<style>${styles}</style><figure>${artwork}<figcaption>Circular instrument controller</figcaption></figure>
          <div class="controls">
            <label>Octave<select data-control="octave">${Array.from({ length: 9 }, (_, i) => `<option value="${i}">${i}</option>`).join("")}</select></label>
            <label>Notes in chord<select data-control="note-count">${Array.from({ length: 5 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}</select></label>
            <label>Mode<select data-control="mode">${TUNING_MODE_NAMES.map((name, i) => `<option value="${i}">${name}</option>`).join("")}</select></label>
            <label>Patch / program<input data-control="program" type="number" min="0" max="127" step="1"></label>
          </div><p>Choose 1 note for a monophonic instrument, or 2–5 notes for chords. Hold a segment to play; drag across segments or use Enter / Space on a focused segment. The face cycles modes; timbre requests a MIDI program. This controller emits events and produces no audio.</p>`
		this.root.querySelector("title")!.textContent =
			"Circular instrument controller: two rings of chord pads"
		for (const [selector, label] of [
			[".fifths-emotion", "Next mode"],
			[".curved-text-frequency", "Next octave"],
			[".curved-text-timbre", "Next program"]
		]) {
			const control = this.root.querySelector(selector!)!
			control.setAttribute("role", "button")
			control.setAttribute("tabindex", "0")
			control.setAttribute("aria-label", label!)
		}
		for (const group of ["harmonies", "tonics"]) {
			this.root
				.querySelectorAll<SVGElement>(`.circle-of-fifths-${group} > path`)
				.forEach((pad, index) => {
					pad.dataset.pad = `${group}:${index}`
					pad.setAttribute("role", "button")
					pad.setAttribute("tabindex", "0")
				})
		}
	}

	protected update() {
		for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-control]")) {
			const name = input.dataset.control as "octave" | "mode" | "note-count" | "program"
			input.value = String(name === "note-count" ? this.noteCount : this[name])
			input.disabled = this.disabled
		}
		for (const pad of this.root.querySelectorAll<SVGElement>("[data-pad]")) {
			const [ring, index] = pad.dataset.pad!.split(":")
			// Clockwise fifths, with the inner ring offset to the relative minor root.
			const pitch = (Number(index) * 7 + (ring === "tonics" ? 9 : 0)) % 12
			const note = instrumentNote((this.octave + 1) * 12 + pitch)
			pad.dataset.note = String(note.noteNumber)
			const colour = new Note(pitch)
			pad.style.setProperty("--key-colour", colour.colour)
			const chord = this.chord(note.noteNumber)
				.map((n) => instrumentNote(n).noteName)
				.join(", ")
			pad.setAttribute(
				"aria-label",
				`${note.noteName} ${this.noteCount === 1 ? "note" : "chord"}: ${chord}`
			)
		}
		this.root.querySelector(".fifths-emotion-text")!.textContent = getEmojiForScaleAndMode(
			"Major",
			this.mode
		)
		this.root.querySelector(".curved-text-tone")!.textContent = TUNING_MODE_NAMES[this.mode]!
		this.root
			.querySelector(".curved-text-tone")!
			.setAttribute("startOffset", `${39.5 - TUNING_MODE_NAMES[this.mode]!.length * 0.5}%`)
		const frequency = this.octave <= 3 ? "Bass" : this.octave <= 5 ? "Lead" : "Treble"
		this.root.querySelector(".curved-text-frequency")!.textContent = frequency
		this.root
			.querySelector(".curved-text-frequency")!
			.setAttribute(
				"aria-label",
				`${frequency}: next register (${this.octave <= 3 ? "Lead" : this.octave <= 5 ? "Treble" : "Bass"})`
			)
		this.root
			.querySelector(".curved-text-frequency")!
			.setAttribute("startOffset", `${75 - frequency.length * 0.5}%`)
		this.root.querySelector(".curved-text-timbre")!.textContent = `Program ${this.program + 1}`
		const timbre = `Program ${this.program + 1}`
		this.root
			.querySelector(".curved-text-timbre")!
			.setAttribute("startOffset", `${12.5 - timbre.length * 0.5}%`)
		for (const control of this.root.querySelectorAll<SVGElement>('[role="button"]')) {
			control.setAttribute("aria-disabled", String(this.disabled))
			control.setAttribute("tabindex", this.disabled ? "-1" : "0")
		}
		this.updatePressed()
	}
}

if (!customElements.get("circular-controller")) {
	customElements.define("circular-controller", CircularController)
}
declare global {
	interface HTMLElementTagNameMap {
		"circular-controller": CircularController
	}
}