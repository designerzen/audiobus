import { 
	GAME_PAD_CONNECTED, 
	GAME_PAD_DISCONNECTED,
	BUTTON_P1, 
	BUTTON_P2,
	BUTTON_A, BUTTON_B, BUTTON_X, BUTTON_Y,
	BUTTON_LB, BUTTON_RB, BUTTON_LT, BUTTON_RT, 
	BUTTON_SELECT, BUTTON_START, 
	BUTTON_LEFT_SHOULDER, BUTTON_RIGHT_SHOULDER, 
	DIRECTION_UP, DIRECTION_DOWN, DIRECTION_LEFT, DIRECTION_RIGHT,
	COMMANDS,
	GamePadManager
} from "./gamepad.ts"

/**
 * Start monitoring for global gamepad input
 * but ignore them until we are ready
 * 
 * START will alter the PLAYER INDEX
 * SELECT will alter the 
 * 
 */
export const addGamePadEvents = () => {
	const gamepadHeld:Map<string, number> = new Map()
	const gamePadManager:GamePadManager = new GamePadManager()

	gamePadManager.addEventListener( (button, value, gamePad, heldFor ) => {
		console.info("GAMEPAD:", {button, value, gamePad, heldFor} )
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
		
			default: 
				if (value)
				{
					gamepadHeld.set(button, value)
				}else{
					gamepadHeld.delete(button)
				}
		}
		
		switch(button)
		{
			// This changes the "selected" user by highlighting their outline
			// this then targets the controller for that specfific person.
			
			case COMMANDS.SELECT: 
				console.info("Gamepad select", selectedId, value, { gamePad, gamepadHeld, heldFor } )
				break

			case GAME_PAD_CONNECTED:
				console.info("Gamepad connected", button, value, gamePad )
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

			case GAME_PAD_DISCONNECTED:
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
	})
}

