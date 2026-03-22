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

    static ID: number = 0

    /**
     * Check if navigator.vibrate is supported
     */
    static isVibrateSupported(): boolean {
        if (typeof navigator === 'undefined') {
            return false
        }
        return !!navigator?.vibrate || !!navigator?.webkitVibrate || !!navigator?.mozVibrate
    }

    #uuid: string
    #connected: boolean = false
    private config: Config
    private connectedGamepads: Gamepad[] = []
    #container: HTMLElement | null = null
    #circleIndicator: HTMLElement | null = null

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
        this.#uuid = "Output-Vibrator-" + (OutputVibrator.ID++)
        this.config = { ...DEFAULT_OPTIONS, ...config }
        this.setupGamepadListeners()
    }

    async connect(): Promise<Function> {
        this.#connected = true
        return this.setupGamepadListeners()
    }
    async disconnect(): Promise<void> {
        this.#connected = false
        this.allNotesOff()
    }

    /**
     * Create GUI showing device status and vibration indicator
     */
    async createGui(): Promise<HTMLElement> {
        this.#container = document.createElement("div")
        this.#container.id = this.#uuid
        this.#container.style.padding = "12px"
        this.#container.style.borderRadius = "4px"
        this.#container.style.backgroundColor = "#1a1a1a"
        this.#container.style.color = "#fff"
        this.#container.style.fontFamily = "system-ui, -apple-system, sans-serif"
        this.#container.style.fontSize = "12px"
        this.#container.style.minHeight = "80px"
        this.#container.style.display = "flex"
        this.#container.style.flexDirection = "column"
        this.#container.style.gap = "12px"

        // Device info section
        const infoSection = document.createElement("div")
        infoSection.style.display = "flex"
        infoSection.style.flexDirection = "column"
        infoSection.style.gap = "6px"

        // Available devices header
        const availableLabel = document.createElement("div")
        availableLabel.style.fontSize = "11px"
        availableLabel.style.opacity = "0.7"
        availableLabel.style.textTransform = "uppercase"
        availableLabel.style.letterSpacing = "0.5px"
        availableLabel.textContent = "Available Devices"

        // Device list
        const deviceList = document.createElement("div")
        deviceList.id = `${this.#uuid}-devices`
        deviceList.style.display = "flex"
        deviceList.style.flexWrap = "wrap"
        deviceList.style.gap = "6px"

        const hasMobileVibrate = OutputVibrator.isVibrateSupported()
        if (hasMobileVibrate) {
            const badge = document.createElement("span")
            badge.style.padding = "4px 8px"
            badge.style.backgroundColor = "#4CAF50"
            badge.style.borderRadius = "3px"
            badge.style.fontSize = "11px"
            badge.style.fontWeight = "500"
            badge.textContent = "📱 Mobile"
            deviceList.appendChild(badge)
        }

        // Gamepad status
        this.updateConnectedGamepads()
        if (this.connectedGamepads.length > 0) {
            this.connectedGamepads.forEach((gamepad, index) => {
                const badge = document.createElement("span")
                badge.style.padding = "4px 8px"
                badge.style.backgroundColor = "#2196F3"
                badge.style.borderRadius = "3px"
                badge.style.fontSize = "11px"
                badge.style.fontWeight = "500"
                const hasVibration = gamepad.vibrationActuator ? "✓" : "✗"
                badge.textContent = `🎮 ${gamepad.id.substring(0, 20)}... ${hasVibration}`
                deviceList.appendChild(badge)
            })
        }

        if (deviceList.children.length === 0) {
            const noDevices = document.createElement("span")
            noDevices.style.color = "#999"
            noDevices.style.fontSize = "11px"
            noDevices.style.fontStyle = "italic"
            noDevices.textContent = "No vibration devices detected"
            deviceList.appendChild(noDevices)
        }

        infoSection.appendChild(availableLabel)
        infoSection.appendChild(deviceList)

        // Vibration indicator section
        const indicatorSection = document.createElement("div")
        indicatorSection.style.display = "flex"
        indicatorSection.style.alignItems = "center"
        indicatorSection.style.justifyContent = "space-between"
        indicatorSection.style.gap = "12px"

        const indicatorLabel = document.createElement("div")
        indicatorLabel.style.fontSize = "11px"
        indicatorLabel.style.opacity = "0.7"
        indicatorLabel.style.textTransform = "uppercase"
        indicatorLabel.style.letterSpacing = "0.5px"
        indicatorLabel.textContent = "Vibration"

        const circleContainer = document.createElement("div")
        circleContainer.style.display = "flex"
        circleContainer.style.alignItems = "center"
        circleContainer.style.justifyContent = "center"
        circleContainer.style.width = "40px"
        circleContainer.style.height = "40px"
        circleContainer.style.position = "relative"

        this.#circleIndicator = document.createElement("div")
        this.#circleIndicator.id = `${this.#uuid}-circle`
        this.#circleIndicator.style.width = "20px"
        this.#circleIndicator.style.height = "20px"
        this.#circleIndicator.style.borderRadius = "50%"
        this.#circleIndicator.style.backgroundColor = "#FF6B6B"
        this.#circleIndicator.style.transition = "transform 0.1s ease-out"
        this.#circleIndicator.style.boxShadow = "0 0 10px rgba(255, 107, 107, 0.5)"
        this.#circleIndicator.style.opacity = "0.6"

        circleContainer.appendChild(this.#circleIndicator)

        const testButton = document.createElement("button")
        testButton.type = "button"
        testButton.textContent = "Test"
        testButton.style.padding = "6px 12px"
        testButton.style.backgroundColor = "#FF6B6B"
        testButton.style.color = "#fff"
        testButton.style.border = "none"
        testButton.style.borderRadius = "3px"
        testButton.style.fontSize = "11px"
        testButton.style.fontWeight = "600"
        testButton.style.cursor = "pointer"
        testButton.style.transition = "background-color 0.2s"
        testButton.onmouseover = () => {
            testButton.style.backgroundColor = "#ff5252"
        }
        testButton.onmouseout = () => {
            testButton.style.backgroundColor = "#FF6B6B"
        }
        testButton.onclick = () => {
            this.triggerVibration(this.config.duration)
        }

        indicatorSection.appendChild(indicatorLabel)
        indicatorSection.appendChild(circleContainer)
        indicatorSection.appendChild(testButton)

        this.#container.appendChild(infoSection)
        this.#container.appendChild(indicatorSection)

        // Add styles for animation
        if (!document.getElementById(`${this.#uuid}-animation-styles`)) {
            const style = document.createElement("style")
            style.id = `${this.#uuid}-animation-styles`
            style.textContent = `
				@keyframes vibration-expand {
					0% { transform: scale(1); opacity: 0.8; }
					100% { transform: scale(2.5); opacity: 0; }
				}
				@keyframes vibration-pulse {
					0% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 10px rgba(255, 107, 107, 0.5); }
					50% { opacity: 0.6; }
					100% { transform: scale(1); opacity: 0.6; box-shadow: 0 0 10px rgba(255, 107, 107, 0.5); }
				}
				.vibrator-animating {
					animation: vibration-expand 0.4s ease-out !important;
				}
				.vibrator-idle {
					animation: vibration-pulse 2s ease-in-out infinite !important;
				}
			`
            document.head.appendChild(style)
        }

        return this.#container
    }

    /**
     * Destroy GUI container
     */
    async destroyGui(): Promise<void> {
        if (this.#container && this.#container.parentElement) {
            this.#container.parentElement.removeChild(this.#container)
        }
        this.#container = null
        this.#circleIndicator = null
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
    private isNoteInRange(noteNumber: number): boolean {
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
    triggerVibration(duration: number): void {
        this.triggerMobileVibration(duration)
        this.triggerGamepadVibration(duration)
        this.#triggerCircleAnimation()
    }

    /**
     * Trigger the circle expansion animation
     */
    #triggerCircleAnimation(): void {
        if (!this.#circleIndicator) return

        // Remove animation classes
        this.#circleIndicator.classList.remove('vibrator-animating', 'vibrator-idle')

        // Trigger reflow to restart animation
        void this.#circleIndicator.offsetWidth

        // Add animating class
        this.#circleIndicator.classList.add('vibrator-animating')

        // After animation completes, return to idle pulse
        setTimeout(() => {
            if (this.#circleIndicator) {
                this.#circleIndicator.classList.remove('vibrator-animating')
                this.#circleIndicator.classList.add('vibrator-idle')
            }
        }, 400)
    }

    /**
     * Note On : Trigger vibration if note is within range
     * @param noteNumber 
     * @param velocity 
     * @returns 
     */
    noteOn(noteNumber: number, _velocity?: number): void {
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
