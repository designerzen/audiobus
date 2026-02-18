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

	glide: boolean = false

	#rollingIndex: number = 0
	#maxTouchEvents: number = 10
	#mouseDown: boolean = false

	constructor(pitchBend: boolean = true) {
		this.glide = pitchBend
	}

	get isMouseDown(): boolean {
		return this.#mouseDown
	}

	get isTouching(): boolean {
		return this.activeNotes.size > 0
	}

	/**
	 * Get the next available index for tracking interactions
	 * @param maxTouches - Maximum number of touch events to track
	 * @returns Available index
	 */
	getNextAvailableIndex(maxTouches: number): number {
		let id = (DEFAULT_MOUSE_ID + this.#rollingIndex) % maxTouches
		// loop through all digits starting from default to find which is "free"
		for (let i = 0; i < maxTouches; i++) {
			id = (id + i) % maxTouches
			if (this.activeId.has(id)) {
				// continue looping
				continue
			} else {
				// escape with this none-active one
				return id
			}
		}
		// not good - all instruments are engaged!
		return id
	}

	getIdFromEvent(event: PointerEvent | KeyboardEvent): number {
		// if this element already has handled an interaction
		// reuse the id previously cached
		if (this.activeElement.has(event.target as Element)) {
			return this.activeElement.get(event.target as Element)!
		}

		if (event instanceof PointerEvent) {
			switch (event.pointerType) {
				case 'touch':
					// each touch id is different
					return event.pointerId

				default:
					//case "mouse":
					//case "pen":
					return this.getNextAvailableIndex(this.#maxTouchEvents)
			}
		}

		return this.getNextAvailableIndex(this.#maxTouchEvents)
	}

	/**
	 * Get the note from a keyboard button element
	 * @param button - DOM element representing a key
	 * @returns NoteModel
	 */
	getNoteFromKey(button: Element): NoteModel {
		throw new Error('getNoteFromKey must be implemented by subclass')
	}

	/**
	 * Add interactivity to the keyboard and wire these
	 * to the noteOn and noteOff functions provided
	 * @param buttonElements - Array of button elements to add interactivity to
	 * @param noteOn - Method to call to play a note
	 * @param noteOff - Method to call to stop the playing note
	 * @param passive - Use passive event listeners
	 * @returns Cleanup function to remove all event listeners
	 */
	addInteractivity(
		buttonElements: Element[],
		noteOn: (noteNumber: number, pressure: number, id: number) => void,
		noteOff: (noteNumber: number, velocity: number, id: number) => void,
		passive: boolean = true
	): () => void {
		if (!buttonElements) {
			throw new Error('No keys provided to add interactivity to')
		}

		const controller = new AbortController()

		buttonElements.forEach((button) => {
			// can come from a touch a mouse click or a keyboard enter press
			const onInteractionStarting = (event: PointerEvent | KeyboardEvent): void => {
				// Keypresses other than Enter and Space should not trigger a command
				if (
					event instanceof KeyboardEvent &&
					event.key !== 'Enter' &&
					event.key !== ' '
				) {
					return
				}

				if (!passive && event.preventDefault) {
					event.preventDefault()
				}

				// roll around of
				this.#rollingIndex = (this.#rollingIndex + 1) % this.#maxTouchEvents

				if (event instanceof PointerEvent) {
					switch (event.pointerType) {
						case 'mouse':
							this.#mouseDown = true
					}
				}

				const pressure =
					(event instanceof PointerEvent ? event.pressure : undefined) ??
					((event as any).webkitForce as number | undefined) ??
					1
				const note = this.getNoteFromKey(button)

				const id = this.getIdFromEvent(event)

				const starting = noteOn(note.noteNumber, pressure, id)

				this.activeNotes.set(id, note)
				this.activeId.set(id, true)
				this.activeElement.set(event.target as Element, id)

				document.addEventListener('pointerleave', onInteractionComplete, {
					signal: controller.signal,
					passive,
				})
				document.addEventListener('pointerup', onInteractionComplete, {
					signal: controller.signal,
					passive,
				})
				document.addEventListener('pointercancel', onInteractionComplete, {
					signal: controller.signal,
					passive,
				})
				document.addEventListener('visibilitychange', onInteractionComplete, {
					signal: controller.signal,
					passive,
				})
			}

			/**
			 * Handle interaction completion
			 * @param event - Pointer or keyboard event
			 * @returns void
			 */
			const onInteractionComplete = (event: Event): void => {
				// Keypresses other than Enter and Space should not trigger a command
				if (
					event instanceof KeyboardEvent &&
					event.key !== 'Enter' &&
					event.key !== ' '
				) {
					return
				}

				if (!passive && event.preventDefault) {
					event.preventDefault()
				}

				if (
					(event instanceof PointerEvent && event.pointerType === 'mouse') ||
					event.type === 'pointerup' ||
					event.type === 'pointercancel'
				) {
					this.#mouseDown = false
				}

				document.removeEventListener('pointerleave', onInteractionComplete as EventListener)
				document.removeEventListener('pointerup', onInteractionComplete as EventListener)
				document.removeEventListener('pointercancel', onInteractionComplete as EventListener)
				document.removeEventListener('visibilitychange', onInteractionComplete as EventListener)

				const id = this.getIdFromEvent(event as PointerEvent | KeyboardEvent)

				const currentlyPlayingNote = this.activeNotes.get(id)

				if (currentlyPlayingNote) {
					noteOff(currentlyPlayingNote.noteNumber, 1, id)
				}

				this.activeNotes.delete(id)
				this.activeId.delete(id)
				this.activeElement.delete(event.target as Element)
			}

			button.addEventListener('pointerdown', onInteractionStarting as EventListener, {
				signal: controller.signal,
				passive,
			})

			// User leaves element - turns off note but updates id
			button.addEventListener(
				'pointerleave',
				(event: Event) => {
					const pointerEvent = event as PointerEvent

					if (!passive && event.preventDefault) {
						event.preventDefault()
					}

					// Stop existing note playback
					const id = this.getIdFromEvent(pointerEvent)
					const currentlyPlayingNote = this.activeNotes.get(id)

					if (currentlyPlayingNote) {
						noteOff(currentlyPlayingNote.noteNumber, 1, id)
						this.activeNotes.delete(id)
						this.activeId.set(id, false)
						this.activeElement.delete(event.target as Element)
					}
				},
				{ signal: controller.signal, passive }
			)

			// if the user has finger down but they change keys...
			button.addEventListener(
				'pointerenter',
				(event: Event) => {
					const pointerEvent = event as PointerEvent

					if (!passive && event.preventDefault) {
						event.preventDefault()
					}

					if (this.#mouseDown) {
						this.#rollingIndex = (this.#rollingIndex + 1) % this.#maxTouchEvents
					}

					// this id will always be inactive due to fetching ids from targets
					const id = this.getIdFromEvent(pointerEvent)
					const isActive = this.activeId.has(id)

					// if we already playing, we change the note
					if (isActive || this.#mouseDown) {
						const requestedNote = this.getNoteFromKey(button)

						if (!this.glide) {
							// TODO: pitch bend!
						}

						noteOn(requestedNote.noteNumber, 1, id)

						// overwrite the pointer
						this.activeNotes.set(id, requestedNote)
						this.activeId.set(id, true)
						this.activeElement.set(event.target as Element, id)
					}
				},
				{ signal: controller.signal, passive }
			)
		})

		return () => {
			controller.abort()
		}
	}
}
