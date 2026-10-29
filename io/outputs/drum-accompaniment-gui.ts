import type OutputDrumAccompaniment from "./output-drum-accompaniment.ts"
import {
	DRUM_GENRES,
	type DrumAccompanimentSettings,
	type DrumGenre
} from "./drum-accompaniment-settings.ts"
import { DRUM_COMPRESSOR_PARAMETERS } from "../../effects/drum-compressor.ts"
import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_INPUT,
	EVENT_CONFIGURATION_CHANGED
} from "../../event-constants.ts"

export interface DrumAccompanimentGui {
	element: HTMLElement
	dispose(): void
}

export function createDrumAccompanimentGui(device: OutputDrumAccompaniment): DrumAccompanimentGui {
	const element = document.createElement("section")
	element.setAttribute("aria-label", "Drum accompaniment controls")
	Object.assign(element.style, {
		display: "grid",
		gap: "0.65rem",
		padding: "0.75rem",
		minWidth: "240px",
		maxWidth: "380px"
	})
	const heading = document.createElement("h3")
	heading.textContent = "Drum accompaniment"
	heading.style.margin = "0"
	const info = document.createElement("p")
	info.textContent =
		"Follows the global transport and tempo. Note activity adds subtle variations."
	Object.assign(info.style, { margin: "0", fontSize: "0.85em", opacity: "0.75" })
	element.append(heading, info)
	const advanced = document.createElement("details")
	const summary = document.createElement("summary")
	summary.textContent = "Character & performance"
	advanced.append(summary)
	const controls = new Map<
		keyof DrumAccompanimentSettings,
		HTMLInputElement | HTMLSelectElement
	>()
	const values = new Map<keyof DrumAccompanimentSettings, HTMLOutputElement>()
	const option = (title: string, value: string): HTMLOptionElement => {
		const element = document.createElement("option")
		element.textContent = title
		element.value = value
		return element
	}

	const label = (
		name: string,
		control: HTMLElement,
		parent: HTMLElement = element
	): HTMLLabelElement => {
		const row = document.createElement("label")
		row.style.display = "grid"
		row.style.gap = "0.25rem"
		const caption = document.createElement("span")
		caption.textContent = name
		row.append(caption, control)
		parent.append(row)
		return row
	}
	const select = (
		key: "genre" | "groove",
		name: string,
		entries: readonly (readonly [string, string])[]
	) => {
		const control = document.createElement("select")
		control.name = key
		control.setAttribute("aria-label", name)
		for (const [value, title] of entries) {
			control.add(option(title, value))
		}
		control.addEventListener(EVENT_CHANGE, () => {
			if (key === "genre") {
				device.configure({ genre: control.value as DrumGenre })
			} else if (key === "groove") {
				device.configure({ groove: control.value })
			}
		})
		controls.set(key, control)
		label(name, control)
		return control
	}
	select(
		"genre",
		"Genre",
		Object.entries(DRUM_GENRES).map(([id, genre]) => [id, genre.title])
	)
	const groove = select("groove", "Groove", [])
	const tuning = document.createElement("select")
	tuning.name = "tuningNote"
	tuning.setAttribute("aria-label", "Tuning note")
	const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
	for (let note = 0; note < 128; note++) {
		tuning.add(
			option(
				NOTE_NAMES[note % 12] + (Math.floor(note / 12) - 1) + " (" + note + ")",
				String(note)
			)
		)
	}
	tuning.addEventListener(EVENT_CHANGE, () =>
		device.configure({ tuningNote: Number(tuning.value) })
	)
	controls.set("tuningNote", tuning)
	label("Tuning note", tuning)

	for (const [key, name, min, max, step] of [
		["volume", "Volume", 0, 1, 0.01],
		["activityResponse", "Activity variations", 0, 1, 0.01],
		["energy", "Energy", 0, 1, 0.01],
		["density", "Density", 0, 1, 0.01],
		["tension", "Tension", 0, 1, 0.01],
		["fillChance", "Fill frequency", 0, 1, 0.01],
		["chaos", "Variation", 0, 1, 0.01]
	] as const) {
		const input = document.createElement("input")
		input.name = key
		input.setAttribute("aria-label", name)
		input.type = "range"
		input.min = String(min)
		input.max = String(max)
		input.step = String(step)
		input.addEventListener(EVENT_INPUT, () => device.configure({ [key]: input.valueAsNumber }))
		const row = label(name, input, key === "volume" ? element : advanced)
		const output = document.createElement("output")
		row.append(output)
		controls.set(key, input)
		values.set(key, output)
	}
	for (const [key, name] of [
		["rapidPercussion", "Rapid fills & tuplets"],
		["muteKick", "Mute kick"],
		["muteSnare", "Mute snare"],
		["muteHat", "Mute hats"],
		["muteClap", "Mute clap"]
	] as const) {
		const input = document.createElement("input")
		input.type = "checkbox"
		input.name = key
		input.setAttribute("aria-label", name)
		input.addEventListener(EVENT_CHANGE, () => device.configure({ [key]: input.checked }))
		const row = label(name, input, advanced)
		Object.assign(row.style, {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between"
		})
		controls.set(key, input)
	}
	const compressor = document.createElement("details")
	const compressorSummary = document.createElement("summary")
	compressorSummary.textContent = "Compressor"
	compressor.append(compressorSummary)
	const enabled = document.createElement("input")
	enabled.type = "checkbox"
	enabled.name = "compressorEnabled"
	enabled.setAttribute("aria-label", "Enable compressor")
	enabled.addEventListener(EVENT_CHANGE, () =>
		device.configure({ compressorEnabled: enabled.checked })
	)
	label("Enable compressor", enabled, compressor)
	controls.set("compressorEnabled", enabled)
	for (const key of Object.keys(
		DRUM_COMPRESSOR_PARAMETERS
	) as (keyof typeof DRUM_COMPRESSOR_PARAMETERS)[]) {
		const parameter = DRUM_COMPRESSOR_PARAMETERS[key]
		const input = document.createElement("input")
		input.type = "range"
		input.name = key
		input.setAttribute("aria-label", `Compressor ${parameter.name.toLowerCase()}`)
		input.min = String(parameter.min)
		input.max = String(parameter.max)
		input.step = String(parameter.step)
		input.addEventListener(EVENT_INPUT, () => device.configure({ [key]: input.valueAsNumber }))
		const row = label(parameter.name, input, compressor)
		const output = document.createElement("output")
		row.append(output)
		controls.set(key, input)
		values.set(key, output)
	}
	const actions = document.createElement("div")
	Object.assign(actions.style, { display: "flex", gap: "0.5rem" })
	const fill = document.createElement("button")
	fill.type = "button"
	fill.textContent = "Request fill"
	fill.addEventListener(EVENT_CLICK, () => device.requestFill())
	actions.append(fill)
	element.append(advanced, compressor, actions)

	let lastGenre: DrumGenre | undefined
	const sync = () => {
		const settings = device.options
		if (settings.genre !== lastGenre) {
			groove.replaceChildren()
			for (const id of DRUM_GENRES[settings.genre].grooves) {
				groove.add(
					option(
						id
							.replaceAll("-", " ")
							.replace(/^./, (character) => character.toUpperCase()),
						id
					)
				)
			}
			lastGenre = settings.genre
		}
		for (const [key, control] of controls) {
			const value = settings[key]
			if (control instanceof HTMLInputElement && control.type === "checkbox") {
				control.checked = Boolean(value)
			} else {
				control.value = String(value)
			}
			const output = values.get(key)
			if (Object.hasOwn(DRUM_COMPRESSOR_PARAMETERS, key)) {
				const parameter =
					DRUM_COMPRESSOR_PARAMETERS[key as keyof typeof DRUM_COMPRESSOR_PARAMETERS]
				control.disabled = !settings.compressorEnabled
				if (output) {
					output.textContent = `${Number((Number(value) * parameter.scale).toFixed(1))}${parameter.unit === ":1" ? "" : " "}${parameter.unit}`
				}
			} else if (output) {
				output.textContent = `${Math.round(Number(value) * 100)}%`
			}
		}
	}
	device.addEventListener(EVENT_CONFIGURATION_CHANGED, sync)
	sync()
	return {
		element,
		dispose: () => {
			device.removeEventListener(EVENT_CONFIGURATION_CHANGED, sync)
			element.remove()
		}
	}
}