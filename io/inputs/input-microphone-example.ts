/**
 * Example: Integrating Microphone Input into HarmonEasy
 * 
 * This file demonstrates how to use InputMicrophoneFormant
 * in your application
 */

import InputMicrophoneFormant from "./input-microphone-formant.ts"
import InputManager from "./input-manager.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

/**
 * Example 1: Basic microphone input setup
 */
export async function setupBasicMicrophoneInput(inputManager: InputManager) {
	const micInput = new InputMicrophoneFormant()
	inputManager.add(micInput)
	
	try {
		await micInput.connect()
		console.log("Microphone input ready")
	} catch (error) {
		console.error("Failed to initialize microphone:", error)
	}
}

/**
 * Example 2: Sensitive vocal detection
 * Optimized for singing/vocal input
 */
export async function setupVocalInput(inputManager: InputManager) {
	const vocalInput = new InputMicrophoneFormant({
		smoothing: 0.85,
		minFrequency: 80,        // Low soprano
		maxFrequency: 1000,      // High soprano/tenor
		confidenceThreshold: 0.85,
		analyzeInterval: 40,     // Slightly faster for vocal responsiveness
		fftSize: 4096            // Better frequency resolution
	})
	
	inputManager.add(vocalInput)
	await vocalInput.connect()
	
	return vocalInput
}

/**
 * Example 3: Instrument detection
 * Optimized for melodic instruments (flute, saxophone, violin, etc.)
 */
export async function setupInstrumentInput(inputManager: InputManager) {
	const instrumentInput = new InputMicrophoneFormant({
		smoothing: 0.8,
		minFrequency: 60,        // Low notes
		maxFrequency: 2000,      // Extended range
		confidenceThreshold: 0.8,
		analyzeInterval: 50,     // Standard interval
		fftSize: 4096
	})
	
	inputManager.add(instrumentInput)
	await vocalInput.connect()
	
	return instrumentInput
}

/**
 * Example 4: Low-latency mode
 * For real-time performance (gaming, live interaction)
 */
export async function setupLowLatencyInput(inputManager: InputManager) {
	const lowLatencyInput = new InputMicrophoneFormant({
		smoothing: 0.7,
		minFrequency: 100,
		maxFrequency: 1200,
		confidenceThreshold: 0.75,
		analyzeInterval: 30,     // More frequent checks
		fftSize: 2048            // Smaller window = lower latency
	})
	
	inputManager.add(lowLatencyInput)
	await lowLatencyInput.connect()
	
	return lowLatencyInput
}

/**
 * Example 5: High-accuracy mode
 * For studio/precision recording
 */
export async function setupHighAccuracyInput(inputManager: InputManager) {
	const accurateInput = new InputMicrophoneFormant({
		smoothing: 0.9,
		minFrequency: 50,
		maxFrequency: 3000,      // Extended range
		confidenceThreshold: 0.92,
		analyzeInterval: 100,    // Slower but more stable
		fftSize: 8192            // Better frequency resolution
	})
	
	inputManager.add(accurateInput)
	await accurateInput.connect()
	
	return accurateInput
}

/**
 * Example 6: Monitor microphone events
 */
export function monitorMicrophoneEvents(inputManager: InputManager) {
	inputManager.addEventListener("inputEvent", (event: any) => {
		const command: IAudioCommand = event.command
		
		switch (command.subtype) {
			case "noteOn":
				console.log(`🎵 Note On: #${command.noteNumber} Velocity: ${command.velocity}`)
				// Update UI, trigger synth, etc.
				break
				
			case "noteOff":
				console.log(`🔇 Note Off: #${command.noteNumber}`)
				// Stop synth, update UI, etc.
				break
				
			case "pitchBend":
				const cents = ((command.value - 8192) / 8192) * 100
				console.log(`🎚️  Pitch Bend: ${cents.toFixed(1)} cents`)
				// Fine-tune pitch in real-time
				break
		}
	})
}

/**
 * Example 7: Create a UI controller for microphone input
 */
export function createMicrophoneController(micInput: InputMicrophoneFormant) {
	const container = document.createElement("div")
	container.style.cssText = `
		padding: 16px;
		border: 2px solid #0088ff;
		border-radius: 8px;
		background: rgba(0, 136, 255, 0.1);
		font-family: monospace;
	`
	
	// Status indicator
	const statusDiv = document.createElement("div")
	statusDiv.innerHTML = `
		<strong>🎤 Microphone Input</strong>
		<p>Status: <span id="mic-status">${micInput.isListening ? "🟢 Listening" : "🔴 Idle"}</span></p>
		<button id="mic-toggle">Stop Listening</button>
		<hr>
		<p>Last Note: <span id="last-note">-</span></p>
		<p>Confidence: <span id="confidence">-</span></p>
	`
	container.appendChild(statusDiv)
	
	// Event listeners
	const toggleBtn = container.querySelector("#mic-toggle") as HTMLButtonElement
	let isListening = micInput.isListening
	
	toggleBtn.onclick = async () => {
		if (isListening) {
			await micInput.disconnect()
			isListening = false
		} else {
			await micInput.connect()
			isListening = true
		}
		toggleBtn.textContent = isListening ? "Stop Listening" : "Start Listening"
	}
	
	// Update on note events
	micInput.addEventListener("inputEvent", (event: any) => {
		const cmd = event.command
		const noteDiv = container.querySelector("#last-note") as HTMLElement
		const confDiv = container.querySelector("#confidence") as HTMLElement
		
		if (cmd.subtype === "noteOn") {
			noteDiv.textContent = `${cmd.noteNumber}`
			confDiv.textContent = `${((cmd.velocity / 127) * 100).toFixed(1)}%`
		}
	})
	
	return container
}

/**
 * Example 8: Complete setup with all features
 */
export async function setupCompleteExample() {
	// Create input manager
	const inputManager = new InputManager()
	
	// Setup microphone input with vocal settings
	const micInput = new InputMicrophoneFormant({
		smoothing: 0.85,
		minFrequency: 100,
		maxFrequency: 1200,
		confidenceThreshold: 0.85,
		analyzeInterval: 40,
		fftSize: 4096
	})
	
	inputManager.add(micInput)
	
	try {
		// Request microphone access and start listening
		await micInput.connect()
		
		// Monitor events
		inputManager.addEventListener("inputEvent", (event: any) => {
			const cmd = event.command
			console.log(`Input: ${cmd.from} → ${cmd.subtype}`, {
				note: cmd.noteNumber,
				velocity: cmd.velocity,
				time: cmd.time
			})
		})
		
		// Create UI controller
		const controller = createMicrophoneController(micInput)
		document.body.appendChild(controller)
		
		console.log("✅ Microphone input setup complete")
		return { inputManager, micInput }
		
	} catch (error) {
		console.error("❌ Setup failed:", error)
		throw error
	}
}

// Auto-run if imported as module
if (import.meta.hot) {
	// Hot module replacement ready
}
