/**
 * Example: Using Web CLAP Output
 *
 * This example demonstrates how to load and play CLAP plugins
 * in your harmoneasy application.
 */

import OutputCLAP from './output-clap.ts'
import { initializeCLAPRegistry, clapRegistry } from './clap-registry.ts'

/**
 * Setup and initialize CLAP
 */
export async function setupCLAPExample(audioContext: AudioContext): Promise<OutputCLAP> {
	// 1. Initialize the registry (loads from /clap-registry.json)
	console.log('Initializing CLAP registry...')
	await initializeCLAPRegistry()

	// 2. Get available patches
	const patches = clapRegistry.getPatches()
	console.log('Available CLAP patches:', patches)

	// 3. Create CLAP output
	console.log('Creating CLAP output...')
	const clapOutput = new OutputCLAP(audioContext, patches)

	// 4. Connect to audio context
	console.log('Connecting CLAP output...')
	await clapOutput.connect()

	// 5. Load a patch (if available)
	if (patches.length > 0) {
		console.log('Loading first patch:', patches[0].id)
		try {
			await clapOutput.loadPatch(patches[0].id)
		} catch (error) {
			console.warn('Could not load patch:', error)
		}
	}

	return clapOutput
}

/**
 * Example: Play a simple melody
 */
export function playMelody(clapOutput: OutputCLAP): void {
	const notes = [60, 62, 64, 65, 67] // C, D, E, F, G
	const noteDuration = 500 // ms

	notes.forEach((note, index) => {
		const startTime = index * noteDuration
		const endTime = startTime + noteDuration * 0.8

		setTimeout(() => {
			console.log('Playing note:', note)
			clapOutput.noteOn(note, 100)
		}, startTime)

		setTimeout(() => {
			console.log('Stopping note:', note)
			clapOutput.noteOff(note)
		}, endTime)
	})
}

/**
 * Example: Create and display GUI
 */
export async function displayCLAPGUI(clapOutput: OutputCLAP, containerId: string): Promise<void> {
	const container = document.getElementById(containerId)
	if (!container) {
		console.error('Container not found:', containerId)
		return
	}

	// Create GUI
	const gui = await clapOutput.createGui()
	container.appendChild(gui)

	// Optional: Add cleanup button
	const cleanupBtn = document.createElement('button')
	cleanupBtn.textContent = 'Remove CLAP'
	cleanupBtn.style.marginTop = '12px'
	cleanupBtn.addEventListener('click', async () => {
		await clapOutput.destroyGui()
		gui.remove()
		await clapOutput.disconnect()
		clapOutput.dispose()
	})
	container.appendChild(cleanupBtn)
}

/**
 * Example: Search and load specific patch
 */
export async function loadPatchByName(clapOutput: OutputCLAP, patchName: string): Promise<boolean> {
	const patches = clapRegistry.searchPatches(patchName)

	if (patches.length === 0) {
		console.warn('No patches found matching:', patchName)
		return false
	}

	const patch = patches[0]
	console.log('Loading patch:', patch.name)

	try {
		await clapOutput.loadPatch(patch.id)
		return true
	} catch (error) {
		console.error('Failed to load patch:', error)
		return false
	}
}

/**
 * Example: List all patches by category
 */
export function listPatchesByCategory(): void {
	const categories = clapRegistry.getCategories()

	console.group('CLAP Patches by Category')
	for (const category of categories) {
		const patches = clapRegistry.getPatchesByCategory(category)
		console.group(category)
		patches.forEach((patch) => {
			console.log(`  ${patch.name} (${patch.id})`)
			if (patch.description) {
				console.log(`    ${patch.description}`)
			}
		})
		console.groupEnd()
	}
	console.groupEnd()
}

/**
 * Example: Continuous pattern playback
 */
export function playPattern(clapOutput: OutputCLAP, pattern: number[], tempo: number = 120): () => void {
	const msPerBeat = (60000 / tempo) * 0.25 // 16th notes

	let currentIndex = 0
	let intervalId: number | null = null

	function playNext(): void {
		const note = pattern[currentIndex % pattern.length]

		// Note on
		clapOutput.noteOn(note, 100)

		// Note off after duration
		setTimeout(() => {
			clapOutput.noteOff(note)
		}, msPerBeat * 0.8)

		currentIndex++
	}

	// Start playback
	intervalId = window.setInterval(playNext, msPerBeat)

	// Return function to stop playback
	return () => {
		if (intervalId !== null) {
			window.clearInterval(intervalId)
			clapOutput.allNotesOff()
		}
	}
}

/**
 * Example: Complete setup with UI
 */
export async function setupCLAPWithUI(audioContext: AudioContext): Promise<void> {
	try {
		// Create container
		const container = document.createElement('div')
		container.id = 'clap-container'
		container.style.padding = '20px'
		container.style.maxWidth = '600px'
		container.style.margin = '20px auto'
		document.body.appendChild(container)

		// Setup CLAP
		const clapOutput = await setupCLAPExample(audioContext)

		// Display GUI
		await displayCLAPGUI(clapOutput, 'clap-container')

		// Add control buttons
		const buttonContainer = document.createElement('div')
		buttonContainer.style.marginTop = '12px'
		buttonContainer.style.display = 'flex'
		buttonContainer.style.gap = '8px'

		// Play melody button
		const playBtn = document.createElement('button')
		playBtn.textContent = 'Play Melody'
		playBtn.addEventListener('click', () => playMelody(clapOutput))
		buttonContainer.appendChild(playBtn)

		// List patches button
		const listBtn = document.createElement('button')
		listBtn.textContent = 'List Patches'
		listBtn.addEventListener('click', () => listPatchesByCategory())
		buttonContainer.appendChild(listBtn)

		document.getElementById('clap-container')?.appendChild(buttonContainer)

		console.log('CLAP UI setup complete')
	} catch (error) {
		console.error('Failed to setup CLAP UI:', error)
	}
}

// Export for use in other modules
export { OutputCLAP, initializeCLAPRegistry, clapRegistry }
