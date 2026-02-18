const now = () => performance.now ?? Date.now() * 1000
export const getGamePads = () => navigator.getGamepads() || navigator.webkitGetGamepads() 

export const fetchGamePads = () => {

	const gamepads = getGamePads()
	for (let i = 0; i < gamepads.length; i++) 
	{
		console.log("Gamepad " + i + ":")

		if (gamepads[i] === null) 
		{
			console.log("[null]")
			continue
		}

		if (!gamepads[i].connected) 
		{
			console.log("[disconnected]")
			continue
		}

		console.log("    Index: " + gamepads[i].index)
		console.log("    ID: " + gamepads[i].id)
		console.log("    Axes: " + gamepads[i].axes.length)
		console.log("    Buttons: " + gamepads[i].buttons.length)
		console.log("    Mapping: " + gamepads[i].mapping)
	}
	return gamepads
}

export const GAME_PAD_AVAILBLE = "game-pad-available"
export const GAME_PAD_UNPLUGGED = "game-pad-unplugged"

export const BUTTON_P1 = "p1"
export const BUTTON_P2 = "p2"

export const BUTTON_A = "a"
export const BUTTON_B = "b"
export const BUTTON_X = "x"
export const BUTTON_Y = "y"

export const BUTTON_LB = "lb"
export const BUTTON_RB = "rb"
export const BUTTON_LT = "lt"
export const BUTTON_RT = "rt"

export const BUTTON_SELECT = "select"
export const BUTTON_START = "start"

export const BUTTON_LEFT_SHOULDER = "ls"
export const BUTTON_RIGHT_SHOULDER = "rs"

export const DIRECTION_UP = "dup"
export const DIRECTION_DOWN = "ddown"
export const DIRECTION_LEFT = "dleft"		
export const DIRECTION_RIGHT = "dright"

export const DIRECTION_LEFT_STICK_Y = "leftstickY"
export const DIRECTION_LEFT_STICK_X = "leftstickX"
export const DIRECTION_RIGHT_STICK_Y = "rightstickY"
export const DIRECTION_RIGHT_STICK_X = "rightstickX"

export const COMMANDS = {
	P1: BUTTON_P1,
	P2: BUTTON_P2,
	A: BUTTON_A,
	B: BUTTON_B,
	X: BUTTON_X,
	Y: BUTTON_Y,
	LB: BUTTON_LB,
	RB: BUTTON_RB,
	LT: BUTTON_LT,
	RT: BUTTON_RT,
	SELECT: BUTTON_SELECT,
	START: BUTTON_START,
	LEFT_SHOULDER: BUTTON_LEFT_SHOULDER,
	RIGHT_SHOULDER: BUTTON_RIGHT_SHOULDER,
	UP: DIRECTION_UP,
	DOWN: DIRECTION_DOWN,
	LEFT: DIRECTION_LEFT,
	RIGHT: DIRECTION_RIGHT,
	LEFT_STICK_Y: DIRECTION_LEFT_STICK_Y,
	LEFT_STICK_X: DIRECTION_LEFT_STICK_X,
	RIGHT_STICK_Y: DIRECTION_RIGHT_STICK_Y,	
	RIGHT_STICK_X: DIRECTION_RIGHT_STICK_X
}

// Gamepad reference IDs
const BUTTON_NAMES = [
	BUTTON_P1,
	BUTTON_P2,
	BUTTON_A,
	BUTTON_B,
	BUTTON_X,
	BUTTON_Y,
	BUTTON_LB,
	BUTTON_RB,
	BUTTON_LT,
	BUTTON_RT,
	BUTTON_SELECT,
	BUTTON_START, 
	BUTTON_LEFT_SHOULDER, 
	BUTTON_RIGHT_SHOULDER, 
	DIRECTION_UP, 
	DIRECTION_DOWN, 
	DIRECTION_LEFT,	
	DIRECTION_RIGHT
]

// Gamepad reference IDs
// const BUTTON_NAMES = [
// 	"a",
// 	"b",
// 	"x",
// 	"y",
// 	"lb",
// 	"rb",
// 	"lt",
// 	"rt",
// 	"select",
// 	"start", 
// 	"ls", 
// 	"rs", 
// 	"dup", 
// 	"ddown", 
// 	"dleft", 
// 	"dright"
// ]

const BUTTON_QUANTITY = BUTTON_NAMES.length

export default class GamePad {

	index = -1
	connectionIndex = -1
	gamePadIndex = -1
	gamepad = null	// just a cache of the last state
	available = false
	connected = false

	// joystick angle
	leftstickX = 0
	leftstickY = 0
	rightstickX = 0
	rightstickY = 0

	// button states
	p1 = false
	p2 = false

	a = false
	b = false
	x = false
	y = false
	rb = false
	lb = false
	rt = false
	lt = false
	rs = false
	ls = false

	start = false
	select = false

	dup = false
	ddown = false
	dleft = false
	dright = false

	standardMapping = false

	watcher = null

	pressedAt = new Map()

    constructor( gamePadId=0, connectionIndex=-1 ) {
		this.connected = false
		this.gamePadIndex = gamePadId
		this.connectionIndex = connectionIndex	
    }

	// getButton(name){
	// 	return this.buttonLibrary.get(name)
	// }
	
	on( callback ) {
		this.watcher = callback
	}

	dispatch( key:string, value:string ){
		this.watcher && this.watcher(key, value)
	}
	
	/**
	 * Connect to this gamepad
	 * @param {Event} event 
	 */
    connect(event) {
		const gamepad = event.originalEvent ? event.originalEvent.gamepad : event.gamepad
		
		this.connected = true
		this.gamepad = gamepad
		this.index = gamepad.index

		this.standardMapping = gamepad.mapping === "standard"

		// BUTTON_NAMES.forEach( (button,index) => {
		// 	this.buttonLibrary.set( button, this.buttons[index] )
		// })
	
		// this.update()
		this.dispatch(GAME_PAD_AVAILBLE, this.toString() )
    }
    
	/**
	 * Disconnect from this gamepad
	 * @param {Event} event 
	 */
    disconnect(event) {
		// const gamepad = event.originalEvent ? event.originalEvent.gamepad : event.gamepad
		this.connected = false
		this.available = false
		this.gamepad = null
		this.dispatch( GAME_PAD_UNPLUGGED, this.toString() )
    }

	/**
	 * Make the gamepad vibrate!
	 * 
	 * @param {Number} value 
	 * @param {Number} duration 
	 * @param {Number} hapticIndex 
	 */
	vibrate(value=1, duration=200, hapticIndex=0 ){
		if (this.gamepad)
		{
			this.gamepad.hapticActuators[hapticIndex].pulse(value, duration)
		}
	}

	/**
	 * 
	 * @param {String} type 
	 * @param {Number} startDelay 
	 * @param {Number} duration 
	 * @param {Number} weakMagnitude 
	 * @param {Number} strongMagnitude 
	 */
	playEffect(type="dual-rumble", startDelay=0, duration=1000, weakMagnitude=1.0, strongMagnitude=1.0 ){
		if (this.gamepad)
		{
			this.gamepad.vibrationActuator.playEffect(type, {
				startDelay,
				duration,
				weakMagnitude,
				strongMagnitude
			})
		}
	}

	/**
	 * Check if changed and send out event if so
	 * 
	 * @param {Class} gamepad 
	 * @param {} button 
	 * @param {Number} buttonIndex 
	 */
	setBoolean( newValue, button, dispatchEvent=true ){
	 
		const oldValue = this[button] 
		let elapsed = -1
		
		if (oldValue === false && newValue === true)
		{
			// ON
			this.pressedAt.set( button, now() )
		}else if (oldValue === true && newValue === false)
		{
			// OFF
			elapsed = now() - this.pressedAt.get( button )
			this.pressedAt.delete( button )
		}

		// TOGGLE
		if (oldValue !== newValue)
		{
			this[button] = newValue
			if (dispatchEvent)
			{
				this.dispatch(button, newValue, elapsed)
			}

			// }else{
			// not changed
			// console.log( buttonIndex, "unchanged gamepad data", gamepad, button, this[button], newValue )
		}
	}

	/**
	 * 
	 * @param {String} key 
	 * @param {String|Number} value 
	 */
	setStickPosition(key, value){
		if (!this.available)
		{	
			// dont't dispatch if first grep
			this[key] = value
			this.available = true
			
		} else if (this[key] !== value) {

			this[key] = value
			this.dispatch(key, value)
		}
	}

	/**
	 * Set all joystick positions
	 */
	setAllStickPositions(){

		this.setStickPosition("leftstickX", this.gamepad.axes[0])
		this.setStickPosition("leftstickY", this.gamepad.axes[1])
		this.setStickPosition("rightstickX", this.gamepad.axes[2])
		this.setStickPosition("rightstickY", this.gamepad.axes[3])

		// this.leftstickX = this.gamepad.axes[0]
		// this.leftstickY = this.gamepad.axes[1]
		// this.rightstickX = this.gamepad.axes[2]
		// this.rightstickY = this.gamepad.axes[3]
	}
    
	/**
	 * Update the gamepad state
	 */
    update() {
		
		// NB. *always* fetch the pads to get their latest state
		const gamepads = getGamePads()
		
    	if (this.available && this.connected) 
		{
			// console.log( "Updating gamepad data",this.gamepad, this)
			this.setAllStickPositions()
		
			const gamepad = gamepads[this.index]

			for (let i = 0; i < BUTTON_QUANTITY; ++i) 
			{
				
				// const gamepadButton = this.gamepad.buttons[i]
				const gamepadButton = gamepad.buttons[i]
				const newValue = gamepadButton.pressed

				// if (newValue){
				// 	console.error("gamepadButton",  this.gamepad.buttons[i].pressed,  getGamePads()[this.index].buttons[i].pressed, this.index )
				// 	// console.info("gamepadButton", gamepadButton, this.gamepad, navigator.getGamepads()[this.buttonIndex] )
				// } 
				this.setBoolean( newValue, BUTTON_NAMES[i] )
			}

			//BUTTON_NAMES.forEach( (button, i) => this.setBoolean( this.gamepad, button, i) )
			// this.setBoolean( gamepad, "a", 0)
			// this.setBoolean( gamepad, "b", 1)
			// this.setBoolean( gamepad, "x", 2)
			// this.setBoolean( gamepad, "y", 3)
			// this.setBoolean( gamepad, "lb", 4)
			// this.setBoolean( gamepad, "rb", 5)
			// this.setBoolean( gamepad, "lt", 6)
			// this.setBoolean( gamepad, "rt", 7)
			// this.setBoolean( gamepad, "select", 8)
			// this.setBoolean( gamepad, "start", 9)
			// this.setBoolean( gamepad, "ls", 10)
			// this.setBoolean( gamepad, "rs", 11)
			// this.setBoolean( gamepad, "dup", 12)
			// this.setBoolean( gamepad, "ddown", 13)
			// this.setBoolean( gamepad, "dleft", 14)
			// this.setBoolean( gamepad, "dright", 15)

			// this.a = !!gamepad.buttons[0].value
			// this.b = !!gamepad.buttons[1].value
			// this.x = !!gamepad.buttons[2].value
			// this.y = !!gamepad.buttons[3].value
			// this.lb = !!gamepad.buttons[4].value
			// this.rb = !!gamepad.buttons[5].value
			// this. lt = !!gamepad.buttons[6].value
			// this.rt = !!gamepad.buttons[7].value
			// this.select = !!gamepad.buttons[8].value
			// this.start = !!gamepad.buttons[9].value
			// this.ls = !!gamepad.buttons[10].value
			// this.rs = !!gamepad.buttons[11].value
			// this.dup = !!gamepad.buttons[12].value
			// this.ddown = !!gamepad.buttons[13].value
			// this.dleft = !!gamepad.buttons[14].value
			// this.dright = !!gamepad.buttons[15].value

		}else{
			//console.log(this.available, "failing to update gamepad data", this.gamepad)
		}

		// kill any references remaining...
		// this.gamepad = null
    }

	toStringState(){
		return BUTTON_NAMES.map( button => this[button] ).join(" / ")
	
	}

	toString(){
		return `Gamepad #${this.index} : ${this.gamePadId} -> ${this.toStringState()}`
	}
}

export const GAME_PAD_CONNECTED = "game-pad-connected"
export const GAME_PAD_DISCONNECTED = "game-pad-disconnected"

/**
 * Manager for the above class
 */
export class GamePadManager {
	
	controllers = new Map()
	callbacks = new Set()
	held = new Map()

    /**
     * 
     */
	get isAnyButtonHeld(){
		return this.held.size > 0
	}

    /**
     * 
     */
	get heldButtons(){
		return this.held
	}

	constructor() {

		// fetch any previously registered game pads
		let pads = fetchGamePads()
		let quantity = 0
		let intervalID = -1
		const eventLoop = () => {

			// console.info("checking buttons for pads", quantity)
			this.controllers.forEach( gamePad => gamePad.update() )
			if (quantity > 0 )
			{
				//console.info("Gamepads", { pads }, this )
				cancelAnimationFrame(intervalID)
				intervalID = requestAnimationFrame( eventLoop )
			}else{
				console.warn("Gamepads loop exit", { pads }, this )
			}
		}

		//pads.forEach( pad => pad && this.controllers.set(pad.index, new GamePad(pad.index)) )
		console.info("Existing Gamepads", { pads }, this )

		window.addEventListener("gamepadconnected", e => {

			const event = e.originalEvent ? e.originalEvent.gamepad : e.gamepad
			const gamePad = new GamePad(e.index, quantity++)
			gamePad.connect(e)
			gamePad.on( (buttonName, value, heldFor ) => {
					
				switch(buttonName)
				{
					// ignore caching these
					case GAME_PAD_CONNECTED:
					case GAME_PAD_DISCONNECTED:
					case COMMANDS.LEFT_STICK_Y: 
					case COMMANDS.LEFT_STICK_X: 
					case COMMANDS.RIGHT_STICK_Y: j
					case COMMANDS.RIGHT_STICK_X:
					// case COMMANDS.UP: 
					// case COMMANDS.DOWN: 
					// case COMMANDS.LEFT: 
					// case COMMANDS.RIGHT: 
						break
				
					default: 
						if (value)
						{
							this.held.set(buttonName, value)
						}else{
							this.held.delete(buttonName)
						}
				}
				console.info("gamepad message", buttonName, value )
				this.dispatchEvent( buttonName, value, gamePad, heldFor )
			})
						
			pads = fetchGamePads()
			this.controllers.set( event.index, gamePad )
			
			console.info(
				"Gamepad connected at index %d: %s. %d buttons, %d axes.",
				event.index,
				event.id,
				event.buttons.length,
				event.axes.length,
				{gamePad, e, event},
				this.controllers,
				pads
			)
			this.dispatchEvent( GAME_PAD_CONNECTED, gamePad )
			// start loop if not started already
			eventLoop()
		})

		window.addEventListener("gamepaddisconnected", e =>{
			let gamePad = this.controllers.get(e.gamepad.connectionIndex)
			gamePad.disconnect()
			this.controllers.delete(e.gamepad.connectionIndex)
			gamePad = null
			quantity--
			this.dispatchEvent( GAME_PAD_DISCONNECTED, gamePad )
			console.info("Gamepad disconnected", {gamePad, e}, this.controllers )
	 	} )

		// start jloop for an existing pre-connected gamepads
		eventLoop()
	}

    /**
     * Test if button is actively held down
     * @param buttonName 
     * @returns 
     */
	isHeld( buttonName:string ):boolean{
		return this.held.has(buttonName)
	}

	/**
	 * 
	 * @param {String} key 
	 * @param {Boolean|String|Object} value 
	 */
	dispatchEvent( key:string, value, gamePad:GamePad ){
		if (this.callbacks.size)
		{
			this.callbacks.forEach( (callback:Function) => callback(key,value, gamePad) )
		}
	}

	addEventListener( callback:Function ){
		this.callbacks.add(callback)
	}

	removeEventListener( callback:Function ){
		this.callbacks.delete(callback)
	}

	destroy(){

	}
}

