import type { IAudioOutput } from "./output-interface.ts"

export const ID_VIBRATOR = "Vibrator"

interface Config {
	lowerNote: number // 1-128, lower bound of note range
	upperNote: number // 1-128, upper bound of note range
	duration: number // Vibration duration in milliseconds
	enabled: number // 1 for on, 0 for off
}

const DEFAULT_OPTIONS: Config = {
	lowerNote: 48, // C3
	upperNote: 72, // C5
	duration: 100,
	enabled: 1
}

/**
 * OutputVibrator
 *
 * Triggers device vibration when a note within a range is played.
 * Supports two mechanisms:
 * - navigator.vibrate() for mobile devices
 * - Gamepad API vibrationActuator for game controllers
 */
export default class OutputVibrator extends EventTarget implements IAudioOutput {

	static ID:number = 0

	/**
	 * Check if navigator.vibrate is supported
	 */
	static isVibrateSupported(): boolean {
		if (typeof navigator === 'undefined') {
			return false
		}
		return !!navigator?.vibrate || !!navigator?.webkitVibrate || !!navigator?.mozVibrate
	}

	#uuid:string
	#connected:boolean = false
	private config: Config
	private connectedGamepads: Gamepad[] = []	
	
	get uuid(): string {
		return this.#uuid
	}
	
	get name(): string {
		return 'Vibrator'
	}

	get description(): string {
		return 'Triggers device vibration when a note within a range is played.'
	}
	
	get isConnected(): boolean {
		return this.#connected
	}
	get isHidden(): boolean {
		return false
	}

	constructor(config: Partial<Config> = {}) {
		super()
		this.#uuid = "Output-Vibrator-"+(OutputVibrator.ID++)
		this.config = { ...DEFAULT_OPTIONS, ...config }
		this.setupGamepadListeners()	
	}

	async connect(): Promise<Function> {
		return this.setupGamepadListeners()
	}
	async disconnect(): Promise<void> {
		throw new Error("Method not implemented.")
	}

	hasMidiOutput(): boolean {
		return false
	}
	hasAudioOutput(): boolean {
		return false
	}
	hasAutomationOutput(): boolean {
		return false
	}
	hasMpeOutput(): boolean {
		return false
	}
	hasOscOutput(): boolean {
		return false
	}
	hasSysexOutput(): boolean {
		return false
	}

	/**
	 * Setup gamepad connection listeners
	 */
	private setupGamepadListeners(): void {
		// Check if we're in a browser environment with window object
		if (typeof window === 'undefined') {
			return
		}

		try {
			window.addEventListener('gamepadconnected', (event) => {
				console.debug('[VIBRATOR] Gamepad connected:', event.gamepad.id)
				this.updateConnectedGamepads()
			})

			window.addEventListener('gamepaddisconnected', (event) => {
				console.debug('[VIBRATOR] Gamepad disconnected:', event.gamepad.id)
				this.updateConnectedGamepads()
			})

			this.#connected = true

		} catch (error) {
			console.debug('[VIBRATOR] Gamepad API not available:', error)
		}
	}

	/**
	 * Update the list of connected gamepads
	 */
	private updateConnectedGamepads(): void {
		// Only available in browser environment
		if (typeof navigator === 'undefined') {
			return
		}

		try {
			const gamepads = navigator.getGamepads?.()
			if (gamepads) {
				this.connectedGamepads = Array.from(gamepads).filter((gp) => gp !== null) as Gamepad[]
			}
		} catch (error) {
			console.debug('[VIBRATOR] Failed to get gamepads:', error)
		}
	}
	/**
	 * Check if a note is within the configured range
	 */
	private isNoteInRange(noteNumber:number): boolean {
		// Check if note is within range (convert from 1-128 to 0-127)
		const lowerNoteZeroBased = this.config.lowerNote - 1
		const upperNoteZeroBased = this.config.upperNote - 1
		return noteNumber >= lowerNoteZeroBased && noteNumber <= upperNoteZeroBased
	}



	/**
	 * Trigger vibration through navigator.vibrate (mobile devices)
	 */
	private triggerMobileVibration(duration: number): void {
		if (!OutputVibrator.isVibrateSupported()) {
			return
		}

		try {
			// First clear any existing vibration
			navigator.vibrate?.(0)

			// Then trigger the new vibration pattern
			navigator.vibrate?.(duration)
		} catch (error) {
			console.debug('[VIBRATOR] Mobile vibration failed:', error)
		}
	}

	/**
	 * Trigger vibration on all connected gamepads
	 */
	private triggerGamepadVibration(duration: number): void {
		// Ensure we have the latest gamepad data
		this.updateConnectedGamepads()

		if (this.connectedGamepads.length === 0) {
			return
		}

		try {
			for (const gamepad of this.connectedGamepads) {
				// Check if gamepad has vibration support
				if (!gamepad.vibrationActuator) {
					continue
				}

				// Create vibration pattern: strong rumble then weak for duration
				const vibrationPattern = {
					startDelay: 0,
					duration: duration,
					weakMagnitude: 0.5,
					strongMagnitude: 1.0
				}

				// Trigger the vibration
				gamepad.vibrationActuator?.playEffect?.('dual-rumble', vibrationPattern).catch((error: any) => {
					console.debug('[VIBRATOR] Gamepad vibration failed:', error)
				})
			}
		} catch (error) {
			console.debug('[VIBRATOR] Gamepad vibration error:', error)
		}
	}

	/**
	 * Trigger all available vibration mechanisms
	 */
	private triggerVibration(duration: number): void {
		this.triggerMobileVibration(duration)
		this.triggerGamepadVibration(duration)
	}

	/**
	 * Note On : Trigger vibration if note is within range
	 * @param noteNumber 
	 * @param velocity 
	 * @returns 
	 */
	noteOn(noteNumber: number, velocity: number): void {
		if (!this.config.enabled) {
			return
		}

		if (this.isNoteInRange(noteNumber)) {
			this.triggerVibration(this.config.duration)
		}
	}

	/**
	 * Note Off : Stop vibrating
	 * @param noteNumber 
	 */
	noteOff(noteNumber: number): void {
		// Optionally trigger a short vibration on note off
		// Currently no-op
	}

	/**
	 * 
	 */
	allNotesOff(): void {
		// Clear mobile vibration
		if (this.isVibrateSupported()) {
			try {
				navigator.vibrate?.(0)
			} catch (error) {
				console.debug('[VIBRATOR] Failed to clear mobile vibration:', error)
			}
		}

		// Clear gamepad vibrations
		try {
			this.updateConnectedGamepads()
			for (const gamepad of this.connectedGamepads) {
				if (!gamepad.vibrationActuator) {
					continue
				}

				gamepad.vibrationActuator?.playEffect?.('dual-rumble', {
					startDelay: 0,
					duration: 0,
					weakMagnitude: 0,
					strongMagnitude: 0
				}).catch((error: any) => {
					console.debug('[VIBRATOR] Failed to clear gamepad vibration:', error)
				})
			}
		} catch (error) {
			console.debug('[VIBRATOR] Gamepad clear error:', error)
		}
	}
}
