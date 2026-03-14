/**
 * This is a keyboard adapter
 * that takes key presses and releases
 * and dispatches events with the AudioCommand
 * as the VO that gets passed through the system
 * and one AudioCommand can be created here
 * then piped into the TransformManager for example
 */

import { NOTE_OFF, NOTE_ON } from '../../commands'
import { COMMANDS, GAME_PAD_CONNECTED, GAME_PAD_DISCONNECTED, GamePadManager } from "../../hardware/gamepad/gamepad"
import AudioCommand from "../../audio-command"
import AbstractInput from "./abstract-input"
import GamepadVisualizerComponent from "../../ui/GamepadVisualizerComponent"
import type { IAudioInput } from "./input-interface"

export const GAMEPAD_INPUT_ID = "GamePad"

export default class InputGamePad extends AbstractInput implements IAudioInput {

	gamePadManager: GamePadManager
	gamepadHeld:Map<string, number> = new Map()
	#visualizer: GamepadVisualizerComponent | null = null
	#isConnected: boolean = false
	#animFrameId: number | null = null
	#checkConnectionIntervalId: number | null = null
		
	get name():string {
		return GAMEPAD_INPUT_ID
	}

	get description():string {
		return "Gamepad"
	}

	constructor(options: Record<string, any> = {}) { 
		super(options)

		this.onGamePadEvent = this.onGamePadEvent.bind(this)
		this.gamePadManager = new GamePadManager()
		this.gamePadManager.addEventListener( this.onGamePadEvent )
		this.setAsConnected()
	}

	async createGui(): Promise<HTMLElement> {
		this.#visualizer = new GamepadVisualizerComponent()
		const container = this.#visualizer.createContainer()

		// Start monitoring for connections and animate visuals
		this.startConnectionMonitoring()

		return container
	}

	private startConnectionMonitoring(): void {
		this.#checkConnectionIntervalId = window.setInterval(() => {
			const hasAnyConnected = Array.from(this.gamePadManager.controllers.values()).some(
				(pad) => pad.connected
			)

			if (hasAnyConnected && !this.#isConnected) {
				this.#isConnected = true
				this.#visualizer?.createGamepadSVG()
				this.startSticksUpdateLoop()
			} else if (!hasAnyConnected && this.#isConnected) {
				this.#isConnected = false
				if (this.#animFrameId !== null) {
					cancelAnimationFrame(this.#animFrameId)
					this.#animFrameId = null
				}
				this.#visualizer?.showPlaceholder()
			}
		}, 500)
	}

	private startSticksUpdateLoop(): void {
		const updateSticks = () => {
			let hasConnectedPad = false
			this.gamePadManager.controllers.forEach((pad) => {
				if (pad.connected) {
					hasConnectedPad = true
					this.#visualizer?.updateStickPosition("left", pad.leftstickX, pad.leftstickY)
					this.#visualizer?.updateStickPosition("right", pad.rightstickX, pad.rightstickY)
				}
			})

			if (hasConnectedPad) {
				this.#animFrameId = requestAnimationFrame(updateSticks)
			} else {
				this.#animFrameId = null
			}
		}

		this.#animFrameId = requestAnimationFrame(updateSticks)
	}

	async destroyGui(): Promise<void> {
		if (this.#checkConnectionIntervalId !== null) {
			clearInterval(this.#checkConnectionIntervalId)
		}
		if (this.#animFrameId !== null) {
			cancelAnimationFrame(this.#animFrameId)
		}
		this.#visualizer?.destroy()
	}

	/**
	 * Remove any connections
	 */
	override destroy(): void {
		if (this.#checkConnectionIntervalId !== null) {
			clearInterval(this.#checkConnectionIntervalId)
		}
		if (this.#animFrameId !== null) {
			cancelAnimationFrame(this.#animFrameId)
		}
		this.#visualizer?.destroy()
		this.gamePadManager.removeEventListener( this.onGamePadEvent )
		this.gamePadManager.destroy()
		this.gamepadHeld.clear()
		this.setAsDisconnected()
	}

	/**
	 * FIXME: Add in ability for multile gamepads
	 * Game pad state has updated - have buttons been mashed?
	 * @param button 
	 * @param value 
	 * @param gamePad 
	 * @param heldFor 
	 */
	protected onGamePadEvent( button: string, value: number, gamePad: Gamepad, heldFor: number ) {
		
		// Update visual representation
		this.#visualizer?.updateButtonVisual(button, value > 0)

		const isHeld = this.gamePadManager.isHeld(button)

		const command = new AudioCommand()
		command.value = value
		command.from = GAMEPAD_INPUT_ID + gamePad.id
		command.text = button
		command.time = this.now // ?? gamePad.timestamp // FIXME:
		command.startAt = this.now // ?? gamePad.timestamp

		switch(button)
		{
			// ignore caching these
			case GAME_PAD_CONNECTED:
			case GAME_PAD_DISCONNECTED:
			case COMMANDS.LEFT_STICK_Y: 
			case COMMANDS.LEFT_STICK_X: 
			case COMMANDS.RIGHT_STICK_Y: 
			case COMMANDS.RIGHT_STICK_X:
			// case COMMANDS.UP: 
			// case COMMANDS.DOWN: 
			// case COMMANDS.LEFT: 
			// case COMMANDS.RIGHT: 
				break
		
			// we want to preserve the state of certain buttons
			default: 
				if (value)
				{
					this.gamepadHeld.set(button, value)
				}else{
					this.gamepadHeld.delete(button)
				}
				command.type = isHeld ? NOTE_ON : NOTE_OFF
		}

		
		switch(button)
		{
			case COMMANDS.SELECT: 
				console.info("Gamepad select", value, { gamePad, heldFor } )
				break

			case GAME_PAD_CONNECTED:
				console.info("Gamepad connected", button, value, gamePad )
				break

			case GAME_PAD_DISCONNECTED:
				break
			// case COMMANDS.LEFT_STICK_Y: 
			// case COMMANDS.RIGHT_STICK_Y: 
				

			// case COMMANDS.LEFT_STICK_X: 
			// case COMMANDS.RIGHT_STICK_X:
			// 	person.loadPreviousInstrument()
			// 	break

			case COMMANDS.UP: 
				
				break
			
			case COMMANDS.DOWN: 
					
				break

			case COMMANDS.LEFT: 
				
				break

			case COMMANDS.RIGHT: 
				
				break

		

			case COMMANDS.START: 
				break
						
			case COMMANDS.A: 
				break
			
			case COMMANDS.B: 
				break
			
			case COMMANDS.X: 
				break
			
			case COMMANDS.Y: 
				
				break
			
			// If we are in a certain mode...
			// adapt 
			case COMMANDS.LB: 
				break

			case COMMANDS.RB: 
				break

			case COMMANDS.LT: 
				break

			case COMMANDS.RT: 
				break

			default:
				console.info("Gamepad", { gamePadManager, button, value, gamePad, heldFor } )
		}

		console.log("Input::Gamepad onGamePadEvent", command )
		
		this.dispatch( command )
	}
}




