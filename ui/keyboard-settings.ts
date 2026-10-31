import { EVENT_CHANGE, EVENT_CLICK, EVENT_KEY_DOWN } from "../event-constants"
import {
	KEYBOARD_MODES,
	KEYBOARD_COMMANDS,
	type KeyboardConfiguration
} from "../hardware/keyboard/keyboard-configuration"
import { NOTE_ON, PITCH_BEND, PROGRAM_CHANGE, CONTROL_CHANGE } from "../commands"

const KEYS = [
	..."`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./",
	" ",
	"Enter",
	"Escape",
	"Delete",
	"Backspace",
	"Tab",
	"ArrowLeft",
	"ArrowRight",
	"ArrowUp",
	"ArrowDown",
	...Array.from({ length: 12 }, (_, i) => `F${i + 1}`)
]

export function createKeyboardSettings(
	root: HTMLElement,
	getConfiguration: () => KeyboardConfiguration,
	update: (configuration: KeyboardConfiguration) => void
): () => void {
	const lifetime = new AbortController()
	let events = new AbortController()
	let learning: number | null = null
	const listen = (element: EventTarget, type: string, callback: EventListener) =>
		element.addEventListener(type, callback, { signal: events.signal })
	const select = (label: string, choices: readonly string[], value: string) => {
		const field = document.createElement("label")
		field.append(`${label} `)
		const control = document.createElement("select")
		control.setAttribute("aria-label", label)
		for (const choice of choices) {
			const option = document.createElement("option")
			option.value = choice
			option.textContent = choice === " " ? "Space" : choice
			control.append(option)
		}
		control.value = value
		field.append(control)
		return { field, control }
	}
	const button = (text: string, action: () => void) => {
		const control = document.createElement("button")
		control.type = "button"
		control.textContent = text
		listen(control, EVENT_CLICK, action)
		return control
	}
	const render = () => {
		events.abort()
		events = new AbortController()
		root.replaceChildren()
		const configuration = getConfiguration()
		const mode = select("Operating mode", Object.keys(KEYBOARD_MODES), configuration.mode)
		for (const option of mode.control.options) {
			option.textContent = KEYBOARD_MODES[option.value as keyof typeof KEYBOARD_MODES][0]
		}
		const description = document.createElement("p")
		description.textContent = KEYBOARD_MODES[configuration.mode][1]
		listen(mode.control, EVENT_CHANGE, () => {
			learning = null
			update({ ...configuration, mode: mode.control.value as KeyboardConfiguration["mode"] })
			render()
		})
		root.append(mode.field, description)
		if (configuration.mode !== "custom") {
			return
		}
		configuration.bindings.forEach((binding, index) => {
			const row = document.createElement("fieldset")
			const legend = document.createElement("legend")
			legend.textContent = `Binding ${index + 1}`
			const key = select("Key", [...new Set([...KEYS, binding.key])], binding.key)
			const command = select("Command", KEYBOARD_COMMANDS, binding.command)
			const valueLabel = document.createElement("label")
			valueLabel.append("Value ")
			const value = document.createElement("input")
			value.type = "number"
			value.setAttribute("aria-label", "Value")
			value.value = String(binding.value)
			const midi = [NOTE_ON, PROGRAM_CHANGE, CONTROL_CHANGE].includes(binding.command)
			value.step = midi ? "1" : "any"
			if (midi || binding.command === PITCH_BEND) {
				value.min = midi ? "0" : "-1"
				value.max = midi ? "127" : "1"
			}
			valueLabel.append(value)
			const save = () => {
				if (!value.checkValidity() || value.value === "") {
					return
				}
				const bindings = configuration.bindings.filter((_, i) => i !== index)
				bindings.push({
					key: key.control.value,
					command: command.control.value,
					value: Number(value.value)
				})
				learning = null
				update({ ...configuration, bindings })
				render()
			}
			listen(key.control, EVENT_CHANGE, save)
			listen(command.control, EVENT_CHANGE, () => {
				value.value = command.control.value === NOTE_ON ? "60" : "0"
				value.removeAttribute("min")
				value.removeAttribute("max")
				save()
			})
			listen(value, EVENT_CHANGE, save)
			row.append(
				legend,
				key.field,
				button(learning === index ? "Cancel learning" : "Learn key", () => {
					learning = learning === index ? null : index
					render()
				}),
				command.field,
				valueLabel,
				button("Remove binding", () => {
					learning = null
					update({
						...configuration,
						bindings: configuration.bindings.filter((_, i) => i !== index)
					})
					render()
				})
			)
			root.append(row)
		})
		const status = document.createElement("p")
		status.setAttribute("role", "status")
		status.textContent =
			learning === null
				? "Value: MIDI note/program/controller number (0–127), pitch bend (−1 to 1), or command value."
				: "Press a key to bind it. Escape cancels."
		root.append(
			status,
			button("Add binding", () => {
				const key = KEYS.find(
					(key) => !configuration.bindings.some((binding) => binding.key === key)
				)
				if (!key) {
					return
				}
				learning = null
				update({
					...configuration,
					bindings: [...configuration.bindings, { key, command: NOTE_ON, value: 60 }]
				})
				render()
			})
		)
	}
	window.addEventListener(
		EVENT_KEY_DOWN,
		(event) => {
			if (learning === null) {
				return
			}
			event.preventDefault()
			event.stopImmediatePropagation()
			if (event.repeat) {
				return
			}
			const configuration = getConfiguration()
			if (event.key !== "Escape") {
				const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
				const binding = configuration.bindings[learning]
				if (binding) {
					update({
						...configuration,
						bindings: [
							...configuration.bindings.filter((_, i) => i !== learning),
							{ ...binding, key }
						]
					})
				}
			}
			learning = null
			render()
		},
		{ capture: true, signal: lifetime.signal }
	)
	render()
	return () => {
		lifetime.abort()
		events.abort()
		root.replaceChildren()
	}
}