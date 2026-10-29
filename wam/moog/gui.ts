import { MOOG_CONTROL_GROUPS, MOOG_PARAMETERS } from "./parameters"
import { WAM_AUTOMATION_EVENT, WAM_MIDI_EVENT } from "../host"

const disposers = new WeakMap<HTMLElement, () => void>()
export function destroyMoogGui(gui: HTMLElement) {
	disposers.get(gui)?.()
	disposers.delete(gui)
	gui.remove()
}
export async function createMoogGui(node: any): Promise<HTMLElement> {
	const host = document.createElement("div")
	const root = host.attachShadow({ mode: "open" })
	const style = document.createElement("style")
	style.textContent = `
        :host { display:block; color:#f4ead5; font:14px system-ui; }
        section { background:#191c20; border:8px solid #64432e; border-radius:12px; padding:20px; }
        h2 { margin:0; letter-spacing:.12em; font-size:24px; }
        p { color:#c4b69f; margin:6px 0 20px; }
        .groups { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr)); gap:16px; }
        fieldset { border:1px solid #71644f; border-radius:6px; margin:0; min-width:0; padding:16px; }
        legend { color:#e7bd70; padding:0 6px; }
        .controls { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,130px),1fr)); gap:16px; }
        label { display:grid; gap:10px; }
        output { color:#e7bd70; font-variant-numeric:tabular-nums; }
        input { width:100%; accent-color:#e7bd70; }
        select,button { color:inherit; background:#2b3036; border:1px solid #71644f; border-radius:4px; padding:8px; }
        button { margin-top:20px; cursor:pointer; }
        :focus-visible { outline:2px solid #e7bd70; outline-offset:3px; }
    `
	const panel = document.createElement("section")
	panel.setAttribute("aria-label", "Moog synthesizer")
	const title = document.createElement("h2")
	title.textContent = "MOOG"
	const caption = document.createElement("p")
	caption.textContent = "Fontana ladder filter · Dual oscillators · Polyphonic / mono legato"
	const groups = document.createElement("div")
	groups.className = "groups"
	const values = await node.getParameterValues()
	const updates = new Map<string, (value: number) => void>()
	const createControl = (id: keyof typeof MOOG_PARAMETERS) => {
		const config = MOOG_PARAMETERS[id]
		const label = document.createElement("label")
		label.append(config.label)
		const display = document.createElement("output")
		const choices = "choices" in config ? config.choices : null
		const input = document.createElement(choices ? "select" : "input") as
			| HTMLInputElement
			| HTMLSelectElement
		input.setAttribute("aria-label", config.label)
		const units = "units" in config ? config.units : ""
		const logarithmic = config.minValue > 0 && (units === "s" || units === "Hz")
		if (choices) {
			choices.forEach((name, index) => {
				const option = document.createElement("option")
				option.value = String(index)
				option.textContent = name
				input.append(option)
			})
		} else {
			const slider = input as HTMLInputElement
			slider.type = "range"
			slider.min = "0"
			slider.max = "1"
			slider.step = "0.001"
		}
		const update = (value: number) => {
			input.value = choices
				? String(Math.round(value))
				: String(
						logarithmic
							? Math.log(value / config.minValue) /
									Math.log(config.maxValue / config.minValue)
							: (value - config.minValue) / (config.maxValue - config.minValue)
					)
			display.value = choices
				? choices[Math.round(value)]
				: units === "Hz"
					? `${id === "frequency" ? Math.round(value) : value.toFixed(2)} Hz`
					: units === "s"
						? `${value.toFixed(3)} s`
						: `${value.toFixed(2)}${units ? ` ${units}` : ""}`
			input.setAttribute("aria-valuetext", display.value)
		}
		updates.set(id, update)
		update(values[id]?.value ?? config.defaultValue)
		input.addEventListener("input", () => {
			const position = Number(input.value)
			const value = choices
				? position
				: logarithmic
					? config.minValue * (config.maxValue / config.minValue) ** position
					: config.minValue + position * (config.maxValue - config.minValue)
			update(value)
			node.scheduleEvents({
				type: WAM_AUTOMATION_EVENT,
				time: node.context.currentTime,
				data: { id, value, normalized: false }
			})
		})
		label.append(display, input)
		return label
	}
	for (const [name, ids] of Object.entries(MOOG_CONTROL_GROUPS)) {
		const fieldset = document.createElement("fieldset")
		const legend = document.createElement("legend")
		legend.textContent = name
		const controls = document.createElement("div")
		controls.className = "controls"
		controls.append(...ids.map(createControl))
		fieldset.append(legend, controls)
		groups.append(fieldset)
	}
	const onAutomation = (event: Event) => {
		const { id, value, normalized } = (event as CustomEvent).detail.data
		const config = MOOG_PARAMETERS[id as keyof typeof MOOG_PARAMETERS]
		if (config) {
			updates.get(id)?.(
				normalized ? config.minValue + value * (config.maxValue - config.minValue) : value
			)
		}
	}
	node.addEventListener(WAM_AUTOMATION_EVENT, onAutomation)
	disposers.set(host, () => node.removeEventListener(WAM_AUTOMATION_EVENT, onAutomation))
	const panic = document.createElement("button")
	panic.type = "button"
	panic.textContent = "All notes off"
	panic.addEventListener("click", () => {
		for (let channel = 0; channel < 16; channel++) {
			node.scheduleEvents({
				type: WAM_MIDI_EVENT,
				time: node.context.currentTime,
				data: { bytes: [0xb0 | channel, 120, 0] }
			})
		}
	})
	panel.append(title, caption, groups, panic)
	root.append(style, panel)
	return host
}