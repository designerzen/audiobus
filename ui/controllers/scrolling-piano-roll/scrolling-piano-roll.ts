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
	CML_GOLD,
	CML_HOST_STYLES,
	clamp,
	midiAddressFromElement,
	noteColorForMidi
} from "../../shared/chrome-music-lab.ts"
import {
	PIANO_ROLL_SCORES,
	PIANO_ROLL_SCORE_IDS,
	type PianoRollScore,
	type PianoRollScoreId,
	type ScoreNote
} from "./scores.ts"

const PIXELS_PER_SECOND = 110
const SCRUB_PREVIEW_MS = 120

let voiceId = 3500000

const STYLES = `${CML_HOST_STYLES}
.stage {
	flex: 1 1 var(--stage-height, 200px);
	margin: 0.4rem 0.5rem 0.5rem;
	border-radius: 8px;
	overflow: hidden;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid color-mix(in oklab, currentColor 16%, transparent);
}
canvas {
	cursor: grab;
}
canvas[data-scrubbing="true"] {
	cursor: grabbing;
}
`

/**
 * Continuous scrolling and scrubbable piano roll input inspired by Chrome Music Lab Piano Roll.
 * Plays or scrubs across five classical scores, emitting NOTE_ON / NOTE_OFF events as bars cross
 * the center trigger line. No internal audio synthesis is created.
 */
export class ScrollingPianoRoll extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"score",
		"speed",
		"disabled",
		"group",
		"channel"
	]

	protected root = this.attachShadow({ mode: "open" })
	private canvas: HTMLCanvasElement
	private status: HTMLElement
	private playBtn: HTMLButtonElement
	private scoreSelect: HTMLSelectElement
	private speedInput: HTMLInputElement
	private listeners?: AbortController
	private observer?: ResizeObserver
	private running = false
	private scrubbing = false
	private wasPlayingBeforeScrub = false
	private scrubPointerId = -1
	private scrubLastX = 0
	private playhead = 0
	private frame = 0
	private lastFrame = 0
	private width = 0
	private height = 0
	private activeScoreNotes = new Map<ScoreNote, NoteDetail>()
	private scrubTimers = new Set<ReturnType<typeof setTimeout>>()
	private scrubHeld = new Map<number, NoteDetail>()
	private externalNotes = new Set<number>()

	constructor() {
		super()
		this.root.innerHTML = `
			<style>${STYLES}</style>
			<div class="toolbar" part="toolbar">
				<button type="button" data-play aria-pressed="false">Play</button>
				<label>Score
					<select data-score>
						${PIANO_ROLL_SCORE_IDS.map((id) => {
							const item = PIANO_ROLL_SCORES[id]
							return `<option value="${id}">${item.title} (${item.composer})</option>`
						}).join("")}
					</select>
				</label>
				<label>Speed <input data-speed type="range" min="0.5" max="2" step="0.1"></label>
			</div>
			<div class="stage" part="stage">
				<canvas part="canvas" tabindex="0" role="application" aria-label="Scrolling piano roll. Press Space to play or pause, drag left or right to scrub."></canvas>
			</div>
			<p class="sr-only" role="status" aria-atomic="true"></p>`
		this.canvas = this.root.querySelector("canvas")!
		this.status = this.root.querySelector('[role="status"]')!
		this.playBtn = this.root.querySelector("[data-play]")!
		this.scoreSelect = this.root.querySelector("[data-score]")!
		this.speedInput = this.root.querySelector("[data-speed]")!
	}

	get scoreId(): PianoRollScoreId {
		const raw = this.getAttribute("score")?.trim() ?? "preludeInC"
		return (PIANO_ROLL_SCORE_IDS as readonly string[]).includes(raw)
			? (raw as PianoRollScoreId)
			: "preludeInC"
	}
	set scoreId(value: PianoRollScoreId) {
		this.setAttribute("score", value)
	}

	get currentScore(): PianoRollScore {
		return PIANO_ROLL_SCORES[this.scoreId]
	}

	get speed(): number {
		const raw = this.getAttribute("speed")
		const parsed = raw === null || !raw.trim() ? 1 : Number(raw)
		return Number.isFinite(parsed) ? clamp(parsed, 0.5, 2) : 1
	}
	set speed(value: number) {
		this.setAttribute("speed", String(clamp(value, 0.5, 2)))
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

	get position(): number {
		return this.playhead
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
		this.scoreSelect.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
				this.scoreId = this.scoreSelect.value as PianoRollScoreId
				this.changed()
			},
			options
		)
		this.speedInput.addEventListener(
			EVENT_INPUT,
			(event) => {
				event.stopPropagation()
				this.speed = Number(this.speedInput.value)
			},
			options
		)
		this.speedInput.addEventListener(
			EVENT_CHANGE,
			(event) => {
				event.stopPropagation()
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
			this.canvas.addEventListener(
				type,
				(event) => this.pointerUp(event as PointerEvent),
				options
			)
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
		cancelAnimationFrame(this.frame)
		this.frame = 0
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		if (previous === next) {
			return
		}
		if (name === "score") {
			this.releaseActiveNotes()
			this.playhead = 0
		} else if (name === "disabled" && this.disabled) {
			this.stop()
		}
		this.update()
		super.attributeChangedCallback(name, previous, next)
	}

	play(): void {
		if (this.disabled || this.running || !this.isConnected) {
			return
		}
		this.running = true
		this.lastFrame = performance.now()
		this.syncPlayheadNotes(this.playhead, false)
		this.update()
		this.status.textContent = `Playing ${this.currentScore.title}`
		this.scheduleFrame()
	}

	stop(): void {
		cancelAnimationFrame(this.frame)
		this.frame = 0
		this.running = false
		this.scrubbing = false
		this.canvas.dataset.scrubbing = "false"
		this.releaseActiveNotes()
		this.clearScrubPreviews()
		this.update()
	}

	/** Move playhead to seconds; when scrubPreview is true, auditions newly crossed notes briefly. */
	seek(seconds: number, scrubPreview = false): void {
		const duration = Math.max(0.1, this.currentScore.duration)
		const wrapped = ((seconds % duration) + duration) % duration
		const previous = this.playhead
		this.playhead = wrapped
		if (scrubPreview && this.isConnected && !this.disabled) {
			this.auditionCrossed(previous, wrapped)
		} else if (this.running) {
			this.syncPlayheadNotes(wrapped, false)
		}
		this.draw()
	}

	setActiveNote(note: InstrumentNote | number, active = true): void {
		const number = instrumentNote(note).noteNumber
		if (active) {
			this.externalNotes.add(number)
		} else {
			this.externalNotes.delete(number)
		}
		this.draw()
	}

	setActiveNotes(notes: Iterable<InstrumentNote | number>): void {
		this.externalNotes = new Set([...notes].map((note) => instrumentNote(note).noteNumber))
		this.draw()
	}

	clearActiveNotes(): void {
		this.externalNotes.clear()
		this.draw()
	}

	private scheduleFrame() {
		if (this.frame || !this.running || typeof requestAnimationFrame === "undefined") {
			return
		}
		this.frame = requestAnimationFrame(this.onFrame)
	}

	private onFrame = (now: number) => {
		this.frame = 0
		if (!this.running || !this.isConnected) {
			return
		}
		const dt = clamp((now - this.lastFrame) / 1000, 0, 0.1) * this.speed
		this.lastFrame = now
		const duration = Math.max(0.1, this.currentScore.duration)
		const next = this.playhead + dt
		if (next >= duration) {
			this.releaseActiveNotes()
			this.playhead = next % duration
		} else {
			this.playhead = next
		}
		this.syncPlayheadNotes(this.playhead, false)
		this.draw()
		this.scheduleFrame()
	}

	private syncPlayheadNotes(time: number, scrub: boolean) {
		const score = this.currentScore
		const address = midiAddressFromElement(this)
		// Release notes no longer intersecting the trigger line
		for (const [note, detail] of this.activeScoreNotes) {
			if (time < note.time || time >= note.time + note.duration) {
				this.activeScoreNotes.delete(note)
				dispatchInstrumentEvent(
					this,
					NOTE_OFF,
					noteDetail(NOTE_OFF, detail.note, 0, detail.id, detail)
				)
			}
		}
		if (scrub) {
			return
		}
		// Trigger notes intersecting the trigger line
		for (const note of score.notes) {
			if (
				time >= note.time &&
				time < note.time + note.duration &&
				!this.activeScoreNotes.has(note)
			) {
				const detail = noteDetail(NOTE_ON, note.midi, note.velocity, voiceId++, address)
				this.activeScoreNotes.set(note, detail)
				dispatchInstrumentEvent(this, NOTE_ON, detail)
			}
		}
	}

	private auditionCrossed(fromTime: number, toTime: number) {
		const lo = Math.min(fromTime, toTime)
		const hi = Math.max(fromTime, toTime)
		const address = midiAddressFromElement(this)
		for (const note of this.currentScore.notes) {
			const noteEnd = note.time + note.duration
			const entered =
				(note.time >= lo && note.time <= hi) ||
				(toTime < fromTime && noteEnd >= lo && noteEnd <= hi)
			if (!entered) {
				continue
			}
			const id = voiceId++
			const detail = noteDetail(
				NOTE_ON,
				note.midi,
				clamp(note.velocity * 0.6, 0.2, 1),
				id,
				address
			)
			this.scrubHeld.set(id, detail)
			dispatchInstrumentEvent(this, NOTE_ON, detail)
			const timer = setTimeout(() => {
				this.scrubTimers.delete(timer)
				const live = this.scrubHeld.get(id)
				if (!live) {
					return
				}
				this.scrubHeld.delete(id)
				dispatchInstrumentEvent(
					this,
					NOTE_OFF,
					noteDetail(NOTE_OFF, live.note, 0, live.id, live)
				)
			}, SCRUB_PREVIEW_MS)
			this.scrubTimers.add(timer)
		}
	}

	private releaseActiveNotes() {
		for (const [note, detail] of this.activeScoreNotes) {
			this.activeScoreNotes.delete(note)
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, detail.note, 0, detail.id, detail)
			)
		}
	}

	private clearScrubPreviews() {
		for (const timer of this.scrubTimers) {
			clearTimeout(timer)
		}
		this.scrubTimers.clear()
		for (const [id, detail] of this.scrubHeld) {
			this.scrubHeld.delete(id)
			dispatchInstrumentEvent(
				this,
				NOTE_OFF,
				noteDetail(NOTE_OFF, detail.note, 0, detail.id, detail)
			)
		}
	}

	private pointerDown(event: PointerEvent) {
		if (this.disabled || (event.pointerType === "mouse" && event.button !== 0)) {
			return
		}
		event.preventDefault()
		this.canvas.setPointerCapture?.(event.pointerId)
		this.scrubbing = true
		this.scrubPointerId = event.pointerId
		this.scrubLastX = event.clientX
		this.wasPlayingBeforeScrub = this.running
		if (this.running) {
			cancelAnimationFrame(this.frame)
			this.frame = 0
			this.running = false
		}
		this.releaseActiveNotes()
		this.canvas.dataset.scrubbing = "true"
		this.draw()
	}

	private pointerMove(event: PointerEvent) {
		if (!this.scrubbing || event.pointerId !== this.scrubPointerId) {
			return
		}
		const dx = event.clientX - this.scrubLastX
		this.scrubLastX = event.clientX
		// Dragging left moves forward in time, like dragging a paper roll past the center line.
		const deltaSeconds = -dx / PIXELS_PER_SECOND
		if (Math.abs(deltaSeconds) > 1e-4) {
			this.seek(this.playhead + deltaSeconds, true)
		}
	}

	private pointerUp(event: PointerEvent) {
		if (!this.scrubbing || event.pointerId !== this.scrubPointerId) {
			return
		}
		this.scrubbing = false
		this.scrubPointerId = -1
		this.canvas.dataset.scrubbing = "false"
		if (this.wasPlayingBeforeScrub && !this.disabled) {
			this.play()
		} else {
			this.draw()
		}
	}

	private keyDown(event: KeyboardEvent) {
		if (this.disabled) {
			return
		}
		if (event.key === " " || event.key === "Enter") {
			event.preventDefault()
			if (this.running) {
				this.stop()
			} else {
				this.play()
			}
		} else if (event.key === "ArrowRight") {
			event.preventDefault()
			this.seek(this.playhead + 0.25, true)
		} else if (event.key === "ArrowLeft") {
			event.preventDefault()
			this.seek(this.playhead - 0.25, true)
		} else if (event.key === "Home") {
			event.preventDefault()
			this.seek(0, false)
		} else if (event.key === "Escape") {
			event.preventDefault()
			this.stop()
		}
	}

	private update() {
		this.playBtn.textContent = this.running ? "Pause" : "Play"
		this.playBtn.setAttribute("aria-pressed", String(this.running))
		this.scoreSelect.value = this.scoreId
		this.speedInput.value = String(this.speed)
		for (const control of [this.playBtn, this.scoreSelect, this.speedInput]) {
			control.disabled = this.disabled
		}
		this.draw()
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
		this.toggleAttribute("data-compact", this.clientHeight > 0 && this.clientHeight < 145)
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

		const score = this.currentScore
		let minMidi = 127
		let maxMidi = 0
		for (const note of score.notes) {
			if (note.midi < minMidi) {
				minMidi = note.midi
			}
			if (note.midi > maxMidi) {
				maxMidi = note.midi
			}
		}
		minMidi = Math.max(0, minMidi - 2)
		maxMidi = Math.min(127, maxMidi + 2)
		const pitchRange = Math.max(1, maxMidi - minMidi)
		const padY = 12
		const usableH = Math.max(20, this.height - padY * 2)
		const barH = clamp(usableH / pitchRange, 4, 14)
		const centerX = this.width / 2

		// Draw notes relative to center trigger line
		for (const note of score.notes) {
			const x = centerX + (note.time - this.playhead) * PIXELS_PER_SECOND
			const w = Math.max(4, note.duration * PIXELS_PER_SECOND - 1)
			if (x + w < -20 || x > this.width + 20) {
				continue
			}
			const normPitch = (note.midi - minMidi) / pitchRange
			const y = padY + (1 - normPitch) * (usableH - barH)
			const active =
				this.activeScoreNotes.has(note) ||
				(this.playhead >= note.time && this.playhead < note.time + note.duration) ||
				this.externalNotes.has(note.midi)
			ctx.fillStyle = active ? CML_GOLD : noteColorForMidi(note.midi)
			ctx.globalAlpha = active ? 1 : 0.78
			ctx.beginPath()
			ctx.roundRect?.(x, y, w, barH, 3)
			if (!ctx.roundRect) {
				ctx.rect(x, y, w, barH)
			}
			ctx.fill()
		}
		ctx.globalAlpha = 1

		// Center trigger line
		ctx.strokeStyle = this.scrubbing ? CML_GOLD : CML_BLUE
		ctx.lineWidth = 2.5
		ctx.beginPath()
		ctx.moveTo(centerX, 0)
		ctx.lineTo(centerX, this.height)
		ctx.stroke()
	}

	private changed() {
		this.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true, composed: true }))
	}
}

if (!customElements.get("chrome-music-lab-piano-roll")) {
	customElements.define("chrome-music-lab-piano-roll", ScrollingPianoRoll)
}

declare global {
	interface HTMLElementTagNameMap {
		"chrome-music-lab-piano-roll": ScrollingPianoRoll
	}
}