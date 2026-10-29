import type { IAudioCommand } from "../../audio-command-interface"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PITCH_BEND, PROGRAM_CHANGE } from "../../commands"
import { CHANNEL_PRESSURE } from "../midi-command-conversion"
import {
	EVENT_BLUR,
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_POINTER_CANCEL,
	EVENT_LOST_POINTER_CAPTURE,
	EVENT_VISIBILITY_CHANGE
} from "../../event-constants"
import {
	controlMessage,
	controlRange,
	type MidiDeviceProfile,
	type MidiProfileMessage,
	type MidiSurfaceElement
} from "./device-profile-schema"

export function validSurfaceBinding(value: unknown): value is MidiProfileMessage {
	if (!value || typeof value !== "object") {
		return false
	}
	const message = value as MidiProfileMessage
	if (!["note", "cc", "pitchBend", "channelPressure", "programChange"].includes(message.type)) {
		return false
	}
	if (
		message.channel !== undefined &&
		(!Number.isInteger(message.channel) || message.channel < 1 || message.channel > 16)
	) {
		return false
	}
	return (
		!["note", "cc"].includes(message.type) ||
		(Number.isInteger(message.number) && message.number! >= 0 && message.number! <= 127)
	)
}

export function createMidiDeviceSurface(
	profile: MidiDeviceProfile,
	options: Record<string, any>,
	perform: (message: MidiProfileMessage, value: number) => void,
	changed: () => void
) {
	const surface = profile.surface!
	const element = document.createElement("section")
	element.setAttribute("aria-label", `${profile.name} interactive hardware`)
	const abort = new AbortController()
	const listen = (target: EventTarget, type: string, callback: (event: any) => void) =>
		target.addEventListener(type, callback, { signal: abort.signal })
	const definitions = new Map(profile.controls.map((control) => [control.id, control]))
	const namespace = "http://www.w3.org/2000/svg"
	const svg = <K extends keyof SVGElementTagNameMap>(tag: K) =>
		document.createElementNS(namespace, tag)
	const frame = document.createElement("div")
	frame.style.cssText = "position:relative;width:100%"
	const image = document.createElement("img")
	image.src = surface.src
	image.alt = `${profile.name} hardware layout`
	image.style.cssText = "display:block;width:100%;height:auto"
	const canvas = svg("svg")
	canvas.setAttribute("viewBox", `0 0 ${surface.width} ${surface.height}`)
	canvas.setAttribute("aria-label", `${profile.name} playable controls`)
	canvas.style.cssText =
		"position:absolute;inset:0;width:100%;height:100%;touch-action:none;overflow:visible"
	frame.append(image, canvas)
	const status = document.createElement("output")
	status.setAttribute("aria-live", "polite")
	const editor = document.createElement("details")
	const summary = document.createElement("summary")
	summary.textContent = "MIDI mappings and learn"
	editor.append(summary)
	const select = document.createElement("select")
	select.setAttribute("aria-label", "Hardware control to map")
	for (const item of surface.elements) {
		const option = document.createElement("option")
		option.value = item.id
		option.textContent = item.label
		select.append(option)
	}
	const type = document.createElement("select")
	type.setAttribute("aria-label", "MIDI message type")
	for (const [value, label] of [
		["note", "Note"],
		["cc", "Control change"],
		["pitchBend", "Pitch bend"],
		["channelPressure", "Channel pressure"],
		["programChange", "Program change"]
	]) {
		const option = document.createElement("option")
		option.value = value
		option.textContent = label
		type.append(option)
	}
	const number = document.createElement("input")
	number.type = "number"
	number.min = "0"
	number.max = "127"
	number.step = "1"
	number.setAttribute("aria-label", "MIDI note or CC number")
	const channel = document.createElement("input")
	channel.type = "number"
	channel.min = "0"
	channel.max = "16"
	channel.step = "1"
	channel.setAttribute("aria-label", "Mapping channel (0 follows selected channel)")
	const learnLabel = document.createElement("label"),
		learn = document.createElement("input")
	learn.type = "checkbox"
	learnLabel.append(learn, " Learn next hardware message")
	editor.append(select, type, number, channel, learnLabel)
	element.append(frame, status, editor)
	for (const input of [select, type, number, channel, learn]) {
		input.dataset.midiIgnore = ""
	}
	let enabled = false
	const held = new Map<string, { messages: MidiProfileMessage[]; value: number }>()
	const visuals = new Map<
		string,
		{ group: SVGGElement; shape: SVGRectElement; value: number; notes: Set<string> }
	>()
	const mapping = (item: MidiSurfaceElement): MidiProfileMessage | undefined => {
		const custom = options.surfaceMappings?.[item.id]
		if (validSurfaceBinding(custom)) {
			return custom
		}
		return item.control ? controlMessage(definitions.get(item.control)!) : item.message
	}
	const range = (item: MidiSurfaceElement) =>
		item.control && !validSurfaceBinding(options.surfaceMappings?.[item.id])
			? controlRange(definitions.get(item.control)!)
			: { min: 0, max: mapping(item)?.type === "pitchBend" ? 16383 : 127, step: 1 }
	const update = (item: MidiSurfaceElement, value: number) => {
		const view = visuals.get(item.id)!
		view.value = value
		const { min, max } = range(item)
		const active = value > min
		view.group.dataset.active = String(active)
		if (item.kind === "knob" || item.kind === "fader") {
			view.group.setAttribute("aria-valuenow", String(value))
		} else {
			view.group.setAttribute("aria-pressed", String(active))
		}
		view.shape.setAttribute("fill", active ? "#6bffc0" : item.dark ? "#17212b" : "#d8e3ef")
		view.shape.setAttribute(
			"fill-opacity",
			active ? String(0.35 + (0.6 * (value - min)) / (max - min || 1)) : "0.12"
		)
		view.shape.setAttribute("stroke", active ? "#c8ffe9" : "#9dc4e8")
		view.shape.setAttribute("stroke-width", active ? "2.5" : "1")
	}
	const boundMessages = (item: MidiSurfaceElement) => {
		const message = mapping(item)
		if (!message) {
			return []
		}
		const configured = validSurfaceBinding(options.surfaceMappings?.[item.id])
		const messages = configured
			? [message]
			: item.control
				? (definitions.get(item.control)!.messages ?? [message])
				: [message]
		return messages.map((message) => ({
			...message,
			channel: message.channel ?? (options.selectedChannel || 1)
		}))
	}
	const releaseItem = (item: MidiSurfaceElement) => {
		const press = held.get(item.id)
		if (!press) {
			return
		}
		held.delete(item.id)
		for (const message of press.messages) {
			perform(message, message.type === "note" ? 0 : range(item).min)
		}
		update(item, 0)
	}
	const release = () => {
		for (const item of surface.elements) {
			releaseItem(item)
		}
	}
	const send = (item: MidiSurfaceElement, value: number, momentary = false) => {
		if (!enabled || learn.checked) {
			return
		}
		const messages = boundMessages(item)
		if (!messages.length) {
			status.textContent = `Set a MIDI mapping for ${item.label}.`
			editor.open = true
			return
		}
		if (momentary && held.has(item.id)) {
			return
		}
		const { min, max } = range(item)
		value = Math.round(Math.max(min, Math.min(max, value)))
		if (momentary) {
			held.set(item.id, { messages, value })
		}
		messages.forEach((message) => perform(message, value))
		update(item, value)
	}
	const syncEditor = () => {
		const item = surface.elements.find((item) => item.id === select.value)
		if (!item) {
			return
		}
		const message = mapping(item)
		type.value = message?.type ?? "cc"
		number.value = String(message?.number ?? 0)
		number.disabled = !["note", "cc"].includes(type.value)
		channel.value = String(message?.channel ?? 0)
	}
	listen(learn, EVENT_CHANGE, () => {
		const armed = learn.checked
		learn.checked = false
		release()
		learn.checked = armed
		status.textContent = armed
			? "Select a surface control, then move or press its hardware counterpart."
			: ""
	})
	listen(select, EVENT_CHANGE, syncEditor)
	for (const input of [type, number, channel]) {
		listen(input, EVENT_CHANGE, () => {
			const message: MidiProfileMessage = { type: type.value as MidiProfileMessage["type"] }
			if (["note", "cc"].includes(message.type)) {
				message.number = number.valueAsNumber
			}
			if (channel.valueAsNumber) {
				message.channel = channel.valueAsNumber
			}
			if (
				!validSurfaceBinding(message) ||
				!channel.value.trim() ||
				!Number.isInteger(channel.valueAsNumber) ||
				channel.valueAsNumber < 0 ||
				channel.valueAsNumber > 16
			) {
				syncEditor()
				return
			}
			release()
			options.surfaceMappings = { ...options.surfaceMappings, [select.value]: message }
			changed()
			syncEditor()
		})
	}
	for (const item of surface.elements) {
		const group = svg("g"),
			shape = svg("rect"),
			title = svg("title")
		const x = (item.position.x * surface.width) / 100,
			y = (item.position.y * surface.height) / 100
		const width = (item.position.width * surface.width) / 100,
			height = (item.position.height * surface.height) / 100
		group.dataset.surfaceControl = item.id
		group.dataset.midiIgnore = ""
		group.setAttribute("tabindex", "0")
		group.setAttribute(
			"role",
			item.kind === "knob" || item.kind === "fader" ? "slider" : "button"
		)
		group.setAttribute("aria-label", item.label)
		group.setAttribute("aria-valuemin", String(range(item).min))
		group.setAttribute("aria-valuemax", String(range(item).max))
		title.textContent = `${item.label}${item.learnable ? " · configurable mapping" : ""}`
		for (const [name, value] of Object.entries({
			x,
			y,
			width,
			height,
			rx: item.kind === "knob" ? Math.min(width, height) / 2 : 3
		})) {
			shape.setAttribute(name, String(value))
		}
		group.append(title, shape)
		canvas.append(group)
		visuals.set(item.id, { group, shape, value: 0, notes: new Set() })
		update(item, 0)
		let pointer: number | undefined
		const continuous = item.kind === "knob" || item.kind === "fader"
		const move = (event: PointerEvent) => {
			if (event.pointerId !== pointer || !continuous) {
				return
			}
			const box = canvas.getBoundingClientRect()
			if (!box.height) {
				return
			}
			const position = ((event.clientY - box.top) / box.height) * surface.height
			const { min, max } = range(item)
			send(item, min + (1 - (position - y) / height) * (max - min))
		}
		const press = (pressure = 1) => {
			select.value = item.id
			syncEditor()
			if (learn.checked) {
				status.textContent = `Move or press ${item.label} on the hardware.`
				return
			}
			const message = mapping(item),
				control = item.control ? definitions.get(item.control) : undefined
			if (control?.widget === "toggle") {
				send(
					item,
					visuals.get(item.id)!.value > range(item).min
						? range(item).min
						: range(item).max
				)
			} else if (!continuous) {
				send(
					item,
					Math.max(1, Math.round(range(item).max * pressure)),
					item.kind === "key" ||
						item.kind === "pad" ||
						message?.type === "note" ||
						!!control?.momentary
				)
			}
		}
		listen(group, EVENT_POINTER_DOWN, (event: PointerEvent) => {
			if (event.button !== 0) {
				return
			}
			event.preventDefault()
			pointer = event.pointerId
			group.setPointerCapture?.(pointer)
			press(event.pointerType !== "mouse" && event.pressure > 0 ? event.pressure : 1)
			if (!learn.checked) {
				move(event)
			}
		})
		listen(group, EVENT_POINTER_MOVE, move)
		for (const event of [
			EVENT_POINTER_UP,
			EVENT_POINTER_CANCEL,
			EVENT_LOST_POINTER_CAPTURE,
			EVENT_BLUR
		]) {
			listen(group, event, () => {
				pointer = undefined
				releaseItem(item)
			})
		}
		listen(group, EVENT_KEY_DOWN, (event: KeyboardEvent) => {
			if (event.key === " " || event.key === "Enter") {
				event.preventDefault()
				if (!event.repeat) {
					press()
				}
			}
			if (
				continuous &&
				["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)
			) {
				event.preventDefault()
				send(
					item,
					visuals.get(item.id)!.value +
						(event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1)
				)
			}
		})
		listen(group, EVENT_KEY_UP, (event: KeyboardEvent) => {
			if (event.key === " " || event.key === "Enter") {
				event.preventDefault()
				releaseItem(item)
			}
		})
		listen(group, EVENT_CLICK, (event: MouseEvent) => {
			if (event.detail === 0 && !held.has(item.id)) {
				press()
				releaseItem(item)
			}
		})
	}
	listen(window, EVENT_BLUR, release)
	listen(document, EVENT_VISIBILITY_CHANGE, () => {
		if (document.hidden) {
			release()
		}
	})
	syncEditor()
	return {
		element,
		release,
		setEnabled(value: boolean) {
			if (!value) {
				release()
			}
			enabled = value
			for (const item of surface.elements) {
				const view = visuals.get(item.id)!
				view.group.setAttribute("aria-disabled", String(!enabled))
				if (!value) {
					view.notes.clear()
					update(item, 0)
				}
			}
		},
		receive(command: IAudioCommand) {
			const kind =
				command.type === NOTE_ON || command.type === NOTE_OFF
					? "note"
					: command.type === CONTROL_CHANGE
						? "cc"
						: command.type === PITCH_BEND
							? "pitchBend"
							: command.type === PROGRAM_CHANGE
								? "programChange"
								: command.type === CHANNEL_PRESSURE
									? "channelPressure"
									: undefined
			if (!kind) {
				return
			}
			if (
				learn.checked &&
				command.type !== NOTE_OFF &&
				!(command.type === NOTE_ON && command.velocity === 0)
			) {
				release()
				const message: MidiProfileMessage = { type: kind, channel: command.channel }
				if (kind === "note" || kind === "cc") {
					message.number = command.number
				}
				if (validSurfaceBinding(message)) {
					options.surfaceMappings = {
						...options.surfaceMappings,
						[select.value]: message
					}
					learn.checked = false
					changed()
					syncEditor()
					status.textContent = `Mapped ${surface.elements.find((item) => item.id === select.value)?.label}.`
				}
			}
			for (const item of surface.elements) {
				const message = mapping(item),
					view = visuals.get(item.id)!
				if (
					!message ||
					(message.channel !== undefined && message.channel !== command.channel)
				) {
					continue
				}
				if (
					command.type === CONTROL_CHANGE &&
					(command.number === 120 || command.number === 123)
				) {
					for (const note of view.notes) {
						if (note.startsWith(`${command.channel}:`)) {
							view.notes.delete(note)
						}
					}
					if (message.type === "note") {
						update(item, view.notes.size ? 127 : 0)
					}
				}
				if (
					message.type !== kind ||
					(["note", "cc"].includes(kind) && message.number !== command.number)
				) {
					continue
				}
				let value = command.value
				if (kind === "note") {
					const key = `${command.channel}:${command.number}`
					if (command.type === NOTE_ON && command.velocity > 0) {
						view.notes.add(key)
					} else {
						view.notes.delete(key)
					}
					value = view.notes.size ? Math.max(1, command.velocity) : 0
				}
				update(item, value)
			}
		},
		destroy() {
			release()
			abort.abort()
			element.remove()
		}
	}
}