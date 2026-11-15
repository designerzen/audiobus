import type OutputProtocol from "./outputs/output-protocol"
import { type CommandDescriptor, type Params, validate } from "audiobus-protocol"
import { devicePanel, changed } from "./device-controls"
import { EVENT_CLICK, EVENT_CHANGE, EVENT_SUBMIT } from "../events/event-constants"
import { createProtocolPropertyControls } from "./protocol-property-controls"

export function createProtocolOutputControls(output: OutputProtocol) {
	const element = devicePanel()
	const properties = createProtocolPropertyControls(output)
	const lifetime = new AbortController()
	const options = { signal: lifetime.signal }
	const field = (title: string, control: HTMLElement) => {
		const label = document.createElement("label")
		label.textContent = title
		label.append(control)
		return label
	}
	const url = document.createElement("input")
	url.type = "url"
	url.value = output.options.url
	url.placeholder = "https://other-app.example/"
	const mode = document.createElement("select")
	for (const [value, title] of [
		["audiobus", "audioBus Protocol"],
		["webmidilink", "WebMidiLink (MIDI and patches)"]
	]) {
		const choice = document.createElement("option")
		choice.value = value
		choice.textContent = title
		mode.append(choice)
	}
	mode.value = output.options.mode
	const fallback = document.createElement("input")
	fallback.type = "checkbox"
	fallback.checked = output.options.allowMidi1Fallback === true
	fallback.addEventListener(
		EVENT_CHANGE,
		() => {
			output.options.allowMidi1Fallback = fallback.checked
			changed(output)
		},
		options
	)
	const status = document.createElement("p")
	status.setAttribute("role", "status")
	const report = (error: unknown) => {
		status.textContent = error instanceof Error ? error.message : String(error)
	}
	const open = document.createElement("button")
	open.type = "button"
	open.textContent = "Open and pair destination"
	open.addEventListener(
		EVENT_CLICK,
		() => {
			try {
				const address = new URL(url.value)
				if (!["http:", "https:"].includes(address.protocol)) {
					throw new Error("Use an HTTP or HTTPS destination URL")
				}
				const target = window.open(address.href, "_blank")
				if (!target) {
					throw new Error("Allow popups to open the destination")
				}
				output.attach(target, address.origin)
				output.options.url = address.href
				changed(output)
				status.textContent = "Paired. Press Connect when the destination is ready."
			} catch (error) {
				report(error)
			}
		},
		options
	)
	mode.addEventListener(
		EVENT_CHANGE,
		() => {
			void output.disconnect().catch(report)
			output.options.mode = mode.value
			changed(output)
			update()
		},
		options
	)
	const refreshButton = document.createElement("button")
	refreshButton.type = "button"
	refreshButton.textContent = "Discover destination commands"
	const commands = document.createElement("select")
	commands.setAttribute("aria-label", "Destination command")
	const form = document.createElement("form")
	const argumentsHost = document.createElement("div")
	const run = document.createElement("button")
	run.type = "submit"
	run.textContent = "Run destination command"
	form.append(argumentsHost, run)
	let descriptors: CommandDescriptor[] = []
	const editors = new Map<string, HTMLInputElement | HTMLSelectElement>()
	let revision = 0
	const select = () => {
		editors.clear()
		argumentsHost.replaceChildren()
		const descriptor = descriptors.find((item) => item.id === commands.value)
		run.disabled = !descriptor?.available || !output.isConnected
		if (!descriptor) {
			return
		}
		for (const [name, parameter] of Object.entries(descriptor.inputSchema.properties)) {
			let control: HTMLInputElement | HTMLSelectElement
			if (parameter.enum || parameter.type === "boolean") {
				control = document.createElement("select")
				for (const item of parameter.enum ?? [true, false]) {
					const option = document.createElement("option")
					option.value = String(item)
					option.textContent = String(item)
					control.append(option)
				}
			} else {
				control = document.createElement("input")
				control.type = parameter.type === "string" ? "text" : "number"
				if (control.type === "number") {
					control.step = parameter.type === "integer" ? "1" : "any"
					if (parameter.minimum !== undefined) {
						control.min = String(parameter.minimum)
					}
					if (parameter.maximum !== undefined) {
						control.max = String(parameter.maximum)
					}
				}
			}
			control.required = descriptor.inputSchema.required?.includes(name) ?? false
			argumentsHost.append(field(parameter.description ?? name, control))
			editors.set(name, control)
		}
	}
	const update = () => {
		properties.update()
		revision++
		const control = output.isConnected && output.options.mode === "audiobus"
		refreshButton.disabled = !control
		commands.disabled = !control
		if (!control) {
			descriptors = []
			commands.replaceChildren()
			select()
		}
		status.textContent = output.isConnected
			? "Connected"
			: "Pair a destination, then press Connect."
	}
	const refresh = async () => {
		if (!output.isConnected || output.options.mode !== "audiobus") {
			return
		}
		const request = ++revision
		void properties.refresh()
		try {
			const result = await output.discover()
			if (request !== revision || lifetime.signal.aborted) {
				return
			}
			const previous = commands.value
			descriptors = result
			commands.replaceChildren(
				...result.map((descriptor) => {
					const option = document.createElement("option")
					option.value = descriptor.id
					option.textContent = descriptor.title
					option.disabled = !descriptor.available
					return option
				})
			)
			commands.value = result.some((item) => item.id === previous && item.available)
				? previous
				: (result.find((item) => item.available)?.id ?? "")
			select()
			status.textContent = `${result.length} destination commands available.`
		} catch (error) {
			if (request === revision && !lifetime.signal.aborted) {
				report(error)
			}
		}
	}
	commands.addEventListener(EVENT_CHANGE, select, options)
	refreshButton.addEventListener(
		EVENT_CLICK,
		() => {
			void refresh()
		},
		options
	)
	form.addEventListener(
		EVENT_SUBMIT,
		(event) => {
			event.preventDefault()
			const descriptor = descriptors.find((item) => item.id === commands.value)
			if (!descriptor || run.disabled) {
				return
			}
			const args: Params = Object.create(null)
			for (const [name, editor] of editors) {
				if (!editor.reportValidity()) {
					return
				}
				if (!editor.value && !editor.required) {
					continue
				}
				const type = descriptor.inputSchema.properties[name].type
				args[name] =
					type === "boolean"
						? editor.value === "true"
						: type === "string"
							? editor.value
							: Number(editor.value)
			}
			try {
				validate(descriptor.inputSchema, args)
				run.disabled = true
				const connection = output.connection
				void output
					.call(descriptor.id, args)
					.then(
						(result) => {
							if (!lifetime.signal.aborted && connection === output.connection) {
								status.textContent =
									result === null ? "Command completed." : JSON.stringify(result)
							}
						},
						(error) => {
							if (!lifetime.signal.aborted && connection === output.connection) {
								report(error)
							}
						}
					)
					.finally(() => {
						run.disabled = !output.isConnected || !descriptor.available
					})
			} catch (error) {
				report(error)
			}
		},
		options
	)
	element.append(
		field("Destination URL", url),
		field("Protocol", mode),
		field("Allow lossy MIDI 1 conversion for group zero", fallback),
		open,
		status,
		refreshButton,
		field("Destination command", commands),
		form,
		properties.element
	)
	update()
	if (output.isConnected) {
		void refresh()
	}
	return {
		element,
		update,
		refresh,
		propertyChanged: properties.changed,
		destroy: () => {
			revision++
			lifetime.abort()
			properties.destroy()
			element.remove()
		}
	}
}