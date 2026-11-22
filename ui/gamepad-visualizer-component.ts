import { COMMANDS } from "../hardware/gamepad/gamepad.ts"
import {
	EVENT_BLUR,
	EVENT_CONTEXT_MENU,
	EVENT_FOCUS_OUT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_LOST_POINTER_CAPTURE,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_VISIBILITY_CHANGE
} from "../events/event-constants.ts"
import "./gamepad-visualizer.css"

type Side = "left" | "right"
type Control = { element: SVGElement; button?: string; side?: Side }
const STICKS = {
	left: { x: 225, y: 255, commands: [COMMANDS.LEFT_STICK_X, COMMANDS.LEFT_STICK_Y] },
	right: { x: 405, y: 255, commands: [COMMANDS.RIGHT_STICK_X, COMMANDS.RIGHT_STICK_Y] }
}
const SVG_NS = "http://www.w3.org/2000/svg"
const svgElement = <K extends keyof SVGElementTagNameMap>(
	tag: K,
	attributes: Record<string, string | number>
) => {
	const element = document.createElementNS(SVG_NS, tag)
	for (const [name, value] of Object.entries(attributes))
		{element.setAttribute(name, String(value))}
	return element
}

/** An always playable gamepad. Hardware feedback never emits virtual input. */
export class GamepadVisualizerComponent {
	#container: HTMLElement | null = null
	#svg: SVGSVGElement | null = null
	#abort = new AbortController()
	#buttons = new Map<string, SVGElement>()
	#sticks = new Map<Side, SVGElement>()
	#hardwareButtons = new Set<string>()
	#hardwareSticks = { left: [0, 0], right: [0, 0] }
	#virtualSticks = { left: [0, 0], right: [0, 0] }
	#pressed = new Map<string, Set<string>>()
	#pointers = new Map<number, Control>()
	#keys = new Map<string, Control>()

	constructor(private onInput: (command: string, value: number) => void = () => {}) {}

	public createContainer(): HTMLElement {
		if (this.#container) {return this.#container}
		const container = document.createElement("div")
		container.className = "gamepad-visualizer-container nodrag nopan nowheel"
		this.#container = container
		this.createGamepadSVG()
		const hint = container.appendChild(document.createElement("p"))
		hint.className = "gamepad-hint"
		hint.textContent = "Touch or click buttons. Drag either stick."
		return container
	}

	public createGamepadSVG(): void {
		if (!this.#container || this.#svg) {return}
		const svg = svgElement("svg", {
			viewBox: "0 0 600 360",
			class: "gamepad-visualizer",
			role: "group",
			"aria-label": "Interactive gamepad"
		})
		this.#svg = svg
		svg.appendChild(
			svgElement("path", {
				class: "gamepad-body",
				d: "M150 75 Q100 66 78 112 L32 278 Q20 333 60 338 Q87 340 125 279 L170 245 Q300 278 430 245 L475 279 Q513 340 540 338 Q580 333 568 278 L522 112 Q500 66 450 75 Q300 104 150 75Z"
			})
		)
		const button = (
			command: string,
			label: string,
			x: number,
			y: number,
			width = 38,
			height = width,
			round = false
		) => {
			const group = svgElement("g", {
				class: `gamepad-button gamepad-button-${command}`,
				"data-command": command,
				transform: `translate(${x} ${y})`,
				role: "button",
				tabindex: 0,
				"aria-label": label,
				"aria-pressed": "false"
			})
			group.appendChild(
				round
					? svgElement("circle", { r: width / 2 })
					: svgElement("rect", { x: -width / 2, y: -height / 2, width, height, rx: 7 })
			)
			const text = group.appendChild(
				svgElement("text", { "text-anchor": "middle", "dominant-baseline": "central" })
			)
			text.textContent = label
			svg.appendChild(group)
			this.#buttons.set(command, group)
		}
		button(COMMANDS.LT, "LT", 145, 36, 70, 30)
		button(COMMANDS.RT, "RT", 455, 36, 70, 30)
		button(COMMANDS.LB, "LB", 145, 77, 82, 30)
		button(COMMANDS.RB, "RB", 455, 77, 82, 30)
		button(COMMANDS.UP, "↑", 145, 126, 34)
		button(COMMANDS.DOWN, "↓", 145, 198, 34)
		button(COMMANDS.LEFT, "←", 109, 162, 34)
		button(COMMANDS.RIGHT, "→", 181, 162, 34)
		button(COMMANDS.Y, "Y", 455, 120, 38, 38, true)
		button(COMMANDS.X, "X", 415, 160, 38, 38, true)
		button(COMMANDS.B, "B", 495, 160, 38, 38, true)
		button(COMMANDS.A, "A", 455, 200, 38, 38, true)
		button(COMMANDS.SELECT, "Select", 265, 147, 58, 30)
		button(COMMANDS.START, "Start", 335, 147, 58, 30)
		button(COMMANDS.P1, "P1", 275, 191, 34, 28)
		button(COMMANDS.P2, "P2", 325, 191, 34, 28)
		for (const side of ["left", "right"] as const) {
			const { x, y } = STICKS[side]
			const group = svgElement("g", {
				class: "gamepad-stick",
				"data-stick": side,
				transform: `translate(${x} ${y})`,
				role: "group",
				"aria-label": `${side} joystick: drag to move`
			})
			group.appendChild(svgElement("circle", { class: "gamepad-stick-well", r: 43 }))
			const knob = group.appendChild(
				svgElement("circle", { class: "gamepad-stick-knob", r: 26 })
			)
			this.#sticks.set(side, knob)
			svg.appendChild(group)
			button(
				side === "left" ? COMMANDS.LEFT_SHOULDER : COMMANDS.RIGHT_SHOULDER,
				side === "left" ? "L3" : "R3",
				x,
				319,
				44,
				26
			)
		}
		this.#container.appendChild(svg)
		this.addInteraction(svg)
	}

	private control(target: EventTarget | null): Control | undefined {
		if (!(target instanceof Element)) {return}
		const element = target.closest<SVGElement>("[data-command], [data-stick]")
		if (!element || !this.#svg?.contains(element)) {return}
		return {
			element,
			button: element.dataset.command,
			side: element.dataset.stick as Side | undefined
		}
	}

	private addInteraction(svg: SVGSVGElement): void {
		const options = { signal: this.#abort.signal }
		svg.addEventListener(
			EVENT_POINTER_DOWN,
			(event) => {
				const control = this.control(event.target)
				if (event.button !== 0 || !control) {return}
				event.preventDefault()
				event.stopPropagation()
				if (
					control.side &&
					[...this.#pointers.values()].some(({ side }) => side === control.side)
				)
					{return}
				this.#pointers.set(event.pointerId, control)
				svg.setPointerCapture?.(event.pointerId)
				if (control.button) {this.press(control.button, `pointer:${event.pointerId}`, true)}
				if (control.side) {this.moveStick(control.side, event)}
			},
			options
		)
		document.addEventListener(
			EVENT_POINTER_MOVE,
			(event) => {
				const control = this.#pointers.get(event.pointerId)
				if (!control) {return}
				event.preventDefault()
				if (control.side) {this.moveStick(control.side, event)}
			},
			{ ...options, passive: false }
		)
		const release = (event: PointerEvent) => this.releasePointer(event.pointerId)
		document.addEventListener(EVENT_POINTER_UP, release, options)
		document.addEventListener(EVENT_POINTER_CANCEL, release, options)
		svg.addEventListener(EVENT_LOST_POINTER_CAPTURE, release, options)
		svg.addEventListener(
			EVENT_KEY_DOWN,
			(event) => {
				const control = this.control(event.target)
				if (!control?.button || ![" ", "Enter"].includes(event.key)) {return}
				event.preventDefault()
				event.stopPropagation()
				if (event.repeat) {return}
				this.#keys.set(event.key, control)
				this.press(control.button, `key:${event.key}`, true)
			},
			options
		)
		document.addEventListener(
			EVENT_KEY_UP,
			(event) => {
				const control = this.#keys.get(event.key)
				if (!control?.button) {return}
				this.#keys.delete(event.key)
				this.press(control.button, `key:${event.key}`, false)
			},
			options
		)
		svg.addEventListener(
			EVENT_FOCUS_OUT,
			(event) => {
				for (const [key, control] of this.#keys) {
					if (control.element === event.target && control.button) {
						this.#keys.delete(key)
						this.press(control.button, `key:${key}`, false)
					}
				}
			},
			options
		)
		svg.addEventListener(EVENT_CONTEXT_MENU, (event) => event.preventDefault(), options)
		window.addEventListener(EVENT_BLUR, () => this.releaseAll(), options)
		document.addEventListener(
			EVENT_VISIBILITY_CHANGE,
			() => {
				if (document.hidden) {this.releaseAll()}
			},
			options
		)
	}

	private press(button: string, owner: string, active: boolean): void {
		const owners = this.#pressed.get(button) ?? new Set<string>()
		const wasActive = owners.size > 0
		if (active) {owners.add(owner)}
		else {owners.delete(owner)}
		if (owners.size) {this.#pressed.set(button, owners)}
		else {this.#pressed.delete(button)}
		this.renderButton(button)
		if (wasActive !== owners.size > 0) {this.onInput(button, owners.size ? 1 : 0)}
	}

	private releasePointer(id: number): void {
		const control = this.#pointers.get(id)
		if (!control) {return}
		this.#pointers.delete(id)
		if (control.button) {this.press(control.button, `pointer:${id}`, false)}
		if (control.side) {this.setVirtualStick(control.side, 0, 0)}
		if (this.#svg?.hasPointerCapture?.(id)) {this.#svg.releasePointerCapture(id)}
	}

	private moveStick(side: Side, event: PointerEvent): void {
		const bounds = this.#svg!.getBoundingClientRect()
		const scale = Math.min(bounds.width / 600, bounds.height / 360)
		if (!scale) {return}
		const x =
			((event.clientX - bounds.left - (bounds.width - 600 * scale) / 2) / scale -
				STICKS[side].x) /
			30
		const y =
			((event.clientY - bounds.top - (bounds.height - 360 * scale) / 2) / scale -
				STICKS[side].y) /
			30
		const length = Math.max(1, Math.hypot(x, y))
		this.setVirtualStick(side, x / length, y / length)
	}

	private setVirtualStick(side: Side, x: number, y: number): void {
		const previous = this.#virtualSticks[side]
		this.#virtualSticks[side] = [x, y]
		this.renderStick(side)
		;[x, y].forEach((value, axis) => {
			if (previous[axis] !== value) {this.onInput(STICKS[side].commands[axis], value)}
		})
	}

	public releaseAll(): void {
		for (const id of this.#pointers.keys()) {this.releasePointer(id)}
		this.#keys.clear()
		for (const [button, owners] of this.#pressed) {
			for (const owner of owners) {this.press(button, owner, false)}
		}
	}

	private renderButton(button: string): void {
		const active = this.#hardwareButtons.has(button) || this.#pressed.has(button)
		const element = this.#buttons.get(button)
		element?.classList.toggle("active", active)
		element?.setAttribute("aria-pressed", String(active))
	}

	public updateButtonVisual(button: string, active: boolean): void {
		if (active) {this.#hardwareButtons.add(button)}
		else {this.#hardwareButtons.delete(button)}
		this.renderButton(button)
	}

	private renderStick(side: Side): void {
		const dragging = [...this.#pointers.values()].some((control) => control.side === side)
		const [x, y] = dragging ? this.#virtualSticks[side] : this.#hardwareSticks[side]
		const knob = this.#sticks.get(side)
		knob?.setAttribute("transform", `translate(${x * 22} ${y * 22})`)
		knob?.classList.toggle("active", Math.hypot(x, y) > 0.1)
	}

	public updateStickPosition(side: Side, x: number, y: number): void {
		this.#hardwareSticks[side] = [x, y].map((value) =>
			Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0
		)
		this.renderStick(side)
	}

	public destroy(): void {
		this.releaseAll()
		this.#abort.abort()
		this.#container?.remove()
		this.#buttons.clear()
		this.#sticks.clear()
	}
}

export default GamepadVisualizerComponent