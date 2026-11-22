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
	CML_BLUE,
	CML_HOST_STYLES,
	clamp,
	isAccidental,
	midiAddressFromElement
} from "../../shared/chrome-music-lab.ts"

const DEFAULT_OCTAVE = 4 // C4–C6, matching Chrome Music Lab Sound Waves
const KEY_COUNT = 25
const GRID_COLS = 22
const GRID_ROWS = 12
const TRACE_POINTS = 90

let voiceId = 3600000

const STYLES = `${CML_HOST_STYLES}
.stage {
	flex: 1 1 var(--stage-height, 150px);
	min-height: 76px;
}
.stage canvas {
	cursor: zoom-in;
}
:host([zoom="true"]) .stage canvas {
	cursor: zoom-out;
}
.keyboard {
	position: relative;
	flex: 0 0 68px;
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
	border-radius: 0 0 5px 5px;
	padding: 0;
	min-height: 0;
	cursor: pointer;
}
.key.white {
	flex: 1 1 0;
	height: 100%;
	background: #f5f7fb;
	color: #1b2232;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding-bottom: 0.25rem;
	font-size: 0.68rem;
	font-weight: 600;
}
.key.black {
	position: absolute;
	top: 0;
	height: 58%;
	z-index: 2;
	background: #222836;
	border-color: #0b0f18;
}
.key[data-active="true"] {
	background: ${CML_BLUE};
	color: #ffffff;
}
`

/**
 * Longitudinal air-particle sound-wave keyboard inspired by Chrome Music Lab Sound Waves.
 * Emits event-only MIDI 2.0 NOTE_ON / NOTE_OFF messages while animating air molecules and a
 * zoomable single-particle sine wave trace.
 */
export class SoundWaves extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"octave",
		"zoom",
		"disabled",
		"group",
		"channel"
	]

	protected root = this.attachShadow({ mode: "open" })
	private canvas: HTMLCanvasElement
	private keyboard: HTMLElement
	private status: HTMLElement
	private zoomBtn: HTMLButtonElement
	private octaveInput: HTMLInputElement
	private keyButtons = new Map<number, HTMLButtonElement>()
	private held = new Map<string, NoteDetail>()
	private activePointers = new Map<number, number>()
	private externalNotes = new Set<number>()
	private listeners?: AbortController
	private observer?: ResizeObserver
	private frame = 0
	private lastFrame = 0
	private width = 0
	private height = 0
	private phaseTime = 0
	private frequency = 261.63
	private amplitude = 0
	private zoomProgress = 0
	private trace: number[] = []

	constructor() {
		super()
		this.root.innerHTML = `
			<style>${STYLES}</style>
			<div class="toolbar" part="toolbar">
				<button type="button" data-zoom aria-pressed="false">Magnify particle</button>
				<label>Octave <input data-octave type="number" min="1" max="6" step="1"></label>
			</div>
			<div class="stage" part="stage">
				<canvas part="canvas" aria-hidden="true"></canvas>
			</div>
			<div class="keyboard" part="keyboard" role="group" aria-label="Sound Waves keyboard"></div>
			<p class="sr-only" role="status" aria-atomic="true"></p>`
		this.canvas = this.root.querySelector("canvas")!
		this.keyboard = this.root.querySelector(".keyboard")!
		this.status = this.root.querySelector('[role="status"]')!
		this.zoomBtn = this.root.querySelector("[data-zoom]")!
		this.octaveInput = this.root.querySelector("[data-octave]")!
		this.buildKeys()
	}

	get octave(): number {
		const raw = this.getAttribute("octave")
		const parsed = raw === null || !raw.trim() ? DEFAULT_OCTAVE : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 1, 6)) : DEFAULT_OCTAVE
	}
	set octave(value: number) {
		this.setAttribute("octave", String(Math.round(clamp(value, 1, 6))))
	}

	get zoom(): boolean {
		return this.getAttribute("zoom") === "true"
	}
	set zoom(value: boolean) {
		this.setAttribute("zoom", value ? "true" : "false")
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}

	connectedCallback() {
		super.connectedCallback()
		this.listeners?.abort()
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }

		this.zoomBtn.addEventListener(
			EVENT_CLICK,
			() => {
				this.zoom = !this.zoom
				this.changed()
			},
			options
		)
		this.canvas.addEventListener(
			EVENT_CLICK,
			() => {
				if (!this.disabled) {
					this.zoom = !this.zoom
					this.changed()
				}
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
			this.observer = new ResizeObserver(() => this.measure())
			this.observer.observe(this)
			this.observer.observe(this.canvas)
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
		this.lastFrame = 0
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		if (previous === next) {
			return
		}
		if (name === "octave") {
			this.stop()
			this.buildKeys()
		} else if (name === "disabled" && this.disabled) {
			this.stop()
		} else if (name === "zoom") {
			this.trace = []
			this.wake()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	noteDown(midi: number, token = "api", velocity = 0.85): void {
		if (this.disabled || !this.isConnected) {
			return
		}
		this.noteUp(token)
		const info = instrumentNote(midi)
		const detail = noteDetail(
			NOTE_ON,
			info.noteNumber,
			clamp(velocity, 0.05, 1),
			voiceId++,
			midiAddressFromElement(this)
		)
		this.held.set(token, detail)
		this.frequency = info.frequency
		this.status.textContent = `${info.noteName} (${Math.round(info.frequency)} Hz)`
		dispatchInstrumentEvent(this, NOTE_ON, detail)
		this.syncHighlights()
		this.wake()
	}

	noteUp(token = "api"): void {
		const detail = this.held.get(token)
		if (!detail) {
			return
		}
		this.held.delete(token)
		dispatchInstrumentEvent(
			this,
			NOTE_OFF,
			noteDetail(NOTE_OFF, detail.note, 0, detail.id, detail)
		)
		this.syncHighlights()
		this.wake()
	}

	stop(): void {
		this.activePointers.clear()
		for (const [token, detail] of this.held) {
			this.held.delete(token)
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, detail.note, 0, detail.id, detail)
			)
		}
		this.syncHighlights()
		this.wake()
	}

	setActiveNote(note: InstrumentNote | number, active = true): void {
		const info = instrumentNote(note)
		if (active) {
			this.externalNotes.add(info.noteNumber)
			this.frequency = info.frequency
		} else {
			this.externalNotes.delete(info.noteNumber)
		}
		this.syncHighlights()
		this.wake()
	}

	setActiveNotes(notes: Iterable<InstrumentNote | number>): void {
		const list = [...notes].map((note) => instrumentNote(note))
		this.externalNotes = new Set(list.map((n) => n.noteNumber))
		if (list.length > 0) {
			this.frequency = list.at(-1)!.frequency
		}
		this.syncHighlights()
		this.wake()
	}

	clearActiveNotes(): void {
		this.externalNotes.clear()
		this.syncHighlights()
		this.wake()
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
			button.setAttribute("aria-label", info.noteName)
			if (isAccidental(midi)) {
				button.className = "key black"
				button.style.left = `${whiteIndex * whiteWidth - blackWidth / 2}%`
				button.style.width = `${blackWidth}%`
				fragment.append(button)
			} else {
				button.className = "key white"
				button.textContent = info.noteKey === "C" ? info.noteName : ""
				whitesRow.append(button)
				whiteIndex++
			}
			this.keyButtons.set(midi, button)
		}
		this.keyboard.replaceChildren(fragment)
		this.syncHighlights()
	}

	private update() {
		this.zoomBtn.setAttribute("aria-pressed", String(this.zoom))
		this.zoomBtn.textContent = this.zoom ? "Show air field" : "Magnify particle"
		this.octaveInput.value = String(this.octave)
		this.zoomBtn.disabled = this.disabled
		this.octaveInput.disabled = this.disabled
		for (const button of this.keyButtons.values()) {
			button.disabled = this.disabled
		}
		this.draw()
	}

	private syncHighlights() {
		const sounding = new Set<number>(this.externalNotes)
		for (const detail of this.held.values()) {
			sounding.add(detail.note.noteNumber)
		}
		for (const [midi, button] of this.keyButtons) {
			button.dataset.active = String(sounding.has(midi))
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
		this.noteDown(midi, `p:${event.pointerId}`, velocity)
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
			this.noteDown(midi, `p:${event.pointerId}`)
		}
	}

	private pointerUp(event: PointerEvent) {
		if (!this.activePointers.delete(event.pointerId)) {
			return
		}
		this.noteUp(`p:${event.pointerId}`)
	}

	private keyDown(event: KeyboardEvent) {
		const midi = this.midiFromTarget(event.target)
		if (midi === undefined) {
			return
		}
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			if (!event.repeat) {
				this.noteDown(midi, `k:${midi}`)
			}
		} else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
			event.preventDefault()
			const next = midi + (event.key === "ArrowRight" ? 1 : -1)
			this.keyButtons.get(next)?.focus()
		}
	}

	private keyUp(event: KeyboardEvent) {
		const midi = this.midiFromTarget(event.target)
		if (midi !== undefined && (event.key === " " || event.key === "Enter")) {
			event.preventDefault()
			this.noteUp(`k:${midi}`)
		}
	}

	private measure() {
		const box = this.canvas.getBoundingClientRect()
		if (box.width !== this.width || box.height !== this.height) {
			this.width = box.width
			this.height = box.height
			const ratio = globalThis.devicePixelRatio || 1
			this.canvas.width = Math.max(1, Math.round(box.width * ratio))
			this.canvas.height = Math.max(1, Math.round(box.height * ratio))
		}
		this.toggleAttribute("data-compact", this.clientHeight > 0 && this.clientHeight < 165)
		this.draw()
	}

	private wake() {
		if (this.frame || !this.isConnected || typeof requestAnimationFrame === "undefined") {
			return
		}
		if (!this.lastFrame) {
			this.lastFrame = performance.now()
		}
		this.frame = requestAnimationFrame(this.onFrame)
	}

	private onFrame = (now: number) => {
		this.frame = 0
		const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05)
		this.lastFrame = now
		const sounding = this.held.size > 0 || this.externalNotes.size > 0
		const targetAmp = sounding ? 1 : 0
		this.amplitude += (targetAmp - this.amplitude) * (1 - Math.exp(-(sounding ? 16 : 6) * dt))
		const targetZoom = this.zoom ? 1 : 0
		this.zoomProgress += (targetZoom - this.zoomProgress) * (1 - Math.exp(-9 * dt))
		// Visual frequency scaled from real Hz (matching Chrome Music Lab's readable wave speed)
		const visualHz = clamp(this.frequency * 0.0085, 0.8, 12)
		this.phaseTime += dt * visualHz

		if (this.zoomProgress > 0.5) {
			const yDisp = Math.sin(this.phaseTime * Math.PI * 2) * this.amplitude
			this.trace.push(yDisp)
			if (this.trace.length > TRACE_POINTS) {
				this.trace.shift()
			}
		}

		this.draw()

		const busy =
			sounding || this.amplitude > 0.01 || Math.abs(this.zoomProgress - targetZoom) > 0.01
		if (busy) {
			this.wake()
		} else {
			this.lastFrame = 0
		}
	}

	private draw() {
		const ctx = this.canvas.getContext?.("2d")
		if (!ctx || !this.width || !this.height) {
			return
		}
		const ratio = this.canvas.width / this.width
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
		ctx.clearRect(0, 0, this.width, this.height)

		const scale = 1 + this.zoomProgress * 2
		const cx = this.width / 2
		const cy = this.height / 2
		const maxDisp = Math.min(this.width, this.height) * 0.08 * this.amplitude * scale
		const baseDotR =
			clamp(Math.min(this.width / GRID_COLS, this.height / GRID_ROWS) * 0.22, 2, 5.5) * scale
		const focusCol = Math.floor(GRID_COLS / 2)
		const focusRow = Math.floor(GRID_ROWS / 2)
		const fieldAlpha = 1 - this.zoomProgress * 0.72

		// Longitudinal air-particle dot grid
		ctx.fillStyle = CML_BLUE
		ctx.globalAlpha = fieldAlpha
		for (let r = 0; r < GRID_ROWS; r++) {
			const ny = (r + 0.5) / GRID_ROWS - 0.5
			const wavePhase = (this.phaseTime + (0.5 - ny) * 2.2) * Math.PI * 2
			const dispY = Math.sin(wavePhase) * maxDisp
			for (let c = 0; c < GRID_COLS; c++) {
				if (this.zoomProgress > 0.1 && c === focusCol && r === focusRow) {
					continue
				}
				const nx = (c + 0.5) / GRID_COLS - 0.5
				const px = cx + nx * this.width * scale
				const py = cy + ny * this.height * scale + dispY
				if (
					px < -baseDotR ||
					px > this.width + baseDotR ||
					py < -baseDotR ||
					py > this.height + baseDotR
				) {
					continue
				}
				ctx.beginPath()
				ctx.arc(px, py, baseDotR, 0, Math.PI * 2)
				ctx.fill()
			}
		}
		ctx.globalAlpha = 1

		// Magnified red particle + scrolling sine wave trace
		if (this.zoomProgress > 0.15) {
			const ny = (focusRow + 0.5) / GRID_ROWS - 0.5
			const focusDisp = Math.sin((this.phaseTime + (0.5 - ny) * 2.2) * Math.PI * 2) * maxDisp
			const fx = cx
			const fy = cy + focusDisp

			if (this.trace.length > 1) {
				ctx.beginPath()
				const traceWidth = cx - 12
				for (let i = 0; i < this.trace.length; i++) {
					const t = i / (TRACE_POINTS - 1)
					const tx = fx - (1 - t) * traceWidth
					const ty =
						cy + this.trace[i]! * (Math.min(this.width, this.height) * 0.08 * scale)
					if (i === 0) {
						ctx.moveTo(tx, ty)
					} else {
						ctx.lineTo(tx, ty)
					}
				}
				ctx.strokeStyle = "rgba(255, 72, 72, 0.85)"
				ctx.lineWidth = 2.5
				ctx.stroke()
			}

			ctx.fillStyle = "#ff4040"
			ctx.beginPath()
			ctx.arc(fx, fy, baseDotR * 1.15, 0, Math.PI * 2)
			ctx.fill()
		}
	}

	private changed() {
		this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
	}
}

if (!customElements.get("chrome-music-lab-sound-waves")) {
	customElements.define("chrome-music-lab-sound-waves", SoundWaves)
}

declare global {
	interface HTMLElementTagNameMap {
		"chrome-music-lab-sound-waves": SoundWaves
	}
}