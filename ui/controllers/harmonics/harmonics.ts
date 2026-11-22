import { NOTE_OFF, NOTE_ON } from "../../../commands/commands.ts"
import {
	EVENT_BLUR,
	EVENT_CHANGE,
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
	harmonicSeriesMidi,
	midiAddressFromElement
} from "../../shared/chrome-music-lab.ts"
import {
	createModalString,
	driveModalHarmonic,
	exciteModalHarmonic,
	modalStringAmplitude,
	sampleModalString,
	stepModalString,
	type ModalString
} from "../../shared/modal-string.ts"

const SEGMENTS = 56
const MIN_HARMONICS = 2
const MAX_HARMONICS = 12
const DEFAULT_ROOT = 53 // F3 (174.61 Hz), matching Chrome Music Lab Harmonics
const DEFAULT_HARMONICS = 6

interface HarmonicColumn {
	series: number
	midi: number
	string: ModalString
	held?: NoteDetail
	pointers: Set<string>
	ratio: number
}

let voiceId = 3000000

const STYLES = `${CML_HOST_STYLES}
.stage {
	flex: 1 1 var(--stage-height, 210px);
}
canvas {
	cursor: pointer;
}
.keys {
	position: absolute;
	inset: 0;
	display: flex;
	pointer-events: none;
}
.keys button {
	flex: 1 1 0;
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
 * Standing-wave harmonic series controller inspired by Chrome Music Lab Harmonics.
 * Reuses the shared modal string oscillator so each harmonic genuinely wobbles at its
 * standing-wave mode (1f..Nf) while held and decays naturally when released.
 */
export class HarmonicsWaves extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"root",
		"harmonics",
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
	private countInput: HTMLInputElement
	private sustainInput: HTMLInputElement
	private columns: HarmonicColumn[] = []
	private pointerColumn = new Map<number, number>()
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
				<label>Harmonics <input data-harmonics type="number" min="${MIN_HARMONICS}" max="${MAX_HARMONICS}" step="1"></label>
				<label>Decay <input data-sustain type="range" min="0.2" max="5" step="0.1"></label>
			</div>
			<div class="stage" part="stage">
				<canvas part="canvas" aria-hidden="true"></canvas>
				<div class="keys" role="group" aria-label="Harmonic series" aria-describedby="help"></div>
			</div>
			<p id="help" class="sr-only">Touch or drag across the standing waves to play harmonics 1 through N. Use Left and Right arrows to choose a harmonic and hold Space or Enter to sound it.</p>
			<p class="sr-only" role="status" aria-atomic="true"></p>`
		this.canvas = this.root.querySelector("canvas")!
		this.keys = this.root.querySelector(".keys")!
		this.status = this.root.querySelector('[role="status"]')!
		this.rootInput = this.root.querySelector("[data-root]")!
		this.countInput = this.root.querySelector("[data-harmonics]")!
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

	get harmonicsCount(): number {
		const raw = this.getAttribute("harmonics")
		const parsed = raw === null || !raw.trim() ? DEFAULT_HARMONICS : Number(raw)
		return Number.isFinite(parsed)
			? Math.round(clamp(parsed, MIN_HARMONICS, MAX_HARMONICS))
			: DEFAULT_HARMONICS
	}
	set harmonicsCount(value: number) {
		this.setAttribute(
			"harmonics",
			String(Math.round(clamp(value, MIN_HARMONICS, MAX_HARMONICS)))
		)
	}

	get sustain(): number {
		const raw = this.getAttribute("sustain")
		const parsed = raw === null || !raw.trim() ? 1.6 : Number(raw)
		return Number.isFinite(parsed) ? clamp(parsed, 0.2, 5) : 1.6
	}
	set sustain(value: number) {
		this.setAttribute("sustain", String(clamp(value, 0.2, 5)))
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}

	/** MIDI notes for each harmonic column (1f..Nf). */
	get notes(): number[] {
		return this.columns.map((column) => column.midi)
	}

	connectedCallback() {
		super.connectedCallback()
		this.listeners?.abort()
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }
		const canvas = this.canvas

		canvas.addEventListener(EVENT_POINTER_DOWN, (event) => this.pointerDown(event), options)
		canvas.addEventListener(EVENT_POINTER_MOVE, (event) => this.pointerMove(event), options)
		for (const type of [
			EVENT_POINTER_UP,
			EVENT_POINTER_CANCEL,
			EVENT_LOST_POINTER_CAPTURE,
			EVENT_POINTER_LEAVE
		]) {
			canvas.addEventListener(type, (event) => this.pointerUp(event as PointerEvent), options)
		}

		this.keys.addEventListener(EVENT_KEY_DOWN, (event) => this.keyDown(event), options)
		this.keys.addEventListener(EVENT_KEY_UP, (event) => this.keyUp(event), options)
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
		this.countInput.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.countInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.harmonicsCount = Number(this.countInput.value) || DEFAULT_HARMONICS
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
		if (name === "root" || name === "harmonics") {
			this.stop()
			this.build()
		} else if (name === "disabled") {
			this.stop()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	/** Press and sustain harmonic column by 0-based index (0 = 1f fundamental). */
	pressHarmonic(index: number, token = "api", velocity = 0.85): void {
		const column = this.columns[index]
		if (!column || this.disabled || !this.isConnected) {
			return
		}
		const wasHeld = column.pointers.size > 0
		column.pointers.add(token)
		if (!wasHeld) {
			const detail = noteDetail(
				NOTE_ON,
				column.midi,
				clamp(velocity, 0.05, 1),
				voiceId++,
				midiAddressFromElement(this)
			)
			column.held = detail
			column.string.level = detail.velocity
			exciteModalHarmonic(
				column.string,
				column.series,
				Math.max(this.maxAmplitude * 0.45, 6),
				this.maxAmplitude * 0.35
			)
			dispatchInstrumentEvent(this, NOTE_ON, detail)
			this.announce(`Harmonic ${column.series}, ${instrumentNote(column.midi).noteName}`)
		}
		this.wake()
		this.draw()
	}

	/** Release harmonic column for a given pointer/key token. */
	releaseHarmonic(index: number, token = "api"): void {
		const column = this.columns[index]
		if (!column || !column.pointers.delete(token)) {
			return
		}
		if (column.pointers.size === 0 && column.held) {
			const held = column.held
			column.held = undefined
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, held.note, 0, held.id, held)
			)
		}
		this.wake()
		this.draw()
	}

	stop(): void {
		this.pointerColumn.clear()
		for (const column of this.columns) {
			column.pointers.clear()
			if (column.held) {
				const held = column.held
				column.held = undefined
				dispatchInstrumentEvent(
					this,
					NOTE_OFF,
					noteDetail(NOTE_OFF, held.note, 0, held.id, held)
				)
			}
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
		const count = this.harmonicsCount
		this.columns = Array.from({ length: count }, (_, index) => {
			const series = index + 1
			const midi = harmonicSeriesMidi(root, series)
			const string = createModalString(root, count)
			return {
				series,
				midi,
				string,
				pointers: new Set(),
				ratio: 0
			}
		})
		this.focused = Math.min(this.focused, this.columns.length - 1)
		this.keys.replaceChildren(
			...this.columns.map((column, index) => {
				const button = document.createElement("button")
				button.type = "button"
				button.dataset.harmonic = String(index)
				button.setAttribute(
					"aria-label",
					`Harmonic ${column.series} (${column.series}f), ${instrumentNote(column.midi).noteName}`
				)
				return button
			})
		)
	}

	private update() {
		this.rootInput.value = String(this.rootNote)
		this.countInput.value = String(this.harmonicsCount)
		this.sustainInput.value = String(this.sustain)
		for (const control of [this.rootInput, this.countInput, this.sustainInput]) {
			control.disabled = this.disabled
		}
		this.keys.querySelectorAll("button").forEach((button, index) => {
			button.disabled = this.disabled
			button.tabIndex = index === this.focused ? 0 : -1
		})
		this.draw()
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

	private get columnWidth(): number {
		return this.width / Math.max(1, this.columns.length)
	}

	private get maxAmplitude(): number {
		return clamp(this.columnWidth * 0.32, 6, 36)
	}

	private columnIndexAt(clientX: number): number {
		const box = this.canvas.getBoundingClientRect()
		this.resize(box.width, box.height)
		const x = clientX - box.left
		return clamp(
			Math.floor((x / Math.max(1, box.width)) * this.columns.length),
			0,
			this.columns.length - 1
		)
	}

	private pointerDown(event: PointerEvent) {
		if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) {
			return
		}
		event.preventDefault()
		this.canvas.setPointerCapture?.(event.pointerId)
		const index = this.columnIndexAt(event.clientX)
		const token = `p:${event.pointerId}`
		this.pointerColumn.set(event.pointerId, index)
		const velocity = event.pointerType === "pen" && event.pressure > 0 ? event.pressure : 0.85
		this.pressHarmonic(index, token, velocity)
	}

	private pointerMove(event: PointerEvent) {
		const previous = this.pointerColumn.get(event.pointerId)
		if (previous === undefined) {
			return
		}
		const next = this.columnIndexAt(event.clientX)
		if (next === previous) {
			return
		}
		const token = `p:${event.pointerId}`
		this.releaseHarmonic(previous, token)
		this.pointerColumn.set(event.pointerId, next)
		const velocity = event.pointerType === "pen" && event.pressure > 0 ? event.pressure : 0.85
		this.pressHarmonic(next, token, velocity)
	}

	private pointerUp(event: PointerEvent) {
		const previous = this.pointerColumn.get(event.pointerId)
		if (previous === undefined) {
			return
		}
		this.pointerColumn.delete(event.pointerId)
		this.releaseHarmonic(previous, `p:${event.pointerId}`)
	}

	private keyDown(event: KeyboardEvent) {
		const count = this.columns.length
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			if (!event.repeat) {
				this.pressHarmonic(this.focused, `k:${this.focused}`)
			}
			return
		}
		let next = this.focused
		if (event.key === "ArrowRight") {
			next = Math.min(count - 1, next + 1)
		} else if (event.key === "ArrowLeft") {
			next = Math.max(0, next - 1)
		} else if (event.key === "Home") {
			next = 0
		} else if (event.key === "End") {
			next = count - 1
		} else {
			return
		}
		event.preventDefault()
		this.releaseHarmonic(this.focused, `k:${this.focused}`)
		this.focused = next
		this.update()
		this.keys.querySelectorAll("button")[next]?.focus()
	}

	private keyUp(event: KeyboardEvent) {
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			this.releaseHarmonic(this.focused, `k:${this.focused}`)
		}
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
		const maxAmp = this.maxAmplitude
		const damping = Math.log(1 / 0.02) / this.sustain
		let busy = false
		for (const column of this.columns) {
			const held = column.pointers.size > 0
			const targetRatio = held ? 1 : 0
			const ease = 1 - Math.exp(-(held ? 14 : 4.5 / Math.max(0.4, this.sustain)) * seconds)
			column.ratio += (targetRatio - column.ratio) * ease
			if (held) {
				driveModalHarmonic(column.string, column.series, maxAmp, seconds, 12)
				stepModalString(column.string, seconds, damping, column.series - 1)
				column.string.level = 1
				busy = true
			} else {
				stepModalString(column.string, seconds, damping)
				column.string.level = clamp(
					modalStringAmplitude(column.string) / Math.max(1, maxAmp),
					0,
					1
				)
			}
			if (column.ratio > 0.01 || modalStringAmplitude(column.string) > 0.1) {
				busy = true
			}
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

		const topPad = 14
		const bottomPad = this.height >= 120 ? 28 : 12
		const span = Math.max(20, this.height - topPad - bottomPad)
		const colW = this.columnWidth
		const maxAmp = this.maxAmplitude
		const baseAmp = maxAmp * 0.42

		context.lineCap = "round"
		context.lineJoin = "round"
		context.textAlign = "center"
		context.textBaseline = "middle"
		context.font = `${clamp(colW * 0.22, 10, 13)}px system-ui, sans-serif`

		this.columns.forEach((column, index) => {
			const cx = (index + 0.5) * colW
			const active = column.pointers.size > 0 || this.activeNotes.has(column.midi)
			const energy = clamp(
				Math.max(column.ratio, column.string.level, active ? 0.75 : 0),
				0,
				1
			)
			const envelope = baseAmp + (maxAmp - baseAmp) * energy

			// Subtle Chrome Music Lab double-curve standing-wave silhouette
			const idleColor = `rgba(170, 184, 206, ${0.35 + energy * 0.4})`
			const liveColor = energy > 0.05 ? CML_GOLD : idleColor

			for (const sign of [-1, 1]) {
				context.beginPath()
				for (let k = 0; k <= SEGMENTS; k++) {
					const u = k / SEGMENTS
					const y = topPad + u * span
					const standing = sign * envelope * Math.sin(column.series * Math.PI * u)
					const x = cx + standing
					if (k === 0) {
						context.moveTo(x, y)
					} else {
						context.lineTo(x, y)
					}
				}
				context.strokeStyle =
					energy > 0.05
						? `rgba(255, 183, 41, ${0.28 + energy * 0.38})`
						: "rgba(148, 163, 184, 0.38)"
				context.lineWidth = 1.6 + energy * 1.1
				context.stroke()
			}

			// Live modal vibrating wave driven by shared modal-string physics
			if (modalStringAmplitude(column.string) > 0.1 || active) {
				context.beginPath()
				for (let k = 0; k <= SEGMENTS; k++) {
					const u = k / SEGMENTS
					const y = topPad + u * span
					const wobble = clamp(
						sampleModalString(column.string, u),
						-maxAmp * 1.2,
						maxAmp * 1.2
					)
					const x = cx + wobble
					if (k === 0) {
						context.moveTo(x, y)
					} else {
						context.lineTo(x, y)
					}
				}
				context.strokeStyle = liveColor
				context.shadowColor = CML_GOLD
				context.shadowBlur = 4 + energy * 16
				context.lineWidth = 2.4 + energy * 1.8
				context.stroke()
				context.shadowBlur = 0
			}

			// Draw harmonic zero-crossing node dots
			context.fillStyle = energy > 0.15 ? CML_GOLD : "rgba(148, 163, 184, 0.55)"
			for (let node = 0; node <= column.series; node++) {
				const y = topPad + (node / column.series) * span
				context.beginPath()
				context.arc(cx, y, node === 0 || node === column.series ? 3.5 : 2.5, 0, Math.PI * 2)
				context.fill()
			}

			if (this.height >= 120) {
				context.fillStyle = energy > 0.15 ? CML_GOLD : "rgba(226, 232, 240, 0.78)"
				context.fillText(
					`${column.series}f · ${instrumentNote(column.midi).noteName}`,
					cx,
					this.height - 13
				)
			}
		})
	}
}

if (!customElements.get("chrome-music-lab-harmonics")) {
	customElements.define("chrome-music-lab-harmonics", HarmonicsWaves)
}

declare global {
	interface HTMLElementTagNameMap {
		"chrome-music-lab-harmonics": HarmonicsWaves
	}
}