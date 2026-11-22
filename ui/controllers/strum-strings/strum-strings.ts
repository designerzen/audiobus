// oxlint-disable-next-line typescript/triple-slash-reference -- Bundler asset declarations.
/// <reference path="./assets.d.ts" />
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
	EVENT_POINTER_LEAVE,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_VISIBILITY_CHANGE
} from "../../../events/event-constants.ts"
import styles from "./strum-strings.css?inline"
import { PatchController } from "../../shared/patch-controller.ts"
import {
	createModalString,
	modalStringAmplitude,
	nudgeModalString,
	sampleModalString,
	shapeModalString,
	stepModalString,
	type ModalString
} from "../../shared/modal-string.ts"
import {
	dispatchInstrumentEvent,
	instrumentNote,
	noteDetail,
	type InstrumentNote,
	type NoteDetail
} from "../../interfaces/instrument.ts"

/** Open-string tunings, listed in the order the strings are laid out. */
export const STRUM_TUNINGS = {
	guitar: { label: "Guitar", notes: [40, 45, 50, 55, 59, 64] },
	bass: { label: "Bass", notes: [28, 33, 38, 43] },
	ukulele: { label: "Ukulele", notes: [67, 60, 64, 69] },
	mandolin: { label: "Mandolin", notes: [55, 62, 69, 76] },
	harp: {
		label: "Diatonic harp",
		notes: [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72]
	},
	pentatonic: { label: "Pentatonic", notes: [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72] }
} as const
export type StrumTuning = keyof typeof STRUM_TUNINGS

const MAX_STRINGS = 24
/** Vibration modes simulated per string; higher modes alias into a shimmer, as on a real string. */
const MODES = 5
const SEGMENTS = 48
/** Fraction of the string spacing a finger can push a string before it slips off and sounds. */
const CATCH = 0.42
/**
 * Below this fraction of CATCH a push is a light touch: easing back lets the string go
 * silently. Beyond it, turning back releases the string, so strokes can reverse anywhere.
 */
const LIGHT = 0.35
/** Fraction of the string spacing within which a resting finger damps a string. */
const DAMP = 0.22
/** Audible level at which a decaying string releases its note. */
const SILENT = 0.015
/** A finger that has not moved for this long is resting, and mutes the string under it. */
const REST_MS = 70

interface Strand extends ModalString {
	hue: number
	held?: NoteDetail
	caught?: number
	muted: boolean
}
interface Contact {
	x: number
	y: number
	time: number
	moved: number
	down: boolean
	pressure: number
	pen: boolean
	travel: number
	/** String under the finger at pointerdown; lifting without moving plucks it. */
	tap?: number
	/** Caught strings, the direction they are being pushed and their furthest push. */
	caught: Map<number, { direction: number; peak: number }>
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
let voice = 2000000

export function strumTuning(value: string | null): number[] {
	const text = value?.trim() ?? ""
	if (Object.hasOwn(STRUM_TUNINGS, text)) {
		return [...STRUM_TUNINGS[text as StrumTuning].notes]
	}
	const notes = text
		.split(/[\s,]+/)
		.filter(Boolean)
		.map(Number)
		.filter((n) => Number.isInteger(n) && n >= 0 && n <= 127)
		.slice(0, MAX_STRINGS)
	return notes.length ? notes : [...STRUM_TUNINGS.guitar.notes]
}

/**
 * Parallel strings simulated as damped modal oscillators. Fingers catch, push and release
 * them; dragging across several strums them in order; a resting finger mutes. All sound is
 * delegated to the host through note events.
 */
export class StrumStrings extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"tuning",
		"capo",
		"sustain",
		"orientation",
		"disabled",
		"group",
		"channel"
	]
	protected root = this.attachShadow({ mode: "open" })
	private canvas: HTMLCanvasElement
	private keys: HTMLElement
	private status: HTMLElement
	private tuningSelect: HTMLSelectElement
	private capoInput: HTMLInputElement
	private sustainInput: HTMLInputElement
	private strands: Strand[] = []
	private contacts = new Map<number, Contact>()
	private activeNotes = new Set<number>()
	private timers = new Set<ReturnType<typeof setTimeout>>()
	private listeners?: AbortController
	private observer?: ResizeObserver
	private frame = 0
	private last = 0
	private width = 0
	private height = 0
	private focused = 0

	constructor() {
		super()
		this.root.innerHTML = `
          <style>${styles}</style>
          <div class="toolbar" part="toolbar">
            <label>Tuning <select data-tuning part="tuning">${Object.entries(STRUM_TUNINGS)
				.map(([id, tuning]) => `<option value="${id}">${tuning.label}</option>`)
				.join("")}<option value="custom" disabled>Custom</option></select></label>
            <label>Capo <input data-capo part="capo" type="number" min="0" max="12" step="1"></label>
            <label>Ring <input data-sustain part="sustain" type="range" min="0.2" max="8" step="0.1"></label>
          </div>
          <div class="strings" part="strings">
            <canvas part="canvas" aria-hidden="true"></canvas>
            <div class="keys" role="group" aria-label="Strings" aria-describedby="help"></div>
          </div>
          <p id="help" class="sr-only">Drag across the strings to strum them in order. Push a string and let go to pluck it, or rest a finger on it to mute. With the keyboard, arrow keys choose a string, Enter or Space plucks it, S strums down and Shift+S strums up. Sound is supplied by the host.</p>
          <p class="sr-only" role="status" aria-atomic="true"></p>`
		this.canvas = this.root.querySelector("canvas")!
		this.keys = this.root.querySelector(".keys")!
		this.status = this.root.querySelector('[role="status"]')!
		this.tuningSelect = this.root.querySelector("[data-tuning]")!
		this.capoInput = this.root.querySelector("[data-capo]")!
		this.sustainInput = this.root.querySelector("[data-sustain]")!
		this.build()
	}

	get tuning(): number[] {
		return strumTuning(this.getAttribute("tuning"))
	}
	set tuning(value: StrumTuning | readonly number[]) {
		this.setAttribute("tuning", typeof value === "string" ? value : value.join(","))
	}
	get capo() {
		return Math.round(clamp(Number(this.getAttribute("capo")) || 0, 0, 24))
	}
	set capo(value: number) {
		this.setAttribute("capo", String(value))
	}
	/** Seconds a plucked string takes to fall silent. */
	get sustain() {
		const value = Number(this.getAttribute("sustain") ?? 2.5)
		return Number.isFinite(value) ? clamp(value, 0.2, 10) : 2.5
	}
	set sustain(value: number) {
		this.setAttribute("sustain", String(value))
	}
	get disabled() {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}
	/** Notes of the strings as currently fretted by the capo. */
	get notes(): number[] {
		return this.strands.map((strand) => strand.note)
	}
	private get axis(): "horizontal" | "vertical" {
		const orientation = this.getAttribute("orientation")
		if (orientation === "horizontal" || orientation === "vertical") {
			return orientation
		}
		return this.width >= this.height ? "horizontal" : "vertical"
	}
	private get address() {
		const number = (name: string) => {
			const value = Number(this.getAttribute(name) ?? 0)
			return Number.isInteger(value) && value >= 0 && value <= 15 ? value : 0
		}
		return { group: number("group"), channel: number("channel") }
	}

	connectedCallback() {
		super.connectedCallback()
		this.listeners?.abort()
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }
		const canvas = this.canvas
		canvas.addEventListener(EVENT_POINTER_DOWN, (event) => this.pointerDown(event), options)
		canvas.addEventListener(EVENT_POINTER_MOVE, (event) => this.pointerMove(event), options)
		canvas.addEventListener(EVENT_POINTER_UP, (event) => this.pointerUp(event, true), options)
		for (const type of [
			EVENT_POINTER_CANCEL,
			EVENT_LOST_POINTER_CAPTURE,
			EVENT_POINTER_LEAVE
		]) {
			canvas.addEventListener(
				type,
				(event) => this.pointerUp(event as PointerEvent, false),
				options
			)
		}
		this.keys.addEventListener(
			EVENT_CLICK,
			(event) => {
				const index = Number((event.target as HTMLElement).dataset?.string)
				if (Number.isInteger(index)) {
					this.pluck(index, 0.7)
					this.announce(`Plucked ${instrumentNote(this.strands[index]!.note).noteName}`)
				}
			},
			options
		)
		this.keys.addEventListener(EVENT_KEY_DOWN, (event) => this.keyDown(event), options)
		// Keep the application's musical keyboard shortcuts out of these controls.
		for (const type of [EVENT_KEY_DOWN, EVENT_KEY_UP]) {
			this.root.addEventListener(type, (event) => event.stopPropagation(), options)
		}
		this.tuningSelect.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.setAttribute("tuning", this.tuningSelect.value)
				this.changed()
			},
			options
		)
		this.capoInput.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.capoInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.capo = clamp(Math.round(Number(this.capoInput.value) || 0), 0, 12)
				this.changed()
			},
			options
		)
		this.sustainInput.addEventListener(
			EVENT_INPUT,
			(event) => {
				event.stopPropagation()
				this.sustain = Number(this.sustainInput.value)
			},
			options
		)
		this.sustainInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.changed()
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
		this.observer?.disconnect()
		if (typeof ResizeObserver !== "undefined") {
			this.observer = new ResizeObserver(() => this.measure())
			this.observer.observe(this)
			this.observer.observe(canvas)
		}
		this.update()
		this.measure()
	}

	disconnectedCallback() {
		this.stop()
		this.listeners?.abort()
		this.listeners = undefined
		this.observer?.disconnect()
		this.observer = undefined
		cancelAnimationFrame(this.frame)
		this.frame = 0
		this.last = 0
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		if (previous === next) {
			return
		}
		if (name === "tuning" || name === "capo") {
			this.stop()
			this.build()
		} else if (name === "disabled") {
			this.stop()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	/** Pluck one string at a position along it (0–1); velocity is 0–1. */
	pluck(index: number, velocity = 0.7, position = 0.5, direction = 1) {
		const strand = this.strands[index]
		if (!strand || this.disabled || !this.isConnected) {
			return
		}
		this.shape(strand, clamp(position, 0.04, 0.96), direction * CATCH * this.spacing * velocity)
		this.sound(index, velocity)
	}

	/** Start the note of a string already set in motion, replacing any note it was ringing. */
	private sound(index: number, velocity: number) {
		const strand = this.strands[index]
		if (!strand || this.disabled || !this.isConnected) {
			return
		}
		this.silence(strand)
		const detail = noteDetail(
			NOTE_ON,
			strand.note,
			clamp(velocity, 0.01, 1),
			voice++,
			this.address
		)
		strand.held = detail
		strand.level = detail.velocity
		dispatchInstrumentEvent(this, NOTE_ON, detail)
		this.wake()
	}

	/** Strum every string in turn: 1 runs from the first string to the last, -1 back. */
	strum(direction: 1 | -1 = 1, velocity = 0.7, spread = 18) {
		const order = this.strands.map((_, index) => index)
		if (direction < 0) {
			order.reverse()
		}
		order.forEach((index, step) => {
			if (!spread || !step) {
				this.pluck(index, velocity, 0.5, direction)
				return
			}
			const timer = setTimeout(() => {
				this.timers.delete(timer)
				this.pluck(index, velocity, 0.5, direction)
			}, step * spread)
			this.timers.add(timer)
		})
	}

	stop() {
		for (const timer of this.timers) {
			clearTimeout(timer)
		}
		this.timers.clear()
		this.contacts.clear()
		for (const strand of this.strands) {
			strand.caught = undefined
			this.silence(strand)
		}
	}

	setActiveNote(note: InstrumentNote | number, active = true) {
		const number = instrumentNote(note).noteNumber
		if (active) {
			this.activeNotes.add(number)
		} else {
			this.activeNotes.delete(number)
		}
		this.draw()
	}
	setActiveNotes(notes: Iterable<InstrumentNote | number>) {
		this.activeNotes = new Set([...notes].map((note) => instrumentNote(note).noteNumber))
		this.draw()
	}
	clearActiveNotes() {
		this.activeNotes.clear()
		this.draw()
	}

	private changed() {
		this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
	}

	private announce(text: string) {
		this.status.textContent = text
	}

	private silence(strand: Strand) {
		const held = strand.held
		strand.held = undefined
		strand.level = 0
		if (held) {
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, held.note, 0, held.id, held)
			)
		}
	}

	private build() {
		const capo = this.capo
		const notes = this.tuning.map((note) => clamp(note + capo, 0, 127))
		this.strands = notes.map((note) => ({
			...createModalString(note, MODES),
			hue: (note % 12) * 30,
			muted: false
		}))
		this.focused = Math.min(this.focused, notes.length - 1)
		this.keys.replaceChildren(
			...notes.map((note, index) => {
				const button = document.createElement("button")
				button.type = "button"
				button.dataset.string = String(index)
				button.setAttribute("part", "string")
				button.setAttribute(
					"aria-label",
					`String ${index + 1}, ${instrumentNote(note).noteName}`
				)
				return button
			})
		)
	}

	protected update() {
		this.dataset.axis = this.axis
		const tuning = this.getAttribute("tuning")?.trim() ?? ""
		const preset = Object.entries(STRUM_TUNINGS).find(
			([id, value]) => id === tuning || value.notes.join(",") === this.tuning.join(",")
		)
		this.tuningSelect.value = preset?.[0] ?? "custom"
		this.capoInput.value = String(this.capo)
		this.sustainInput.value = String(this.sustain)
		for (const control of [this.tuningSelect, this.capoInput, this.sustainInput]) {
			control.disabled = this.disabled
		}
		this.keys.querySelectorAll("button").forEach((button, index) => {
			button.disabled = this.disabled
			button.tabIndex = index === this.focused ? 0 : -1
		})
		this.draw()
	}

	private measure() {
		const box = this.canvas.getBoundingClientRect()
		this.resize(box.width, box.height)
		this.toggleAttribute("data-compact", this.clientHeight > 0 && this.clientHeight < 170)
	}

	private resize(width: number, height: number) {
		if (width === this.width && height === this.height) {
			return
		}
		const axis = this.axis
		this.width = width
		this.height = height
		if (axis !== this.axis) {
			this.stop()
		}
		this.dataset.axis = this.axis
		const ratio = globalThis.devicePixelRatio || 1
		this.canvas.width = Math.max(1, Math.round(width * ratio))
		this.canvas.height = Math.max(1, Math.round(height * ratio))
		this.draw()
	}

	// Geometry in CSS pixels: strings run along one axis and are spaced evenly across the other.
	private get length() {
		return this.axis === "horizontal" ? this.width : this.height
	}
	private get breadth() {
		return this.axis === "horizontal" ? this.height : this.width
	}
	private get spacing() {
		return this.breadth / Math.max(1, this.strands.length) || 1
	}
	private get labelled() {
		return this.spacing >= 14 && this.length >= 120
	}
	private get start() {
		return this.labelled ? (this.axis === "horizontal" ? 38 : 24) : 8
	}
	private get end() {
		return Math.max(this.start + 1, this.length - 8)
	}
	private rest(index: number) {
		return (index + 0.5) * this.spacing
	}
	private along(x: number, y: number) {
		return this.axis === "horizontal" ? x : y
	}
	private across(x: number, y: number) {
		return this.axis === "horizontal" ? y : x
	}
	private position(x: number, y: number) {
		return clamp((this.along(x, y) - this.start) / (this.end - this.start), 0.04, 0.96)
	}

	/** Set a string to the triangle a finger makes holding it at position, displaced by offset. */
	private shape(strand: Strand, position: number, offset: number) {
		shapeModalString(strand, position, offset)
	}

	/** A light touch: an impulse that sets the string swinging without sounding it. */
	private nudge(strand: Strand, position: number, impulse: number) {
		nudgeModalString(strand, position, impulse)
		this.wake()
	}

	private amplitude(strand: Strand) {
		return modalStringAmplitude(strand)
	}

	private velocity(contact: Contact, speed: number, push = 0) {
		// Speed is in strings crossed per second; a brisk strum is around 40. Pushing a
		// string to its limit alone gives a medium pluck.
		const value = 0.2 + 0.8 * clamp(Math.max(speed / 40, push * 0.6), 0, 1)
		return clamp(contact.pen ? value * (0.5 + contact.pressure) : value, 0.05, 1)
	}

	private local(event: PointerEvent) {
		const box = this.canvas.getBoundingClientRect()
		this.resize(box.width, box.height)
		return { x: event.clientX - box.left, y: event.clientY - box.top }
	}

	private nearest(across: number) {
		const index = clamp(Math.floor(across / this.spacing), 0, this.strands.length - 1)
		return Math.abs(across - this.rest(index)) < this.spacing * 0.3 ? index : undefined
	}

	private pointerDown(event: PointerEvent) {
		if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) {
			return
		}
		event.preventDefault()
		this.canvas.setPointerCapture?.(event.pointerId)
		const { x, y } = this.local(event)
		const tap = this.nearest(this.across(x, y))
		this.contacts.set(event.pointerId, {
			x,
			y,
			time: event.timeStamp,
			moved: event.timeStamp,
			down: true,
			pressure: event.pressure,
			pen: event.pointerType === "pen",
			travel: 0,
			tap,
			caught: new Map()
		})
		this.wake()
	}

	private pointerMove(event: PointerEvent) {
		const { x, y } = this.local(event)
		let contact = this.contacts.get(event.pointerId)
		if (!contact) {
			// Hovering mice brush the strings visually.
			if (event.pointerType !== "mouse" || event.buttons) {
				return
			}
			contact = {
				x,
				y,
				time: event.timeStamp,
				moved: event.timeStamp,
				down: false,
				pressure: 0,
				pen: false,
				travel: 0,
				caught: new Map()
			}
			this.contacts.set(event.pointerId, contact)
			return
		}
		const from = this.across(contact.x, contact.y),
			to = this.across(x, y),
			position = this.position(x, y),
			spacing = this.spacing,
			seconds = Math.max(0.001, (event.timeStamp - contact.time) / 1000),
			speed = Math.abs(to - from) / spacing / seconds,
			distance = Math.hypot(x - contact.x, y - contact.y)
		contact.travel += distance
		contact.x = x
		contact.y = y
		contact.time = event.timeStamp
		contact.pressure = event.pressure
		if (distance > 0.5) {
			contact.moved = event.timeStamp
		}
		if (!contact.down) {
			for (const index of this.crossed(from, to)) {
				this.nudge(this.strands[index]!, position, Math.sign(to - from) * spacing * 0.08)
			}
			return
		}
		if (contact.tap !== undefined && contact.travel > 3) {
			// A finger placed on a string takes it along when it moves off.
			const strand = this.strands[contact.tap]!
			if (strand.caught === undefined && to !== this.rest(contact.tap)) {
				strand.caught = event.pointerId
				contact.caught.set(contact.tap, {
					direction: Math.sign(to - this.rest(contact.tap)),
					peak: 0
				})
			}
			contact.tap = undefined
		}
		for (const [index, hold] of contact.caught) {
			const strand = this.strands[index]!
			const direction = hold.direction,
				offset = to - this.rest(index),
				push = offset * direction
			const reversed =
				hold.peak >= LIGHT * CATCH * spacing &&
				push < hold.peak - Math.max(1.5, 0.1 * spacing)
			if (reversed) {
				// The stroke turned back: the string springs off the retreating finger.
				contact.caught.delete(index)
				strand.caught = undefined
				this.shape(strand, position, direction * hold.peak)
				this.sound(index, this.velocity(contact, speed, hold.peak / (CATCH * spacing)))
			} else if (push <= 0) {
				// Eased back over the string: it slips free with a gentle wobble.
				contact.caught.delete(index)
				strand.caught = undefined
				this.wake()
			} else if (push > CATCH * spacing) {
				// Pushed past its limit: the string slips off the finger and sounds.
				contact.caught.delete(index)
				strand.caught = undefined
				this.shape(strand, position, direction * CATCH * spacing)
				this.sound(index, this.velocity(contact, speed, 1))
			} else {
				hold.peak = Math.max(hold.peak, push)
				this.shape(strand, position, offset)
				this.wake()
			}
		}
		const direction = Math.sign(to - from)
		for (const index of this.crossed(from, to)) {
			const strand = this.strands[index]!
			if (contact.caught.has(index) || strand.caught !== undefined) {
				continue
			}
			const push = Math.abs(to - this.rest(index))
			if (push > CATCH * spacing) {
				// A fast stroke passes straight through, plucking on the way.
				this.shape(strand, position, direction * CATCH * spacing)
				this.sound(index, this.velocity(contact, speed))
			} else {
				strand.caught = event.pointerId
				contact.caught.set(index, { direction, peak: push })
				this.shape(strand, position, to - this.rest(index))
				this.wake()
			}
		}
	}

	private pointerUp(event: PointerEvent, lifted: boolean) {
		const contact = this.contacts.get(event.pointerId)
		if (!contact) {
			return
		}
		this.contacts.delete(event.pointerId)
		if (!contact.down) {
			return
		}
		// Letting go of a pushed string plucks it, as hard as it was pushed.
		for (const [index, { direction }] of contact.caught) {
			const strand = this.strands[index]!
			strand.caught = undefined
			const push = (this.across(contact.x, contact.y) - this.rest(index)) * direction
			if (lifted && push > 0) {
				// The string already holds the finger's shape; releasing it sets it ringing.
				this.sound(index, this.velocity(contact, 0, push / (CATCH * this.spacing)))
			}
		}
		if (lifted && contact.tap !== undefined && contact.travel <= 3) {
			this.pluck(
				contact.tap,
				this.velocity(contact, 0, 0.45),
				this.position(contact.x, contact.y)
			)
		}
		this.wake()
	}

	/** Strings whose rest line lies between two positions, in the order a finger meets them. */
	private crossed(from: number, to: number) {
		if (from === to) {
			return []
		}
		const indices: number[] = []
		for (let index = 0; index < this.strands.length; index++) {
			const rest = this.rest(index)
			if (from < rest !== to < rest) {
				indices.push(index)
			}
		}
		return to < from ? indices.reverse() : indices
	}

	private keyDown(event: KeyboardEvent) {
		const count = this.strands.length
		let next = this.focused
		switch (event.key) {
			case "ArrowDown":
			case "ArrowRight":
				next = Math.min(count - 1, next + 1)
				break
			case "ArrowUp":
			case "ArrowLeft":
				next = Math.max(0, next - 1)
				break
			case "Home":
				next = 0
				break
			case "End":
				next = count - 1
				break
			case "s":
			case "S":
				event.preventDefault()
				if (!event.repeat && !this.disabled) {
					this.strum(event.shiftKey ? -1 : 1)
					this.announce(event.shiftKey ? "Strummed up" : "Strummed down")
				}
				return
			default:
				return
		}
		event.preventDefault()
		this.focused = next
		this.update()
		this.keys.querySelectorAll("button")[next]?.focus()
	}

	private wake() {
		if (this.frame || !this.isConnected || typeof requestAnimationFrame === "undefined") {
			return
		}
		if (!this.last) {
			this.last = performance.now()
		}
		this.frame = requestAnimationFrame(this.frameStep)
	}

	private frameStep = (time: number) => {
		this.frame = 0
		const seconds = clamp((time - this.last) / 1000, 0, 0.05)
		this.last = time
		const busy = this.advance(seconds, time)
		this.draw()
		if (busy) {
			this.wake()
		} else {
			this.last = 0
		}
	}

	/** Advance every string by seconds; returns whether anything is still moving. */
	private advance(seconds: number, now = performance.now()) {
		const spacing = this.spacing
		const resting = [...this.contacts.values()].filter(
			(contact) => contact.down && now - contact.moved > REST_MS
		)
		// Level falls to SILENT over the sustain time; a resting finger damps far faster.
		const rate = Math.log(1 / SILENT) / this.sustain
		let busy = [...this.contacts.values()].some((contact) => contact.down)
		this.strands.forEach((strand, index) => {
			const rest = this.rest(index)
			strand.muted = resting.some(
				(contact) =>
					!contact.caught.has(index) &&
					Math.abs(this.across(contact.x, contact.y) - rest) < DAMP * spacing
			)
			const damping = rate * (strand.muted ? 14 : 1)
			if (strand.caught === undefined) {
				stepModalString(strand, seconds, damping)
			}
			if (strand.held) {
				strand.level *= Math.exp(-damping * seconds)
				if (strand.level < SILENT) {
					this.silence(strand)
				}
			}
			busy ||= !!strand.held || strand.caught !== undefined || this.amplitude(strand) > 0.05
		})
		return busy
	}

	private draw() {
		const context = this.canvas.getContext?.("2d")
		if (!context || !this.width || !this.height) {
			return
		}
		const ratio = this.canvas.width / this.width,
			horizontal = this.axis === "horizontal",
			start = this.start,
			span = this.end - start,
			spacing = this.spacing,
			labelled = this.labelled,
			notes = this.strands.map((strand) => strand.note),
			low = Math.min(...notes),
			range = Math.max(1, Math.max(...notes) - low),
			limit = spacing * 0.48
		context.setTransform(ratio, 0, 0, ratio, 0, 0)
		context.clearRect(0, 0, this.width, this.height)
		context.lineCap = "round"
		context.lineJoin = "round"
		context.textBaseline = "middle"
		context.textAlign = horizontal ? "left" : "center"
		context.font = `${clamp(spacing * 0.42, 9, 13)}px system-ui, sans-serif`
		// Nut and bridge.
		context.strokeStyle = "rgba(255,255,255,0.16)"
		context.lineWidth = 2
		context.beginPath()
		for (const edge of [start, start + span]) {
			if (horizontal) {
				context.moveTo(edge, 0)
				context.lineTo(edge, this.height)
			} else {
				context.moveTo(0, edge)
				context.lineTo(this.width, edge)
			}
		}
		context.stroke()
		this.strands.forEach((strand, index) => {
			const rest = this.rest(index),
				active = this.activeNotes.has(strand.note),
				glow = Math.max(strand.level, active ? 0.6 : 0),
				color = `hsl(${strand.hue} 85% ${strand.muted ? 45 : 62 + glow * 14}%)`
			context.strokeStyle = color
			context.shadowColor = color
			context.shadowBlur = 2 + glow * 18
			context.lineWidth = 1.2 + 2.4 * (1 - (strand.note - low) / range) + glow * 1.5
			context.beginPath()
			for (let k = 0; k <= SEGMENTS; k++) {
				const u = k / SEGMENTS
				const offset = sampleModalString(strand, u)
				const along = start + u * span,
					across = rest + clamp(offset, -limit, limit)
				if (horizontal) {
					context[k ? "lineTo" : "moveTo"](along, across)
				} else {
					context[k ? "lineTo" : "moveTo"](across, along)
				}
			}
			context.stroke()
			context.shadowBlur = 0
			if (labelled) {
				context.fillStyle = color
				const name = instrumentNote(strand.note).noteName
				if (horizontal) {
					context.fillText(name, 6, rest)
				} else {
					context.fillText(name, rest, 12)
				}
			}
		})
	}
}

if (!customElements.get("strum-strings")) {
	customElements.define("strum-strings", StrumStrings)
}
declare global {
	interface HTMLElementTagNameMap {
		"strum-strings": StrumStrings
	}
}