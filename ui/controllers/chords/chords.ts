import { NOTE_OFF, NOTE_ON } from "../../../commands/commands.ts"
import {
	EVENT_BLUR,
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_INPUT,
	EVENT_INSTRUMENT_DISCONNECT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_LOST_POINTER_CAPTURE,
	EVENT_PAGE_HIDE,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_VISIBILITY_CHANGE
} from "../../../events/event-constants.ts"
import {
	dispatchInstrumentEvent,
	instrumentNote,
	noteDetail,
	type InstrumentNote,
	type NoteDetail
} from "../../interfaces/instrument.ts"
import { PatchController } from "../../shared/patch-controller.ts"
import {
	CML_GOLD,
	CML_HOST_STYLES,
	clamp,
	isAccidental,
	midiAddressFromElement
} from "../../shared/chrome-music-lab.ts"

export type ChordMode = "major" | "minor"

const ROLL_DELAY_MS = 50
const DEFAULT_OCTAVE = 3 // C3–C5, matching Chrome Music Lab Chords
const KEY_COUNT = 25 // 2 octaves inclusive (C3..C5)

let voiceId = 3200000

const STYLES = `${CML_HOST_STYLES}
.banner {
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 2.2rem;
	padding: 0.35rem 0.75rem;
	font-weight: 700;
	font-size: 1.05rem;
	letter-spacing: 0.02em;
	color: ${CML_GOLD};
}
.keyboard {
	position: relative;
	flex: 1 1 var(--stage-height, 150px);
	min-height: 88px;
	margin: 0 0.5rem 0.5rem;
	border-radius: 8px;
	overflow: hidden;
	background: #1b2232;
	user-select: none;
	touch-action: none;
}
.whites {
	display: flex;
	height: 100%;
	width: 100%;
}
.key {
	position: relative;
	border: 1px solid rgba(15, 23, 42, 0.35);
	border-radius: 0 0 6px 6px;
	padding: 0;
	min-height: 0;
	cursor: pointer;
	transition: background-color 80ms ease;
}
.key.white {
	flex: 1 1 0;
	height: 100%;
	background: #f5f7fb;
	color: #1c2434;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding-bottom: 0.35rem;
	font-size: 0.72rem;
	font-weight: 600;
}
.key.black {
	position: absolute;
	top: 0;
	height: 60%;
	z-index: 2;
	background: #222836;
	color: #e2e8f0;
	border-color: #0b0f18;
}
.key[data-chord="true"] {
	background: ${CML_GOLD};
	color: #16181f;
}
.key[data-root="true"] {
	background: #ff9f1c;
	color: #11131a;
}
.key[data-external="true"]:not([data-chord="true"]) {
	background: #4bb250;
	color: #0b1116;
}
.mode-toggle {
	display: inline-flex;
	border-radius: 6px;
	overflow: hidden;
	border: 1px solid color-mix(in oklab, currentColor 32%, transparent);
}
.mode-toggle button {
	border: 0;
	border-radius: 0;
}
`

/**
 * Chord keyboard input inspired by Chrome Music Lab Chords.
 * Pressing any key highlights and emits a Major or Minor triad (optionally rolled).
 */
export class ChordKeyboard extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"mode",
		"octave",
		"roll",
		"disabled",
		"group",
		"channel"
	]

	protected root = this.attachShadow({ mode: "open" })
	private banner: HTMLElement
	private keyboard: HTMLElement
	private status: HTMLElement
	private majorBtn: HTMLButtonElement
	private minorBtn: HTMLButtonElement
	private rollInput: HTMLInputElement
	private octaveInput: HTMLInputElement
	private keyButtons = new Map<number, HTMLButtonElement>()
	private held = new Map<number, NoteDetail>()
	private timers = new Set<ReturnType<typeof setTimeout>>()
	private activePointers = new Map<number, number>()
	private activeNotes = new Set<number>()
	private chordNotes = new Set<number>()
	private lastRoot: number | null = null
	private listeners?: AbortController
	private observer?: ResizeObserver

	constructor() {
		super()
		this.root.innerHTML = `
			<style>${STYLES}</style>
			<div class="toolbar" part="toolbar">
				<div class="mode-toggle" role="group" aria-label="Chord quality">
					<button type="button" data-mode="major" aria-pressed="true">Major</button>
					<button type="button" data-mode="minor" aria-pressed="false">Minor</button>
				</div>
				<label>Octave <input data-octave type="number" min="1" max="6" step="1"></label>
				<label><input data-roll type="checkbox" checked> Roll</label>
			</div>
			<div class="banner" part="banner" aria-live="polite">Press a key</div>
			<div class="keyboard" part="keyboard" role="group" aria-label="Chord keyboard"></div>
			<p class="sr-only" role="status" aria-atomic="true"></p>`
		this.banner = this.root.querySelector(".banner")!
		this.keyboard = this.root.querySelector(".keyboard")!
		this.status = this.root.querySelector('[role="status"]')!
		this.majorBtn = this.root.querySelector('[data-mode="major"]')!
		this.minorBtn = this.root.querySelector('[data-mode="minor"]')!
		this.rollInput = this.root.querySelector("[data-roll]")!
		this.octaveInput = this.root.querySelector("[data-octave]")!
		this.buildKeys()
	}

	get mode(): ChordMode {
		return this.getAttribute("mode")?.toLowerCase() === "minor" ? "minor" : "major"
	}
	set mode(value: ChordMode) {
		this.setAttribute("mode", value === "minor" ? "minor" : "major")
	}

	get octave(): number {
		const raw = this.getAttribute("octave")
		const parsed = raw === null || !raw.trim() ? DEFAULT_OCTAVE : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 1, 6)) : DEFAULT_OCTAVE
	}
	set octave(value: number) {
		this.setAttribute("octave", String(Math.round(clamp(value, 1, 6))))
	}

	get roll(): boolean {
		const raw = this.getAttribute("roll")
		return raw === null ? true : raw !== "false"
	}
	set roll(value: boolean) {
		this.setAttribute("roll", value ? "true" : "false")
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}

	/** Triad MIDI notes for a given root note in the current mode. */
	triadFor(rootMidi: number): number[] {
		const intervals = this.mode === "minor" ? [0, 3, 7] : [0, 4, 7]
		return intervals.map((step) => rootMidi + step).filter((note) => note >= 0 && note <= 127)
	}

	connectedCallback() {
		super.connectedCallback()
		this.listeners?.abort()
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }

		this.majorBtn.addEventListener(
			EVENT_CLICK,
			() => {
				this.mode = "major"
				this.changed()
			},
			options
		)
		this.minorBtn.addEventListener(
			EVENT_CLICK,
			() => {
				this.mode = "minor"
				this.changed()
			},
			options
		)
		this.octaveInput.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.octaveInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.octave = Number(this.octaveInput.value) || DEFAULT_OCTAVE
				this.changed()
			},
			options
		)
		this.rollInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.roll = this.rollInput.checked
				this.changed()
			},
			options
		)

		this.keyboard.addEventListener(
			EVENT_POINTER_DOWN,
			(event) => this.pointerDown(event),
			options
		)
		this.keyboard.addEventListener(
			EVENT_POINTER_MOVE,
			(event) => this.pointerMove(event),
			options
		)
		for (const type of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
			this.keyboard.addEventListener(
				type,
				(event) => this.pointerUp(event as PointerEvent),
				options
			)
		}

		this.keyboard.addEventListener(EVENT_KEY_DOWN, (event) => this.keyDown(event), options)
		this.keyboard.addEventListener(EVENT_KEY_UP, (event) => this.keyUp(event), options)
		for (const type of [EVENT_KEY_DOWN, EVENT_KEY_UP]) {
			this.root.addEventListener(type, (event) => event.stopPropagation(), options)
		}

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

		this.observer?.disconnect()
		if (typeof ResizeObserver !== "undefined") {
			this.observer = new ResizeObserver(() => {
				this.toggleAttribute(
					"data-compact",
					this.clientHeight > 0 && this.clientHeight < 140
				)
			})
			this.observer.observe(this)
		}
		this.update()
	}

	disconnectedCallback() {
		this.stop()
		this.listeners?.abort()
		this.listeners = undefined
		this.observer?.disconnect()
		this.observer = undefined
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		if (previous === next) {
			return
		}
		if (name === "octave") {
			this.stop()
			this.buildKeys()
		} else if (name === "mode") {
			if (this.lastRoot !== null && this.held.size > 0) {
				this.triggerChord(this.lastRoot)
			}
		} else if (name === "disabled") {
			this.stop()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	/** Sound a major or minor triad rooted at rootMidi. */
	triggerChord(rootMidi: number, velocity = 0.85): void {
		if (this.disabled || !this.isConnected) {
			return
		}
		this.releaseHeld()
		const notes = this.triadFor(rootMidi)
		this.lastRoot = rootMidi
		this.chordNotes = new Set(notes)
		const rootInfo = instrumentNote(rootMidi)
		const label = `${rootInfo.noteKey} ${this.mode === "minor" ? "Minor" : "Major"}`
		this.banner.textContent = `${label} (${notes.map((n) => instrumentNote(n).noteKey).join(" – ")})`
		this.status.textContent = label
		this.syncHighlights()

		const address = midiAddressFromElement(this)
		const delay = this.roll ? ROLL_DELAY_MS : 0
		notes.forEach((midi, index) => {
			const fire = () => {
				if (!this.isConnected || this.disabled) {
					return
				}
				const detail = noteDetail(
					NOTE_ON,
					midi,
					clamp(velocity, 0.05, 1),
					voiceId++,
					address
				)
				this.held.set(midi, detail)
				dispatchInstrumentEvent(this, NOTE_ON, detail)
			}
			if (!delay || index === 0) {
				fire()
			} else {
				const timer = setTimeout(() => {
					this.timers.delete(timer)
					fire()
				}, index * delay)
				this.timers.add(timer)
			}
		})
	}

	stop(): void {
		this.activePointers.clear()
		this.releaseHeld()
		this.chordNotes.clear()
		this.lastRoot = null
		this.syncHighlights()
	}

	setActiveNote(note: InstrumentNote | number, active = true): void {
		const number = instrumentNote(note).noteNumber
		if (active) {
			this.activeNotes.add(number)
		} else {
			this.activeNotes.delete(number)
		}
		this.syncHighlights()
	}

	setActiveNotes(notes: Iterable<InstrumentNote | number>): void {
		this.activeNotes = new Set([...notes].map((note) => instrumentNote(note).noteNumber))
		this.syncHighlights()
	}

	clearActiveNotes(): void {
		this.activeNotes.clear()
		this.syncHighlights()
	}

	private releaseHeld() {
		for (const timer of this.timers) {
			clearTimeout(timer)
		}
		this.timers.clear()
		for (const [midi, detail] of this.held) {
			this.held.delete(midi)
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, detail.note, 0, detail.id, detail)
			)
		}
	}

	private buildKeys() {
		const startMidi = (this.octave + 1) * 12
		const allNotes = Array.from({ length: KEY_COUNT }, (_, i) => startMidi + i)
		const whites = allNotes.filter((midi) => !isAccidental(midi))
		const whiteWidth = 100 / whites.length
		const blackWidth = whiteWidth * 0.64

		this.keyButtons.clear()
		const whitesRow = document.createElement("div")
		whitesRow.className = "whites"
		const fragment = document.createDocumentFragment()
		fragment.append(whitesRow)

		let whiteIndex = 0
		for (const midi of allNotes) {
			const info = instrumentNote(midi)
			const button = document.createElement("button")
			button.type = "button"
			button.dataset.midi = String(midi)
			button.setAttribute("aria-label", `${info.noteName} chord root`)
			if (isAccidental(midi)) {
				button.className = "key black"
				button.style.left = `${whiteIndex * whiteWidth - blackWidth / 2}%`
				button.style.width = `${blackWidth}%`
				fragment.append(button)
			} else {
				button.className = "key white"
				button.textContent = info.noteKey === "C" ? info.noteName : info.noteKey
				whitesRow.append(button)
				whiteIndex++
			}
			this.keyButtons.set(midi, button)
		}
		this.keyboard.replaceChildren(fragment)
		this.syncHighlights()
	}

	private update() {
		this.majorBtn.setAttribute("aria-pressed", String(this.mode === "major"))
		this.minorBtn.setAttribute("aria-pressed", String(this.mode === "minor"))
		this.octaveInput.value = String(this.octave)
		this.rollInput.checked = this.roll
		for (const control of [this.majorBtn, this.minorBtn, this.octaveInput, this.rollInput]) {
			control.disabled = this.disabled
		}
		for (const button of this.keyButtons.values()) {
			button.disabled = this.disabled
		}
		this.syncHighlights()
	}

	private syncHighlights() {
		for (const [midi, button] of this.keyButtons) {
			button.dataset.chord = String(this.chordNotes.has(midi))
			button.dataset.root = String(this.lastRoot === midi && this.chordNotes.has(midi))
			button.dataset.external = String(this.activeNotes.has(midi))
		}
	}

	private midiFromTarget(target: EventTarget | null): number | undefined {
		const el = (target as Element | null)?.closest?.<HTMLButtonElement>("button[data-midi]")
		if (!el) {
			return undefined
		}
		const midi = Number(el.dataset.midi)
		return Number.isInteger(midi) ? midi : undefined
	}

	private pointerDown(event: PointerEvent) {
		if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) {
			return
		}
		const midi = this.midiFromTarget(event.target)
		if (midi === undefined) {
			return
		}
		event.preventDefault()
		this.keyboard.setPointerCapture?.(event.pointerId)
		this.activePointers.set(event.pointerId, midi)
		const velocity = event.pointerType === "pen" && event.pressure > 0 ? event.pressure : 0.85
		this.triggerChord(midi, velocity)
	}

	private pointerMove(event: PointerEvent) {
		const current = this.activePointers.get(event.pointerId)
		if (current === undefined) {
			return
		}
		const hit = this.root.elementFromPoint?.(event.clientX, event.clientY) ?? null
		const midi = this.midiFromTarget(hit)
		if (midi !== undefined && midi !== current) {
			this.activePointers.set(event.pointerId, midi)
			this.triggerChord(midi)
		}
	}

	private pointerUp(event: PointerEvent) {
		if (!this.activePointers.delete(event.pointerId)) {
			return
		}
		if (this.activePointers.size === 0) {
			this.releaseHeld()
		}
	}

	private keyDown(event: KeyboardEvent) {
		const midi = this.midiFromTarget(event.target)
		if (midi === undefined) {
			return
		}
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			if (!event.repeat) {
				this.triggerChord(midi)
			}
		} else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			event.preventDefault()
			const next = midi + (event.key === "ArrowRight" ? 1 : -1)
			this.keyButtons.get(next)?.focus()
		}
	}

	private keyUp(event: KeyboardEvent) {
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			this.releaseHeld()
		}
	}

	private changed() {
		this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
	}
}

if (!customElements.get("chrome-music-lab-chords")) {
	customElements.define("chrome-music-lab-chords", ChordKeyboard)
}

declare global {
	interface HTMLElementTagNameMap {
		"chrome-music-lab-chords": ChordKeyboard
	}
}