import QwertyKeyboard from './keyboard-qwerty.ts'

/**
 * Manages the display and interaction of the QWERTY keyboard visualization
 * Listens to keyboard events and updates the visual representation
 */
export default class KeyboardDisplayManager {
	private keyboard: QwertyKeyboard
	private keyDownListener: ((event: Event) => void) | null = null
	private keyUpListener: ((event: Event) => void) | null = null
	private abortController: AbortController

	constructor() {
		this.keyboard = new QwertyKeyboard()
		this.abortController = new AbortController()
		this.attachListeners()
	}

	private attachListeners(): void {
		// Listen for custom keyboard events from the hardware listener
		this.keyDownListener = (event: Event) => {
			const customEvent = event as CustomEvent<{ key: string }>
			this.keyboard.setKeyAsActive(customEvent.detail.key)
		}

		this.keyUpListener = (event: Event) => {
			const customEvent = event as CustomEvent<{ key: string }>
			this.keyboard.setKeyAsInactive(customEvent.detail.key)
		}

		window.addEventListener('keyboardKeyDown', this.keyDownListener, {
			signal: this.abortController.signal,
		})
		window.addEventListener('keyboardKeyUp', this.keyUpListener, {
			signal: this.abortController.signal,
		})
	}

	/**
	 * Get the keyboard display element
	 */
	getElement(): DocumentFragment {
		return this.keyboard.fragment
	}

	/**
	 * Get the SVG string for the keyboard
	 */
	getSVG(): string {
		return this.keyboard.svg
	}

	/**
	 * Destroy the manager and clean up listeners
	 */
	destroy(): void {
		this.abortController.abort()
		this.keyboard.destroy()
	}
}
