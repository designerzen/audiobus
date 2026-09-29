export const DEFAULT_MOUSE_ID = 1

interface NoteModel {
	noteNumber: number
	noteName: string
	[key: string]: any
}

export default class AbstractInteractive {
	activeId: Map<number, boolean> = new Map()
	activeNotes: Map<number, NoteModel> = new Map()
	activeElement: Map<Element, number> = new Map()
	glide: boolean
	#mouseDown = false
	#releaseAll = () => {}
	#cleanup = () => {}

	constructor(pitchBend = true) {
		this.glide = pitchBend
	}

	get isMouseDown(): boolean { return this.#mouseDown }
	get isTouching(): boolean { return this.activeNotes.size > 0 }

	getNoteFromKey(_button: Element): NoteModel {
		throw new Error('getNoteFromKey must be implemented by subclass')
	}

	allNotesOff(): void { this.#releaseAll() }

	destroy(): void {
		this.#cleanup()
		this.#cleanup = () => {}
		this.#releaseAll = () => {}
	}

	addInteractivity(
		buttonElements: Element[],
		noteOn: (noteNumber: number, pressure: number, id: number) => void,
		noteOff: (noteNumber: number, velocity: number, id: number) => void
	): () => void {
		this.#cleanup()
		const root = buttonElements[0]?.closest('svg') ?? buttonElements[0]?.parentElement
		if (!root) return () => {}

		const controller = new AbortController()
		const options = { signal: controller.signal }
		const keys = new Set(buttonElements)
		const pointers = new Set<number>()
		const elements = new Map<number, Element>()
		const sounding = new Map<number, { count: number, id: number }>()
		const keyboardIds = new Map<string, number>()
		let nextKeyboardId = -1

		const findKey = (target: EventTarget | null): Element | undefined => {
			const key = target instanceof Element ? target.closest('[data-number]') : null
			return key && keys.has(key) ? key : undefined
		}
		const release = (id: number) => {
			const note = this.activeNotes.get(id)
			const element = elements.get(id)
			this.activeNotes.delete(id)
			this.activeId.delete(id)
			elements.delete(id)
			if (element) {
				const remaining = Array.from(elements).find(([, key]) => key === element)
				if (remaining) this.activeElement.set(element, remaining[0])
				else {
					this.activeElement.delete(element)
					element.classList.remove('pressed')
				}
			}
			if (note) {
				const voice = sounding.get(note.noteNumber)!
				if (--voice.count === 0) {
					sounding.delete(note.noteNumber)
					noteOff(note.noteNumber, 1, voice.id)
				}
			}
		}
		const press = (id: number, key: Element | undefined, pressure: number) => {
			if (elements.get(id) === key) return
			release(id)
			if (!key) return
			const note = this.getNoteFromKey(key)
			this.activeNotes.set(id, note)
			this.activeId.set(id, true)
			this.activeElement.set(key, id)
			elements.set(id, key)
			key.classList.add('pressed')
			const voice = sounding.get(note.noteNumber)
			if (voice) voice.count++
			else {
				sounding.set(note.noteNumber, { count: 1, id })
				noteOn(note.noteNumber, pressure > 0 ? pressure : 1, id)
			}
		}
		const endPointer = (event: PointerEvent) => {
			if (!pointers.delete(event.pointerId)) return
			release(event.pointerId)
			if (event.pointerType === 'mouse') this.#mouseDown = false
			if (root.hasPointerCapture?.(event.pointerId)) root.releasePointerCapture(event.pointerId)
		}
		this.#releaseAll = () => {
			for (const id of Array.from(this.activeNotes.keys())) release(id)
			for (const id of pointers) {
				if (root.hasPointerCapture?.(id)) root.releasePointerCapture(id)
			}
			pointers.clear()
			keyboardIds.clear()
			this.#mouseDown = false
		}

		root.addEventListener('pointerdown', ((event: PointerEvent) => {
			const key = findKey(event.target)
			if (!key || event.button !== 0 || pointers.has(event.pointerId)) return
			event.preventDefault()
			pointers.add(event.pointerId)
			if (event.pointerType === 'mouse') this.#mouseDown = true
			root.setPointerCapture?.(event.pointerId)
			press(event.pointerId, key, event.pressure)
		}) as EventListener, options)
		document.addEventListener('pointermove', (event: PointerEvent) => {
			if (!pointers.has(event.pointerId)) return
			if (event.pointerType === 'mouse' && event.buttons === 0) {
				endPointer(event)
				return
			}
			// Pointer capture keeps releases reliable; hit testing follows fingers across keys.
			press(event.pointerId, findKey(document.elementFromPoint(event.clientX, event.clientY)), event.pressure)
		}, { ...options, passive: true })
		document.addEventListener('pointerup', endPointer, options)
		document.addEventListener('pointercancel', endPointer, options)
		root.addEventListener('lostpointercapture', endPointer as EventListener, options)
		root.addEventListener('contextmenu', event => event.preventDefault(), options)
		root.addEventListener('keydown', ((event: KeyboardEvent) => {
			const key = findKey(event.target)
			if (!key || (event.key !== 'Enter' && event.key !== ' ')) return
			event.preventDefault()
			if (event.repeat || keyboardIds.has(event.key)) return
			const id = nextKeyboardId--
			keyboardIds.set(event.key, id)
			press(id, key, 1)
		}) as EventListener, options)
		document.addEventListener('keyup', (event: KeyboardEvent) => {
			const id = keyboardIds.get(event.key)
			if (id === undefined) return
			event.preventDefault()
			release(id)
			keyboardIds.delete(event.key)
		}, options)
		root.addEventListener('focusout', () => {
			for (const id of keyboardIds.values()) release(id)
			keyboardIds.clear()
		}, options)
		window.addEventListener('blur', this.#releaseAll, options)
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) this.#releaseAll()
		}, options)

		this.#cleanup = () => {
			controller.abort()
			this.#releaseAll()
		}
		return this.#cleanup
	}
}
