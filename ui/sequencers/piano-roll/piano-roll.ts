import { EVENT_SEQUENCE_CHANGE, EVENT_STEP_CHANGE } from "../../../event-constants.ts"
import { NOTE_OFF, NOTE_ON } from "../../../commands.ts"
import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_INSTRUMENT_DISCONNECT,
	EVENT_KEY_DOWN,
	EVENT_PAGE_HIDE,
	EVENT_VISIBILITY_CHANGE
} from "../../../event-constants.ts"
import {
	dispatchInstrumentEvent,
	instrumentNote,
	noteDetail,
	range,
	type NoteDetail
} from "../../interfaces/instrument.ts"
import { PatchController } from "../../shared/patch-controller.ts"

export interface PianoRollNote {
	/** MIDI pitch, 0–127. */
	midi: number
	/** Zero-based grid step. */
	start: number
	/** Length in grid steps. */
	duration: number
	/** Normalized velocity, greater than 0 and at most 1. */
	velocity: number
}

// Adapted from TrackAble's grid/math.js and pianoRoll/notes/utils.js:
// four quarter-note beats per bar, subdivisions per beat, highest pitch first.
function position(step: number, division: number) {
	return `Bar ${Math.floor(step / (4 * division)) + 1}, beat ${(Math.floor(step / division) % 4) + 1}, tick ${(step % division) + 1}`
}
let voiceId = 0

/** A single-track, event-only accessible piano roll. No audio engine is created. */
export class PianoRollElement extends PatchController {
	static observedAttributes = [
		...PatchController.observedAttributes,
		"label",
		"min",
		"max",
		"steps",
		"division",
		"bpm",
		"loop",
		"disabled",
		"muted",
		"group",
		"channel"
	]
	private root = this.attachShadow({ mode: "open" })
	private sequence: PianoRollNote[] = []
	private cursor = { midi: 60, step: 0 }
	private listeners?: AbortController
	private timer?: ReturnType<typeof setTimeout>
	private voices = new Map<PianoRollNote, NoteDetail>()
	private nextStep = 0
	private deadline = 0
	private running = false

	private number(name: string, fallback: number, min: number, max: number) {
		const raw = this.getAttribute(name)
		const value = raw === null || !raw.trim() ? fallback : Number(raw)
		return Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback
	}
	get min() {
		return this.number("min", 60, 0, 127)
	}
	get max() {
		return Math.max(this.min, this.number("max", 72, 0, 127))
	}
	get steps() {
		return this.number("steps", 16, 1, 128)
	}
	get division() {
		return this.number("division", 4, 1, 16)
	}
	get bpm() {
		return this.number("bpm", 120, 20, 300)
	}
	set bpm(value: number) {
		this.setAttribute("bpm", String(range(value, 20, 300, "bpm", true)))
	}
	get loop() {
		return this.hasAttribute("loop")
	}
	set loop(value: boolean) {
		this.toggleAttribute("loop", value)
	}
	get disabled() {
		return this.hasAttribute("disabled")
	}
	set disabled(value: boolean) {
		this.toggleAttribute("disabled", value)
	}
	get muted() {
		return this.hasAttribute("muted")
	}
	set muted(value: boolean) {
		this.toggleAttribute("muted", value)
	}
	get playing() {
		return this.running
	}
	get currentStep() {
		return this.running ? this.nextStep - 1 : -1
	}
	get notes(): PianoRollNote[] {
		return this.sequence.map((note) => ({ ...note }))
	}
	set notes(value: PianoRollNote[]) {
		const next = value.map((note) => ({ ...note }))
		for (const note of next) {
			range(note.midi, this.min, this.max, "midi", true)
			range(note.start, 0, this.steps - 1, "start", true)
			range(note.duration, 1, this.steps - note.start, "duration", true)
			range(note.velocity, Number.MIN_VALUE, 1, "velocity")
			if (this.collides(note, next)) {
				throw new RangeError("Notes of the same pitch must not overlap")
			}
		}
		this.stop()
		this.sequence = next.sort((a, b) => a.start - b.start || b.midi - a.midi)
		this.refresh()
	}

	connectedCallback() {
		super.connectedCallback()
		if (!this.root.childElementCount) {
			this.render()
		}
		this.listeners?.abort()
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }
		this.root.addEventListener(
			EVENT_CLICK,
			(event) => {
				const target = (event.target as Element).closest<HTMLButtonElement>("button")
				if (!target || this.disabled) {
					return
				}
				if (target.dataset.step !== undefined) {
					this.focusCell(Number(target.dataset.midi), Number(target.dataset.step))
					if (!(event as MouseEvent).detail || !this.selected()) {
						this.toggleNote()
					}
				} else if (target.id === "play") {
					if (this.playing) {
						this.stop()
					} else {
						this.play()
					}
				} else if (target.id === "clear") {
					this.commit([], "Sequence cleared")
				} else if (target.id === "remove" && this.selected()) {
					this.toggleNote()
				}
			},
			options
		)
		this.root.addEventListener(
			EVENT_KEY_DOWN,
			(event) => this.keydown(event as KeyboardEvent),
			options
		)
		this.root.addEventListener(
			"focusin",
			(event) => {
				const cell = (event.target as HTMLElement).closest<HTMLButtonElement>(
					"button[data-step]"
				)
				if (cell) {
					this.focusCell(Number(cell.dataset.midi), Number(cell.dataset.step), false)
				}
			},
			options
		)
		this.root.addEventListener(
			EVENT_CHANGE,
			(event) => {
				const input = event.target as HTMLInputElement
				if (this.disabled) {
					return
				}
				if (input.id === "bpm") {
					if (input.checkValidity()) {
						this.bpm = Number(input.value)
					} else {
						input.value = String(this.bpm)
					}
				}
				if (input.id === "loop") {
					this.loop = input.checked
				}
				if (input.id === "duration" || input.id === "velocity") {
					const note = this.selected()
					if (!input.checkValidity()) {
						this.syncControls()
						return
					}
					if (note) {
						this.editNote({
							...note,
							[input.id]: Number(input.value) / (input.id === "velocity" ? 100 : 1)
						})
					}
				}
			},
			options
		)
		window.addEventListener(EVENT_PAGE_HIDE, () => this.stop(), options)
		document.addEventListener(
			EVENT_VISIBILITY_CHANGE,
			() => {
				if (document.hidden) {
					this.stop()
				}
			},
			options
		)
		this.refresh()
	}
	disconnectedCallback() {
		this.stop()
		this.listeners?.abort()
		dispatchInstrumentEvent(this, EVENT_INSTRUMENT_DISCONNECT, {})
	}
	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		this.stop()
		super.attributeChangedCallback(name, previous, next)
		if (["min", "max", "steps"].includes(name)) {
			const next = this.sequence
				.filter(
					(note) =>
						note.midi >= this.min && note.midi <= this.max && note.start < this.steps
				)
				.map((note) => ({
					...note,
					duration: Math.min(note.duration, this.steps - note.start)
				}))
			if (JSON.stringify(next) !== JSON.stringify(this.sequence)) {
				this.sequence = next
				this.changed()
			}
		}
		this.refresh()
	}

	private selected() {
		return this.sequence.find(
			(note) =>
				note.midi === this.cursor.midi &&
				note.start <= this.cursor.step &&
				note.start + note.duration > this.cursor.step
		)
	}
	private collides(note: PianoRollNote, notes = this.sequence, except?: PianoRollNote) {
		return notes.some(
			(other) =>
				other !== note &&
				other !== except &&
				other.midi === note.midi &&
				other.start < note.start + note.duration &&
				note.start < other.start + other.duration
		)
	}
	private changed() {
		this.dispatchEvent(
			new CustomEvent(EVENT_SEQUENCE_CHANGE, {
				detail: { notes: this.notes },
				bubbles: true,
				composed: true
			})
		)
	}
	private commit(notes: PianoRollNote[], message: string) {
		this.stop()
		this.sequence = notes
		this.refresh()
		this.changed()
		this.announce(message)
	}
	private toggleNote() {
		const selected = this.selected()
		if (selected) {
			this.commit(
				this.sequence.filter((note) => note !== selected),
				"Note removed"
			)
		} else {
			this.commit(
				[
					...this.sequence,
					{ midi: this.cursor.midi, start: this.cursor.step, duration: 1, velocity: 0.8 }
				],
				"Note added"
			)
		}
	}
	private editNote(note: PianoRollNote) {
		const selected = this.selected()
		if (!selected) {
			return
		}
		if (
			note.midi < this.min ||
			note.midi > this.max ||
			note.start < 0 ||
			note.duration < 1 ||
			note.start + note.duration > this.steps ||
			this.collides(note, this.sequence, selected)
		) {
			this.syncControls()
			this.announce("Cannot edit note: outside the grid or overlapping another note")
			return
		}
		this.cursor = { midi: note.midi, step: note.start }
		this.commit(
			this.sequence.map((other) => (other === selected ? note : other)),
			`${instrumentNote(note.midi).noteName}, ${position(note.start, this.division)}, length ${note.duration} steps, velocity ${Math.round(note.velocity * 100)} percent`
		)
	}
	private keydown(event: KeyboardEvent) {
		// Keep shortcuts inside the grid; native inputs retain their keyboard behavior.
		if (!(event.target as Element).matches("button[data-step]")) {
			return
		}
		event.stopPropagation()
		if (this.disabled) {
			return
		}
		const { key } = event
		const dx = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0
		const dy = key === "ArrowUp" ? 1 : key === "ArrowDown" ? -1 : 0
		const note = this.selected()
		if (dx || dy) {
			event.preventDefault()
			if (event.altKey && note) {
				this.editNote({ ...note, start: note.start + dx, midi: note.midi + dy })
			} else if (event.shiftKey && dx && note) {
				this.editNote({ ...note, duration: note.duration + dx })
			} else {
				this.focusCell(this.cursor.midi + dy, this.cursor.step + dx)
			}
		} else if (key === "Home" || key === "End") {
			event.preventDefault()
			this.focusCell(
				event.ctrlKey ? (key === "Home" ? this.max : this.min) : this.cursor.midi,
				key === "Home" ? 0 : this.steps - 1
			)
		} else if (key === "Delete" || key === "Backspace") {
			event.preventDefault()
			if (note) {
				this.commit(
					this.sequence.filter((other) => other !== note),
					"Note removed"
				)
			}
		} else if (key === "Escape") {
			event.preventDefault()
			this.stop()
		}
		// Enter/Space use the native button click, including assistive technology activation.
	}
	private focusCell(midi: number, step: number, focus = true) {
		this.cursor = {
			midi: Math.max(this.min, Math.min(this.max, midi)),
			step: Math.max(0, Math.min(this.steps - 1, step))
		}
		for (const cell of this.root.querySelectorAll<HTMLButtonElement>("button[data-step]")) {
			const active =
				Number(cell.dataset.midi) === this.cursor.midi &&
				Number(cell.dataset.step) === this.cursor.step
			cell.tabIndex = active && !this.disabled ? 0 : -1
			if (active && focus) {
				cell.focus()
			}
		}
		this.syncControls()
	}
	private announce(message: string) {
		const status = this.root.querySelector("#status")
		if (status) {
			status.textContent = message
		}
	}

	play() {
		if (this.disabled || this.muted || this.running || !this.isConnected) {
			return
		}
		this.running = true
		this.nextStep = 0
		this.deadline = performance.now()
		this.syncControls()
		this.announce("Playing")
		this.tick()
	}
	stop() {
		clearTimeout(this.timer)
		this.timer = undefined
		const wasPlaying = this.running
		this.running = false
		const voices = [...this.voices]
		this.voices.clear()
		for (const [note, detail] of voices) {
			this.release(note, detail)
		}
		this.markPlayhead(-1)
		this.syncControls()
		if (wasPlaying) {
			this.announce("Stopped")
		}
	}
	private release(note: PianoRollNote, detail: NoteDetail) {
		dispatchInstrumentEvent(
			this,
			NOTE_OFF,
			noteDetail("noteOff", note.midi, 0, detail.id, detail)
		)
	}
	private tick() {
		if (!this.running) {
			return
		}
		const step = this.nextStep
		for (const [note, detail] of this.voices) {
			if (note.start + note.duration <= step) {
				this.voices.delete(note)
				this.release(note, detail)
				if (!this.running) {
					return
				}
			}
		}
		if (step >= this.steps) {
			if (!this.loop) {
				this.stop()
				return
			}
			this.nextStep = 0
		}
		const current = this.nextStep++
		for (const note of this.sequence.filter((note) => note.start === current)) {
			const detail = noteDetail("noteOn", note.midi, note.velocity, ++voiceId, {
				group: this.number("group", 0, 0, 15),
				channel: this.number("channel", 0, 0, 15)
			})
			this.voices.set(note, detail)
			dispatchInstrumentEvent(this, NOTE_ON, detail)
			if (!this.running) {
				return
			}
		}
		this.markPlayhead(current)
		this.dispatchEvent(
			new CustomEvent(EVENT_STEP_CHANGE, {
				detail: { step: current },
				bubbles: true,
				composed: true
			})
		)
		if (!this.running) {
			return
		}
		const interval = 60000 / this.bpm / this.division
		// Avoid accumulating timer drift; don't burst through missed notes after a stall.
		this.deadline = Math.max(this.deadline + interval, performance.now())
		this.timer = setTimeout(() => this.tick(), Math.max(0, this.deadline - performance.now()))
	}
	private markPlayhead(step: number) {
		for (const cell of this.root.querySelectorAll<HTMLElement>("[data-step]")) {
			cell.toggleAttribute("data-playing", Number(cell.dataset.step) === step)
		}
		const output = this.root.querySelector("#position")
		if (output) {
			output.textContent = step < 0 ? "Stopped" : position(step, this.division)
		}
	}
	private syncControls() {
		if (!this.root.childElementCount) {
			return
		}
		const note = this.selected()
		const play = this.root.querySelector<HTMLButtonElement>("#play")!
		play.textContent = this.running ? "Stop" : "Play"
		play.setAttribute("aria-pressed", String(this.running))
		for (const control of this.root.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
			"input, button"
		)) {
			control.disabled = this.disabled
		}
		this.root.querySelector<HTMLInputElement>("#bpm")!.value = String(this.bpm)
		this.root.querySelector<HTMLInputElement>("#loop")!.checked = this.loop
		this.root.querySelector<HTMLButtonElement>("#remove")!.disabled = this.disabled || !note
		for (const name of ["duration", "velocity"] as const) {
			const input = this.root.querySelector<HTMLInputElement>(`#${name}`)!
			input.disabled = this.disabled || !note
			input.value = String(
				note
					? name === "duration"
						? note.duration
						: Math.round(note.velocity * 100)
					: name === "duration"
						? 1
						: 80
			)
			if (name === "duration") {
				input.max = String(this.steps - (note?.start ?? this.cursor.step))
			}
		}
		this.root.querySelector("#selection")!.textContent =
			`${instrumentNote(this.cursor.midi).noteName}, ${position(this.cursor.step, this.division)}${note ? `, note starts at step ${note.start + 1}` : ", empty"}`
	}
	private refresh() {
		if (!this.root.childElementCount) {
			return
		}
		const restore = this.root.activeElement?.matches("button[data-step]")
		this.cursor.midi = Math.max(this.min, Math.min(this.max, this.cursor.midi))
		this.cursor.step = Math.min(this.steps - 1, this.cursor.step)
		const grid = this.root.querySelector<HTMLElement>("#grid")!
		grid.setAttribute("aria-label", this.getAttribute("label") || "Piano roll")
		grid.setAttribute("aria-rowcount", String(this.max - this.min + 2))
		grid.setAttribute("aria-colcount", String(this.steps + 1))
		const rows: string[] = [
			`<div role="row" class="row"><span role="columnheader" class="pitch">Pitch</span>${Array.from({ length: this.steps }, (_, step) => `<span role="columnheader" data-step="${step}" aria-label="${position(step, this.division)}">${step + 1}</span>`).join("")}</div>`
		]
		for (let midi = this.max; midi >= this.min; midi--) {
			const name = instrumentNote(midi).noteName
			rows.push(
				`<div role="row" class="row ${name.includes("#") ? "accidental" : ""}"><span role="rowheader" class="pitch">${name}</span>${Array.from(
					{ length: this.steps },
					(_, step) => {
						const note = this.sequence.find(
							(note) =>
								note.midi === midi &&
								note.start <= step &&
								note.start + note.duration > step
						)
						const start = note?.start === step
						const label = `${name}, ${position(step, this.division)}, ${note ? `${start ? "note" : "continuation"}, length ${note.duration} steps, velocity ${Math.round(note.velocity * 100)} percent` : "empty"}`
						return `<span role="gridcell" ${step % this.division === 0 ? "data-beat" : ""} data-step="${step}"><button type="button" part="cell" data-step="${step}" data-midi="${midi}" ${note ? "data-note" : ""} ${start ? "data-start" : ""} aria-pressed="${!!note}" aria-label="${label}" tabindex="-1">${note ? (start ? "●" : "━") : "·"}</button></span>`
					}
				).join("")}</div>`
			)
		}
		grid.style.setProperty("--steps", String(this.steps))
		grid.innerHTML = rows.join("")
		this.focusCell(this.cursor.midi, this.cursor.step, !!restore)
		this.syncControls()
	}
	private render() {
		this.root.innerHTML = `<style>
            :host{display:block;color:var(--piano-roll-ink,#202638);font:1rem/1.5 system-ui,sans-serif;min-width:0}
            *{box-sizing:border-box}section{background:var(--piano-roll-background,#f5f6fa);border:1px solid #8a94a6;border-radius:1rem;padding:1.25rem}
            .controls{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;margin-block:.75rem}label{display:flex;align-items:center;gap:.4rem}
            button,input{font:inherit;color:inherit}button{cursor:pointer;border:1px solid #737e93;border-radius:.35rem;background:#fff;padding:.45rem .8rem;min-height:44px}
            button:disabled,input:disabled{cursor:default;opacity:.55}input[type=number]{width:5rem;padding:.4rem;border:1px solid #737e93;border-radius:.3rem;background:#fff}
            :focus-visible{outline:3px solid #bd3c00;outline-offset:2px;position:relative;z-index:2}
            .scroll{overflow:auto;max-height:34rem;border:1px solid #737e93;border-radius:.4rem;margin-block:1rem}
            #grid{width:max-content;min-width:100%}.row{display:grid;grid-template-columns:4rem repeat(var(--steps),minmax(2.75rem,1fr))}
            [role=columnheader]{text-align:center;background:#e0e5ef;padding:.5rem .2rem;border-right:1px solid #8a94a6}
            .pitch{position:sticky;left:0;z-index:1;background:#fff;padding:.5rem;font-weight:650;border-bottom:1px solid #aeb6c4}
            .accidental .pitch{background:#283147;color:#fff}[role=gridcell]{border-right:1px solid #bac1ce;border-bottom:1px solid #bac1ce;background:#fff}
            .accidental [role=gridcell]{background:#e6e9f0}[data-beat]{border-left:2px solid #758096}
            [data-step] button{display:block;width:100%;height:100%;border:0;border-radius:0;background:transparent;padding:.25rem;color:#727c8d}
            button[data-note]{background:var(--piano-roll-note,#285b9b);color:#fff}button[data-start]{border-radius:.35rem 0 0 .35rem}
            [data-playing]{box-shadow:inset 0 0 0 3px #bc4d00}#selection{font-weight:600}p{margin:.5rem 0}#status{min-height:1.5em}
            @media(forced-colors:active){button[data-note]{background:Highlight;color:HighlightText;forced-color-adjust:none}[data-playing]{outline:2px solid Highlight}}
        </style><section aria-label="Piano roll editor" part="editor">
            <div class="controls"><button id="play" type="button" aria-pressed="false">Play</button><label>Tempo <input id="bpm" type="number" min="20" max="300" step="1"> BPM</label><label><input id="loop" type="checkbox"> Loop</label><button id="clear" type="button">Clear notes</button></div>
            <p id="help">Click an empty cell to add a note; click a filled cell to select it. Arrow keys navigate. Enter or Space adds/removes a note. Delete removes. Alt + arrows moves a note. Shift + Left/Right changes its length. Home/End moves to the first/last step. Escape stops playback.</p>
            <div class="scroll"><div id="grid" role="grid" aria-describedby="help"></div></div>
            <p id="selection"></p><div class="controls"><label>Length (steps) <input id="duration" type="number" min="1" step="1"></label><label>Velocity (%) <input id="velocity" type="number" min="1" max="100" step="1"></label><button id="remove" type="button">Remove selected note</button></div>
            <p id="position">Stopped</p><p id="status" role="status" aria-live="polite" aria-atomic="true">Ready. Add notes to begin.</p>
        </section>`
	}
}

if (!customElements.get("piano-roll")) {
	customElements.define("piano-roll", PianoRollElement)
}
declare global {
	interface HTMLElementTagNameMap {
		"piano-roll": PianoRollElement
	}
}