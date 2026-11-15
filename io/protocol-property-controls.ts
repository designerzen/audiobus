import type OutputProtocol from "./outputs/output-protocol"
import type { Json, PropertyDescriptor } from "audiobus-protocol"
import { EVENT_CHANGE, EVENT_CLICK } from "../events/event-constants"

/** A small property editor driven entirely by the paired application's metadata. */
export function createProtocolPropertyControls(output: OutputProtocol) {
	const element = document.createElement("fieldset"),
		legend = document.createElement("legend")
	legend.textContent = "Destination properties"
	const choice = document.createElement("select")
	choice.setAttribute("aria-label", "Destination property")
	const host = document.createElement("label"),
		status = document.createElement("output")
	status.setAttribute("role", "status")
	const read = document.createElement("button"),
		write = document.createElement("button")
	read.type = write.type = "button"
	read.textContent = "Read property"
	write.textContent = "Apply property"
	element.append(legend, choice, host, read, write, status)
	const lifetime = new AbortController(),
		options = { signal: lifetime.signal }
	let descriptors: PropertyDescriptor[] = [],
		editor: HTMLInputElement | HTMLSelectElement | undefined
	let revision = 0
	const selected = () => descriptors.find((item) => item.id === choice.value)
	const show = (value: Json) => {
		const property = selected()
		status.textContent = `Current value: ${value}${property?.unit ? ` ${property.unit}` : ""}`
		if (editor && document.activeElement !== editor) {
			editor.value = String(value)
		}
	}
	const report = (error: unknown) => {
		if (!lifetime.signal.aborted) {
			status.textContent = error instanceof Error ? error.message : String(error)
		}
	}
	const load = async () => {
		const property = selected(),
			connection = output.connection
		if (!property) {
			return
		}
		const token = ++revision
		try {
			const value = await output.getProperty(property.id)
			if (
				token === revision &&
				connection === output.connection &&
				!lifetime.signal.aborted
			) {
				show(value)
			}
		} catch (error) {
			if (token === revision) {
				report(error)
			}
		}
	}
	const render = () => {
		host.replaceChildren()
		editor = undefined
		const property = selected()
		write.disabled = !property?.available || property.readOnly
		read.disabled = !property?.available
		if (!property) {
			return
		}
		host.textContent = `${property.title}${property.unit ? ` (${property.unit})` : ""}`
		const schema = property.schema
		if (schema.enum || schema.type === "boolean") {
			editor = document.createElement("select")
			for (const value of schema.enum ?? [true, false]) {
				const option = document.createElement("option")
				option.value = String(value)
				option.textContent = String(value)
				editor.append(option)
			}
		} else {
			editor = document.createElement("input")
			editor.type = schema.type === "string" ? "text" : "number"
			if (editor.type === "number") {
				editor.step = schema.type === "integer" ? "1" : "any"
				if (schema.minimum !== undefined) {
					editor.min = String(schema.minimum)
				}
				if (schema.maximum !== undefined) {
					editor.max = String(schema.maximum)
				}
			}
		}
		editor.required = true
		editor.disabled = property.readOnly || !property.available
		host.append(editor)
		void load()
	}
	choice.addEventListener(EVENT_CHANGE, render, options)
	read.addEventListener(
		EVENT_CLICK,
		() => {
			void load()
		},
		options
	)
	write.addEventListener(
		EVENT_CLICK,
		() => {
			const property = selected(),
				connection = output.connection
			if (!editor || !property || write.disabled || !editor.reportValidity()) {
				return
			}
			const type = property.schema.type
			const value =
				type === "boolean"
					? editor.value === "true"
					: type === "string"
						? editor.value
						: Number(editor.value)
			write.disabled = true
			void output
				.setProperty(property.id, value)
				.then((actual) => {
					if (
						connection === output.connection &&
						selected()?.id === property.id &&
						!lifetime.signal.aborted
					) {
						show(actual)
					}
				}, report)
				.finally(() => {
					write.disabled = !output.isConnected || (selected()?.readOnly ?? true)
				})
		},
		options
	)
	const update = () => {
		revision++
		element.hidden = !output.isConnected || !output.connection?.supports("properties")
		element.disabled = element.hidden
		if (element.hidden) {
			descriptors = []
			choice.replaceChildren()
			host.replaceChildren()
			editor = undefined
		}
	}
	const refresh = async () => {
		update()
		if (element.hidden) {
			return
		}
		const connection = output.connection,
			token = ++revision
		try {
			const properties = await output.listProperties()
			if (token !== revision || connection !== output.connection || lifetime.signal.aborted) {
				return
			}
			const previous = choice.value
			descriptors = properties
			choice.replaceChildren(
				...properties.map((property) => {
					const option = document.createElement("option")
					option.value = property.id
					option.textContent = property.title
					option.disabled = !property.available
					return option
				})
			)
			choice.value = properties.some((item) => item.id === previous && item.available)
				? previous
				: (properties.find((item) => item.available)?.id ?? "")
			render()
		} catch (error) {
			if (token === revision) {
				report(error)
			}
		}
	}
	update()
	return {
		element,
		update,
		refresh,
		changed(data: Json) {
			if (
				data &&
				typeof data === "object" &&
				!Array.isArray(data) &&
				data.id === choice.value &&
				Object.hasOwn(data, "value")
			) {
				revision++
				show(data.value)
			}
		},
		destroy() {
			revision++
			lifetime.abort()
			element.remove()
		}
	}
}