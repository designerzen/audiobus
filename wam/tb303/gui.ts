import { TB303_PARAMETERS } from "./parameters"
import { WAM_AUTOMATION_EVENT } from "../host"
import {
	EVENT_CHANGE,
	EVENT_INPUT,
	EVENT_LOST_POINTER_CAPTURE,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP
} from "../../event-constants"

const disposers = new WeakMap<HTMLElement, () => void>()
export function destroyTB303Gui(gui: HTMLElement) {
	disposers.get(gui)?.()
	disposers.delete(gui)
	gui.remove()
}
export async function createTB303Gui(node: any): Promise<HTMLElement> {
	const host = document.createElement("div")
	const root = host.attachShadow({ mode: "open" })
	const style = document.createElement("style")
	style.textContent = `
        :host { display:block; color:#222925; font:12px Arial,sans-serif; }
        * { box-sizing:border-box; }
        section { padding:20px 22px 16px; border:1px solid #929795; border-bottom:7px solid #737a76;
            border-radius:9px; background:linear-gradient(135deg,#e0e2dc,#bec4c0 60%,#d6d9d1);
            box-shadow:inset 0 1px 2px #fff9,0 3px 10px #0004; }
        header { display:flex; align-items:baseline; gap:12px; border-bottom:3px solid #252e29; padding-bottom:9px; }
        h2 { font-size:29px; letter-spacing:-.06em; margin:0; font-weight:900; }
        header span { font-size:11px; font-weight:bold; letter-spacing:.12em; }
        .controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(76px,1fr)); gap:20px 12px; padding:22px 0 18px; }
        label { display:flex; flex-direction:column; align-items:center; gap:9px; text-align:center; }
        .label { font-weight:bold; text-transform:uppercase; font-size:10px; letter-spacing:.035em; }
        .dial { width:62px; height:62px; position:relative; border-radius:50%;
            background:repeating-conic-gradient(from -135deg,#555 0deg 1deg,transparent 1deg 27deg); }
        .dial:after { content:''; position:absolute; inset:5px; border-radius:50%; background:#cbd0c9; pointer-events:none; }
        .knob { position:absolute; inset:9px; z-index:1; border-radius:50%; pointer-events:none;
            border:1px solid #101713; background:radial-gradient(circle at 35% 25%,#505852,#252b27 55%,#101713);
            box-shadow:1px 3px 4px #0007,inset 0 1px 1px #ffffff45; }
        .knob:after { content:''; position:absolute; width:3px; height:13px; background:#f7f4dc; left:calc(50% - 1.5px); top:3px; border-radius:1px; }
        input { position:absolute; inset:0; width:100%; height:100%; margin:0; opacity:0; z-index:2; cursor:ns-resize; touch-action:none; }
        .dial:focus-within { outline:2px solid #aa3928; outline-offset:3px; }
        output { font-size:10px; font-variant-numeric:tabular-nums; min-height:12px; color:#424c45; }
        footer { display:flex; flex-wrap:wrap; gap:14px; align-items:center; border-top:4px solid #b94730; padding-top:12px; }
        footer label { flex-direction:row; gap:8px; }
        select { font:10px Arial,sans-serif; font-weight:bold; color:#eee9d9; background:#303a32; border:1px solid #16241a; border-radius:3px; padding:6px; }
        p { margin:0; font-size:10px; color:#49534c; line-height:1.5; }
        select:focus-visible { outline:2px solid #aa3928; outline-offset:3px; }
        @media (max-width:400px) { section { padding:15px 12px; } header { flex-wrap:wrap; gap:5px 12px; } }
    `
	const panel = document.createElement("section")
	panel.setAttribute("aria-label", "TB-303 bass synthesizer")
	const header = document.createElement("header")
	const title = document.createElement("h2")
	title.textContent = "TB-303"
	const subtitle = document.createElement("span")
	subtitle.textContent = "BASS LINE"
	header.append(title, subtitle)
	const controls = document.createElement("div")
	controls.className = "controls"
	const footer = document.createElement("footer")
	const values = await node.getParameterValues()
	const updates = new Map<string, (value: number) => void>()
	const cleanup: Array<() => void> = []
	for (const [id, config] of Object.entries(TB303_PARAMETERS)) {
		const label = document.createElement("label")
		const caption = document.createElement("span")
		caption.className = "label"
		caption.textContent = config.label
		const choices = "choices" in config ? config.choices : null
		const input = document.createElement(choices ? "select" : "input") as
			| HTMLInputElement
			| HTMLSelectElement
		input.setAttribute("aria-label", config.label)
		const output = document.createElement("output")
		const knob = document.createElement("div")
		knob.className = "knob"
		knob.setAttribute("aria-hidden", "true")
		const logarithmic = id === "cutoff" || id === "decay" || id === "delayTime"
		const toPosition = (value: number) =>
			logarithmic
				? Math.log(value / config.minValue) / Math.log(config.maxValue / config.minValue)
				: (value - config.minValue) / (config.maxValue - config.minValue)
		const fromPosition = (position: number) =>
			logarithmic
				? config.minValue * (config.maxValue / config.minValue) ** position
				: config.minValue + position * (config.maxValue - config.minValue)
		if (choices) {
			choices.forEach((choice, index) => {
				const option = document.createElement("option")
				option.textContent = choice
				option.value = String(index)
				input.append(option)
			})
			label.append(caption, input)
			footer.append(label)
		} else {
			const slider = input as HTMLInputElement
			slider.type = "range"
			slider.min = "0"
			slider.max = "1"
			slider.step = "0.001"
			const dial = document.createElement("div")
			dial.className = "dial"
			dial.append(knob, input)
			label.append(caption, dial, output)
			controls.append(label)
			let drag: { id: number; y: number; position: number } | null = null
			const down = (event: PointerEvent) => {
				if (event.button !== 0) {
					return
				}
				event.preventDefault()
				slider.focus()
				drag = { id: event.pointerId, y: event.clientY, position: Number(slider.value) }
				slider.setPointerCapture(event.pointerId)
			}
			const move = (event: PointerEvent) => {
				if (!drag || event.pointerId !== drag.id) {
					return
				}
				slider.value = String(
					Math.max(
						0,
						Math.min(
							1,
							drag.position + (drag.y - event.clientY) / (event.shiftKey ? 1200 : 180)
						)
					)
				)
				slider.dispatchEvent(new Event(EVENT_INPUT))
			}
			const up = (event: PointerEvent) => {
				if (!drag || event.pointerId !== drag.id) {
					return
				}
				drag = null
				if (slider.hasPointerCapture(event.pointerId)) {
					slider.releasePointerCapture(event.pointerId)
				}
			}
			slider.addEventListener(EVENT_POINTER_DOWN, down)
			slider.addEventListener(EVENT_POINTER_MOVE, move)
			slider.addEventListener(EVENT_POINTER_UP, up)
			slider.addEventListener(EVENT_POINTER_CANCEL, up)
			slider.addEventListener(EVENT_LOST_POINTER_CAPTURE, up)
			cleanup.push(() => {
				if (drag && slider.hasPointerCapture(drag.id)) {
					slider.releasePointerCapture(drag.id)
				}
				slider.removeEventListener(EVENT_POINTER_DOWN, down)
				slider.removeEventListener(EVENT_POINTER_MOVE, move)
				slider.removeEventListener(EVENT_POINTER_UP, up)
				slider.removeEventListener(EVENT_POINTER_CANCEL, up)
				slider.removeEventListener(EVENT_LOST_POINTER_CAPTURE, up)
			})
		}
		const update = (raw: number) => {
			const value = Math.max(config.minValue, Math.min(config.maxValue, raw))
			const position = toPosition(value)
			input.value = choices ? String(Math.round(value)) : String(position)
			knob.style.transform = `rotate(${-135 + 270 * position}deg)`
			output.value = choices
				? choices[Math.round(value)]
				: id === "cutoff"
					? `${Math.round(value)} Hz`
					: id === "decay" || id === "delayTime"
						? `${value.toFixed(2)} s`
						: id === "tuning"
							? `${Math.round(value)} ct`
							: `${Math.round(value * 100)}%`
			input.setAttribute("aria-valuetext", output.value)
		}
		updates.set(id, update)
		update(values[id]?.value ?? config.defaultValue)
		const change = () => {
			const value = choices ? Number(input.value) : fromPosition(Number(input.value))
			update(value)
			node.scheduleEvents({
				type: WAM_AUTOMATION_EVENT,
				time: node.context.currentTime,
				data: { id, value, normalized: false }
			})
		}
		const eventName = choices ? EVENT_CHANGE : EVENT_INPUT
		input.addEventListener(eventName, change)
		cleanup.push(() => input.removeEventListener(eventName, change))
	}
	const hint = document.createElement("p")
	hint.textContent =
		"Overlap notes to slide · Velocity 100–127 accents · Shift-drag for fine tuning"
	footer.append(hint)
	const automation = (event: Event) => {
		const { id, value, normalized } = (event as CustomEvent).detail.data
		const config = TB303_PARAMETERS[id as keyof typeof TB303_PARAMETERS]
		if (config) {
			updates.get(id)?.(
				normalized ? config.minValue + value * (config.maxValue - config.minValue) : value
			)
		}
	}
	node.addEventListener(WAM_AUTOMATION_EVENT, automation)
	cleanup.push(() => node.removeEventListener(WAM_AUTOMATION_EVENT, automation))
	disposers.set(host, () => cleanup.forEach((dispose) => dispose()))
	panel.append(header, controls, footer)
	root.append(style, panel)
	return host
}