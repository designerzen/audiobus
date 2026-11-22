import { NOTE_OFF, NOTE_ON } from "../../../commands/commands.ts"
import {
	EVENT_BLUR,
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_INPUT,
	EVENT_INSTRUMENT_DISCONNECT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_PAGE_HIDE,
	EVENT_POINTER_DOWN,
	EVENT_STEP_CHANGE,
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
	CHROMATIC_NOTES,
	CML_ARPEGGIO_COLORS,
	CML_HOST_STYLES,
	clamp,
	midiAddressFromElement,
	type PitchClassName
} from "../../shared/chrome-music-lab.ts"

export type ArpeggioQuality = "major" | "minor"

export interface ArpeggioEvent {
	/** Offset in quarter-note beats within a 4-beat bar. */
	beat: number
	/** Duration in quarter-note beats. */
	duration: number
	/** Degree indices into the 3-octave triad (0..8). */
	degrees: readonly number[]
}

export interface ArpeggioPattern {
	name: string
	steps: readonly ArpeggioEvent[]
}

/** Circle-of-fifths ordering from Chrome Music Lab Arpeggios. */
export const MAJOR_WHEEL_ORDER: readonly PitchClassName[] = [
	"C",
	"G",
	"D",
	"A",
	"E",
	"B",
	"F#",
	"C#",
	"G#",
	"D#",
	"A#",
	"F"
]

export const MINOR_WHEEL_ORDER: readonly PitchClassName[] = [
	"A",
	"E",
	"B",
	"F#",
	"C#",
	"G#",
	"D#",
	"A#",
	"F",
	"C",
	"G",
	"D"
]

/** The five looping arpeggio patterns from Chrome Music Lab Arpeggios. */
export const ARPEGGIO_PATTERNS: readonly ArpeggioPattern[] = [
	{
		name: "Up & Down",
		steps: [0, 1, 2, 3, 4, 3, 2, 1].map((degree, i) => ({
			beat: i * 0.5,
			duration: 0.45,
			degrees: [degree]
		}))
	},
	{
		name: "High Wave",
		steps: [3, 5, 4, 5, 3, 5, 4, 5].map((degree, i) => ({
			beat: i * 0.5,
			duration: 0.45,
			degrees: [degree]
		}))
	},
	{
		name: "Quarter Climb",
		steps: [0, 1, 2, 3].map((degree, i) => ({
			beat: i,
			duration: 0.9,
			degrees: [degree]
		}))
	},
	{
		name: "Triplet Ripple",
		steps: [5, 4, 3, 4, 3, 2, 3, 2, 1, 2, 3, 4].map((degree, i) => ({
			beat: i / 3,
			duration: 0.3,
			degrees: [degree]
		}))
	},
	{
		name: "Double Triplets",
		steps: [
			[0, 2],
			[1, 3],
			[2, 4],
			[3, 5],
			[2, 4],
			[1, 5],
			[0, 6],
			[1, 5],
			[2, 6],
			[3, 7],
			[6, 2],
			[5, 1]
		].map((degrees, i) => ({
			beat: i / 3,
			duration: 0.3,
			degrees
		}))
	}
]

const INNER_RING_RATIO = 0.64
const CENTER_BUTTON_RATIO = 0.28
const PREVIEW_STRUM_MS = 45
const PREVIEW_HOLD_MS = 320

let voiceId = 3300000

const STYLES = `${CML_HOST_STYLES}
.body {
	display: grid;
	grid-template-columns: minmax(150px, 1fr) minmax(150px, 1.1fr);
	gap: 0.5rem;
	padding: 0.5rem;
	flex: 1 1 var(--stage-height, 210px);
	min-height: 120px;
	align-items: stretch;
}
@media (max-width: 420px) {
	.body {
		grid-template-columns: 1fr;
	}
}
.wheel-wrap,
.pattern-wrap {
	position: relative;
	min-height: 120px;
}
.wheel-wrap canvas {
	cursor: pointer;
}
.pattern-wrap {
	display: flex;
	flex-direction: column;
	gap: 0.35rem;
}
.pattern-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.35rem;
	font-weight: 600;
}
.pattern-canvas-wrap {
	position: relative;
	flex: 1 1 0;
	min-height: 84px;
	border-radius: 8px;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid color-mix(in oklab, currentColor 14%, transparent);
	overflow: hidden;
}
`

export function arpeggioChordNotes(
	letter: PitchClassName,
	quality: ArpeggioQuality,
	octave = 3
): number[] {
	const pc = CHROMATIC_NOTES.indexOf(letter)
	const root = (octave + 1) * 12 + Math.max(0, pc)
	const intervals = quality === "minor" ? [0, 3, 7] : [0, 4, 7]
	const notes: number[] = []
	for (let oct = 0; oct < 3; oct++) {
		for (const interval of intervals) {
			notes.push(clamp(root + oct * 12 + interval, 0, 127))
		}
	}
	return notes
}

/**
 * Circle-of-fifths arpeggio chord wheel inspired by Chrome Music Lab Arpeggios.
 * Emits event-only MIDI 2.0 NOTE_ON / NOTE_OFF messages for the active pattern and chord.
 */
export class ArpeggiosWheel extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"chord",
		"quality",
		"pattern",
		"bpm",
		"octave",
		"disabled",
		"group",
		"channel"
	]

	protected root = this.attachShadow({ mode: "open" })
	private wheelCanvas: HTMLCanvasElement
	private patternCanvas: HTMLCanvasElement
	private status: HTMLElement
	private playBtn: HTMLButtonElement
	private prevBtn: HTMLButtonElement
	private nextBtn: HTMLButtonElement
	private patternName: HTMLElement
	private bpmInput: HTMLInputElement
	private octaveInput: HTMLInputElement
	private listeners?: AbortController
	private observer?: ResizeObserver
	private running = false
	private stepIndex = -1
	private stepTimer?: ReturnType<typeof setTimeout>
	private releaseTimers = new Set<ReturnType<typeof setTimeout>>()
	private held = new Map<number, NoteDetail>()
	private activeNotes = new Set<number>()
	private wheelSize = { w: 0, h: 0 }
	private patternSize = { w: 0, h: 0 }

	constructor() {
		super()
		this.root.innerHTML = `
			<style>${STYLES}</style>
			<div class="toolbar" part="toolbar">
				<button type="button" data-play aria-pressed="false">Play</button>
				<label>Tempo <input data-bpm type="number" min="40" max="240" step="1"> BPM</label>
				<label>Octave <input data-octave type="number" min="1" max="5" step="1"></label>
			</div>
			<div class="body" part="body">
				<div class="wheel-wrap">
					<canvas data-wheel part="wheel" aria-label="Circle of fifths chord wheel" role="application" tabindex="0"></canvas>
				</div>
				<div class="pattern-wrap">
					<div class="pattern-header">
						<button type="button" data-prev aria-label="Previous pattern">◀</button>
						<span data-pattern-name></span>
						<button type="button" data-next aria-label="Next pattern">▶</button>
					</div>
					<div class="pattern-canvas-wrap">
						<canvas data-pattern part="pattern" aria-hidden="true"></canvas>
					</div>
				</div>
			</div>
			<p class="sr-only" role="status" aria-atomic="true"></p>`
		this.wheelCanvas = this.root.querySelector("[data-wheel]")!
		this.patternCanvas = this.root.querySelector("[data-pattern]")!
		this.status = this.root.querySelector('[role="status"]')!
		this.playBtn = this.root.querySelector("[data-play]")!
		this.prevBtn = this.root.querySelector("[data-prev]")!
		this.nextBtn = this.root.querySelector("[data-next]")!
		this.patternName = this.root.querySelector("[data-pattern-name]")!
		this.bpmInput = this.root.querySelector("[data-bpm]")!
		this.octaveInput = this.root.querySelector("[data-octave]")!
	}

	get chord(): PitchClassName {
		const raw = this.getAttribute("chord")?.trim().toUpperCase() ?? "C"
		return (CHROMATIC_NOTES as readonly string[]).includes(raw) ? (raw as PitchClassName) : "C"
	}
	set chord(value: PitchClassName) {
		this.setAttribute("chord", value)
	}

	get quality(): ArpeggioQuality {
		return this.getAttribute("quality")?.toLowerCase() === "minor" ? "minor" : "major"
	}
	set quality(value: ArpeggioQuality) {
		this.setAttribute("quality", value === "minor" ? "minor" : "major")
	}

	get pattern(): number {
		const raw = this.getAttribute("pattern")
		const parsed = raw === null || !raw.trim() ? 0 : Number(raw)
		return Number.isInteger(parsed)
			? ((parsed % ARPEGGIO_PATTERNS.length) + ARPEGGIO_PATTERNS.length) %
					ARPEGGIO_PATTERNS.length
			: 0
	}
	set pattern(value: number) {
		const index =
			((Math.round(value) % ARPEGGIO_PATTERNS.length) + ARPEGGIO_PATTERNS.length) %
			ARPEGGIO_PATTERNS.length
		this.setAttribute("pattern", String(index))
	}

	get bpm(): number {
		const raw = this.getAttribute("bpm")
		const parsed = raw === null || !raw.trim() ? 120 : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 40, 240)) : 120
	}
	set bpm(value: number) {
		this.setAttribute("bpm", String(Math.round(clamp(value, 40, 240))))
	}

	get octave(): number {
		const raw = this.getAttribute("octave")
		const parsed = raw === null || !raw.trim() ? 3 : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 1, 5)) : 3
	}
	set octave(value: number) {
		this.setAttribute("octave", String(Math.round(clamp(value, 1, 5))))
	}

	get disabled(): boolean {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}

	get playing(): boolean {
		return this.running
	}

	get chordNotes(): number[] {
		return arpeggioChordNotes(this.chord, this.quality, this.octave)
	}

	connectedCallback() {
		super.connectedCallback()
		this.listeners?.abort()
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }

		this.playBtn.addEventListener(
			EVENT_CLICK,
			() => {
				if (this.running) {
					this.stop()
				} else {
					this.play()
				}
			},
			options
		)
		this.prevBtn.addEventListener(
			EVENT_CLICK,
			() => {
				this.pattern = this.pattern - 1
				this.changed()
			},
			options
		)
		this.nextBtn.addEventListener(
			EVENT_CLICK,
			() => {
				this.pattern = this.pattern + 1
				this.changed()
			},
			options
		)
		this.bpmInput.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.bpmInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.bpm = Number(this.bpmInput.value) || 120
				this.changed()
			},
			options
		)
		this.octaveInput.addEventListener(EVENT_INPUT, (event) => event.stopPropagation(), options)
		this.octaveInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.octave = Number(this.octaveInput.value) || 3
				this.changed()
			},
			options
		)

		this.wheelCanvas.addEventListener(
			EVENT_POINTER_DOWN,
			(event) => this.wheelPointerDown(event),
			options
		)
		this.wheelCanvas.addEventListener(
			EVENT_KEY_DOWN,
			(event) => this.wheelKeyDown(event),
			options
		)
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
			this.observer.observe(this.wheelCanvas)
			this.observer.observe(this.patternCanvas)
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
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		if (previous === next) {
			return
		}
		if (name === "disabled" && this.disabled) {
			this.stop()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	selectChord(letter: PitchClassName, quality: ArpeggioQuality, preview = !this.running): void {
		if (this.disabled) {
			return
		}
		this.chord = letter
		this.quality = quality
		this.status.textContent = `${letter} ${quality}`
		this.changed()
		if (preview && this.isConnected) {
			this.previewChord()
		}
		this.draw()
	}

	play(): void {
		if (this.disabled || this.running || !this.isConnected) {
			return
		}
		this.clearReleaseTimers()
		this.releaseHeld()
		this.running = true
		this.stepIndex = -1
		this.update()
		this.status.textContent = "Arpeggio playing"
		this.tick()
	}

	stop(): void {
		clearTimeout(this.stepTimer)
		this.stepTimer = undefined
		this.clearReleaseTimers()
		this.running = false
		this.stepIndex = -1
		this.releaseHeld()
		this.update()
	}

	setActiveNote(note: InstrumentNote | number, active = true): void {
		const number = instrumentNote(note).noteNumber
		if (active) {
			this.activeNotes.add(number)
		} else {
			this.activeNotes.delete(number)
		}
		this.drawPattern()
	}

	setActiveNotes(notes: Iterable<InstrumentNote | number>): void {
		this.activeNotes = new Set([...notes].map((note) => instrumentNote(note).noteNumber))
		this.drawPattern()
	}

	clearActiveNotes(): void {
		this.activeNotes.clear()
		this.drawPattern()
	}

	private previewChord() {
		this.clearReleaseTimers()
		this.releaseHeld()
		const notes = this.chordNotes.slice(0, 4)
		notes.forEach((midi, idx) => {
			const onTimer = setTimeout(() => {
				this.releaseTimers.delete(onTimer)
				if (!this.isConnected || this.disabled || this.running) {
					return
				}
				this.emitTimedNote(midi, PREVIEW_HOLD_MS, 0.78)
			}, idx * PREVIEW_STRUM_MS)
			this.releaseTimers.add(onTimer)
		})
	}

	private tick() {
		if (!this.running || !this.isConnected) {
			return
		}
		const pattern = ARPEGGIO_PATTERNS[this.pattern]!
		const steps = pattern.steps
		this.stepIndex = (this.stepIndex + 1) % steps.length
		const current = steps[this.stepIndex]!
		const next = steps[(this.stepIndex + 1) % steps.length]!
		const notes = this.chordNotes
		const msPerBeat = 60000 / this.bpm
		const holdMs = Math.max(40, current.duration * msPerBeat)

		for (const degree of current.degrees) {
			const midi = notes[degree]
			if (midi !== undefined) {
				this.emitTimedNote(midi, holdMs, 0.85)
			}
		}

		this.dispatchEvent(
			new CustomEvent(EVENT_STEP_CHANGE, {
				detail: { step: this.stepIndex },
				bubbles: true,
				composed: true
			})
		)
		this.drawPattern()

		const gapBeats =
			next.beat > current.beat ? next.beat - current.beat : 4 - current.beat + next.beat
		this.stepTimer = setTimeout(() => this.tick(), Math.max(30, gapBeats * msPerBeat))
	}

	private emitTimedNote(midi: number, durationMs: number, velocity: number) {
		const id = voiceId++
		const detail = noteDetail(NOTE_ON, midi, velocity, id, midiAddressFromElement(this))
		this.held.set(id, detail)
		dispatchInstrumentEvent(this, NOTE_ON, detail)
		const timer = setTimeout(() => {
			this.releaseTimers.delete(timer)
			const live = this.held.get(id)
			if (!live) {
				return
			}
			this.held.delete(id)
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, live.note, 0, live.id, live)
			)
		}, durationMs)
		this.releaseTimers.add(timer)
	}

	private clearReleaseTimers() {
		for (const timer of this.releaseTimers) {
			clearTimeout(timer)
		}
		this.releaseTimers.clear()
	}

	private releaseHeld() {
		for (const [id, detail] of this.held) {
			this.held.delete(id)
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, detail.note, 0, detail.id, detail)
			)
		}
	}

	private wheelPointerDown(event: PointerEvent) {
		if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) {
			return
		}
		event.preventDefault()
		const box = this.wheelCanvas.getBoundingClientRect()
		const x = event.clientX - box.left - box.width / 2
		const y = event.clientY - box.top - box.height / 2
		const radius = Math.min(box.width, box.height) * 0.46
		if (radius <= 0) {
			return
		}
		const dist = Math.hypot(x, y) / radius
		if (dist > 1) {
			return
		}
		if (dist <= CENTER_BUTTON_RATIO) {
			if (this.running) {
				this.stop()
			} else {
				this.play()
			}
			return
		}
		const arc = (Math.PI * 2) / 12
		// Top slice (C major / a minor) is centered at -PI/2.
		const angle = (Math.atan2(y, x) + Math.PI / 2 + arc / 2 + Math.PI * 2) % (Math.PI * 2)
		const slice = clamp(Math.floor(angle / arc), 0, 11)
		if (dist >= INNER_RING_RATIO) {
			this.selectChord(MAJOR_WHEEL_ORDER[slice]!, "major")
		} else {
			this.selectChord(MINOR_WHEEL_ORDER[slice]!, "minor")
		}
	}

	private wheelKeyDown(event: KeyboardEvent) {
		if (this.disabled) {
			return
		}
		const order = this.quality === "major" ? MAJOR_WHEEL_ORDER : MINOR_WHEEL_ORDER
		const index = Math.max(0, order.indexOf(this.chord))
		if (event.key === "ArrowRight") {
			event.preventDefault()
			this.selectChord(order[(index + 1) % 12]!, this.quality)
		} else if (event.key === "ArrowLeft") {
			event.preventDefault()
			this.selectChord(order[(index + 11) % 12]!, this.quality)
		} else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
			event.preventDefault()
			const nextQuality: ArpeggioQuality = this.quality === "major" ? "minor" : "major"
			const nextOrder = nextQuality === "major" ? MAJOR_WHEEL_ORDER : MINOR_WHEEL_ORDER
			this.selectChord(nextOrder[index]!, nextQuality)
		} else if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			if (this.running) {
				this.stop()
			} else {
				this.play()
			}
		}
	}

	private update() {
		this.playBtn.textContent = this.running ? "Stop" : "Play"
		this.playBtn.setAttribute("aria-pressed", String(this.running))
		this.bpmInput.value = String(this.bpm)
		this.octaveInput.value = String(this.octave)
		this.patternName.textContent = `${this.pattern + 1}/${ARPEGGIO_PATTERNS.length} ${ARPEGGIO_PATTERNS[this.pattern]!.name}`
		for (const control of [
			this.playBtn,
			this.prevBtn,
			this.nextBtn,
			this.bpmInput,
			this.octaveInput
		]) {
			control.disabled = this.disabled
		}
		this.draw()
	}

	private measure() {
		this.resizeCanvas(this.wheelCanvas, this.wheelSize)
		this.resizeCanvas(this.patternCanvas, this.patternSize)
		this.toggleAttribute("data-compact", this.clientHeight > 0 && this.clientHeight < 155)
		this.draw()
	}

	private resizeCanvas(canvas: HTMLCanvasElement, size: { w: number; h: number }) {
		const box = canvas.getBoundingClientRect()
		if (box.width === size.w && box.height === size.h) {
			return
		}
		size.w = box.width
		size.h = box.height
		const ratio = globalThis.devicePixelRatio || 1
		canvas.width = Math.max(1, Math.round(box.width * ratio))
		canvas.height = Math.max(1, Math.round(box.height * ratio))
	}

	private draw() {
		this.drawWheel()
		this.drawPattern()
	}

	private drawWheel() {
		const ctx = this.wheelCanvas.getContext?.("2d")
		const { w, h } = this.wheelSize
		if (!ctx || !w || !h) {
			return
		}
		const ratio = this.wheelCanvas.width / w
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
		ctx.clearRect(0, 0, w, h)

		const cx = w / 2
		const cy = h / 2
		const radius = Math.min(w, h) * 0.46
		const inner = radius * INNER_RING_RATIO
		const center = radius * CENTER_BUTTON_RATIO
		const arc = (Math.PI * 2) / 12
		const offset = -Math.PI / 2 - arc / 2

		ctx.textAlign = "center"
		ctx.textBaseline = "middle"

		for (let i = 0; i < 12; i++) {
			const start = offset + i * arc
			const end = start + arc
			const mid = (start + end) / 2
			const maj = MAJOR_WHEEL_ORDER[i]!
			const min = MINOR_WHEEL_ORDER[i]!

			// Major outer ring
			const majSelected = this.quality === "major" && this.chord === maj
			ctx.beginPath()
			ctx.arc(cx, cy, radius, start, end)
			ctx.arc(cx, cy, inner, end, start, true)
			ctx.closePath()
			ctx.fillStyle = majSelected ? "#111520" : CML_ARPEGGIO_COLORS[maj]
			ctx.fill()
			ctx.strokeStyle = "rgba(16, 19, 29, 0.6)"
			ctx.lineWidth = 1.2
			ctx.stroke()

			const majR = (radius + inner) / 2
			ctx.fillStyle = majSelected ? "#ffffff" : "#111520"
			ctx.font = `700 ${clamp(radius * 0.13, 9, 14)}px system-ui, sans-serif`
			ctx.fillText(maj, cx + Math.cos(mid) * majR, cy + Math.sin(mid) * majR)

			// Minor inner ring
			const minSelected = this.quality === "minor" && this.chord === min
			ctx.beginPath()
			ctx.arc(cx, cy, inner, start, end)
			ctx.arc(cx, cy, center, end, start, true)
			ctx.closePath()
			ctx.fillStyle = minSelected ? "#111520" : CML_ARPEGGIO_COLORS[min]
			ctx.globalAlpha = minSelected ? 1 : 0.78
			ctx.fill()
			ctx.globalAlpha = 1
			ctx.stroke()

			const minR = (inner + center) / 2
			ctx.fillStyle = minSelected ? "#ffffff" : "#111520"
			ctx.font = `600 ${clamp(radius * 0.11, 8, 12)}px system-ui, sans-serif`
			ctx.fillText(min.toLowerCase(), cx + Math.cos(mid) * minR, cy + Math.sin(mid) * minR)
		}

		// Center Play / Stop button
		ctx.beginPath()
		ctx.arc(cx, cy, center, 0, Math.PI * 2)
		ctx.fillStyle = this.running ? "#16a8f0" : "#f7f5ef"
		ctx.fill()

		ctx.fillStyle = "#10131d"
		const icon = center * 0.42
		if (this.running) {
			ctx.fillRect(cx - icon * 0.7, cy - icon * 0.7, icon * 1.4, icon * 1.4)
		} else {
			ctx.beginPath()
			ctx.moveTo(cx - icon * 0.45, cy - icon * 0.8)
			ctx.lineTo(cx + icon * 0.85, cy)
			ctx.lineTo(cx - icon * 0.45, cy + icon * 0.8)
			ctx.closePath()
			ctx.fill()
		}
	}

	private drawPattern() {
		const ctx = this.patternCanvas.getContext?.("2d")
		const { w, h } = this.patternSize
		if (!ctx || !w || !h) {
			return
		}
		const ratio = this.patternCanvas.width / w
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
		ctx.clearRect(0, 0, w, h)

		const pattern = ARPEGGIO_PATTERNS[this.pattern]!
		const notes = this.chordNotes
		const pad = 8
		const innerW = Math.max(10, w - pad * 2)
		const innerH = Math.max(10, h - pad * 2)
		const rows = 9
		const rowH = innerH / rows

		// Subtle beat grid
		ctx.strokeStyle = "rgba(255, 255, 255, 0.08)"
		ctx.lineWidth = 1
		for (let b = 1; b < 4; b++) {
			const x = pad + (b / 4) * innerW
			ctx.beginPath()
			ctx.moveTo(x, pad)
			ctx.lineTo(x, h - pad)
			ctx.stroke()
		}

		pattern.steps.forEach((step, idx) => {
			const x = pad + (step.beat / 4) * innerW
			const barW = Math.max(6, (step.duration / 4) * innerW - 2)
			const isCurrent = this.running && idx === this.stepIndex
			for (const degree of step.degrees) {
				const midi = notes[degree] ?? 60
				const y = pad + (rows - 1 - clamp(degree, 0, rows - 1)) * rowH
				const color = CML_ARPEGGIO_COLORS[CHROMATIC_NOTES[midi % 12]!]
				ctx.fillStyle = isCurrent ? "#ffffff" : color
				ctx.globalAlpha = isCurrent || this.activeNotes.has(midi) ? 1 : 0.72
				ctx.beginPath()
				ctx.roundRect?.(x, y + 1, barW, Math.max(4, rowH - 2), 4)
				if (!ctx.roundRect) {
					ctx.rect(x, y + 1, barW, Math.max(4, rowH - 2))
				}
				ctx.fill()
			}
		})
		ctx.globalAlpha = 1
	}

	private changed() {
		this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
	}
}

if (!customElements.get("chrome-music-lab-arpeggios")) {
	customElements.define("chrome-music-lab-arpeggios", ArpeggiosWheel)
}

declare global {
	interface HTMLElementTagNameMap {
		"chrome-music-lab-arpeggios": ArpeggiosWheel
	}
}