import AbstractEffect from "./abstract-effect"
import { IMPULSE_RESPONSE } from "./effect-definitions"
import { EVENT_CHANGE } from "../events/event-constants"
import { changed } from "../io/device-controls"
import { createReverbImpulseResponse } from "./reverb"
import {
	BUILTIN_ROOM_PRESET,
	IMPULSE_RESPONSE_ASSET_PATH,
	IMPULSE_RESPONSE_PRESETS
} from "./impulse-response-presets"

const MAX_IMPULSE_BYTES = 4 * 1024 * 1024

export default class EffectImpulseResponse extends AbstractEffect {
	declare readonly options: {
		mix: number
		preset?: string
		impulse?: string
		filename?: string
	}
	private convolver: ConvolverNode
	private revision = 0
	private pendingPreset?: AbortController
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, IMPULSE_RESPONSE, options)
		this.convolver = this.node(context.createConvolver())
		this.convolver.buffer = createReverbImpulseResponse(context, 1, 3)
		this.audioInput.connect(this.convolver).connect(this.wet)
		this.start()
	}
	static async create(options: Record<string, any> = {}) {
		if (!options.audioContext) {
			throw new Error("Impulse Response requires an audio context")
		}
		const effect = new EffectImpulseResponse(options.audioContext, options)
		try {
			if (options.impulse) {
				await effect.loadImpulse(options.impulse, options.filename)
			} else if (options.preset) {
				await effect.loadPreset(options.preset)
			}
			return effect
		} catch (error) {
			await effect.destroy()
			throw error
		}
	}
	protected apply() {}
	setMix(mix: number) {
		this.setParameter("mix", mix)
	}
	async loadImpulse(encoded: string, filename = "Custom impulse response") {
		if (typeof encoded !== "string" || encoded.length > Math.ceil(MAX_IMPULSE_BYTES / 3) * 4) {
			throw new Error("Choose an impulse response smaller than 4 MB")
		}
		const revision = ++this.revision
		this.pendingPreset?.abort()
		const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
		const buffer = await this.context.decodeAudioData(bytes.buffer)
		if (!this.isConnected || revision !== this.revision) {
			return
		}
		this.convolver.buffer = buffer
		this.options.impulse = encoded
		this.options.filename = filename
		this.options.preset = ""
		changed(this)
	}
	async loadPreset(id: string): Promise<void> {
		const preset = IMPULSE_RESPONSE_PRESETS.find((entry) => entry.id === id)
		if (!preset && id !== BUILTIN_ROOM_PRESET) {
			throw new Error("Unknown impulse response preset")
		}
		const revision = ++this.revision
		this.pendingPreset?.abort()
		const request = new AbortController()
		this.pendingPreset = request
		try {
			let buffer: AudioBuffer
			if (preset) {
				const response = await fetch(`${IMPULSE_RESPONSE_ASSET_PATH}${preset.id}.wav`, {
					signal: request.signal
				})
				if (!response.ok) {
					throw new Error(`Could not load ${preset.name} (${response.status})`)
				}
				buffer = await this.context.decodeAudioData(await response.arrayBuffer())
			} else {
				buffer = createReverbImpulseResponse(this.context, 1, 3)
			}
			if (!this.isConnected || revision !== this.revision) {
				return
			}
			this.convolver.buffer = buffer
			// Empty values, not deleted keys, so saving overrides the options this was restored from.
			this.options.impulse = ""
			this.options.filename = ""
			this.options.preset = preset?.id ?? BUILTIN_ROOM_PRESET
			changed(this)
		} finally {
			if (this.pendingPreset === request) {
				this.pendingPreset = undefined
			}
		}
	}
	protected override decorateGui(panel: HTMLElement, signal: AbortSignal): void {
		const presetLabel = document.createElement("label")
		const select = document.createElement("select")
		const addOption = (parent: HTMLElement, value: string, name: string) => {
			const option = document.createElement("option")
			option.value = value
			option.textContent = name
			parent.append(option)
			return option
		}
		addOption(select, BUILTIN_ROOM_PRESET, "Built-in room")
		const groups = new Map<string, HTMLOptGroupElement>()
		for (const preset of IMPULSE_RESPONSE_PRESETS) {
			let group = groups.get(preset.group)
			if (!group) {
				group = document.createElement("optgroup")
				group.label = preset.group
				groups.set(preset.group, group)
				select.append(group)
			}
			addOption(group, preset.id, preset.name)
		}
		const custom = addOption(select, "custom", "Custom uploaded impulse response")
		custom.disabled = true
		presetLabel.append("Impulse response preset ", select)
		const status = document.createElement("output")
		status.setAttribute("aria-live", "polite")
		const credit = document.createElement("small")
		const refresh = () => {
			const preset = IMPULSE_RESPONSE_PRESETS.find(
				(entry) => entry.id === this.options.preset
			)
			select.value = preset?.id ?? (this.options.impulse ? "custom" : BUILTIN_ROOM_PRESET)
			custom.hidden = !this.options.impulse
			status.textContent =
				preset?.name || this.options.filename || "Built-in room impulse response"
			credit.replaceChildren()
			if (preset) {
				const attribution = document.createElement("a")
				attribution.href = `${IMPULSE_RESPONSE_ASSET_PATH}${preset.id}.attribution.txt`
				attribution.textContent = `${preset.author} · ${preset.license} · Attribution and license`
				attribution.target = "_blank"
				attribution.rel = "noopener noreferrer"
				const source = document.createElement("a")
				source.href = preset.source
				source.textContent = "Source"
				source.target = "_blank"
				source.rel = "noopener noreferrer"
				credit.append(attribution, " · ", source)
			}
		}
		let selectionRevision = 0
		select.addEventListener(
			EVENT_CHANGE,
			async () => {
				const revision = ++selectionRevision
				status.textContent = "Loading impulse response…"
				try {
					await this.loadPreset(select.value)
					if (revision === selectionRevision && !signal.aborted) {
						refresh()
					}
				} catch (error) {
					if (revision === selectionRevision && !signal.aborted) {
						refresh()
						status.textContent = error instanceof Error ? error.message : String(error)
					}
				}
			},
			{ signal }
		)
		const label = document.createElement("label")
		const file = document.createElement("input")
		file.type = "file"
		file.accept = "audio/*,.wav,.aif,.aiff,.flac"
		label.append("Impulse response file ", file)
		file.addEventListener(
			EVENT_CHANGE,
			async () => {
				const selected = file.files?.[0]
				if (!selected) {
					return
				}
				file.disabled = true
				const revision = ++selectionRevision
				try {
					if (selected.size > MAX_IMPULSE_BYTES) {
						throw new Error("Choose an impulse response smaller than 4 MB")
					}
					status.textContent = "Loading impulse response…"
					const bytes = new Uint8Array(await selected.arrayBuffer())
					if (revision !== selectionRevision || signal.aborted) {
						return
					}
					let binary = ""
					for (const byte of bytes) {
						binary += String.fromCharCode(byte)
					}
					await this.loadImpulse(btoa(binary), selected.name)
					if (revision === selectionRevision && !signal.aborted) {
						refresh()
					}
				} catch (error) {
					if (revision === selectionRevision && !signal.aborted) {
						refresh()
						status.textContent = error instanceof Error ? error.message : String(error)
					}
				} finally {
					file.disabled = false
				}
			},
			{ signal }
		)
		refresh()
		panel.append(presetLabel, label, status, credit)
	}
	override async destroy() {
		this.revision++
		this.pendingPreset?.abort()
		await super.destroy()
	}
}