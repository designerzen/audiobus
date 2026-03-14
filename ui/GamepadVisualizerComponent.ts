/**
 * Shared Gamepad Visualizer Component
 * Creates and manages an SVG visualization of a gamepad
 * Can be used by any input that needs to display gamepad state
 */

import { COMMANDS } from "../hardware/gamepad/gamepad.ts"
import "./gamepad-visualizer.css"

export class GamepadVisualizerComponent {
	#containerElement: HTMLElement | null = null
	#svgElement: SVGSVGElement | null = null
	#placeholderElement: HTMLElement | null = null
	#buttonElements: Map<string, SVGElement> = new Map()
	#isVisible: boolean = false

	constructor() {}

	public createContainer(): HTMLElement {
		const container = document.createElement("div")
		container.className = "gamepad-visualizer-container"
		this.#containerElement = container
		this.showPlaceholder()
		return container
	}

	public showPlaceholder(): void {
		if (!this.#containerElement) return

		const placeholder = document.createElement("div")
		placeholder.className = "gamepad-placeholder"

		const icon = document.createElement("div")
		icon.className = "placeholder-icon"
		icon.textContent = "🕹️"

		const text = document.createElement("div")
		text.className = "placeholder-text"
		text.textContent = "Connect your controller"

		const hint = document.createElement("div")
		hint.className = "placeholder-hint"
		hint.textContent = "Plug in a gamepad or controller to get started"

		placeholder.appendChild(icon)
		placeholder.appendChild(text)
		placeholder.appendChild(hint)

		this.#containerElement.innerHTML = ""
		this.#containerElement.appendChild(placeholder)
		this.#placeholderElement = placeholder
		this.#isVisible = false
		this.#buttonElements.clear()
	}

	public createGamepadSVG(): void {
		if (!this.#containerElement) return

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
		svg.setAttribute("viewBox", "0 0 800 500")
		svg.setAttribute("class", "gamepad-visualizer")
		svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")

		// Gamepad body
		const bodyGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
		bodyGroup.setAttribute("class", "gamepad-body")

		// Left grip
		const leftGrip = document.createElementNS("http://www.w3.org/2000/svg", "path")
		leftGrip.setAttribute("d", "M 80 180 Q 40 250 80 320 L 120 320 Q 100 250 120 180 Z")
		leftGrip.setAttribute("fill", "#2a2a2a")
		leftGrip.setAttribute("stroke", "#444")
		leftGrip.setAttribute("stroke-width", "2")
		bodyGroup.appendChild(leftGrip)

		// Center body
		const centerBody = document.createElementNS("http://www.w3.org/2000/svg", "rect")
		centerBody.setAttribute("x", "120")
		centerBody.setAttribute("y", "100")
		centerBody.setAttribute("width", "560")
		centerBody.setAttribute("height", "300")
		centerBody.setAttribute("rx", "80")
		centerBody.setAttribute("fill", "#1a1a1a")
		centerBody.setAttribute("stroke", "#333")
		centerBody.setAttribute("stroke-width", "2")
		bodyGroup.appendChild(centerBody)

		// Right grip
		const rightGrip = document.createElementNS("http://www.w3.org/2000/svg", "path")
		rightGrip.setAttribute("d", "M 680 180 Q 720 250 680 320 L 640 320 Q 660 250 640 180 Z")
		rightGrip.setAttribute("fill", "#2a2a2a")
		rightGrip.setAttribute("stroke", "#444")
		rightGrip.setAttribute("stroke-width", "2")
		bodyGroup.appendChild(rightGrip)

		// Center details
		const centerDetail = document.createElementNS("http://www.w3.org/2000/svg", "rect")
		centerDetail.setAttribute("x", "140")
		centerDetail.setAttribute("y", "120")
		centerDetail.setAttribute("width", "520")
		centerDetail.setAttribute("height", "260")
		centerDetail.setAttribute("rx", "70")
		centerDetail.setAttribute("fill", "#222")
		centerDetail.setAttribute("stroke", "none")
		bodyGroup.appendChild(centerDetail)

		svg.appendChild(bodyGroup)

		// D-Pad
		this.createDPad(svg)

		// Left Stick
		this.createStick(svg, "left", 280, 310)

		// Action Buttons (ABXY)
		this.createActionButtons(svg)

		// Right Stick
		this.createStick(svg, "right", 670, 310)

		// Shoulder Buttons
		this.createShoulderButtons(svg)

		// Trigger Buttons
		this.createTriggerButtons(svg)

		// Menu Buttons
		this.createMenuButtons(svg)

		// Stick Click Buttons
		this.createStickClickButtons(svg)

		this.#containerElement.innerHTML = ""
		this.#containerElement.appendChild(svg)
		this.#svgElement = svg
		this.#isVisible = true
	}

	private createDPad(svg: SVGSVGElement): void {
		const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
		group.setAttribute("class", "dpad-group")
		group.setAttribute("transform", "translate(200, 200)")

		const buttons = [
			{ id: "up", x: "-15", y: "-35", class: "dpad-up", cmd: COMMANDS.UP },
			{ id: "down", x: "-15", y: "10", class: "dpad-down", cmd: COMMANDS.DOWN },
			{ id: "left", x: "-35", y: "-12.5", class: "dpad-left", cmd: COMMANDS.LEFT },
			{ id: "right", x: "10", y: "-12.5", class: "dpad-right", cmd: COMMANDS.RIGHT }
		]

		buttons.forEach((btn) => {
			const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
			rect.setAttribute("class", `dpad-button ${btn.class}`)
			rect.setAttribute("x", btn.x)
			rect.setAttribute("y", btn.y)
			rect.setAttribute("width", btn.id === "left" || btn.id === "right" ? "25" : "30")
			rect.setAttribute("height", btn.id === "left" || btn.id === "right" ? "30" : "25")
			rect.setAttribute("rx", "3")
			rect.id = `button-${btn.cmd}`
			group.appendChild(rect)
			this.#buttonElements.set(btn.cmd, rect)
		})

		svg.appendChild(group)
	}

	private createStick(svg: SVGSVGElement, side: "left" | "right", x: number, y: number): void {
		const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
		group.setAttribute("class", `${side}-stick-group`)
		group.setAttribute("transform", `translate(${x}, ${y})`)

		const outer = document.createElementNS("http://www.w3.org/2000/svg", "circle")
		outer.setAttribute("cx", "0")
		outer.setAttribute("cy", "0")
		outer.setAttribute("r", "30")
		outer.setAttribute("fill", "#1a1a1a")
		outer.setAttribute("stroke", "#555")
		outer.setAttribute("stroke-width", "2")
		group.appendChild(outer)

		const mid = document.createElementNS("http://www.w3.org/2000/svg", "circle")
		mid.setAttribute("cx", "0")
		mid.setAttribute("cy", "0")
		mid.setAttribute("r", "26")
		mid.setAttribute("fill", "#2a2a2a")
		mid.setAttribute("stroke", "none")
		group.appendChild(mid)

		const innerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g")
		innerGroup.setAttribute("class", "stick-inner")
		innerGroup.id = `stick-${side}`

		const inner = document.createElementNS("http://www.w3.org/2000/svg", "circle")
		inner.setAttribute("cx", "0")
		inner.setAttribute("cy", "0")
		inner.setAttribute("r", "20")
		inner.setAttribute("fill", "#444")
		inner.setAttribute("stroke", "#666")
		inner.setAttribute("stroke-width", "1")
		innerGroup.appendChild(inner)

		group.appendChild(innerGroup)
		svg.appendChild(group)
	}

	private createActionButtons(svg: SVGSVGElement): void {
		const group = document.createElementNS("http://www.w3.org/2000/svg", "g")
		group.setAttribute("class", "buttons-group")
		group.setAttribute("transform", "translate(600, 200)")

		const buttons = [
			{ cmd: COMMANDS.Y, cx: "0", cy: "-40", class: "button-y", label: "Y" },
			{ cmd: COMMANDS.B, cx: "40", cy: "0", class: "button-b", label: "B" },
			{ cmd: COMMANDS.A, cx: "0", cy: "40", class: "button-a", label: "A" },
			{ cmd: COMMANDS.X, cx: "-40", cy: "0", class: "button-x", label: "X" }
		]

		buttons.forEach((btn) => {
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
			circle.setAttribute("class", `action-button ${btn.class}`)
			circle.setAttribute("cx", btn.cx)
			circle.setAttribute("cy", btn.cy)
			circle.setAttribute("r", "18")
			circle.id = `button-${btn.cmd}`
			group.appendChild(circle)
			this.#buttonElements.set(btn.cmd, circle)

			const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
			text.setAttribute("x", btn.cx)
			text.setAttribute("y", btn.cy)
			text.setAttribute("text-anchor", "middle")
			text.setAttribute("dominant-baseline", "middle")
			text.setAttribute("class", "button-label")
			text.textContent = btn.label
			group.appendChild(text)
		})

		svg.appendChild(group)
	}

	private createShoulderButtons(svg: SVGSVGElement): void {
		const buttons = [
			{ cmd: COMMANDS.LB, x: "160", label: "LB" },
			{ cmd: COMMANDS.RB, x: "580", label: "RB" }
		]

		buttons.forEach((btn) => {
			const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
			rect.setAttribute("class", `shoulder-button ${btn.cmd}-button`)
			rect.setAttribute("x", btn.x)
			rect.setAttribute("y", "95")
			rect.setAttribute("width", "60")
			rect.setAttribute("height", "35")
			rect.setAttribute("rx", "8")
			rect.id = `button-${btn.cmd}`
			svg.appendChild(rect)
			this.#buttonElements.set(btn.cmd, rect)

			const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
			text.setAttribute("x", btn.x === "160" ? "190" : "610")
			text.setAttribute("y", "117")
			text.setAttribute("text-anchor", "middle")
			text.setAttribute("dominant-baseline", "middle")
			text.setAttribute("class", "shoulder-label")
			text.textContent = btn.label
			svg.appendChild(text)
		})
	}

	private createTriggerButtons(svg: SVGSVGElement): void {
		const buttons = [
			{ cmd: COMMANDS.LT, x: "160", label: "LT" },
			{ cmd: COMMANDS.RT, x: "580", label: "RT" }
		]

		buttons.forEach((btn) => {
			const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
			rect.setAttribute("class", `trigger-button ${btn.cmd}-button`)
			rect.setAttribute("x", btn.x)
			rect.setAttribute("y", "50")
			rect.setAttribute("width", "60")
			rect.setAttribute("height", "30")
			rect.setAttribute("rx", "6")
			rect.id = `button-${btn.cmd}`
			svg.appendChild(rect)
			this.#buttonElements.set(btn.cmd, rect)

			const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
			text.setAttribute("x", btn.x === "160" ? "190" : "610")
			text.setAttribute("y", "70")
			text.setAttribute("text-anchor", "middle")
			text.setAttribute("dominant-baseline", "middle")
			text.setAttribute("class", "trigger-label")
			text.textContent = btn.label
			svg.appendChild(text)
		})
	}

	private createMenuButtons(svg: SVGSVGElement): void {
		const buttons = [
			{ cmd: COMMANDS.SELECT, x: "310", label: "SELECT" },
			{ cmd: COMMANDS.START, x: "410", label: "START" }
		]

		buttons.forEach((btn) => {
			const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
			rect.setAttribute("class", `menu-button ${btn.cmd}-button`)
			rect.setAttribute("x", btn.x)
			rect.setAttribute("y", "230")
			rect.setAttribute("width", "80")
			rect.setAttribute("height", "25")
			rect.setAttribute("rx", "5")
			rect.id = `button-${btn.cmd}`
			svg.appendChild(rect)
			this.#buttonElements.set(btn.cmd, rect)

			const text = document.createElementNS("http://www.w3.org/2000/svg", "text")
			text.setAttribute("x", btn.x === "310" ? "350" : "450")
			text.setAttribute("y", "247")
			text.setAttribute("text-anchor", "middle")
			text.setAttribute("dominant-baseline", "middle")
			text.setAttribute("class", "menu-label text-small")
			text.textContent = btn.label
			svg.appendChild(text)
		})
	}

	private createStickClickButtons(svg: SVGSVGElement): void {
		const buttons = [
			{ cmd: COMMANDS.LEFT_SHOULDER, cx: "280" },
			{ cmd: COMMANDS.RIGHT_SHOULDER, cx: "670" }
		]

		buttons.forEach((btn) => {
			const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
			circle.setAttribute("class", `stick-button ${btn.cmd}-button`)
			circle.setAttribute("cx", btn.cx)
			circle.setAttribute("cy", "310")
			circle.setAttribute("r", "8")
			circle.id = `button-${btn.cmd}`
			svg.appendChild(circle)
			this.#buttonElements.set(btn.cmd, circle)
		})
	}

	public updateButtonVisual(buttonName: string, isActive: boolean): void {
		if (!this.#isVisible) return

		const element = this.#buttonElements.get(buttonName)
		if (!element) return

		if (isActive) {
			element.classList.add("active")
		} else {
			element.classList.remove("active")
		}
	}

	public updateStickPosition(side: "left" | "right", x: number, y: number): void {
		if (!this.#isVisible) return

		const stickElement = document.getElementById(`stick-${side}`)
		if (!stickElement) return

		const deadzone = 0.1
		const absX = Math.abs(x) > deadzone ? x : 0
		const absY = Math.abs(y) > deadzone ? y : 0

		const moveX = absX * 20
		const moveY = absY * 20

		stickElement.style.transform = `translate(${moveX}, ${moveY})`
	}

	public destroy(): void {
		this.#buttonElements.clear()
		if (this.#containerElement) {
			this.#containerElement.innerHTML = ""
		}
	}
}

export default GamepadVisualizerComponent
