const now = () => performance.now()
export const getGamePads = () =>
	typeof navigator?.getGamepads === "function" ? navigator.getGamepads() : []

export const fetchGamePads = () => {
	const gamepads = getGamePads()
	for (let i = 0; i < gamepads.length; i++) {
		console.log("Gamepad " + i + ":")

		if (!gamepads[i]) {
			console.log("[null]")
			continue
		}

		if (!gamepads[i]!.connected) {
			console.log("[disconnected]")
			continue
		}

		console.log("    Index: " + gamepads[i]!.index)
		console.log("    ID: " + gamepads[i]!.id)
		console.log("    Axes: " + gamepads[i]!.axes.length)
		console.log("    Buttons: " + gamepads[i]!.buttons.length)
		console.log("    Mapping: " + gamepads[i]!.mapping)
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
	BUTTON_B,
	BUTTON_A,
	BUTTON_Y,
	BUTTON_X,
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
	DIRECTION_RIGHT,
	BUTTON_P1,
	BUTTON_P2
] as const

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
	gamepad: Gamepad | null = null // just a cache of the last state
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

	watcher: ((button: string, value: string | number | boolean, heldFor: number) => void) | null =
		null

	pressedAt = new Map<string, number>()

	constructor(gamePadId = 0, connectionIndex = -1) {
		this.connected = false
		this.gamePadIndex = gamePadId
		this.connectionIndex = connectionIndex
	}

	// getButton(name){
	// 	return this.buttonLibrary.get(name)
	// }

	on(callback: GamePad["watcher"]) {
		this.watcher = callback
	}

	dispatch(key: string, value: string | number | boolean, heldFor = -1) {
		if (this.watcher) {
			this.watcher(key, value, heldFor)
		}
	}

	/**
	 * Connect to this gamepad
	 * @param {Event} event
	 */
	connect(event: GamepadEvent) {
		const gamepad = event.gamepad

		this.connected = true
		this.available = true
		this.gamepad = gamepad
		this.index = gamepad.index

		this.standardMapping = gamepad.mapping === "standard"

		// BUTTON_NAMES.forEach( (button,index) => {
		// 	this.buttonLibrary.set( button, this.buttons[index] )
		// })

		// this.update()
		this.dispatch(GAME_PAD_AVAILBLE, this.toString())
	}

	/**
	 * Disconnect from this gamepad
	 * @param {Event} event
	 */
	disconnect() {
		// const gamepad = event.originalEvent ? event.originalEvent.gamepad : event.gamepad
		this.connected = false
		this.available = false
		this.gamepad = null
		this.dispatch(GAME_PAD_UNPLUGGED, this.toString())
	}

	/**
	 * Make the gamepad vibrate!
	 *
	 * @param {Number} value
	 * @param {Number} duration
	 * @param {Number} hapticIndex
	 */
	vibrate(value = 1, duration = 200, hapticIndex = 0) {
		if (this.gamepad) {
			const pad = this.gamepad as Gamepad & {
				hapticActuators?: { pulse(value: number, duration: number): Promise<boolean> }[]
			}
			void pad.hapticActuators?.[hapticIndex]?.pulse(value, duration)
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
	playEffect(
		type: GamepadHapticEffectType = "dual-rumble",
		startDelay = 0,
		duration = 1000,
		weakMagnitude = 1.0,
		strongMagnitude = 1.0
	) {
		if (this.gamepad) {
			this.gamepad.vibrationActuator?.playEffect(type, {
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
	setBoolean(newValue: boolean, button: (typeof BUTTON_NAMES)[number], dispatchEvent = true) {
		const oldValue = this[button]
		let elapsed = -1

		if (oldValue === false && newValue === true) {
			// ON
			this.pressedAt.set(button, now())
		} else if (oldValue === true && newValue === false) {
			// OFF
			elapsed = now() - (this.pressedAt.get(button) ?? now())
			this.pressedAt.delete(button)
		}

		// TOGGLE
		if (oldValue !== newValue) {
			this[button] = newValue
			if (dispatchEvent) {
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
	setStickPosition(
		key: "leftstickX" | "leftstickY" | "rightstickX" | "rightstickY",
		value: number
	) {
		if (!this.available) {
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
	setAllStickPositions() {
		if (!this.gamepad) {
			return
		}
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

		if (this.available && this.connected) {
			// console.log( "Updating gamepad data",this.gamepad, this)

			const gamepad = gamepads[this.index]
			if (!gamepad) {
				this.disconnect()
				return
			}
			this.gamepad = gamepad
			this.setAllStickPositions()

			for (let i = 0; i < BUTTON_QUANTITY; ++i) {
				// const gamepadButton = this.gamepad.buttons[i]
				const gamepadButton = gamepad.buttons[i]
				const newValue = gamepadButton?.pressed ?? false

				// if (newValue){
				// 	console.error("gamepadButton",  this.gamepad.buttons[i].pressed,  getGamePads()[this.index].buttons[i].pressed, this.index )
				// 	// console.info("gamepadButton", gamepadButton, this.gamepad, navigator.getGamepads()[this.buttonIndex] )
				// }
				this.setBoolean(newValue, BUTTON_NAMES[i])
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
		} else {
			//console.log(this.available, "failing to update gamepad data", this.gamepad)
		}

		// kill any references remaining...
		// this.gamepad = null
	}

	get id(): string {
		return this.gamepad?.id ?? String(this.gamePadIndex)
	}

	toStringState() {
		return BUTTON_NAMES.map((button) => this[button]).join(" / ")
	}

	toString() {
		return `Gamepad #${this.index} : ${this.gamePadIndex} -> ${this.toStringState()}`
	}
}

export const GAME_PAD_CONNECTED = "game-pad-connected"
export const GAME_PAD_DISCONNECTED = "game-pad-disconnected"

/**
 * Manager for the above class
 */
export class GamePadManager {
	controllers = new Map<number, GamePad>()
	callbacks = new Set<(key: string, value: number, gamePad: GamePad, heldFor: number) => void>()
	held = new Map<string, number>()
	private abortController = new AbortController()
	private animationFrame = -1
	get isAnyButtonHeld() {
		return this.held.size > 0
	}
	get heldButtons() {
		return this.held
	}
	constructor() {
		window.addEventListener("gamepadconnected", (event) => this.connectPad(event.gamepad), {
			signal: this.abortController.signal
		})
		window.addEventListener(
			"gamepaddisconnected",
			(event) => {
				const pad = this.controllers.get(event.gamepad.index)
				if (!pad) {
					return
				}
				pad.disconnect()
				this.controllers.delete(event.gamepad.index)
				this.held.clear()
				this.dispatchEvent(GAME_PAD_DISCONNECTED, 0, pad)
			},
			{ signal: this.abortController.signal }
		)
		for (const pad of getGamePads()) {
			if (pad?.connected) {
				this.connectPad(pad)
			}
		}
	}
	private connectPad(device: Gamepad) {
		if (this.controllers.has(device.index)) {
			return
		}
		const pad = new GamePad(device.index, this.controllers.size)
		pad.connect({ gamepad: device } as GamepadEvent)
		pad.on((button, value, heldFor) => {
			const numericValue = Number(value)
			if (!Number.isFinite(numericValue)) {
				return
			}
			if (!button.includes("stick")) {
				if (numericValue) {
					this.held.set(button, numericValue)
				} else {
					this.held.delete(button)
				}
			}
			this.dispatchEvent(button, numericValue, pad, heldFor)
		})
		this.controllers.set(device.index, pad)
		this.dispatchEvent(GAME_PAD_CONNECTED, 1, pad)
		if (this.animationFrame < 0) {
			this.update()
		}
	}
	private update = () => {
		for (const pad of this.controllers.values()) {
			pad.update()
		}
		this.animationFrame = this.controllers.size ? requestAnimationFrame(this.update) : -1
	}
	isHeld(buttonName: string): boolean {
		return this.held.has(buttonName)
	}
	dispatchEvent(key: string, value: number, gamePad: GamePad, heldFor = -1) {
		for (const callback of this.callbacks) {
			callback(key, value, gamePad, heldFor)
		}
	}
	addEventListener(
		callback: (key: string, value: number, gamePad: GamePad, heldFor: number) => void
	) {
		this.callbacks.add(callback)
	}
	removeEventListener(
		callback: (key: string, value: number, gamePad: GamePad, heldFor: number) => void
	) {
		this.callbacks.delete(callback)
	}
	destroy() {
		this.abortController.abort()
		cancelAnimationFrame(this.animationFrame)
		this.animationFrame = -1
		this.callbacks.clear()
		this.controllers.clear()
		this.held.clear()
	}
}