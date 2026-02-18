import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { Transformer } from "./abstract-transformer.ts"
import * as Commands from '../../commands'

import type { IAudioCommand } from "../../audio-command-interface.ts"
import type Timer from "../../timing/timer.ts"
import type { ITransformer } from "./interface-transformer.ts"

export const ID_VIBRATOR = "Vibrator"

interface Config {
    lowerNote: number // 1-128, lower bound of note range
    upperNote: number // 1-128, upper bound of note range
    channel: string // Channel number or 'ALL'
    duration: number // Vibration duration in milliseconds
    enabled: number // 1 for on, 0 for off
}

const DEFAULT_OPTIONS: Config = {
    lowerNote: 48, // C3
    upperNote: 72, // C5
    channel: 'ALL',
    duration: 100,
    enabled: 1
}

/**
 * Vibrator Transformer
 *
 * Triggers device vibration when a note within a range is played.
 * Supports two mechanisms:
 * - navigator.vibrate() for mobile devices
 * - Gamepad API vibrationActuator for game controllers
 */
export class TransformerVibrator extends Transformer<Config> implements ITransformer {

    protected type = ID_VIBRATOR
    category = TRANSFORMER_CATEGORY_TIMING
    
    // Cache connected gamepads
    private connectedGamepads: Gamepad[] = []

    get name(): string {
        return 'Vibrator'
    }

    get fields() {
        // Generate options for note selection (1-128)
        const noteOptions = Array.from({ length: 128 }, (_, i) => {
            const noteNum = i + 1
            let noteName = ''
            const octave = Math.floor(i / 12)
            const noteInOctave = i % 12
            const noteLetters = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            noteName = `${noteLetters[noteInOctave]}${octave}`
            return {
                name: `${noteNum} (${noteName})`,
                value: noteNum
            }
        })

        // Generate channel options (1-16 plus ALL)
        const channelOptions = Array.from({ length: 16 }, (_, i) => ({
            name: `Channel ${i + 1}`,
            value: `${i + 1}`
        }))
        channelOptions.unshift({ name: 'All Channels', value: 'ALL' })

        return [
            {
                name: 'enabled',
                type: 'select',
                enabled: true,
                values: [
                    { name: 'On', value: 1 },
                    { name: 'Off', value: 0 }
                ],
                default: DEFAULT_OPTIONS.enabled
            },
            {
                name: 'lowerNote',
                type: 'select',
                enabled: true,
                values: noteOptions,
                default: DEFAULT_OPTIONS.lowerNote
            },
            {
                name: 'upperNote',
                type: 'select',
                enabled: true,
                values: noteOptions,
                default: DEFAULT_OPTIONS.upperNote
            },
            {
                name: 'channel',
                type: 'select',
                enabled: true,
                values: channelOptions,
                default: DEFAULT_OPTIONS.channel
            },
            {
                name: 'duration',
                type: 'select',
                enabled: true,
                values: [
                    { name: '50ms', value: 50 },
                    { name: '100ms', value: 100 },
                    { name: '150ms', value: 150 },
                    { name: '200ms', value: 200 },
                    { name: '300ms', value: 300 },
                    { name: '500ms', value: 500 }
                ],
                default: DEFAULT_OPTIONS.duration
            }
        ]
    }

    get description(): string {
        return "Trigger device vibration (mobile or gamepad) when a note within the specified range is played"
    }

    constructor(config: Partial<Config> = {}) {
        super({ ...DEFAULT_OPTIONS, ...config })
        this.setupGamepadListeners()
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
     * Check if navigator.vibrate is supported
     */
    private isVibrateSupported(): boolean {
        if (typeof navigator === 'undefined') {
            return false
        }
        return !!navigator?.vibrate || !!navigator?.webkitVibrate || !!navigator?.mozVibrate
    }

    /**
     * Trigger vibration through navigator.vibrate (mobile devices)
     */
    private triggerMobileVibration(duration: number): void {
        if (!this.isVibrateSupported()) {
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
     * Check if a command matches the trigger conditions
     */
    private shouldTriggerVibration(command: IAudioCommand): boolean {
        // Only trigger on NOTE_ON
        if (command.type !== Commands.NOTE_ON) {
            return false
        }

        // Check if note is within range (convert from 1-128 to 0-127)
        const lowerNoteZeroBased = this.config.lowerNote - 1
        const upperNoteZeroBased = this.config.upperNote - 1
        if (command.number < lowerNoteZeroBased || command.number > upperNoteZeroBased) {
            return false
        }

        // Check channel
        if (this.config.channel !== 'ALL') {
            const targetChannel = parseInt(this.config.channel, 10)
            if (command.channel !== targetChannel) {
                return false
            }
        }

        return true
    }

    transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {

        if (!this.config.enabled || commands.length === 0) {
            return commands
        }

        // Process each command and trigger vibration if conditions are met
        for (const command of commands) {
            if (this.shouldTriggerVibration(command)) {
                this.triggerVibration(this.config.duration)
                break // Only trigger once per transform call
            }
        }

        // Pass through all commands unchanged
        return commands
    }

    /**
     * Reset vibrator state
     */
    reset(): void {
        // Clear mobile vibration
        if (this.isVibrateSupported()) {
            try {
                navigator.vibrate?.(0)
            } catch (error) {
                console.debug('[VIBRATOR] Failed to clear mobile vibration on reset:', error)
            }
        }
        
        // Clear gamepad vibrations
        try {
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
                    console.debug('[VIBRATOR] Failed to clear gamepad vibration on reset:', error)
                })
            }
        } catch (error) {
            console.debug('[VIBRATOR] Gamepad reset error:', error)
        }
    }
}




