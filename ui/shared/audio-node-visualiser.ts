import { EVENT_VISUALISER_ERROR, EVENT_VISUALISER_READY } from "../../event-constants.ts"
import { instrumentNote, type InstrumentNote } from "../interfaces/instrument.ts"
import type { AudioNodeVisualiserInterface } from "../interfaces/audio-node-visualiser.ts"
import { observeAudioContextOutput } from "../interfaces/audio-context-output.ts"

/** A silent audio-graph observer with optional instrument note feedback. */
export abstract class AudioNodeVisualiser
	extends HTMLElement
	implements AudioNodeVisualiserInterface
{
	static observedAttributes = ["width", "height"]
	canvas: HTMLCanvasElement
	protected readonly root = this.attachShadow({ mode: "open" })
	private source: AudioNode | null = null
	private selectedContext: BaseAudioContext | null = null
	private unobserveOutput?: () => void
	private release?: () => void
	private frame?: number
	private generation = 0
	private notes = new Map<string, InstrumentNote>()

	constructor(label: string) {
		super()
		this.root.innerHTML = `<style>
            :host { display: inline-block; max-width: 100%; }
            canvas { display: block; max-width: 100%; height: auto; background: #090d19; border-radius: 12px; }
            [role=status]:empty { display: none; }
            [part=notes]:empty { display: none; }
            [part=notes] { display: block; font: inherit; padding-block: 0.5em; }
        </style><canvas part="canvas" role="img"></canvas><output part="notes" aria-label="Active notes" aria-live="off"></output><span role="status"></span>`
		this.canvas = this.root.querySelector("canvas")!
		this.canvas.setAttribute("aria-label", label)
		this.resize()
	}

	get audioNode(): AudioNode | null {
		return this.source
	}
	set audioNode(value: AudioNode | null) {
		this.unobserveOutput?.()
		this.unobserveOutput = undefined
		this.selectedContext = null
		this.setSource(value)
	}
	get audioContext(): BaseAudioContext | null {
		return this.selectedContext ?? this.source?.context ?? null
	}
	set audioContext(value: BaseAudioContext | null) {
		if (value === this.selectedContext && this.unobserveOutput) {
			return
		}
		this.audioNode = null
		this.selectedContext = value
		this.observeOutput()
	}
	private observeOutput() {
		if (!this.isConnected || !this.selectedContext || this.unobserveOutput) {
			return
		}
		this.unobserveOutput = observeAudioContextOutput(this.selectedContext, (source) => {
			if (source === this.source) {
				void this.start()
			} else {
				this.setSource(source)
			}
		})
	}
	private setSource(value: AudioNode | null) {
		if (value === this.source) {
			return
		}
		this.stop()
		this.source = value
		if (this.isConnected) {
			void this.start()
		}
	}
	get width() {
		return this.dimension("width", 640)
	}
	set width(value: number) {
		this.setAttribute("width", String(value))
	}
	get height() {
		return this.dimension("height", 360)
	}
	set height(value: number) {
		this.setAttribute("height", String(value))
	}

	/** Optional display feedback, matching InstrumentInterface; never emits or plays notes. */
	noteOn(input: InstrumentNote | number, _velocity = 1, id = 0) {
		const note = instrumentNote(input)
		this.notes.set(`${id}:${note.noteNumber}`, note)
		this.updateNotes()
	}
	/** Optional: releases only the matching note and voice ID. */
	noteOff(input: InstrumentNote | number, _velocity = 0, id = 0) {
		const note = instrumentNote(input)
		this.notes.delete(`${id}:${note.noteNumber}`)
		this.updateNotes()
	}
	/** Optional instrument feedback helpers. */
	setActiveNote(note: InstrumentNote | number, active = true) {
		if (active) {
			this.noteOn(note)
		} else {
			this.noteOff(note)
		}
	}
	setActiveNotes(notes: Iterable<InstrumentNote | number>) {
		const next = new Map<string, InstrumentNote>()
		for (const input of notes) {
			const note = instrumentNote(input)
			next.set(`0:${note.noteNumber}`, note)
		}
		this.notes = next
		this.updateNotes()
	}
	clearActiveNotes() {
		this.notes.clear()
		this.updateNotes()
	}
	private updateNotes() {
		const names = [...new Set([...this.notes.values()].map((note) => note.noteName))]
		this.root.querySelector("[part=notes]")!.textContent = names.join(" · ")
	}

	private dimension(name: string, fallback: number) {
		const value = Number(this.getAttribute(name))
		return Number.isFinite(value) && value > 0
			? Math.min(4096, Math.max(1, Math.round(value)))
			: fallback
	}
	private resize() {
		this.canvas.width = this.width
		this.canvas.height = this.height
		this.resizeRenderer()
	}
	attributeChangedCallback() {
		this.resize()
	}
	connectedCallback() {
		if (this.selectedContext) {
			this.observeOutput()
		} else {
			void this.start()
		}
	}
	disconnectedCallback() {
		this.unobserveOutput?.()
		this.unobserveOutput = undefined
		this.stop()
		this.clearActiveNotes()
	}

	private async start() {
		this.stop()
		const generation = this.generation
		this.root.querySelector("[role=status]")!.textContent = ""
		if (!this.source) {
			return
		}
		try {
			const release = await this.prepare(
				this.source,
				() => generation === this.generation && this.isConnected
			)
			if (generation !== this.generation || !this.isConnected) {
				release()
				return
			}
			this.release = release
			const draw = () => {
				this.frame = undefined
				try {
					if (!this.ownerDocument.hidden) {
						this.renderFrame()
					}
					this.frame = requestAnimationFrame(draw)
				} catch (error) {
					this.fail(error)
				}
			}
			draw()
			if (generation === this.generation) {
				this.dispatchEvent(new Event(EVENT_VISUALISER_READY))
			}
		} catch (error) {
			if (generation === this.generation) {
				this.fail(error)
			}
		}
	}
	private fail(error: unknown) {
		this.stop()
		this.root.querySelector("[role=status]")!.textContent = "Audio visualisation unavailable."
		this.dispatchEvent(
			new CustomEvent(EVENT_VISUALISER_ERROR, {
				detail: error,
				bubbles: true,
				composed: true
			})
		)
	}
	private stop() {
		this.generation++
		if (this.frame !== undefined) {
			cancelAnimationFrame(this.frame)
		}
		this.frame = undefined
		this.release?.()
		this.release = undefined
	}
	protected resizeRenderer() {}
	protected replaceCanvas(canvas: HTMLCanvasElement) {
		if (this.canvas !== canvas) {
			return
		}
		const replacement = canvas.cloneNode(false) as HTMLCanvasElement
		canvas.replaceWith(replacement)
		this.canvas = replacement
	}
	protected abstract prepare(source: AudioNode, isCurrent: () => boolean): Promise<() => void>
	protected abstract renderFrame(): void
}

/** Disconnect only the edge owned by a visualiser, preserving the caller's graph. */
export function disconnectTap(source: AudioNode, tap: AudioNode) {
	try {
		source.disconnect(tap)
	} catch {
		/* The owner may already have disconnected it. */
	}
	tap.disconnect()
}