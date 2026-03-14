/**
 * Example: How to integrate the QWERTY keyboard display
 * 
 * This shows how to add the visual QWERTY keyboard to your UI
 * and have it automatically respond to keyboard input events
 */

import KeyboardDisplayManager from './keyboard-display-manager.ts'

export function setupKeyboardDisplay(containerSelector: string = '.keyboard-display-container'): KeyboardDisplayManager {
	// Create the keyboard display manager
	const keyboardManager = new KeyboardDisplayManager()

	// Find the container element
	const container = document.querySelector(containerSelector)
	if (!container) {
		console.warn(`Container "${containerSelector}" not found for keyboard display`)
		return keyboardManager
	}

	// Get the keyboard fragment and append it to the container
	const keyboardElement = keyboardManager.getElement()
	container.appendChild(keyboardElement)

	// The keyboard will automatically respond to keyboard events through:
	// - 'keyboardKeyDown' custom event (dispatched on keydown)
	// - 'keyboardKeyUp' custom event (dispatched on keyup)
	// 
	// These events are dispatched from the hardware keyboard listener in keyboard.ts

	return keyboardManager
}

/**
 * Alternative: Get just the SVG string if you want to embed it elsewhere
 */
export function getKeyboardSVG(): string {
	const keyboardManager = new KeyboardDisplayManager()
	const svg = keyboardManager.getSVG()
	keyboardManager.destroy()
	return svg
}

/**
 * Example HTML setup:
 * 
 * <div class="keyboard-display-container"></div>
 * 
 * <script>
 *   import { setupKeyboardDisplay } from './keyboard-example.ts'
 *   
 *   // Initialize the keyboard display
 *   const keyboard = setupKeyboardDisplay('.keyboard-display-container')
 *   
 *   // Clean up when done (optional)
 *   // keyboard.destroy()
 * </script>
 */
