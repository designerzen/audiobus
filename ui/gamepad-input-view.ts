import GamePad, { COMMANDS, GamePadManager } from "../hardware/gamepad/gamepad.ts"
import GamepadVisualizerComponent from "./gamepad-visualizer-component.ts"

/** Shares the same GUI and normalized input path between raw and musical gamepads. */
export default class GamepadInputView {
	readonly element: HTMLElement
	private visualizer: GamepadVisualizerComponent
	private virtualPad = new GamePad(-1)
	private pressedAt = new Map<string, number>()

	constructor(
		private manager: GamePadManager,
		onInput: (command: string, value: number, pad: GamePad, heldFor: number) => void,
		private gamepadIndex?: number
	) {
		this.visualizer = new GamepadVisualizerComponent((command, value) => {
			const start = this.pressedAt.get(command) ?? performance.now()
			if (value) {
				this.pressedAt.set(command, start)
			} else {
				this.pressedAt.delete(command)
			}
			onInput(command, value, this.virtualPad, value ? -1 : performance.now() - start)
		})
		this.element = this.visualizer.createContainer()
		this.manager.addEventListener(this.update)
		this.update()
	}

	private update = (): void => {
		const pads = [...this.manager.controllers.values()].filter(
			(pad) =>
				pad.connected &&
				(this.gamepadIndex == null || pad.index === Number(this.gamepadIndex))
		)
		for (const command of Object.values(COMMANDS)) {
			if (command.includes("stick")) {
				continue
			}
			this.visualizer.updateButtonVisual(
				command,
				pads.some((pad) => Boolean(pad[command as keyof GamePad]))
			)
		}
		for (const side of ["left", "right"] as const) {
			const x = `${side}stickX` as const
			const y = `${side}stickY` as const
			const pad = pads.reduce<GamePad | undefined>(
				(selected, current) =>
					!selected ||
					Math.hypot(current[x], current[y]) > Math.hypot(selected[x], selected[y])
						? current
						: selected,
				undefined
			)
			this.visualizer.updateStickPosition(side, pad?.[x] ?? 0, pad?.[y] ?? 0)
		}
	}

	public destroy(): void {
		this.visualizer.destroy()
		this.manager.removeEventListener(this.update)
	}
}