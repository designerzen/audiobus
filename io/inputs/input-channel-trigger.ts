import AbstractInput from "./abstract-input"
import AudioCommand from "../../audio-command"
import { NOTE_ON, NOTE_OFF } from "../../commands"
import {
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_BLUR,
	EVENT_VISIBILITY_CHANGE,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_UP,
	EVENT_POINTER_CANCEL,
	EVENT_LOST_POINTER_CAPTURE
} from "../../event-constants"
import { GamePadManager, COMMANDS, GAME_PAD_DISCONNECTED } from "../../hardware/gamepad/gamepad"
import { notifyControls, notifyControlSchema } from "../component-ui"
import type { ControlValue, UiDescriptor } from "control-surface/types"

let gamepads: GamePadManager | undefined
let gamepadUsers = 0

/** One persistent player control, shared by its key, gamepad and surface pad. */
export default class InputChannelTrigger extends AbstractInput {
	private events = new AbortController()
	private held = new Set<string>()
	private releaseGamepad?: () => void
	private gui?: HTMLElement
	get name() {
		return this.options.label || `Song channel ${this.options.songChannel}`
	}
	get description() {
		return "Trigger this song part using its assigned key, gamepad or control-surface pad"
	}
	hasMidiInput() {
		return true
	}
	constructor(options: Record<string, any> = {}) {
		super({ now: () => performance.now() / 1000, ...options })
		this.options.songChannel = Math.max(
			1,
			Math.min(16, Math.round(Number(options.songChannel) || 1))
		)
		this.configure(options)
		if (typeof window !== "undefined") {
			const { signal } = this.events
			window.addEventListener(
				EVENT_KEY_DOWN,
				(event) => {
					if (
						event.defaultPrevented ||
						event.repeat ||
						event.isComposing ||
						event.ctrlKey ||
						event.altKey ||
						event.metaKey ||
						!this.options.key ||
						event.key.toLowerCase() !== this.options.key ||
						document.querySelector("dialog[open]") ||
						(event.target instanceof HTMLElement &&
							(event.target.isContentEditable ||
								event.target.closest("input,textarea,select,[role=textbox]")))
					) {
						return
					}
					event.preventDefault()
					this.trigger(true, "keyboard")
				},
				{ signal }
			)
			window.addEventListener(
				EVENT_KEY_UP,
				(event) => {
					if (event.key.toLowerCase() === this.options.key) {
						this.trigger(false, "keyboard")
					}
				},
				{ signal }
			)
			window.addEventListener(EVENT_BLUR, () => this.releaseAll(), { signal })
			document.addEventListener(
				EVENT_VISIBILITY_CHANGE,
				() => {
					if (document.hidden) {
						this.releaseAll()
					}
				},
				{ signal }
			)
		}
		this.setAsConnected()
	}
	configure(options: Record<string, any>): void {
		this.releaseAll()
		this.releaseGamepad?.()
		this.releaseGamepad = undefined
		Object.assign(this.options, options)
		this.options.key = String(this.options.key ?? "").toLowerCase()
		if (
			Number.isInteger(this.options.gamepadIndex) &&
			this.options.gamepadIndex >= 0 &&
			typeof window !== "undefined" &&
			typeof navigator !== "undefined" &&
			typeof navigator.getGamepads === "function"
		) {
			gamepads ??= new GamePadManager()
			const manager = gamepads
			gamepadUsers++
			const listener = (button: string, value: number, pad: { index: number }) => {
				if (pad.index !== this.options.gamepadIndex) {
					return
				}
				if (button === GAME_PAD_DISCONNECTED) {
					for (const id of this.held) {
						if (id.startsWith("gamepad:")) {
							this.trigger(false, id)
						}
					}
				} else if (
					(Object.values(COMMANDS) as string[]).includes(button) &&
					!button.includes("stick")
				) {
					this.trigger(value > 0, `gamepad:${button}`)
				}
			}
			manager.addEventListener(listener)
			this.releaseGamepad = () => {
				manager.removeEventListener(listener)
				if (--gamepadUsers === 0) {
					manager.destroy()
					gamepads = undefined
				}
			}
		}
		notifyControlSchema(this)
		if (this.gui) {
			this.gui.querySelector("button")!.textContent = this.name
			this.gui.querySelector("p")!.textContent = this.getUiDescriptor().controls[0].help ?? ""
		}
	}
	trigger(pressed: boolean, id = "surface"): void {
		if (!this.isConnected || pressed === this.held.has(id)) {
			return
		}
		if (pressed) {
			this.held.add(id)
		} else {
			this.held.delete(id)
		}
		if (pressed || !this.held.size) {
			this.dispatch(
				Object.assign(new AudioCommand(), {
					type: pressed ? NOTE_ON : NOTE_OFF,
					number: 0,
					velocity: pressed ? 127 : 0,
					channel: this.options.songChannel,
					from: this.uuid,
					startAt: this.now,
					time: this.now
				})
			)
		}
		notifyControls(this, "trigger")
	}
	private releaseAll(): void {
		for (const id of this.held) {
			this.trigger(false, id)
		}
	}
	getUiDescriptor(): UiDescriptor {
		return {
			title: this.name,
			controls: [
				{
					id: "trigger",
					label: this.name,
					widget: "pad",
					min: 0,
					max: 1,
					step: 1,
					defaultValue: 0,
					priority: 1,
					help: `${this.options.key ? `Key ${this.options.key.toUpperCase()}. ` : ""}${Number.isInteger(this.options.gamepadIndex) && this.options.gamepadIndex >= 0 ? `Gamepad ${this.options.gamepadIndex + 1}: any button. ` : ""}Play this channel at the shared song position.`
				}
			]
		}
	}
	getControlValue(id: string): ControlValue | undefined {
		return id === "trigger" ? Number(this.held.size > 0) : undefined
	}
	setControlValue(id: string, value: ControlValue): void {
		if (id === "trigger") {
			this.trigger(Number(value) > 0)
		}
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const root = document.createElement("div")
		const button = document.createElement("button")
		button.type = "button"
		button.textContent = this.name
		button.style.cssText = "min-height:72px;min-width:120px;touch-action:none"
		button.addEventListener(EVENT_POINTER_DOWN, (event) => {
			button.setPointerCapture?.(event.pointerId)
			this.trigger(true, `pointer:${event.pointerId}`)
		})
		for (const event of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
			button.addEventListener(event, (e) =>
				this.trigger(false, `pointer:${(e as PointerEvent).pointerId}`)
			)
		}
		button.addEventListener(EVENT_KEY_DOWN, (event) => {
			if (!event.repeat && [" ", "Enter"].includes(event.key)) {
				event.preventDefault()
				this.trigger(true, "button")
			}
		})
		button.addEventListener(EVENT_KEY_UP, (event) => {
			if ([" ", "Enter"].includes(event.key)) {
				this.trigger(false, "button")
			}
		})
		button.addEventListener(EVENT_BLUR, () => this.releaseAll())
		const info = document.createElement("p")
		info.textContent = this.getUiDescriptor().controls[0].help ?? ""
		root.append(button, info)
		this.gui = root
		return root
	}
	async destroyGui(): Promise<void> {
		this.releaseAll()
		this.gui = undefined
	}
	destroy(): void {
		this.releaseAll()
		this.events.abort()
		this.releaseGamepad?.()
		this.releaseGamepad = undefined
		this.destroyGui()
		this.setAsDisconnected()
	}
}