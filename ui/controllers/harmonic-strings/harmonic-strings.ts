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
	midiAddressFromElement,
	ratioMidi
} from "../../shared/chrome-music-lab.ts"
import {
	createModalString,
	modalStringAmplitude,
	nudgeModalString,
	sampleModalString,
	shapeModalString,
	stepModalString,
	type ModalString
} from "../../shared/modal-string.ts"

const MODES = 5
const SEGMENTS = 40
const CATCH = 0.36
const SILENT = 0.015
const DEFAULT_ROOT = 48 // C3
const DEFAULT_COLUMNS = 6

interface DividedSegment extends ModalString {
	column: number
	series: number
	isTop: boolean
	/** Normalized vertical span [startFrac, endFrac] along the column height. */
	startFrac: number
	endFrac: number
	fractionLabel: string
	held?: NoteDetail
	caught?: number
}

interface Contact {
	x: number
	y: number
	time: number
	down: boolean
	travel: number
	tap?: number
	caught: Map<number, { direction: number; peak: number }>
}

let voiceId = 3100000

const STYLES = `${CML_HOST_STYLES}
.stage {
	flex: 1 1 var(--stage-height, 220px);
}
canvas {
	cursor: grab;
}
.keys {
	position: absolute;
	inset: 0;
	display: flex;
	flex-wrap: wrap;
	pointer-events: none;
}
.keys button {
	flex: 1 1 14%;
	min-width: 0;
	margin: 0;
	padding: 0;
	opacity: 0;
	border: 0;
	background: none;
	pointer-events: none;
}
.keys button:focus-visible {
	opacity: 1;
	outline: 2px solid var(--focus-color, #ffb729);
	outline-offset: -4px;
	border-radius: 6px;
}
`

/**
 * Divided harmonic strings controller inspired by Chrome Music Lab Strings (harmonics & strings).
 * Each column divides a string into 1/n and (n-1)/n segments, simulated with the shared modal string physics.
 */
export class HarmonicStrings extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"root",
		"columns",
		"sustain",
		"disabled",
		"group",
		"channel"
	]

	protected root = this.attachShadow({ mode: "open" })
	private canvas: HTMLCanvasElement
	private keys: HTMLElement
	private status: HTMLElement
	private rootInput: HTMLInputElement
	private columnsInput: HTMLInputElement
	private sustainInput: HTMLInputElement
	private segments: DividedSegment[] = []
	private contacts = new Map<number, Contact>()
	private activeNotes = new Set<number>()
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
			<style>${STYLES}</style>
			<div class="toolbar" part="toolbar">
				<label>Root <input data-root type="number" min="24" max="72" step="1"></label>
				<label>Divisions <input data-columns type="number" min="2" max="8" step="1"></label>
				<label>Ring <input data-sustain type="range" min="0.2" max="6" step="0.1"></label>
			</div>
			<div class="stage" part="stage">
				<canvas part="canvas" aria-hidden="true"></canvas>
				<div class="keys" role="group" aria-label="Divided harmonic strings" aria-describedby="help"></div>
			</div>
			<p id="help" class="sr-only">Drag across the vertical string segments to pluck them, or pull and release a segment. Arrow keys choose a segment and Enter or Space plucks it.</p>
			<p class="sr-only" role="status" aria-atomic="true"></p>`
		this.canvas = this.root.querySelector("canvas")!
		this.keys = this.root.querySelector(".keys")!
		this.status = this.root.querySelector('[role="status"]')!
		this.rootInput = this.root.querySelector("[data-root]")!
		this.columnsInput = this.root.querySelector("[data-columns]")!
		this.sustainInput = this.root.querySelector("[data-sustain]")!
		this.build()
	}

	get rootNote(): number {
		const raw = this.getAttribute("root")
		const parsed = raw === null || !raw.trim() ? DEFAULT_ROOT : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 24, 72)) : DEFAULT_ROOT
	}
	set rootNote(value: number) {
		this.setAttribute("root", String(Math.round(clamp(value, 24, 72))))
	}

	get columnsCount(): number {
		const raw = this.getAttribute("columns")
		const parsed = raw === null || !raw.trim() ? DEFAULT_COLUMNS : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 2, 8)) : DEFAULT_COLUMNS
	}
	set columnsCount(value: number) {
		this.setAttribute("columns", String(Math.round(clamp(value, 2, 8))))
	}

	get sustain(): number {
		const raw = this.getAttribute("sustain")
		const parsed = raw === null || !raw.trim() ? 2.2 : Number(raw)
		return Number.isFinite(parsed) ? clamp(parsed, 0.2, 6) : 2.2
	}
	set sustain(value: number) {
		this.setAttribute("sustain", String(clamp(value, 0.2, 6)))
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}

	/** MIDI notes of every pluckable string segment in column order. */
	get notes(): number[] {
		return this.segments.map((segment) => segment.note)
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
				const index = Number((event.target as HTMLElement).dataset?.segment)
				if (Number.isInteger(index)) {
					this.pluck(index, 0.75)
				}
			},
			options
		)
		this.keys.addEventListener(EVENT_KEY_DOWN, (event) => this.keyDown(event), options)
		for (const type of [EVENT_KEY_DOWN, EVENT_KEY_UP]) {
			this.root.addEventListener(type, (event) => event.stopPropagation(), options)
		}

		this.rootInput.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.rootInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.rootNote = Number(this.rootInput.value) || DEFAULT_ROOT
				this.changed()
			},
			options
		)
		this.columnsInput.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.columnsInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.columnsCount = Number(this.columnsInput.value) || DEFAULT_COLUMNS
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
		if (name === "root" || name === "columns") {
			this.stop()
			this.build()
		} else if (name === "disabled") {
			this.stop()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	pluck(index: number, velocity = 0.75, position = 0.5, direction = 1): void {
		const segment = this.segments[index]
		if (!segment || this.disabled || !this.isConnected) {
			return
		}
		shapeModalString(segment, position, direction * CATCH * this.colSpacing * velocity)
		this.sound(index, velocity)
	}

	stop(): void {
		this.contacts.clear()
		for (const segment of this.segments) {
			segment.caught = undefined
			this.silence(segment)
		}
		this.draw()
	}

	setActiveNote(note: InstrumentNote | number, active = true): void {
		const number = instrumentNote(note).noteNumber
		if (active) {
			this.activeNotes.add(number)
		} else {
			this.activeNotes.delete(number)
		}
		this.draw()
	}

	setActiveNotes(notes: Iterable<InstrumentNote | number>): void {
		this.activeNotes = new Set([...notes].map((note) => instrumentNote(note).noteNumber))
		this.draw()
	}

	clearActiveNotes(): void {
		this.activeNotes.clear()
		this.draw()
	}

	private build() {
		const root = this.rootNote
		const cols = this.columnsCount
		const segments: DividedSegment[] = []
		for (let h = 0; h < cols; h++) {
			const series = h + 1
			if (series === 1) {
				segments.push({
					...createModalString(root, MODES),
					column: h,
					series,
					isTop: true,
					startFrac: 0,
					endFrac: 1,
					fractionLabel: "1/1"
				})
			} else {
				const split = (series - 1) / series
				const topMidi = ratioMidi(root, series / (series - 1))
				const bottomMidi = ratioMidi(root, series)
				segments.push({
					...createModalString(topMidi, MODES),
					column: h,
					series,
					isTop: true,
					startFrac: 0,
					endFrac: split,
					fractionLabel: `${series - 1}/${series}`
				})
				segments.push({
					...createModalString(bottomMidi, MODES),
					column: h,
					series,
					isTop: false,
					startFrac: split,
					endFrac: 1,
					fractionLabel: `1/${series}`
				})
			}
		}
		this.segments = segments
		this.focused = Math.min(this.focused, this.segments.length - 1)
		this.keys.replaceChildren(
			...this.segments.map((segment, index) => {
				const button = document.createElement("button")
				button.type = "button"
				button.dataset.segment = String(index)
				button.setAttribute(
					"aria-label",
					`String ${segment.series} (${segment.fractionLabel}), ${instrumentNote(segment.note).noteName}`
				)
				return button
			})
		)
	}

	private update() {
		this.rootInput.value = String(this.rootNote)
		this.columnsInput.value = String(this.columnsCount)
		this.sustainInput.value = String(this.sustain)
		for (const control of [this.rootInput, this.columnsInput, this.sustainInput]) {
			control.disabled = this.disabled
		}
		this.keys.querySelectorAll("button").forEach((button, index) => {
			button.disabled = this.disabled
			button.tabIndex = index === this.focused ? 0 : -1
		})
		this.draw()
	}

	private sound(index: number, velocity: number) {
		const segment = this.segments[index]
		if (!segment || this.disabled || !this.isConnected) {
			return
		}
		this.silence(segment)
		const detail = noteDetail(
			NOTE_ON,
			segment.note,
			clamp(velocity, 0.05, 1),
			voiceId++,
			midiAddressFromElement(this)
		)
		segment.held = detail
		segment.level = detail.velocity
		dispatchInstrumentEvent(this, NOTE_ON, detail)
		this.announce(`Plucked ${segment.fractionLabel} (${instrumentNote(segment.note).noteName})`)
		this.wake()
		this.draw()
	}

	private silence(segment: DividedSegment) {
		const held = segment.held
		segment.held = undefined
		segment.level = 0
		if (held) {
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, held.note, 0, held.id, held)
			)
		}
	}

	private changed() {
		this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
	}

	private announce(text: string) {
		this.status.textContent = text
	}

	private measure() {
		const box = this.canvas.getBoundingClientRect()
		this.resize(box.width, box.height)
		this.toggleAttribute("data-compact", this.clientHeight > 0 && this.clientHeight < 150)
	}

	private resize(width: number, height: number) {
		if (width === this.width && height === this.height) {
			return
		}
		this.width = width
		this.height = height
		const ratio = globalThis.devicePixelRatio || 1
		this.canvas.width = Math.max(1, Math.round(width * ratio))
		this.canvas.height = Math.max(1, Math.round(height * ratio))
		this.draw()
	}

	private get colSpacing(): number {
		return this.width / Math.max(1, this.columnsCount) || 1
	}

	private get topPad(): number {
		return 16
	}

	private get bottomPad(): number {
		return this.height >= 120 ? 28 : 14
	}

	private get span(): number {
		return Math.max(24, this.height - this.topPad - this.bottomPad)
	}

	private segmentBounds(segment: DividedSegment) {
		const x = (segment.column + 0.5) * this.colSpacing
		const y0 = this.topPad + segment.startFrac * this.span
		const y1 = this.topPad + segment.endFrac * this.span
		return { x, y0, y1 }
	}

	private local(event: PointerEvent) {
		const box = this.canvas.getBoundingClientRect()
		this.resize(box.width, box.height)
		return { x: event.clientX - box.left, y: event.clientY - box.top }
	}

	private nearestSegment(x: number, y: number): number | undefined {
		const maxDist = this.colSpacing * 0.35
		let best: number | undefined
		let bestDist = maxDist
		this.segments.forEach((segment, index) => {
			const { x: sx, y0, y1 } = this.segmentBounds(segment)
			if (y < y0 - 4 || y > y1 + 4) {
				return
			}
			const dist = Math.abs(x - sx)
			if (dist < bestDist) {
				bestDist = dist
				best = index
			}
		})
		return best
	}

	private crossedSegments(x0: number, y0: number, x1: number, y1: number): number[] {
		if (x0 === x1) {
			return []
		}
		const hits: { index: number; t: number }[] = []
		this.segments.forEach((segment, index) => {
			const { x: sx, y0: sy0, y1: sy1 } = this.segmentBounds(segment)
			if (x0 < sx === x1 < sx) {
				return
			}
			const t = (sx - x0) / (x1 - x0)
			const yCross = y0 + (y1 - y0) * t
			if (yCross >= sy0 && yCross <= sy1) {
				hits.push({ index, t })
			}
		})
		hits.sort((a, b) => a.t - b.t)
		return hits.map((hit) => hit.index)
	}

	private pointerDown(event: PointerEvent) {
		if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) {
			return
		}
		event.preventDefault()
		this.canvas.setPointerCapture?.(event.pointerId)
		const { x, y } = this.local(event)
		this.contacts.set(event.pointerId, {
			x,
			y,
			time: event.timeStamp,
			down: true,
			travel: 0,
			tap: this.nearestSegment(x, y),
			caught: new Map()
		})
		this.wake()
	}

	private pointerMove(event: PointerEvent) {
		const { x, y } = this.local(event)
		let contact = this.contacts.get(event.pointerId)
		if (!contact) {
			if (event.pointerType !== "mouse" || event.buttons) {
				return
			}
			contact = { x, y, time: event.timeStamp, down: false, travel: 0, caught: new Map() }
			this.contacts.set(event.pointerId, contact)
			return
		}
		const fromX = contact.x
		const fromY = contact.y
		const seconds = Math.max(0.001, (event.timeStamp - contact.time) / 1000)
		const spacing = this.colSpacing
		const speed = Math.abs(x - fromX) / spacing / seconds
		contact.travel += Math.hypot(x - fromX, y - fromY)
		contact.x = x
		contact.y = y
		contact.time = event.timeStamp

		if (!contact.down) {
			for (const index of this.crossedSegments(fromX, fromY, x, y)) {
				const seg = this.segments[index]!
				const { y0, y1 } = this.segmentBounds(seg)
				const pos = clamp((y - y0) / Math.max(1, y1 - y0), 0.05, 0.95)
				nudgeModalString(seg, pos, Math.sign(x - fromX) * spacing * 0.08)
				this.wake()
			}
			return
		}

		if (contact.tap !== undefined && contact.travel > 3) {
			const seg = this.segments[contact.tap]!
			const { x: sx } = this.segmentBounds(seg)
			if (seg.caught === undefined && x !== sx) {
				seg.caught = event.pointerId
				contact.caught.set(contact.tap, { direction: Math.sign(x - sx), peak: 0 })
			}
			contact.tap = undefined
		}

		for (const [index, hold] of contact.caught) {
			const seg = this.segments[index]!
			const { x: sx, y0, y1 } = this.segmentBounds(seg)
			const pos = clamp((y - y0) / Math.max(1, y1 - y0), 0.05, 0.95)
			const offset = x - sx
			const push = offset * hold.direction
			if (push <= 0) {
				contact.caught.delete(index)
				seg.caught = undefined
				this.wake()
			} else if (push > CATCH * spacing || y < y0 || y > y1) {
				contact.caught.delete(index)
				seg.caught = undefined
				shapeModalString(seg, pos, hold.direction * CATCH * spacing)
				const velocity = clamp(0.25 + 0.75 * clamp(speed / 35, 0, 1), 0.25, 1)
				this.sound(index, velocity)
			} else {
				hold.peak = Math.max(hold.peak, push)
				shapeModalString(seg, pos, offset)
				this.wake()
			}
		}

		const direction = Math.sign(x - fromX)
		for (const index of this.crossedSegments(fromX, fromY, x, y)) {
			const seg = this.segments[index]!
			if (contact.caught.has(index) || seg.caught !== undefined) {
				continue
			}
			const { x: sx, y0, y1 } = this.segmentBounds(seg)
			const pos = clamp((y - y0) / Math.max(1, y1 - y0), 0.05, 0.95)
			const push = Math.abs(x - sx)
			if (push > CATCH * spacing || speed > 8) {
				shapeModalString(seg, pos, direction * CATCH * spacing)
				const velocity = clamp(0.3 + 0.7 * clamp(speed / 35, 0, 1), 0.3, 1)
				this.sound(index, velocity)
			} else {
				seg.caught = event.pointerId
				contact.caught.set(index, { direction, peak: push })
				shapeModalString(seg, pos, x - sx)
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
		for (const [index, { direction }] of contact.caught) {
			const seg = this.segments[index]!
			seg.caught = undefined
			const { x: sx } = this.segmentBounds(seg)
			const push = (contact.x - sx) * direction
			if (lifted && push > 0) {
				const velocity = clamp(0.25 + 0.75 * (push / (CATCH * this.colSpacing)), 0.2, 1)
				this.sound(index, velocity)
			}
		}
		if (lifted && contact.tap !== undefined && contact.travel <= 3) {
			const seg = this.segments[contact.tap]!
			const { y0, y1 } = this.segmentBounds(seg)
			const pos = clamp((contact.y - y0) / Math.max(1, y1 - y0), 0.08, 0.92)
			this.pluck(contact.tap, 0.7, pos)
		}
		this.wake()
	}

	private keyDown(event: KeyboardEvent) {
		const count = this.segments.length
		let next = this.focused
		if (event.key === "ArrowRight" || event.key === "ArrowDown") {
			next = Math.min(count - 1, next + 1)
		} else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
			next = Math.max(0, next - 1)
		} else if (event.key === "Home") {
			next = 0
		} else if (event.key === "End") {
			next = count - 1
		} else {
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
		const busy = this.advance(seconds)
		this.draw()
		if (busy) {
			this.wake()
		} else {
			this.last = 0
		}
	}

	private advance(seconds: number): boolean {
		const rate = Math.log(1 / SILENT) / this.sustain
		let busy = [...this.contacts.values()].some((contact) => contact.down)
		for (const seg of this.segments) {
			if (seg.caught === undefined) {
				stepModalString(seg, seconds, rate)
			}
			if (seg.held) {
				seg.level *= Math.exp(-rate * seconds)
				if (seg.level < SILENT) {
					this.silence(seg)
				}
			}
			busy ||= !!seg.held || seg.caught !== undefined || modalStringAmplitude(seg) > 0.05
		}
		return busy
	}

	private draw() {
		const context = this.canvas.getContext?.("2d")
		if (!context || !this.width || !this.height) {
			return
		}
		const ratio = this.canvas.width / this.width
		context.setTransform(ratio, 0, 0, ratio, 0, 0)
		context.clearRect(0, 0, this.width, this.height)

		const colW = this.colSpacing
		const limit = colW * 0.44
		context.lineCap = "round"
		context.lineJoin = "round"

		// Draw teal division tick marks along each column (matching Chrome Music Lab Strings)
		context.strokeStyle = "rgba(147, 203, 209, 0.65)"
		context.lineWidth = 2
		for (let h = 2; h < this.columnsCount; h++) {
			const series = h + 1
			const x = (h + 0.5) * colW
			for (let t = 1; t < series - 1; t++) {
				const y = this.topPad + (t / series) * this.span
				context.beginPath()
				context.moveTo(x - 6, y)
				context.lineTo(x + 6, y)
				context.stroke()
			}
		}

		// Draw vibrating segments
		for (const seg of this.segments) {
			const { x, y0, y1 } = this.segmentBounds(seg)
			const active = this.activeNotes.has(seg.note)
			const glow = clamp(Math.max(seg.level, active ? 0.65 : 0), 0, 1)
			const color =
				glow > 0.06
					? CML_GOLD
					: seg.isTop
						? "rgba(182, 194, 212, 0.85)"
						: "rgba(140, 168, 198, 0.9)"
			context.strokeStyle = color
			context.shadowColor = CML_GOLD
			context.shadowBlur = glow * 16
			context.lineWidth = 2.4 + glow * 1.8
			context.beginPath()
			for (let k = 0; k <= SEGMENTS; k++) {
				const u = k / SEGMENTS
				const y = y0 + u * (y1 - y0)
				const offset = clamp(sampleModalString(seg, u), -limit, limit)
				const px = x + offset
				if (k === 0) {
					context.moveTo(px, y)
				} else {
					context.lineTo(px, y)
				}
			}
			context.stroke()
			context.shadowBlur = 0
		}

		// Draw grey node endpoints & division nodes
		context.fillStyle = "rgba(148, 163, 184, 0.9)"
		for (let h = 0; h < this.columnsCount; h++) {
			const series = h + 1
			const x = (h + 0.5) * colW
			const nodeYs =
				series === 1
					? [this.topPad, this.topPad + this.span]
					: [
							this.topPad,
							this.topPad + ((series - 1) / series) * this.span,
							this.topPad + this.span
						]
			for (const y of nodeYs) {
				context.beginPath()
				context.arc(x, y, 4.5, 0, Math.PI * 2)
				context.fill()
			}
			if (this.height >= 120) {
				context.fillStyle = "rgba(226, 232, 240, 0.75)"
				context.textAlign = "center"
				context.textBaseline = "middle"
				context.font = `${clamp(colW * 0.22, 10, 12)}px system-ui, sans-serif`
				context.fillText(`1/${series}`, x, this.height - 13)
				context.fillStyle = "rgba(148, 163, 184, 0.9)"
			}
		}
	}
}

if (!customElements.get("chrome-music-lab-strings")) {
	customElements.define("chrome-music-lab-strings", HarmonicStrings)
}

declare global {
	interface HTMLElementTagNameMap {
		"chrome-music-lab-strings": HarmonicStrings
	}
}