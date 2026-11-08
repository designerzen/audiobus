import { EVENT_CHANGE, EVENT_CLICK, EVENT_KEY_DOWN, EVENT_TOGGLE } from "../event-constants"
import {
	KEYBOARD_MODES,
	KEYBOARD_COMMANDS,
	type KeyboardConfiguration
} from "../hardware/keyboard/keyboard-configuration"
import { defaultKeyboardBindings } from "../hardware/keyboard/keyboard"
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
	let selected = 0
	let settingsOpen = false
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
		description.textContent =
			configuration.mode === "custom"
				? "Play using your saved mapping. Change individual keys in Keyboard settings."
				: KEYBOARD_MODES[configuration.mode][1]
		listen(mode.control, EVENT_CHANGE, () => {
			learning = null
			const nextMode = mode.control.value as KeyboardConfiguration["mode"]
			update({
				...configuration,
				mode: nextMode,
				bindings:
					nextMode === "custom" && configuration.bindings.length === 0
						? defaultKeyboardBindings(
								configuration.mode === "custom" ? "combined" : configuration.mode
							)
						: configuration.bindings
			})
			render()
		})
		root.append(mode.field, description)
		if (configuration.mode !== "custom") {
			return
		}
		const summary = document.createElement("p")
		summary.textContent = configuration.bindings.length
			? `${configuration.bindings.length} custom bindings ready to use.`
			: "No keys assigned. Choose Notes and shortcuts to play immediately, or open settings to use the standard mapping."
		const settings = document.createElement("details")
		settings.open = settingsOpen
		const toggle = document.createElement("summary")
		toggle.textContent = "Keyboard settings"
		settings.append(toggle)
		root.append(summary, settings)
		listen(settings, EVENT_TOGGLE, () => {
			if (settingsOpen === settings.open) {
				return
			}
			settingsOpen = settings.open
			learning = null
			render()
		})
		if (!settingsOpen) {
			return
		}
		const editor = document.createElement("div")
		editor.className = "keyboard-binding-editor"
		settings.append(editor)
		if (configuration.bindings.length > 0) {
			selected = Math.min(selected, configuration.bindings.length - 1)
			const picker = select(
				"Edit binding",
				configuration.bindings.map((_, index) => String(index)),
				String(selected)
			)
			for (const option of picker.control.options) {
				const binding = configuration.bindings[Number(option.value)]
				option.textContent = `${binding.key === " " ? "Space" : binding.key} · ${binding.command} · ${binding.value}`
			}
			listen(picker.control, EVENT_CHANGE, () => {
				selected = Number(picker.control.value)
				learning = null
				render()
			})
			editor.append(picker.field)
		}
		configuration.bindings.forEach((binding, index) => {
			if (index !== selected) {
				return
			}
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
				const bindings = configuration.bindings
					.map((binding, i) =>
						i === index
							? {
									key: key.control.value,
									command: command.control.value,
									value: Number(value.value)
								}
							: binding
					)
					.filter((binding, i) => i === index || binding.key !== key.control.value)
				selected = bindings.findIndex((binding) => binding.key === key.control.value)
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
			editor.append(row)
		})
		const status = document.createElement("p")
		status.setAttribute("role", "status")
		status.textContent =
			learning === null
				? "Value: MIDI note/program/controller number (0–127), pitch bend (−1 to 1), or command value."
				: "Press a key to bind it. Escape cancels."
		editor.append(
			status,
			button("Add binding", () => {
				const key = KEYS.find(
					(key) => !configuration.bindings.some((binding) => binding.key === key)
				)
				if (!key) {
					return
				}
				learning = null
				selected = configuration.bindings.length
				update({
					...configuration,
					bindings: [...configuration.bindings, { key, command: NOTE_ON, value: 60 }]
				})
				render()
			}),
			button("Use standard mapping", () => {
				learning = null
				selected = 0
				update({ ...configuration, bindings: defaultKeyboardBindings() })
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
						bindings: configuration.bindings
							.map((item, i) => (i === learning ? { ...binding, key } : item))
							.filter((item, i) => i === learning || item.key !== key)
					})
					selected = getConfiguration().bindings.findIndex((item) => item.key === key)
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