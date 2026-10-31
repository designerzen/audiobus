import AudioCommand from "../../audio-command"
import * as COMMANDS from "../../commands"
import {
	EVENT_BLUR,
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_CLOSE,
	EVENT_KEY_DOWN,
	EVENT_SUBMIT,
	EVENT_VISIBILITY_CHANGE
} from "../../event-constants"
import { bounded, changed, devicePanel, numberControl } from "../device-controls"
import AbstractInput from "./abstract-input"
import type { ControlValue, UiDescriptor } from "control-surface/types"

export interface CosmoDotCommand {
	type: string
	number: number
	channel: number
	velocity: number
	value: number
	pitchBend: number
	patch: number
	subtype: string
	text: string
}
export interface CosmoDotConfiguration {
	trigger: string
	duration: number
	command: CosmoDotCommand
}

const COMMAND_TYPES = Object.values(COMMANDS).filter(
	(value) => value !== COMMANDS.INPUT_EVENT && value !== COMMANDS.OUTPUT_EVENT
)
const COLOURS = [
	"#ce4052",
	"#d77821",
	"#be9e16",
	"#3f9b53",
	"#219c98",
	"#397cc7",
	"#7957c3",
	"#bc448f"
]

export function cosmoDotConfiguration(value: any, index: number): CosmoDotConfiguration {
	const command = value?.command
	return {
		trigger:
			typeof value?.trigger === "string" && value.trigger.length > 0
				? value.trigger
				: String(index),
		duration: Math.round(bounded(value?.duration, 200, 20, 10000)),
		command: {
			type: COMMAND_TYPES.includes(command?.type) ? command.type : COMMANDS.NOTE_ON,
			number: Math.round(bounded(command?.number, 60 + index, 0, 127)),
			channel: Math.round(bounded(command?.channel, 1, 1, 16)),
			velocity: Math.round(bounded(command?.velocity, 100, 0, 127)),
			value: bounded(command?.value, 60 + index, 0, 16383),
			pitchBend: bounded(command?.pitchBend, 0, -8192, 16383),
			patch: Math.round(bounded(command?.patch, 0, 0, 127)),
			subtype: typeof command?.subtype === "string" ? command.subtype : "",
			text: typeof command?.text === "string" ? command.text : ""
		}
	}
}

export default class InputCosmoDots extends AbstractInput {
	private events = new AbortController()
	private gui?: HTMLElement
	private views = new Map<HTMLElement, HTMLButtonElement[]>()
	private countControl?: HTMLInputElement
	private dialog?: HTMLDialogElement
	private editing = false
	private active = new Map<
		number,
		{ command: AudioCommand; timer: ReturnType<typeof setTimeout> }
	>()

	get name(): string {
		return "Cosmo Dots"
	}
	get description(): string {
		return "Configurable Cosmo Dot keyboard and onscreen triggers"
	}
	get configuration(): CosmoDotConfiguration[] {
		return this.options.dots.map(cosmoDotConfiguration)
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.options.dots = Array.from(
			{ length: Math.round(bounded(options.dotCount ?? options.dots?.length, 8, 1, 8)) },
			(_, i) => cosmoDotConfiguration(options.dots?.[i], i)
		)
		this.options.dotCount = this.options.dots.length
		const { signal } = this.events
		if (typeof window !== "undefined") {
			window.addEventListener(
				EVENT_KEY_DOWN,
				(event) => {
					if (
						event.repeat ||
						event.isComposing ||
						event.ctrlKey ||
						event.altKey ||
						event.metaKey ||
						this.editing ||
						this.dialog ||
						document.querySelector("dialog[open]") ||
						event
							.composedPath()
							.some(
								(target) =>
									target instanceof HTMLElement &&
									(target.isContentEditable ||
										target.matches("input, textarea, select, [role=textbox]"))
							)
					) {
						return
					}
					const indexes = this.configuration.flatMap((dot, i) =>
						dot.trigger === event.key ? [i] : []
					)
					if (indexes.length) {
						event.preventDefault()
						indexes.forEach((i) => this.activate(i))
					}
				},
				{ signal }
			)
			window.addEventListener(EVENT_BLUR, () => this.stopAll(), { signal })
			document.addEventListener(
				EVENT_VISIBILITY_CHANGE,
				() => {
					if (document.hidden) {
						this.stopAll()
					}
				},
				{ signal }
			)
		}
		this.setAsConnected()
	}

	setDot(index: number, configuration: CosmoDotConfiguration): void {
		if (!Number.isInteger(index) || index < 0 || index >= this.configuration.length) {
			return
		}
		this.stop(index)
		this.options.dots[index] = cosmoDotConfiguration(configuration, index)
		this.refresh()
		changed(this)
	}

	setDotCount(value: number): void {
		this.stopAll()
		const count = Math.round(bounded(value, this.configuration.length, 1, 8))
		this.options.dots = Array.from({ length: count }, (_, i) =>
			cosmoDotConfiguration(this.options.dots[i], i)
		)
		this.options.dotCount = count
		this.refresh()
		changed(this)
	}
	getUiDescriptor(): UiDescriptor {
		return {
			controls: [
				{
					id: "dotCount",
					label: "Number of Cosmo Dots",
					widget: "number",
					min: 1,
					max: 8,
					step: 1
				}
			]
		}
	}
	getControlValue(id: string): ControlValue | undefined {
		return id === "dotCount" ? this.configuration.length : undefined
	}
	setControlValue(id: string, value: ControlValue): void {
		if (id === "dotCount" && typeof value === "number") {
			this.setDotCount(value)
		}
	}

	activate(index: number): void {
		if (
			!this.isConnected ||
			this.editing ||
			this.dialog ||
			!Number.isInteger(index) ||
			index < 0 ||
			index >= this.configuration.length
		) {
			return
		}
		this.stop(index)
		const dot = this.configuration[index]
		const command = Object.assign(new AudioCommand(), dot.command, {
			from: this.name,
			startAt: this.now,
			time: this.now
		})
		this.active.set(index, {
			command: Object.assign(new AudioCommand(), command),
			timer: setTimeout(() => this.stop(index), dot.duration)
		})
		this.refresh()
		this.dispatch(command)
	}

	private stop(index: number): void {
		const active = this.active.get(index)
		if (!active) {
			return
		}
		clearTimeout(active.timer)
		this.active.delete(index)
		const { command } = active
		if (
			command.type === COMMANDS.NOTE_ON &&
			command.velocity > 0 &&
			!Array.from(this.active.values()).some(
				({ command: other }) =>
					other.type === COMMANDS.NOTE_ON &&
					other.number === command.number &&
					other.channel === command.channel
			)
		) {
			const release = new AudioCommand()
			this.dispatch(
				Object.assign(release, command, {
					id: release.id,
					type: COMMANDS.NOTE_OFF,
					velocity: 0,
					startAt: this.now,
					time: this.now
				})
			)
		}
		this.refresh()
	}
	private stopAll(): void {
		for (const index of this.active.keys()) {
			this.stop(index)
		}
	}
	private refresh(): void {
		if (this.countControl) {
			this.countControl.value = String(this.configuration.length)
		}
		for (const [grid, previous] of this.views) {
			const buttons =
				previous.length === this.configuration.length ? previous : this.renderDots(grid)
			buttons.forEach((button, i) => {
				const dot = this.configuration[i]
				const text = dot.trigger === " " ? "Space" : dot.trigger
				button.querySelector("span")!.textContent = text
				button.title = `${this.editing ? "Edit" : "Activate"} dot ${i + 1}: ${dot.command.type}, ${dot.command.number}`
				button.setAttribute("aria-label", `${button.title}; trigger ${text}`)
				button.setAttribute("aria-pressed", String(this.active.has(i)))
				button.dataset.active = String(this.active.has(i))
				button.style.filter = this.active.has(i) ? "brightness(1.6)" : ""
				button.style.boxShadow = this.active.has(i) ? "0 0 0 4px currentColor" : ""
			})
		}
	}
	private renderDots(grid: HTMLElement): HTMLButtonElement[] {
		grid.replaceChildren()
		const buttons = this.configuration.map((_, i) => {
			const button = document.createElement("button")
			button.type = "button"
			button.dataset.cosmoDot = String(i)
			button.style.cssText = `position:relative;border-radius:50%;aspect-ratio:1;min-height:64px;border:0;background:transparent;color:${COLOURS[i]};font-weight:bold;font-size:1.2rem;touch-action:manipulation`
			button.innerHTML =
				'<svg viewBox="0 0 100 100" aria-hidden="true" style="display:block;width:100%;height:auto"><ellipse cx="50" cy="82" rx="43" ry="12" fill="#121826"/><path d="M7 54v18c0 28 86 28 86 0V54" fill="currentColor" opacity=".6"/><ellipse cx="50" cy="53" rx="43" ry="34" fill="currentColor"/><ellipse cx="50" cy="46" rx="34" ry="24" fill="white" opacity=".16"/><path d="M27 33q23-18 46 0" fill="none" stroke="white" stroke-width="3" opacity=".5"/></svg><span style="position:absolute;inset:38% 8% auto;color:white;overflow-wrap:anywhere;pointer-events:none"></span>'
			button.addEventListener(EVENT_CLICK, () =>
				this.editing ? this.editDot(i) : this.activate(i)
			)
			grid.append(button)
			return button
		})
		this.views.set(grid, buttons)
		return buttons
	}
	createSurfaceView(): { element: HTMLElement; destroy(): void } {
		const grid = document.createElement("div")
		grid.setAttribute("aria-label", "Cosmo Dots")
		grid.style.cssText =
			"display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,100px));justify-content:center;gap:16px;padding:12px;width:100%;box-sizing:border-box;max-width:1000px;margin:auto"
		this.renderDots(grid)
		this.refresh()
		return {
			element: grid,
			destroy: () => {
				this.views.delete(grid)
				grid.remove()
			}
		}
	}

	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel()
		const help = document.createElement("p")
		help.textContent =
			"Pair your Dots in keyboard (Switch) mode using Cosmo Dot Setup, then match their keys below. Press a key or click a dot to play."
		const label = document.createElement("label")
		const edit = document.createElement("input")
		edit.type = "checkbox"
		edit.addEventListener(EVENT_CHANGE, () => {
			this.stopAll()
			this.editing = edit.checked
			this.refresh()
		})
		label.append(edit, " Edit dots")
		panel.append(help, label)
		this.countControl = numberControl(
			panel,
			"Number of dots",
			this.configuration.length,
			1,
			8,
			(value) => this.setDotCount(value)
		)
		panel.append(this.createSurfaceView().element)
		this.gui = panel
		this.refresh()
		return panel
	}

	private editDot(index: number): void {
		if (this.dialog) {
			return
		}
		this.stopAll()
		const dot = this.configuration[index]
		const dialog = document.createElement("dialog")
		this.dialog = dialog
		const form = document.createElement("form")
		form.style.cssText = "display:grid;gap:12px;min-width:260px;max-width:80vw"
		const title = document.createElement("h2")
		title.id = `${this.uuid}-dot-title`
		title.textContent = `Edit Cosmo dot ${index + 1}`
		dialog.setAttribute("aria-labelledby", title.id)
		form.append(title)
		const textField = (name: string, value: string) => {
			const label = document.createElement("label"),
				input = document.createElement("input")
			input.value = value
			label.append(`${name} `, input)
			form.append(label)
			return input
		}
		const trigger = textField("Trigger key (press a key or choose from the list)", dot.trigger)
		const triggers = document.createElement("datalist")
		triggers.id = `${this.uuid}-triggers`
		for (const key of [
			..."0123456789",
			" ",
			"Enter",
			"Tab",
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight",
			"F7",
			"F8",
			"F9",
			"~",
			"AudioVolumeUp",
			"AudioVolumeDown",
			"AudioVolumeMute",
			"MediaPlayPause"
		]) {
			const option = document.createElement("option")
			option.value = key
			option.label = key === " " ? "Space" : key
			triggers.append(option)
		}
		trigger.setAttribute("list", triggers.id)
		form.append(triggers)
		trigger.required = true
		trigger.addEventListener(EVENT_KEY_DOWN, (event) => {
			if (
				event.key === "Tab" ||
				event.key === "Escape" ||
				event.ctrlKey ||
				event.metaKey ||
				event.altKey
			) {
				return
			}
			event.preventDefault()
			trigger.value = event.key
		})
		const typeLabel = document.createElement("label"),
			type = document.createElement("select")
		for (const value of COMMAND_TYPES) {
			const option = document.createElement("option")
			option.value = value
			option.textContent = value
			type.append(option)
		}
		type.value = dot.command.type
		typeLabel.append("AudioCommand type ", type)
		form.append(typeLabel)
		const numeric = (name: string, value: number, min: number, max: number) =>
			numberControl(form, name, value, min, max, () => {})
		const number = numeric("Note / controller number", dot.command.number, 0, 127)
		const channel = numeric("Channel", dot.command.channel, 1, 16)
		const velocity = numeric("Velocity", dot.command.velocity, 0, 127)
		const value = numeric("Value", dot.command.value, 0, 16383)
		const duration = numeric("Note duration / flash (ms)", dot.duration, 20, 10000)
		const details = document.createElement("details"),
			summary = document.createElement("summary")
		summary.textContent = "Additional command fields"
		details.append(summary)
		form.append(details)
		const pitchBend = numberControl(
			details,
			"Pitch bend",
			dot.command.pitchBend,
			-8192,
			16383,
			() => {}
		)
		const patch = numberControl(details, "Patch", dot.command.patch, 0, 127, () => {})
		const subtype = textField("Subtype", dot.command.subtype)
		const text = textField("Text", dot.command.text)
		details.append(subtype.parentElement!, text.parentElement!)
		const hint = document.createElement("p")
		hint.textContent =
			"Note On sends a matching Note Off after the duration. Other commands are sent once per activation."
		const save = document.createElement("button"),
			cancel = document.createElement("button")
		save.type = "submit"
		save.textContent = "Save"
		cancel.type = "button"
		cancel.textContent = "Cancel"
		cancel.addEventListener(EVENT_CLICK, () => dialog.close())
		form.append(hint, save, cancel)
		form.addEventListener(EVENT_SUBMIT, (event) => {
			event.preventDefault()
			if (!form.reportValidity()) {
				return
			}
			this.setDot(index, {
				trigger: trigger.value,
				duration: duration.valueAsNumber,
				command: {
					type: type.value,
					number: number.valueAsNumber,
					channel: channel.valueAsNumber,
					velocity: velocity.valueAsNumber,
					value: value.valueAsNumber,
					pitchBend: pitchBend.valueAsNumber,
					patch: patch.valueAsNumber,
					subtype: subtype.value,
					text: text.value
				}
			})
			dialog.close()
		})
		dialog.addEventListener(
			EVENT_CLOSE,
			() => {
				dialog.remove()
				if (this.dialog === dialog) {
					this.dialog = undefined
				}
			},
			{ once: true }
		)
		dialog.append(form)
		document.body.append(dialog)
		dialog.showModal()
	}

	async destroyGui(): Promise<void> {
		this.stopAll()
		this.dialog?.close()
		this.dialog?.remove()
		this.dialog = undefined
		this.editing = false
		for (const grid of this.views.keys()) {
			if (this.gui?.contains(grid)) {
				this.views.delete(grid)
			}
		}
		this.gui?.remove()
		this.gui = undefined
		this.countControl = undefined
	}
	destroy(): void {
		void this.destroyGui()
		this.events.abort()
		this.views.clear()
		this.setAsDisconnected()
	}
}