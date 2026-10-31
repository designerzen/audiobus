import { createDomGui } from "control-surface/dom"
import { bindingKey, validateValue } from "control-surface/model"
import type {
	ComponentUi,
	ControlBinding,
	ControlDescriptor,
	ControlValue,
	UiDescriptor
} from "control-surface/types"
import { EVENT_CHANGE, EVENT_INPUT, EVENT_CONFIGURATION_CHANGED } from "../event-constants"
import type { FieldConfig } from "./transformers/interface-transformer"

type Component = ComponentUi & {
	name?: string
	fields?: FieldConfig[]
	options?: unknown
	setConfig?(key: string, value: unknown): unknown
	addEventListener?: EventTarget["addEventListener"]
	removeEventListener?: EventTarget["removeEventListener"]
}
export function fieldsDescriptor(fields: FieldConfig[]): UiDescriptor {
	return {
		controls: fields.map((field) => ({
			id: field.name,
			label: field.label ?? field.name,
			group: field.group,
			help: field.help,
			defaultValue: field.default,
			disabled: field.enabled === false,
			widget:
				field.type === "button"
					? "button"
					: field.type === "select"
						? "select"
						: field.type === "number"
							? "number"
							: "text",
			min: field.min ?? (field.type === "number" ? -1000000 : undefined),
			max: field.max ?? (field.type === "number" ? 1000000 : undefined),
			step: field.step,
			choices: field.values?.map((value) =>
				typeof value === "object"
					? { label: value.name, value: value.value }
					: { label: String(value), value }
			)
		}))
	}
}

const listeners = new WeakMap<object, Set<() => void>>()
export function notifyControls(component: object): void {
	for (const listener of listeners.get(component) ?? []) {
		listener()
	}
}
export function subscribeControls(component: Component, listener: () => void): () => void {
	let set = listeners.get(component)
	if (!set) {
		listeners.set(component, (set = new Set()))
	}
	set.add(listener)
	component.addEventListener?.(EVENT_CONFIGURATION_CHANGED, listener)
	return () => {
		set!.delete(listener)
		component.removeEventListener?.(EVENT_CONFIGURATION_CHANGED, listener)
	}
}

/** Bridge legacy native GUIs until each engine supplies its own declarative descriptor.
 * It never clones, moves, or destroys the component's cached GUI. */
interface LegacyControl {
	descriptor: ControlDescriptor
	element: HTMLInputElement | HTMLSelectElement | HTMLButtonElement | HTMLTextAreaElement
	radios?: HTMLInputElement[]
}
async function legacyControls(
	component: Component,
	create?: ComponentUi["createGui"]
): Promise<Map<string, LegacyControl>> {
	const map = new Map<string, LegacyControl>()
	if (!create) {
		return map
	}
	const root = await create.call(component)
	const visit = (parent: ParentNode) => {
		for (const node of parent.querySelectorAll<HTMLElement>("*")) {
			if (node.shadowRoot) {
				visit(node.shadowRoot)
			}
			if (
				!(
					node instanceof HTMLInputElement ||
					node instanceof HTMLSelectElement ||
					node instanceof HTMLButtonElement ||
					node instanceof HTMLTextAreaElement
				)
			) {
				continue
			}
			if (
				node instanceof HTMLInputElement &&
				["hidden", "file", "submit", "password"].includes(node.type)
			) {
				continue
			}
			const labelCopy = node.labels?.[0]?.cloneNode(true) as HTMLElement | undefined
			for (const child of labelCopy?.querySelectorAll(
				"input,select,button,textarea,output"
			) ?? []) {
				child.remove()
			}
			const label =
				node.getAttribute("aria-label") ||
				labelCopy?.textContent?.trim() ||
				node.title ||
				node.textContent?.trim() ||
				node.name ||
				node.id ||
				node.tagName
			const base = node.dataset.midiControl || node.name || node.id || label
			if (node instanceof HTMLInputElement && node.type === "radio") {
				const group = map.get(base)
				if (group?.radios) {
					group.radios.push(node)
					group.descriptor.choices!.push({ label, value: node.value })
					continue
				}
				map.set(base, {
					descriptor: {
						id: base,
						label: node.name || label,
						widget: "radio",
						choices: [{ label, value: node.value }]
					},
					element: node,
					radios: [node]
				})
				continue
			}
			let id = base,
				suffix = 1
			while (map.has(id)) {
				id = `${base}:${suffix++}`
			}
			const descriptor: ControlDescriptor = {
				id,
				label: label.slice(0, 100),
				widget: "text",
				disabled: node.disabled
			}
			if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
				descriptor.readOnly = node.readOnly
			}
			if (node instanceof HTMLSelectElement) {
				descriptor.widget = "select"
				descriptor.choices = [...node.options]
					.filter((o) => !o.disabled)
					.map((o) => ({ label: o.text, value: o.value }))
			} else if (node instanceof HTMLButtonElement || node.type === "button") {
				descriptor.widget = "button"
			} else if (node instanceof HTMLInputElement) {
				descriptor.widget =
					node.type === "checkbox"
						? "toggle"
						: node.type === "radio"
							? "toggle"
							: node.type === "range"
								? "slider"
								: node.type === "number"
									? "number"
									: node.type === "color"
										? "color"
										: "text"
				if (["range", "number"].includes(node.type)) {
					descriptor.min =
						node.min === "" ? (node.type === "range" ? 0 : -1000000) : Number(node.min)
					descriptor.max =
						node.max === "" ? (node.type === "range" ? 100 : 1000000) : Number(node.max)
					descriptor.step = node.step === "any" ? 0 : Number(node.step || 1)
				}
			}
			map.set(id, { descriptor, element: node })
		}
	}
	visit(root)
	return map
}

const installed = new WeakSet<object>()
/** Common capability installation also covers external/legacy devices without inheritance. */
export function installComponentUi<T extends object>(target: T): T & ComponentUi {
	const component = target as T & Component
	if (installed.has(component)) {
		return component
	}
	installed.add(component)
	const originalGui = component.createGui,
		originalDestroy = component.destroyGui
	const legacyGui = !component.getUiDescriptor && !component.fields && !!originalGui
	let leases = 0,
		pendingDestroy = false
	let legacy = new Map<string, LegacyControl>()
	let legacyRoot: HTMLElement | undefined
	let legacyLoading: Promise<HTMLElement> | undefined
	if (legacyGui) {
		component.createGui = async () => {
			pendingDestroy = false
			if (legacyRoot) {
				return legacyRoot
			}
			legacyLoading ??= Promise.resolve()
				.then(() => originalGui!.call(component))
				.then(async (root) => {
					legacyRoot = root
					legacy = await legacyControls(component, () => root)
					return root
				})
				.finally(() => {
					legacyLoading = undefined
				})
			return legacyLoading
		}
		component.destroyGui = async () => {
			if (leases) {
				pendingDestroy = true
				return
			}
			legacy.clear()
			legacyRoot = undefined
			await originalDestroy?.call(component)
		}
	}
	if (!component.getUiDescriptor) {
		component.getUiDescriptor = async () => {
			if (component.fields) {
				return fieldsDescriptor(component.fields)
			}
			legacy = await legacyControls(
				component,
				legacyRoot ? () => legacyRoot! : originalGui ? component.createGui : undefined
			)
			return {
				title: component.name,
				controls: [...legacy.values()].map((v) => v.descriptor)
			}
		}
	}
	if (!component.getControlValue) {
		component.getControlValue = (id) => {
			if (component.fields) {
				return (
					(component.options as Record<string, ControlValue> | undefined)?.[id] ??
					component.fields.find((f) => f.name === id)?.default
				)
			}
			const entry = legacy.get(id),
				node = entry?.element
			if (!node) {
				return undefined
			}
			entry.descriptor.disabled = node.disabled
			if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
				entry.descriptor.readOnly = node.readOnly
			}
			if (entry.radios) {
				return entry.radios.find((radio) => radio.checked)?.value
			}
			if (node instanceof HTMLInputElement) {
				if (["checkbox", "radio"].includes(node.type)) {
					return node.checked
				}
				if (["range", "number"].includes(node.type)) {
					return node.valueAsNumber
				}
			}
			return node.value
		}
	}
	if (!component.setControlValue) {
		component.setControlValue = async (id, value) => {
			if (component.fields) {
				await component.setConfig?.(id, value)
				notifyControls(component)
				return
			}
			const entry = legacy.get(id)
			if (!entry) {
				throw new Error("Control no longer exists")
			}
			const { element, descriptor } = entry
			validateValue({ ...descriptor, disabled: element.disabled }, value)
			if (entry.radios) {
				const radio = entry.radios.find((node) => node.value === value)
				if (!radio || radio.disabled) {
					throw new Error("Choose an available option")
				}
				radio.click()
			} else if (descriptor.widget === "button") {
				element.click()
			} else {
				if (
					element instanceof HTMLInputElement &&
					["checkbox", "radio"].includes(element.type)
				) {
					element.checked = Boolean(value)
				} else {
					element.value = String(value)
				}
				element.dispatchEvent(new Event(EVENT_INPUT, { bubbles: true }))
				element.dispatchEvent(new Event(EVENT_CHANGE, { bubbles: true }))
			}
			notifyControls(component)
		}
	}
	if (!component.subscribeControls) {
		component.subscribeControls = (listener) => {
			if (legacyGui) {
				leases++
			}
			const unsubscribe = subscribeControls(component, listener)
			let released = false
			return () => {
				if (released) {
					return
				}
				released = true
				unsubscribe()
				if (legacyGui && !--leases && pendingDestroy) {
					pendingDestroy = false
					void component.destroyGui?.()
				}
			}
		}
	}
	if (!originalGui) {
		let gui: ReturnType<typeof createDomGui> | undefined
		component.createGui = async () => {
			if (!gui) {
				gui = createDomGui(await componentBindings(component, "generated"))
			}
			return gui.element
		}
		component.destroyGui = () => {
			gui?.destroy()
			gui = undefined
		}
	}
	return component
}

export async function componentBindings(
	component: Component,
	componentId: string
): Promise<ControlBinding[]> {
	installComponentUi(component)
	const descriptor = await component.getUiDescriptor!()
	return descriptor.controls
		.filter((d) => !d.hidden)
		.map((d) => ({
			key: bindingKey(componentId, d.id),
			sourceLabel: component.name ?? descriptor.title ?? "Component",
			descriptor: d,
			read: () => component.getControlValue!(d.id),
			async write(value) {
				await component.setControlValue!(d.id, validateValue(d, value))
				notifyControls(component)
			},
			subscribe: (listener) => component.subscribeControls!(listener)
		}))
}