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
	EVENT_SEQUENCE_CHANGE,
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
	CML_BLUE,
	CML_HOST_STYLES,
	CML_MELODY_COLORS,
	clamp,
	midiAddressFromElement,
	noteColorForMidi
} from "../../shared/chrome-music-lab.ts"

export type HarmonyDirection = "none" | "right" | "left" | "up" | "down"

export const MELODY_MAKER_COLS = 8
export const MELODY_MAKER_ROWS = 14
/** Two octaves of a Major diatonic scale, matching Chrome Music Lab Melody Maker. */
const MAJOR_DIATONIC_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23] as const
const HARMONY_ORDER: readonly HarmonyDirection[] = ["none", "right", "up", "down", "left"]
const DEFAULT_ROOT = 48 // C3

let voiceId = 3400000

const STYLES = `${CML_HOST_STYLES}
.stage {
	flex: 1 1 var(--stage-height, 220px);
	margin: 0.45rem;
	border-radius: 8px;
	overflow: hidden;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid color-mix(in oklab, currentColor 18%, transparent);
}
canvas {
	cursor: pointer;
}
`

export function parseMelodyPattern(value: string | null): (number | null)[] {
	const result: (number | null)[] = Array.from({ length: MELODY_MAKER_COLS }, () => null)
	if (!value?.trim()) {
		return result
	}
	const parts = value.split(",")
	for (let i = 0; i < Math.min(MELODY_MAKER_COLS, parts.length); i++) {
		const n = Number(parts[i])
		if (Number.isInteger(n) && n >= 0 && n < MELODY_MAKER_ROWS) {
			result[i] = n
		}
	}
	return result
}

export function serializeMelodyPattern(rows: readonly (number | null)[]): string {
	return rows.map((row) => (row === null ? -1 : row)).join(",")
}

/**
 * 8x14 diatonic grid sequencer with ghost harmony shadows inspired by Chrome Music Lab Melody Maker.
 * Event-only controller: emits MIDI 2.0 NOTE_ON / NOTE_OFF messages without creating audio nodes.
 */
export class MelodyMaker extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"pattern",
		"harmony",
		"bpm",
		"root",
		"disabled",
		"group",
		"channel"
	]

	protected root = this.attachShadow({ mode: "open" })
	private canvas: HTMLCanvasElement
	private status: HTMLElement
	private playBtn: HTMLButtonElement
	private harmonyBtn: HTMLButtonElement
	private clearBtn: HTMLButtonElement
	private bpmInput: HTMLInputElement
	private rootInput: HTMLInputElement
	/** Stored as 0 = bottom (lowest pitch) .. 13 = top (highest pitch), or null. */
	private columns: (number | null)[] = Array.from({ length: MELODY_MAKER_COLS }, () => null)
	private running = false
	private currentCol = -1
	private stepTimer?: ReturnType<typeof setTimeout>
	private releaseTimers = new Set<ReturnType<typeof setTimeout>>()
	private held = new Map<number, NoteDetail>()
	private activeNotes = new Set<number>()
	private dragging = false
	private dragAction: "set" | "clear" = "set"
	private lastDragCell = ""
	private cursor = { col: 0, row: 0 }
	private listeners?: AbortController
	private observer?: ResizeObserver
	private width = 0
	private height = 0

	constructor() {
		super()
		this.root.innerHTML = `
			<style>${STYLES}</style>
			<div class="toolbar" part="toolbar">
				<button type="button" data-play aria-pressed="false">Play</button>
				<button type="button" data-harmony aria-pressed="false">Harmony: Off</button>
				<label>Tempo <input data-bpm type="number" min="50" max="220" step="1"> BPM</label>
				<label>Root <input data-root type="number" min="24" max="72" step="1"></label>
				<button type="button" data-clear>Clear</button>
			</div>
			<div class="stage" part="stage">
				<canvas part="canvas" tabindex="0" role="application" aria-label="Melody Maker 8 by 14 grid"></canvas>
			</div>
			<p class="sr-only" role="status" aria-atomic="true"></p>`
		this.canvas = this.root.querySelector("canvas")!
		this.status = this.root.querySelector('[role="status"]')!
		this.playBtn = this.root.querySelector("[data-play]")!
		this.harmonyBtn = this.root.querySelector("[data-harmony]")!
		this.clearBtn = this.root.querySelector("[data-clear]")!
		this.bpmInput = this.root.querySelector("[data-bpm]")!
		this.rootInput = this.root.querySelector("[data-root]")!
	}

	get bpm(): number {
		const raw = this.getAttribute("bpm")
		const parsed = raw === null || !raw.trim() ? 120 : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 50, 220)) : 120
	}
	set bpm(value: number) {
		this.setAttribute("bpm", String(Math.round(clamp(value, 50, 220))))
	}

	get rootNote(): number {
		const raw = this.getAttribute("root")
		const parsed = raw === null || !raw.trim() ? DEFAULT_ROOT : Number(raw)
		return Number.isFinite(parsed) ? Math.round(clamp(parsed, 24, 72)) : DEFAULT_ROOT
	}
	set rootNote(value: number) {
		this.setAttribute("root", String(Math.round(clamp(value, 24, 72))))
	}

	get harmony(): HarmonyDirection {
		const raw = this.getAttribute("harmony")?.toLowerCase() ?? "none"
		return (HARMONY_ORDER as readonly string[]).includes(raw)
			? (raw as HarmonyDirection)
			: "none"
	}
	set harmony(value: HarmonyDirection) {
		this.setAttribute("harmony", value)
	}

	get pattern(): (number | null)[] {
		return [...this.columns]
	}
	set pattern(value: readonly (number | null)[]) {
		this.columns = Array.from({ length: MELODY_MAKER_COLS }, (_, i) => {
			const row = value[i]
			return typeof row === "number" &&
				Number.isInteger(row) &&
				row >= 0 &&
				row < MELODY_MAKER_ROWS
				? row
				: null
		})
		this.setAttribute("pattern", serializeMelodyPattern(this.columns))
		this.draw()
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

	/** MIDI pitch for a 0-based row (0 = bottom/lowest, 13 = top/highest). */
	pitchForRow(row: number): number {
		const index = clamp(Math.round(row), 0, MELODY_MAKER_ROWS - 1)
		return clamp(this.rootNote + MAJOR_DIATONIC_OFFSETS[index]!, 0, 127)
	}

	/** Notes sounding in column `col` (melody + optional ghost harmony shadow). */
	notesAtColumn(col: number): number[] {
		const index = ((col % MELODY_MAKER_COLS) + MELODY_MAKER_COLS) % MELODY_MAKER_COLS
		const result: number[] = []
		const melodyRow = this.columns[index]
		if (melodyRow !== null) {
			result.push(this.pitchForRow(melodyRow))
		}
		const dir = this.harmony
		if (dir !== "none") {
			const dx = dir === "right" ? 2 : dir === "left" ? -2 : 0
			const dy = dir === "up" ? 2 : dir === "down" ? -2 : 0
			const sourceCol = (index - dx + MELODY_MAKER_COLS) % MELODY_MAKER_COLS
			const sourceRow = this.columns[sourceCol]
			if (sourceRow !== null) {
				const ghostRow = (sourceRow + dy + MELODY_MAKER_ROWS) % MELODY_MAKER_ROWS
				const ghostMidi = this.pitchForRow(ghostRow)
				if (!result.includes(ghostMidi)) {
					result.push(ghostMidi)
				}
			}
		}
		return result
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
		this.harmonyBtn.addEventListener(
			EVENT_CLICK,
			() => {
				const next =
					HARMONY_ORDER[(HARMONY_ORDER.indexOf(this.harmony) + 1) % HARMONY_ORDER.length]!
				this.harmony = next
				this.changed()
			},
			options
		)
		this.clearBtn.addEventListener(
			EVENT_CLICK,
			() => {
				this.clear()
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

		this.canvas.addEventListener(
			EVENT_POINTER_DOWN,
			(event) => this.pointerDown(event),
			options
		)
		this.canvas.addEventListener(
			EVENT_POINTER_MOVE,
			(event) => this.pointerMove(event),
			options
		)
		for (const type of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
			this.canvas.addEventListener(type, () => this.pointerUp(), options)
		}
		this.canvas.addEventListener(EVENT_KEY_DOWN, (event) => this.keyDown(event), options)
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
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		if (previous === next) {
			return
		}
		if (name === "pattern") {
			this.columns = parseMelodyPattern(next)
		} else if (name === "disabled" && this.disabled) {
			this.stop()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	/** Toggle a cell at (col: 0..7, row: 0..13 where 0 is bottom/lowest pitch). */
	toggleCell(col: number, row: number, preview = true): void {
		if (
			this.disabled ||
			col < 0 ||
			col >= MELODY_MAKER_COLS ||
			row < 0 ||
			row >= MELODY_MAKER_ROWS
		) {
			return
		}
		const removed = this.columns[col] === row
		this.columns[col] = removed ? null : row
		this.commitPattern()
		if (!removed && preview && this.isConnected) {
			this.emitTimedNote(this.pitchForRow(row), 180, 0.8)
		}
		this.status.textContent = removed
			? `Cleared step ${col + 1}`
			: `Step ${col + 1}: ${instrumentNote(this.pitchForRow(row)).noteName}`
	}

	clear(): void {
		this.columns = Array.from({ length: MELODY_MAKER_COLS }, () => null)
		this.commitPattern()
		this.status.textContent = "Pattern cleared"
	}

	play(): void {
		if (this.disabled || this.running || !this.isConnected) {
			return
		}
		this.clearReleaseTimers()
		this.releaseHeld()
		this.running = true
		this.currentCol = -1
		this.update()
		this.status.textContent = "Playing"
		this.tick()
	}

	stop(): void {
		clearTimeout(this.stepTimer)
		this.stepTimer = undefined
		this.clearReleaseTimers()
		this.running = false
		this.currentCol = -1
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

	private commitPattern() {
		this.setAttribute("pattern", serializeMelodyPattern(this.columns))
		this.draw()
		this.dispatchEvent(
			new CustomEvent(EVENT_SEQUENCE_CHANGE, {
				detail: { pattern: this.pattern },
				bubbles: true,
				composed: true
			})
		)
	}

	private tick() {
		if (!this.running || !this.isConnected) {
			return
		}
		this.currentCol = (this.currentCol + 1) % MELODY_MAKER_COLS
		const stepMs = 60000 / this.bpm / 2 // Eighth notes, matching Chrome Music Lab Melody Maker
		const notes = this.notesAtColumn(this.currentCol)
		notes.forEach((midi, idx) => {
			this.emitTimedNote(midi, Math.max(40, stepMs * 0.85), idx === 0 ? 0.88 : 0.62)
		})
		this.dispatchEvent(
			new CustomEvent(EVENT_STEP_CHANGE, {
				detail: { step: this.currentCol },
				bubbles: true,
				composed: true
			})
		)
		this.draw()
		this.stepTimer = setTimeout(() => this.tick(), stepMs)
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

	private cellFromPointer(event: PointerEvent): { col: number; row: number } {
		const box = this.canvas.getBoundingClientRect()
		this.resize(box.width, box.height)
		const col = clamp(
			Math.floor(((event.clientX - box.left) / Math.max(1, box.width)) * MELODY_MAKER_COLS),
			0,
			MELODY_MAKER_COLS - 1
		)
		const topRow = clamp(
			Math.floor(((event.clientY - box.top) / Math.max(1, box.height)) * MELODY_MAKER_ROWS),
			0,
			MELODY_MAKER_ROWS - 1
		)
		return { col, row: MELODY_MAKER_ROWS - 1 - topRow }
	}

	private pointerDown(event: PointerEvent) {
		if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) {
			return
		}
		event.preventDefault()
		this.canvas.setPointerCapture?.(event.pointerId)
		const { col, row } = this.cellFromPointer(event)
		this.dragging = true
		this.dragAction = this.columns[col] === row ? "clear" : "set"
		this.lastDragCell = `${col}:${row}`
		this.cursor = { col, row }
		this.toggleCell(col, row)
	}

	private pointerMove(event: PointerEvent) {
		if (!this.dragging || this.disabled) {
			return
		}
		const { col, row } = this.cellFromPointer(event)
		const key = `${col}:${row}`
		if (key === this.lastDragCell) {
			return
		}
		this.lastDragCell = key
		this.cursor = { col, row }
		if (this.dragAction === "clear") {
			if (this.columns[col] === row) {
				this.columns[col] = null
				this.commitPattern()
			}
		} else if (this.columns[col] !== row) {
			this.columns[col] = row
			this.commitPattern()
			this.emitTimedNote(this.pitchForRow(row), 160, 0.78)
		}
	}

	private pointerUp() {
		this.dragging = false
		this.lastDragCell = ""
	}

	private keyDown(event: KeyboardEvent) {
		if (this.disabled) {
			return
		}
		if (event.key === "ArrowRight") {
			event.preventDefault()
			this.cursor.col = (this.cursor.col + 1) % MELODY_MAKER_COLS
			this.draw()
		} else if (event.key === "ArrowLeft") {
			event.preventDefault()
			this.cursor.col = (this.cursor.col + MELODY_MAKER_COLS - 1) % MELODY_MAKER_COLS
			this.draw()
		} else if (event.key === "ArrowUp") {
			event.preventDefault()
			this.cursor.row = Math.min(MELODY_MAKER_ROWS - 1, this.cursor.row + 1)
			this.draw()
		} else if (event.key === "ArrowDown") {
			event.preventDefault()
			this.cursor.row = Math.max(0, this.cursor.row - 1)
			this.draw()
		} else if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			this.toggleCell(this.cursor.col, this.cursor.row)
		} else if (event.key === "Escape") {
			event.preventDefault()
			this.stop()
		}
	}

	private update() {
		this.playBtn.textContent = this.running ? "Stop" : "Play"
		this.playBtn.setAttribute("aria-pressed", String(this.running))
		const dir = this.harmony
		this.harmonyBtn.textContent =
			dir === "none" ? "Harmony: Off" : `Harmony: ${dir[0]!.toUpperCase()}${dir.slice(1)}`
		this.harmonyBtn.setAttribute("aria-pressed", String(dir !== "none"))
		this.bpmInput.value = String(this.bpm)
		this.rootInput.value = String(this.rootNote)
		for (const control of [
			this.playBtn,
			this.harmonyBtn,
			this.clearBtn,
			this.bpmInput,
			this.rootInput
		]) {
			control.disabled = this.disabled
		}
		this.draw()
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

	private draw() {
		const ctx = this.canvas.getContext?.("2d")
		if (!ctx || !this.width || !this.height) {
			return
		}
		const ratio = this.canvas.width / this.width
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
		ctx.clearRect(0, 0, this.width, this.height)

		const cellW = this.width / MELODY_MAKER_COLS
		const cellH = this.height / MELODY_MAKER_ROWS
		const margin = Math.min(2.5, Math.min(cellW, cellH) * 0.12)

		// Active playhead column highlight
		if (this.currentCol >= 0) {
			ctx.fillStyle = "rgba(22, 168, 240, 0.16)"
			ctx.fillRect(this.currentCol * cellW, 0, cellW, this.height)
		}

		// Grid lines
		ctx.strokeStyle = "rgba(22, 168, 240, 0.28)"
		ctx.lineWidth = 1
		for (let c = 1; c < MELODY_MAKER_COLS; c++) {
			ctx.beginPath()
			ctx.moveTo(c * cellW, 0)
			ctx.lineTo(c * cellW, this.height)
			ctx.stroke()
		}
		for (let r = 1; r < MELODY_MAKER_ROWS; r++) {
			ctx.beginPath()
			ctx.moveTo(0, r * cellH)
			ctx.lineTo(this.width, r * cellH)
			ctx.stroke()
		}

		// Ghost harmony shadows
		const dir = this.harmony
		if (dir !== "none") {
			const dx = dir === "right" ? 2 : dir === "left" ? -2 : 0
			const dy = dir === "up" ? 2 : dir === "down" ? -2 : 0
			for (let c = 0; c < MELODY_MAKER_COLS; c++) {
				const row = this.columns[c]
				if (row === null) {
					continue
				}
				const gc = (c + dx + MELODY_MAKER_COLS) % MELODY_MAKER_COLS
				const gr = (row + dy + MELODY_MAKER_ROWS) % MELODY_MAKER_ROWS
				const drawRow = MELODY_MAKER_ROWS - 1 - gr
				ctx.fillStyle =
					gc === this.currentCol
						? "rgba(226, 232, 240, 0.6)"
						: "rgba(180, 192, 210, 0.35)"
				ctx.fillRect(
					gc * cellW + margin,
					drawRow * cellH + margin,
					Math.max(2, cellW - margin * 2),
					Math.max(2, cellH - margin * 2)
				)
			}
		}

		// Melody tiles
		for (let c = 0; c < MELODY_MAKER_COLS; c++) {
			const row = this.columns[c]
			if (row === null) {
				continue
			}
			const drawRow = MELODY_MAKER_ROWS - 1 - row
			const midi = this.pitchForRow(row)
			const active = c === this.currentCol || this.activeNotes.has(midi)
			ctx.fillStyle = noteColorForMidi(midi, CML_MELODY_COLORS)
			ctx.globalAlpha = active ? 1 : 0.85
			ctx.fillRect(
				c * cellW + margin,
				drawRow * cellH + margin,
				Math.max(2, cellW - margin * 2),
				Math.max(2, cellH - margin * 2)
			)
			if (active) {
				ctx.strokeStyle = "#ffffff"
				ctx.lineWidth = 2
				ctx.strokeRect(
					c * cellW + margin,
					drawRow * cellH + margin,
					Math.max(2, cellW - margin * 2),
					Math.max(2, cellH - margin * 2)
				)
			}
		}
		ctx.globalAlpha = 1

		// Keyboard focus indicator when canvas is focused
		if (this.root.activeElement === this.canvas) {
			const drawRow = MELODY_MAKER_ROWS - 1 - this.cursor.row
			ctx.strokeStyle = CML_BLUE
			ctx.lineWidth = 2
			ctx.strokeRect(
				this.cursor.col * cellW + 1,
				drawRow * cellH + 1,
				Math.max(2, cellW - 2),
				Math.max(2, cellH - 2)
			)
		}
	}

	private changed() {
		this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
	}
}

if (!customElements.get("chrome-music-lab-melody-maker")) {
	customElements.define("chrome-music-lab-melody-maker", MelodyMaker)
}

declare global {
	interface HTMLElementTagNameMap {
		"chrome-music-lab-melody-maker": MelodyMaker
	}
}