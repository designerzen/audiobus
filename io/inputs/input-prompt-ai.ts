import { EVENT_CHANGE, EVENT_CLICK } from "../../events/event-constants"
import NoteInput from "./note-input"
import { bounded, devicePanel, numberControl, changed } from "../device-controls"
import { promptBrowserAI } from "../browser-ai"
import {
	FUGUE_SCHEMA,
	describeMusicalContext,
	fuguePrompt,
	noteName,
	parseFugue,
	type FuguePattern,
	type MusicalContext
} from "../ai-fugue"

export const PROMPT_AI_INPUT_ID = "PromptAI"
const MODES = ["melody", "bass", "drums", "chord"]
const QUANTISE = ["bar", "beat"]
const BEATS_PER_BAR = 4
/** Without a transport beat for this long, a preview runs on its own clock. */
const TRANSPORT_TIMEOUT_MS = 250
const PREVIEW_INTERVAL_MS = 10
const EPSILON = 1e-6

/**
 * Generates a looping pattern with rhythm, duration and velocity, then plays it
 * on the shared transport, starting on the next beat or bar. While the
 * transport is stopped, Generate and Play preview it on a local clock.
 */
export default class InputPromptAI extends NoteInput {
	private panel?: HTMLElement
	private request?: AbortController
	private disposed = false
	private context: MusicalContext = {}
	private enabled = false
	private pattern?: FuguePattern
	private pending?: { pattern: FuguePattern; startBeat?: number }
	private source?: "transport" | "preview"
	private beat?: number
	private origin = 0
	private cycle = 0
	private cursor = 0
	private scheduled: Array<{ number: number; channel: number; at: number }> = []
	private transportAt = -Infinity
	private preview?: ReturnType<typeof setInterval>
	private previewBeat = 0
	private previewAt = 0
	get name(): string {
		return PROMPT_AI_INPUT_ID
	}
	get description(): string {
		return "Describe a melody, bass line, drum pattern or chord loop using built-in browser AI"
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.options.prompt = String(options.prompt ?? "")
		this.options.mode = MODES.includes(options.mode) ? options.mode : "melody"
		this.options.bpm = Number.isFinite(options.bpm)
			? Math.max(30, Math.min(300, options.bpm))
			: 120
		this.options.loop = options.loop !== false
		this.options.quantise = QUANTISE.includes(options.quantise) ? options.quantise : "bar"
		try {
			this.options.pattern = options.pattern ? parseFugue(options.pattern) : undefined
		} catch {
			this.options.pattern = undefined
		}
		this.setAsConnected()
	}

	private get bpm(): number {
		return bounded(this.options.getBpm?.(), this.options.bpm, 30, 300)
	}
	private get channel(): number {
		return this.options.mode === "drums" ? 10 : 1
	}
	private get contextText(): string {
		return describeMusicalContext(this.context, this.options.mode, this.bpm)
	}

	/** Pushed by the chain manager: key, chords, instruments and drum pads. */
	setMusicalContext(context: MusicalContext): void {
		this.context = context
		const details = this.panel?.querySelector("#prompt-context")
		if (details) {
			details.textContent = this.contextText
		}
	}

	async createGui(): Promise<HTMLElement> {
		if (this.panel) {
			return this.panel
		}
		const panel = devicePanel()
		panel.classList.add("prompt-ai-panel")
		const container = document.createElement("div")
		container.className = "prompt-ai-container"
		const help = document.createElement("p")
		help.textContent =
			"Describe music in English. Runs on your device, without an API key. First use may download a browser model. Loops follow the transport when it is playing."
		const label = document.createElement("label")
		label.textContent = "Musical idea "
		const prompt = document.createElement("textarea")
		prompt.id = "prompt-input"
		prompt.rows = 4
		prompt.value = this.options.prompt
		prompt.placeholder = "A gentle descending melody in D minor"
		prompt.addEventListener(EVENT_CHANGE, () => {
			this.options.prompt = prompt.value
			changed(this)
		})
		label.append(prompt)
		const select = (title: string, key: string, values: string[]) => {
			const label = document.createElement("label"),
				select = document.createElement("select")
			label.textContent = `${title} `
			for (const value of values) {
				const option = document.createElement("option")
				option.value = value
				option.textContent = value
				select.append(option)
			}
			select.value = this.options[key]
			select.addEventListener(EVENT_CHANGE, () => {
				this.options[key] = select.value
				this.setMusicalContext(this.context)
				changed(this)
			})
			label.append(select)
			return label
		}
		const loopLabel = document.createElement("label"),
			loop = document.createElement("input")
		loop.type = "checkbox"
		loop.checked = this.options.loop
		loop.addEventListener(EVENT_CHANGE, () => {
			this.options.loop = loop.checked
			changed(this)
		})
		loopLabel.append(loop, " Loop")
		const context = document.createElement("details"),
			summary = document.createElement("summary"),
			contextText = document.createElement("pre")
		summary.textContent = "Context sent to the AI"
		contextText.id = "prompt-context"
		contextText.style.whiteSpace = "pre-wrap"
		context.append(summary, contextText)
		const button = (id: string, text: string, run: () => void) => {
			const button = document.createElement("button")
			button.type = "button"
			button.id = id
			button.textContent = text
			button.addEventListener(EVENT_CLICK, run)
			return button
		}
		const generate = button("generate-sequence", "Generate and play", () => {
			void this.generateSequenceFromPrompt(prompt.value)
		})
		const play = button("play-sequence", "Play", () => this.play())
		const stop = button("stop-generation", "Stop", () => this.stopGeneration())
		play.disabled = !this.options.pattern
		const status = document.createElement("p"),
			notes = document.createElement("p")
		status.id = "generation-status"
		status.setAttribute("role", "status")
		notes.id = "generated-notes"
		container.append(
			help,
			label,
			select("Generate", "mode", MODES),
			select("Start on next", "quantise", QUANTISE),
			loopLabel
		)
		numberControl(
			container,
			"Tempo (BPM; follows shared transport when available)",
			this.options.bpm,
			30,
			300,
			(value) => {
				this.options.bpm = value
				this.setMusicalContext(this.context)
				changed(this)
			}
		)
		container.append(context, generate, play, stop, status, notes)
		panel.append(container)
		this.panel = panel
		this.setMusicalContext(this.context)
		this.showPattern()
		return panel
	}

	async generateSequenceFromPrompt(prompt: string): Promise<void> {
		if (this.disposed) {
			return
		}
		this.request?.abort()
		if (!prompt.trim()) {
			this.updateStatus("Please describe some music.", "error")
			return
		}
		this.options.prompt = prompt.slice(0, 4000)
		changed(this)
		const request = (this.request = new AbortController())
		const button = this.panel?.querySelector<HTMLButtonElement>("#generate-sequence")
		if (button) {
			button.disabled = true
		}
		try {
			const response = await promptBrowserAI(
				fuguePrompt(this.options.prompt, this.options.mode, this.contextText),
				FUGUE_SCHEMA,
				request.signal,
				(message) => this.updateStatus(message)
			)
			if (request.signal.aborted || this.disposed) {
				return
			}
			this.options.pattern = parseFugue(response)
			changed(this)
			this.showPattern()
			this.play()
		} catch (error) {
			if (!request.signal.aborted) {
				this.updateStatus(error instanceof Error ? error.message : String(error), "error")
			}
		} finally {
			if (this.request === request) {
				this.request = undefined
				if (button) {
					button.disabled = false
				}
			}
		}
	}

	private showPattern(): void {
		const pattern: FuguePattern | undefined = this.options.pattern
		const display = this.panel?.querySelector("#generated-notes")
		if (display) {
			display.textContent = pattern
				? `${pattern.beats}-beat pattern: ${pattern.notes
						.map(({ number, beat }) => `${noteName(number)}@${beat}`)
						.join(" ")}`
				: ""
		}
		const play = this.panel?.querySelector<HTMLButtonElement>("#play-sequence")
		if (play) {
			play.disabled = !pattern
		}
	}

	/** Queue the saved pattern; it replaces any playing pattern on the next boundary. */
	play(): void {
		const pattern: FuguePattern | undefined = this.options.pattern
		if (!pattern || this.disposed) {
			return
		}
		this.enabled = true
		if (this.transportRunning) {
			this.pending = { pattern, startBeat: this.boundary(this.beat!, true) }
			this.updateStatus(`Starting on the next ${this.options.quantise}.`, "success")
			return
		}
		if (this.source !== "preview") {
			this.releaseAll()
			this.source = "preview"
			this.previewBeat = 0
			this.pattern = undefined
		}
		this.previewAt = performance.now()
		// Swap a running preview in time; start a silent one immediately.
		this.pending = {
			pattern,
			startBeat: this.pattern ? this.boundary(this.previewBeat, true) : undefined
		}
		this.preview ??= setInterval(() => this.previewTick(), PREVIEW_INTERVAL_MS)
		this.advance(this.previewBeat)
		this.updateStatus("Playing. Press transport Play to sync.", "success")
	}

	private get transportRunning(): boolean {
		return (
			this.beat !== undefined && performance.now() - this.transportAt < TRANSPORT_TIMEOUT_MS
		)
	}

	/** The next beat or bar line; `after` skips one the current beat already sits on. */
	private boundary(beat: number, after = false): number {
		const unit = this.options.quantise === "beat" ? 1 : BEATS_PER_BAR
		return after
			? (Math.floor(beat / unit + EPSILON) + 1) * unit
			: Math.ceil(beat / unit - EPSILON) * unit
	}

	private previewTick(): void {
		if (this.transportRunning && this.source === "transport") {
			return
		}
		const now = performance.now()
		this.previewBeat += (((now - this.previewAt) / 1000) * this.bpm) / 60
		this.previewAt = now
		this.advance(this.previewBeat)
	}

	/** Called with the transport position in quarter-note beats on every clock tick. */
	setMusicalBeat(beat: number): void {
		if (!Number.isFinite(beat)) {
			return
		}
		const seeked = this.source === "transport" && this.beat !== undefined && beat < this.beat
		this.transportAt = performance.now()
		if (this.source !== "transport" || seeked) {
			// Joining the transport, or after a seek, restart the pattern in time.
			this.source = "transport"
			this.releaseAll()
			this.pattern = this.pending = undefined
		}
		if (this.enabled && !this.pattern && !this.pending && this.options.pattern) {
			this.pending = { pattern: this.options.pattern, startBeat: this.boundary(beat) }
		}
		this.advance(beat)
	}

	/** Joins the manager's timed inputs so transport start and stop reach this input. */
	updateTime(): void {}
	startClock(): void {
		this.enabled ||= Boolean(this.options.pattern)
	}

	private advance(beat: number): void {
		this.beat = beat
		this.scheduled = this.scheduled.filter((release) => {
			if (beat < release.at - EPSILON) {
				return true
			}
			this.noteOff(release.number, release.channel)
			return false
		})
		const pending = this.pending
		if (pending && (pending.startBeat === undefined || beat >= pending.startBeat - EPSILON)) {
			this.releaseAll()
			this.pattern = pending.pattern
			this.pending = undefined
			this.origin = pending.startBeat ?? beat
			this.cycle = 0
			this.cursor = 0
		}
		const pattern = this.pattern
		if (!pattern || !this.isConnected || beat < this.origin - EPSILON) {
			return
		}
		const local = Math.max(0, beat - this.origin),
			cycle = Math.floor(local / pattern.beats + EPSILON)
		if (cycle > 0 && !this.options.loop) {
			if (!this.scheduled.length) {
				this.pattern = undefined
				this.enabled = false
				this.updateStatus("Finished. Press Play to hear it again.")
			}
			return
		}
		if (cycle !== this.cycle) {
			this.cycle = cycle
			this.cursor = 0
		}
		const position = local - cycle * pattern.beats,
			start = this.origin + cycle * pattern.beats
		while (
			this.cursor < pattern.notes.length &&
			pattern.notes[this.cursor].beat <= position + EPSILON
		) {
			const note = pattern.notes[this.cursor++]
			// Skip notes missed while the tab was stalled rather than bursting them.
			if (position - note.beat > 0.5) {
				continue
			}
			const channel = this.channel
			this.noteOn(note.number, note.velocity, channel)
			this.scheduled.push({
				number: note.number,
				channel,
				at: start + note.beat + note.duration
			})
		}
	}

	private releaseAll(): void {
		this.scheduled = []
		this.allNotesOff()
	}

	protected updateStatus(message: string, type: "success" | "error" | "info" = "info"): void {
		const status = this.panel?.querySelector<HTMLElement>("#generation-status")
		if (status) {
			status.textContent = message
			status.className = `status-message status-${type}`
		}
	}

	stopGeneration(): void {
		this.request?.abort()
		this.request = undefined
		this.stopPlayback()
		const button = this.panel?.querySelector<HTMLButtonElement>("#generate-sequence")
		if (button) {
			button.disabled = false
		}
		this.updateStatus("Stopped")
	}
	private stopPlayback(): void {
		clearInterval(this.preview)
		this.preview = undefined
		this.enabled = false
		this.pattern = this.pending = this.source = undefined
		this.releaseAll()
	}
	stopClock(): void {
		this.stopPlayback()
		this.beat = undefined
		this.transportAt = -Infinity
	}
	/** Closing the panel cancels a pending generation; a playing loop keeps going. */
	async destroyGui(): Promise<void> {
		this.request?.abort()
		this.request = undefined
		this.panel?.remove()
		this.panel = undefined
	}
	async disconnect(): Promise<void> {
		this.stopGeneration()
		await super.disconnect()
	}
	override destroy(): void {
		this.disposed = true
		this.request?.abort()
		this.stopPlayback()
		void this.destroyGui()
		super.destroy()
	}
}