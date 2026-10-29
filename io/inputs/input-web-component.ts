import AbstractInput from "./abstract-input.ts"
import { UI_INPUT_COMPONENTS, type UIInputId } from "../../ui/input-components.ts"
import { NOTE_ON, NOTE_OFF, PITCH_BEND, CONTROL_CHANGE, PROGRAM_CHANGE } from "../../commands.ts"
import {
	EVENT_CONFIGURATION_CHANGED,
	EVENT_INSTRUMENT_DISCONNECT,
	EVENT_INSTRUMENT_CHANGE,
	EVENT_INPUT,
	EVENT_CHANGE,
	EVENT_SEQUENCE_CHANGE
} from "../../event-constants.ts"
import { umpToCommand } from "../../midi/ump-codec.ts"
import type { NoteDetail } from "../../ui/interfaces/instrument.ts"

type Controller = HTMLElement & { stop(): void; notes?: unknown[] }

/** Bridge event-only custom elements into the normal audiobus input chain. */
export default class InputWebComponent extends AbstractInput {
	private element?: Controller
	private listeners?: AbortController
	private pending?: Promise<HTMLElement>
	private generation = 0
	private voices = new Map<string, NoteDetail>()
	private controls = new Map<string, number[]>()

	private get component() {
		return UI_INPUT_COMPONENTS[this.options.component as UIInputId]
	}
	get name() {
		return this.component?.name ?? "UI Controller"
	}
	get description() {
		return this.component?.description ?? "Web component input"
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		if (!this.component) {
			throw new Error(`Unknown UI input: ${options.component}`)
		}
		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		if (this.element) {
			return this.element
		}
		if (this.pending) {
			return this.pending
		}
		const generation = this.generation
		const pending = this.buildGui(generation)
		this.pending = pending
		try {
			return await pending
		} finally {
			if (this.pending === pending) {
				this.pending = undefined
			}
		}
	}

	private async buildGui(generation: number): Promise<HTMLElement> {
		await this.component.load()
		if (generation !== this.generation) {
			throw new DOMException("UI input disposed", "AbortError")
		}
		const element = document.createElement(this.component.tag) as Controller
		this.element = element
		this.listeners = new AbortController()
		const options = { signal: this.listeners.signal }
		for (const type of [NOTE_ON, NOTE_OFF, PITCH_BEND, CONTROL_CHANGE, PROGRAM_CHANGE]) {
			element.addEventListener(
				type,
				(event) => {
					if (!(event instanceof CustomEvent) || event.composedPath()[0] !== element) {
						return
					}
					const detail = event.detail
					const words = detail?.ump
					if (!Array.isArray(words)) {
						return
					}
					if (type === NOTE_ON || type === NOTE_OFF) {
						const key = `${detail.group}:${detail.channel}:${detail.id}`
						const previous = this.voices.get(key)
						if (type === NOTE_OFF) {
							if (previous?.note.noteNumber !== detail.note.noteNumber) {
								return
							}
							this.voices.delete(key)
							if (this.hasVoice(detail)) {
								return
							}
						} else {
							this.voices.delete(key)
							if (previous && !this.hasVoice(previous)) {
								this.send(this.releaseWords(previous))
							}
							const sounding = this.hasVoice(detail)
							this.voices.set(key, detail)
							if (sounding) {
								return
							}
						}
					} else if (
						type === PITCH_BEND ||
						(type === CONTROL_CHANGE && detail.controller === 64)
					) {
						const key = `${type}:${detail.group}:${detail.channel}`
						const reset = type === PITCH_BEND ? 0x80000000 : 0
						if (words[1] === reset) {
							this.controls.delete(key)
						} else {
							this.controls.set(key, [words[0], reset])
						}
					}
					this.send(words)
				},
				options
			)
		}
		element.addEventListener(EVENT_INSTRUMENT_DISCONNECT, () => this.release(), options)
		element.addEventListener(EVENT_INSTRUMENT_CHANGE, () => this.saveAttributes(), options)
		element.addEventListener(EVENT_INPUT, () => this.saveAttributes(), options)
		element.addEventListener(EVENT_CHANGE, () => this.saveAttributes(), options)
		element.addEventListener(EVENT_SEQUENCE_CHANGE, () => this.saveAttributes(), options)
		// Persist reflected controller settings without serializing DOM or runtime voices.
		element.addEventListener(PROGRAM_CHANGE, () => this.saveAttributes(), options)
		const attributes = this.options.attributes ?? {}
		for (const [name, value] of Object.entries(attributes)) {
			if (!/^on/i.test(name) && name !== "style") {
				element.setAttribute(name, String(value))
			}
		}
		if (this.options.component === "piano-roll" && Array.isArray(this.options.notes)) {
			element.notes = structuredClone(this.options.notes)
		}
		return element
	}

	private saveAttributes() {
		if (!this.element) {
			return
		}
		this.options.attributes = Object.fromEntries(
			[...this.element.attributes].map((attribute) => [attribute.name, attribute.value])
		)
		if (this.options.component === "piano-roll") {
			this.options.notes = this.element.notes
		}
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
	}

	private send(words: readonly number[]) {
		const command = umpToCommand([...words], this.now, this.uuid)
		if (command) {
			this.dispatch(command)
		}
	}

	private releaseWords(detail: NoteDetail): number[] {
		return [
			(0x40800000 |
				(detail.group << 24) |
				(detail.channel << 16) |
				(detail.note.noteNumber << 8)) >>>
				0,
			0
		]
	}

	private hasVoice(detail: NoteDetail) {
		return [...this.voices.values()].some(
			(voice) =>
				voice.group === detail.group &&
				voice.channel === detail.channel &&
				voice.note.noteNumber === detail.note.noteNumber
		)
	}

	private release() {
		for (const [key, detail] of this.voices) {
			this.voices.delete(key)
			if (!this.hasVoice(detail)) {
				this.send(this.releaseWords(detail))
			}
		}
		for (const words of this.controls.values()) {
			this.send(words)
		}
		this.controls.clear()
	}

	async destroyGui(): Promise<void> {
		this.generation++
		this.pending = undefined
		this.element?.stop()
		this.release()
		this.saveAttributes()
		this.listeners?.abort()
		this.listeners = undefined
		this.element?.remove()
		this.element = undefined
	}

	destroy(): void {
		void this.destroyGui()
		this.setAsDisconnected()
	}
}