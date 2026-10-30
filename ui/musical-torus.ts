import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_KEY_DOWN,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_POINTER_CANCEL,
	EVENT_LOST_POINTER_CAPTURE
} from "../event-constants"
import { mod12 } from "../tuning/pitch-class-set"
import { numberControl } from "../io/device-controls"

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"
const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]

/** The periodic fingerboard before Duncan's further quotient to twelve vertices. */
export function torusPitch(x: number, y: number): number {
	return mod12(x + 5 * y)
}

export function createMusicalTorus(options: {
	audition: (pitch: number) => void
	toggle: (pitch: number) => void
}) {
	const element = document.createElement("section"),
		help = document.createElement("p")
	const controls = document.createElement("div"),
		modeLabel = document.createElement("label"),
		mode = document.createElement("select")
	const svg = document.createElementNS(SVG_NAMESPACE, "svg"),
		status = document.createElement("p")
	let mask = 2741,
		root = 0,
		x = 0,
		y = 0,
		rotation = 25
	let threeD = false,
		yaw = 25,
		pitch = 55,
		roll = 0
	let drag:
		| {
				id: number
				x: number
				y: number
				startX: number
				startY: number
				moved: boolean
				note?: [number, number]
		  }
		| undefined
	let suppressClick = false
	element.setAttribute("aria-label", "Musical torus")
	help.textContent =
		"Musical torus · right +1 semitone, up +5 (a fourth). Both directions wrap after 12 steps. Each pitch appears 12 times; highlighted facets belong to the set. Press a face or use arrow keys; Enter plays or edits it."
	for (const [name, value] of [
		["Audition notes", "audition"],
		["Edit pitch set", "edit"]
	]) {
		const option = document.createElement("option")
		option.textContent = name
		option.value = value
		mode.append(option)
	}
	modeLabel.append("Torus interaction ", mode)
	controls.append(modeLabel)
	const viewLabel = document.createElement("label"),
		view = document.createElement("input")
	view.type = "checkbox"
	viewLabel.append(view, " 3D mode")
	controls.append(viewLabel)
	const viewControls = document.createElement("div")
	viewControls.setAttribute("aria-label", "3D view controls")
	viewControls.hidden = true
	const instruction = document.createElement("p")
	instruction.textContent =
		"Drag with a mouse, pen or one finger to rotate freely; Shift-drag rolls the view. Use yaw, pitch and roll for precise angles. Press a face without dragging to play or edit it."
	viewControls.append(instruction)
	svg.setAttribute("viewBox", "0 0 480 340")
	svg.style.cssText =
		"display:block;width:100%;min-width:220px;max-width:540px;touch-action:manipulation"
	svg.setAttribute("role", "group")
	svg.setAttribute("aria-label", "Periodic chromatic and fourths fingerboard on a torus")
	status.setAttribute("role", "status")
	element.append(help, controls, viewControls, svg, status)
	const radians = (angle: number) => (angle * Math.PI) / 180
	const rotate = (vx: number, vy: number, vz: number) => {
		const a = radians(yaw),
			b = radians(pitch),
			c = radians(roll)
		const xx = vx * Math.cos(a) - vy * Math.sin(a),
			yy = vx * Math.sin(a) + vy * Math.cos(a)
		const y2 = yy * Math.cos(b) + vz * Math.sin(b),
			z2 = yy * Math.sin(b) - vz * Math.cos(b)
		return {
			x: xx * Math.cos(c) - y2 * Math.sin(c),
			y: xx * Math.sin(c) + y2 * Math.cos(c),
			z: z2
		}
	}
	const point = (a: number, b: number) => {
		if (threeD) {
			const u = (a * Math.PI) / 6,
				v = (b * Math.PI) / 6,
				radius = 1.55 + 0.6 * Math.cos(v)
			const p = rotate(radius * Math.cos(u), radius * Math.sin(u), 0.6 * Math.sin(v))
			// Perspective camera remains outside the torus at every orientation.
			const scale = (68 * 8) / (8 - p.z)
			return { x: 240 + scale * p.x, y: 170 - scale * p.y, depth: p.z }
		}
		const u = (a * Math.PI) / 6 + (rotation * Math.PI) / 180,
			v = (b * Math.PI) / 6
		const radius = 1.55 + 0.6 * Math.cos(v),
			horizontal = radius * Math.sin(u),
			vertical = 0.6 * Math.sin(v)
		return {
			x: 240 + 102 * radius * Math.cos(u),
			y: 170 - 102 * (horizontal * 0.58 + vertical * 0.815),
			depth: horizontal * 0.815 - vertical * 0.58
		}
	}
	const activate = (a: number, b: number) => {
		x = mod12(a)
		y = mod12(b)
		const pitch = torusPitch(x, y)
		if (mode.value === "edit") {
			options.toggle(pitch)
		} else {
			options.audition(pitch)
		}
		render(true)
	}
	function render(focus = false) {
		svg.replaceChildren()
		svg.dataset.view = threeD ? "3d" : "fixed"
		const facets = Array.from({ length: 144 }, (_, i) => {
			const a = i % 12,
				b = Math.floor(i / 12)
			// Each pitch owns a complete curved patch, centered on its lattice point.
			const boundary = []
			for (let step = 0; step < 4; step++) {
				boundary.push(point(a - 0.5 + step / 4, b - 0.5))
			}
			for (let step = 0; step < 4; step++) {
				boundary.push(point(a + 0.5, b - 0.5 + step / 4))
			}
			for (let step = 0; step < 4; step++) {
				boundary.push(point(a + 0.5 - step / 4, b + 0.5))
			}
			for (let step = 0; step < 4; step++) {
				boundary.push(point(a - 0.5, b + 0.5 - step / 4))
			}
			return { a, b, boundary, p: point(a, b) }
		}).sort((a, b) => a.p.depth - b.p.depth)
		for (const { a, b, boundary, p } of facets) {
			const pitchClass = torusPitch(a, b),
				active = Boolean(mask & (1 << pitchClass)),
				selected = a === x && b === y
			const node = document.createElementNS(SVG_NAMESPACE, "g"),
				face = document.createElementNS(SVG_NAMESPACE, "polygon")
			node.setAttribute("role", "button")
			node.dataset.fret = String(a)
			node.dataset.string = String(b)
			node.setAttribute("tabindex", selected ? "0" : "-1")
			const label = `${NOTE_NAMES[mod12(pitchClass + root)]}, ${pitchClass} semitones above tonic, ${active ? "in set" : "outside set"}, fret ${a}, string ${b}`
			node.setAttribute("aria-label", label)
			node.setAttribute("aria-pressed", String(active))
			node.style.cursor = "pointer"
			const title = document.createElementNS(SVG_NAMESPACE, "title")
			title.textContent = label
			face.setAttribute("points", boundary.map((p) => `${p.x},${p.y}`).join(" "))
			const u = (a * Math.PI) / 6,
				v = (b * Math.PI) / 6
			const normal = rotate(Math.cos(u) * Math.cos(v), Math.sin(u) * Math.cos(v), Math.sin(v))
			const light = threeD
				? Math.round(
						20 + 55 * Math.max(0, normal.x * -0.3 + normal.y * 0.4 + normal.z * 0.85)
					)
				: 45
			face.setAttribute(
				"fill",
				active
					? `color-mix(in srgb, var(--col-accent, #a899d9) ${light}%, var(--col-surface, #26262b))`
					: `color-mix(in srgb, currentColor ${threeD ? Math.round(light / 4) : 8}%, var(--col-surface, #26262b))`
			)
			face.setAttribute("stroke", selected ? "currentColor" : "var(--col-line, #777)")
			face.setAttribute("stroke-width", selected ? "2.5" : "0.6")
			face.setAttribute("stroke-linejoin", "round")
			node.append(title, face)
			if (selected || (b === 0 && p.depth > 0)) {
				const text = document.createElementNS(SVG_NAMESPACE, "text")
				text.setAttribute("x", String(p.x))
				text.setAttribute("y", String(p.y + 4))
				text.setAttribute("text-anchor", "middle")
				text.setAttribute("fill", "currentColor")
				text.setAttribute("font-size", "12")
				text.textContent = NOTE_NAMES[mod12(pitchClass + root)]
				text.setAttribute("pointer-events", "none")
				node.append(text)
			}
			node.addEventListener(EVENT_CLICK, (event) => {
				if (suppressClick && (event as MouseEvent).detail !== 0) {
					event.preventDefault()
					return
				}
				activate(a, b)
			})
			node.addEventListener(EVENT_KEY_DOWN, (event) => {
				const key = (event as KeyboardEvent).key
				const move: Record<string, [number, number]> = {
					ArrowRight: [1, 0],
					ArrowLeft: [-1, 0],
					ArrowUp: [0, 1],
					ArrowDown: [0, -1]
				}
				if (move[key]) {
					event.preventDefault()
					event.stopPropagation()
					x = mod12(a + move[key][0])
					y = mod12(b + move[key][1])
					render(true)
				} else if (key === "Enter" || key === " ") {
					event.preventDefault()
					event.stopPropagation()
					activate(a, b)
				}
			})
			svg.append(node)
		}
		const selectedPitch = torusPitch(x, y)
		status.textContent = `${NOTE_NAMES[mod12(selectedPitch + root)]} · offset ${selectedPitch} · ${mask & (1 << selectedPitch) ? "in set" : "outside set"}. Highlighted facets belong to the set. Chromatic movement follows the large ring; fourths follow the tube.`
		if (focus) {
			;(svg.querySelector('[tabindex="0"]') as SVGGElement | null)?.focus()
		}
	}
	mode.addEventListener(EVENT_CHANGE, () => render())
	const flatRotation = numberControl(
		controls,
		"Rotate view (degrees)",
		rotation,
		0,
		360,
		(value) => {
			rotation = value
			render()
		},
		5
	)
	const wrap = (angle: number) => ((angle % 360) + 360) % 360
	const angleInputs = [
		numberControl(viewControls, "Yaw (degrees)", yaw, 0, 360, (value) => {
			yaw = value
			render()
		}),
		numberControl(viewControls, "Pitch (degrees)", pitch, 0, 360, (value) => {
			pitch = value
			render()
		}),
		numberControl(viewControls, "Roll (degrees)", roll, 0, 360, (value) => {
			roll = value
			render()
		})
	]
	const syncAngles = () => {
		angleInputs.forEach((input, index) => {
			input.value = String(Math.round([yaw, pitch, roll][index]))
		})
	}
	const reset = document.createElement("button")
	reset.type = "button"
	reset.textContent = "Reset view"
	reset.addEventListener(EVENT_CLICK, () => {
		yaw = 25
		pitch = 55
		roll = 0
		syncAngles()
		render()
	})
	viewControls.append(reset)
	const endDrag = (event?: PointerEvent) => {
		if (!drag || (event && event.pointerId !== drag.id)) {
			return
		}
		const id = drag.id
		const tapped =
			event?.type === EVENT_POINTER_UP &&
			!drag.moved &&
			Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5
				? drag.note
				: undefined
		suppressClick = drag.moved || Boolean(tapped) || event?.type !== EVENT_POINTER_UP
		drag = undefined
		if (svg.hasPointerCapture?.(id)) {
			svg.releasePointerCapture(id)
		}
		svg.style.cursor = threeD ? "grab" : ""
		if (tapped) {
			activate(...tapped)
		}
	}
	view.addEventListener(EVENT_CHANGE, () => {
		endDrag()
		threeD = view.checked
		viewControls.hidden = !threeD
		flatRotation.parentElement!.hidden = threeD
		svg.style.touchAction = threeD ? "none" : "manipulation"
		svg.style.cursor = threeD ? "grab" : ""
		render()
	})
	svg.addEventListener(EVENT_POINTER_DOWN, (event) => {
		if (!threeD || event.button !== 0 || drag) {
			return
		}
		event.preventDefault()
		event.stopPropagation()
		suppressClick = false
		const target = (event.target as Element).closest?.("g[data-fret]") as SVGGElement | null
		drag = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			startX: event.clientX,
			startY: event.clientY,
			moved: false,
			note: target ? [Number(target.dataset.fret), Number(target.dataset.string)] : undefined
		}
		// Keep receiving release/cancel events even if the pointer leaves the view.
		svg.setPointerCapture?.(event.pointerId)
	})
	svg.addEventListener(EVENT_POINTER_MOVE, (event) => {
		if (!drag || event.pointerId !== drag.id) {
			return
		}
		if (
			!drag.moved &&
			Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5
		) {
			return
		}
		event.preventDefault()
		event.stopPropagation()
		if (!drag.moved) {
			drag.moved = true
		}
		suppressClick = true
		const dx = event.clientX - drag.x,
			dy = event.clientY - drag.y
		if (event.shiftKey) {
			roll = wrap(roll + dx * 0.6)
		} else {
			yaw = wrap(yaw + dx * 0.6)
			pitch = wrap(pitch + dy * 0.6)
		}
		drag.x = event.clientX
		drag.y = event.clientY
		svg.style.cursor = "grabbing"
		syncAngles()
		render()
	})
	for (const name of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
		svg.addEventListener(name, (event) => endDrag(event as PointerEvent))
	}
	render()
	return {
		element,
		update(nextMask: number, nextRoot: number) {
			mask = nextMask
			root = nextRoot
			render()
		}
	}
}