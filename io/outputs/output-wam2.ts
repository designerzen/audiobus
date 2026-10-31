import { EVENT_CONFIGURATION_CHANGED, EVENT_CONTROL_SCHEMA_CHANGED } from "../../event-constants"
import { commandToMidi } from "../../midi/midi-command-conversion"
import { initializeHost, WAM_MIDI_EVENT, WAM_AUTOMATION_EVENT } from "../../wam/host"
import type {
	ComponentUi,
	ControlDescriptor,
	ControlValue,
	UiDescriptor
} from "control-surface/types"
import { installComponentUi, subscribeControls } from "../component-ui"
import wam2Registry, { type WAM2PluginDescriptor } from "../../wam/registry"
import type { IAudioCommand } from "../../audio-command-interface"
import type { IAudioOutput } from "./output-interface"

export default class OutputWAM2 extends EventTarget implements IAudioOutput {
	static ID = 0
	readonly uuid = `Output-WAM-${OutputWAM2.ID++}`
	protected context: AudioContext
	protected label = "WAM2"
	protected acceptsPluginUrl = true
	protected showPluginBrowser = true
	#output: GainNode
	#plugin: any = null
	#url: string
	#name: string
	#connecting: Promise<void> | null = null
	#container: HTMLElement | null = null
	#pluginGui: HTMLElement | null = null
	#guiHost: HTMLElement | null = null
	#silentSource: ConstantSourceNode | null = null
	#silentInput: GainNode | null = null
	#activeNotes = new Set<string>()
	#controlRead?: Promise<Record<string, { value: number }>>
	#legacyControlUi?: ComponentUi

	constructor(
		context: AudioContext,
		pluginUrl = "",
		name = "WAM2",
		destination?: AudioNode | null
	) {
		super()
		this.context = context
		this.#url = pluginUrl
		this.#name = name
		this.#output = context.createGain()
		if (destination !== null) {
			this.#output.connect(destination ?? context.destination)
		}
	}
	get name() {
		return this.#name
	}
	get description() {
		return `${this.label} instrument output`
	}
	get isConnected() {
		return this.#plugin !== null
	}
	get isHidden() {
		return false
	}
	get output() {
		return this.#output
	}
	get pluginNode() {
		return this.#plugin?.audioNode ?? null
	}
	async getUiDescriptor(): Promise<UiDescriptor> {
		if (!this.pluginNode) {
			return { title: this.name, controls: [] }
		}
		if (typeof this.pluginNode.getParameterInfo !== "function") {
			this.#legacyControlUi ??= installComponentUi({
				name: this.name,
				createGui: () => this.createGui()
			})
			return this.#legacyControlUi.getUiDescriptor!()
		}
		const info = await this.pluginNode.getParameterInfo()
		return {
			title: this.name,
			controls: Object.entries(info).map(([id, entry]) => {
				const p = entry as any
				return {
					id,
					label: p.label || id,
					widget: p.choices?.length ? "select" : "dial",
					min: p.minValue,
					max: p.maxValue,
					step: p.discreteStep || 0,
					defaultValue: p.defaultValue,
					unit: p.units,
					scale: p.units === "Hz" && p.minValue > 0 ? "log" : "linear",
					choices: p.choices?.map((label: string, value: number) => ({ label, value }))
				} as ControlDescriptor
			})
		}
	}
	async getControlValue(id: string): Promise<ControlValue | undefined> {
		if (!this.pluginNode) {
			return undefined
		}
		if (this.#legacyControlUi) {
			return this.#legacyControlUi.getControlValue!(id)
		}
		this.#controlRead ??= this.pluginNode.getParameterValues(false).finally(() => {
			this.#controlRead = undefined
		})
		return (await this.#controlRead)![id]?.value
	}
	setControlValue(id: string, value: ControlValue): void | Promise<void> {
		if (!this.pluginNode) {
			throw new Error("Connect the instrument first")
		}
		if (this.#legacyControlUi) {
			return this.#legacyControlUi.setControlValue!(id, value)
		}
		this.pluginNode.scheduleEvents({
			type: WAM_AUTOMATION_EVENT,
			time: this.context.currentTime,
			data: { id, value, normalized: false }
		})
	}
	subscribeControls(listener: () => void): () => void {
		const node = this.pluginNode
		node?.addEventListener(WAM_AUTOMATION_EVENT, listener)
		const unsubscribe = subscribeControls(this, listener)
		return () => {
			node?.removeEventListener(WAM_AUTOMATION_EVENT, listener)
			unsubscribe()
		}
	}
	get options() {
		return { pluginUrl: this.#url }
	}
	hasMidiOutput() {
		return false
	}
	hasAudioOutput() {
		return true
	}
	hasAutomationOutput() {
		return false
	}
	hasMpeOutput() {
		return false
	}
	hasOscOutput() {
		return false
	}
	hasSysexOutput() {
		return false
	}

	protected async availablePlugins() {
		await wam2Registry.initialize()
		return wam2Registry.getInstruments()
	}
	protected async createPlugin(url: string): Promise<any> {
		const groupId = await initializeHost(this.context)
		const { default: Plugin } = await import(/* @vite-ignore */ url)
		if (typeof Plugin?.createInstance !== "function") {
			throw new Error(
				"This module is not a WAM2 plugin. Use the built plugin index.js and include its companion assets."
			)
		}
		return Plugin.createInstance(groupId, this.context)
	}
	async connect(): Promise<void> {
		if (this.isConnected) {
			return
		}
		if (this.#connecting) {
			return this.#connecting
		}
		this.#connecting = (async () => {
			if (!this.#url) {
				const plugins = await this.availablePlugins()
				const plugin = plugins.find((p) => p.path.includes("synth101")) ?? plugins[0]
				if (!plugin) {
					throw new Error("No WAM instruments are available")
				}
				this.#url = wam2Registry.getPluginUrl(plugin)
			}
			const plugin = await this.createPlugin(this.#url)
			try {
				if (!plugin.audioNode) {
					throw new Error("WAM plugin has no audio node")
				}
				// Some synth/effect combinations only process MIDI when a stereo input exists.
				if (plugin.audioNode.numberOfInputs > 0) {
					this.#silentSource = this.context.createConstantSource()
					this.#silentSource.offset.value = 0
					this.#silentInput = this.context.createGain()
					this.#silentInput.channelCount = 2
					this.#silentInput.channelCountMode = "explicit"
					this.#silentSource.connect(this.#silentInput)
					this.#silentInput.connect(plugin.audioNode)
					this.#silentSource.start()
				}
				plugin.audioNode.connect(this.#output)
			} catch (error) {
				this.clearSilentInput()
				await plugin.audioNode?.destroy?.()
				throw error
			}
			this.#plugin = plugin
			this.#name = `${plugin.descriptor?.name ?? this.label} (${this.label})`
			this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
			this.dispatchEvent(new Event(EVENT_CONTROL_SCHEMA_CHANGED))
			await this.showPluginGui()
		})()
		try {
			await this.#connecting
		} finally {
			this.#connecting = null
		}
	}
	processMidi(bytes: number[]): void {
		if (!this.isConnected) {
			return
		}
		this.pluginNode.scheduleEvents({
			type: WAM_MIDI_EVENT,
			time: this.context.currentTime,
			data: { bytes }
		})
		const kind = bytes[0] & 0xf0
		const key = `${bytes[0] & 15}:${bytes[1]}`
		if (kind === 0x90 && bytes[2]) {
			this.#activeNotes.add(key)
		}
		if (kind === 0x80 || (kind === 0x90 && !bytes[2])) {
			this.#activeNotes.delete(key)
		}
	}
	noteOn(note: number, velocity = 127) {
		this.processMidi([0x90, this.byte(note), this.byte(velocity)])
	}
	noteOff(note: number) {
		this.processMidi([0x80, this.byte(note), 0])
	}
	private byte(value: number) {
		return Math.max(0, Math.min(127, Math.round(value)))
	}
	sendControlChange(controller: number, value: number, channel = 0) {
		this.processMidi([
			0xb0 | Math.max(0, Math.min(15, channel)),
			this.byte(controller),
			this.byte(value)
		])
	}
	sendCommand(command: IAudioCommand) {
		const bytes = commandToMidi(command)
		if (bytes) {
			this.processMidi(bytes)
		}
	}
	getNoteKey(command: IAudioCommand) {
		return `${command.channel || 1}:${command.number}`
	}
	getActiveNoteCount() {
		return this.#activeNotes.size
	}
	getPluginInfo() {
		return this.#plugin?.descriptor ?? null
	}
	allNotesOff() {
		for (let channel = 0; channel < 16; channel++) {
			this.processMidi([0xb0 | channel, 64, 0])
			this.processMidi([0xb0 | channel, 123, 0])
			this.processMidi([0xb0 | channel, 120, 0])
		}
		this.#activeNotes.clear()
	}
	async disconnect(): Promise<void> {
		if (this.#connecting) {
			await this.#connecting.catch(() => {})
		}
		this.allNotesOff()
		await this.destroyPluginGui()
		const plugin = this.#plugin
		this.#plugin = null
		this.#legacyControlUi = undefined
		this.#controlRead = undefined
		this.clearSilentInput()
		try {
			plugin?.audioNode.disconnect()
		} finally {
			await plugin?.audioNode.destroy?.()
		}
		this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
		this.dispatchEvent(new Event(EVENT_CONTROL_SCHEMA_CHANGED))
	}
	private clearSilentInput() {
		try {
			this.#silentSource?.stop()
		} catch {
			/* A failed connection may not have started it. */
		}
		this.#silentSource?.disconnect()
		this.#silentInput?.disconnect()
		this.#silentSource = null
		this.#silentInput = null
	}
	async destroy() {
		await this.disconnect()
		this.#output.disconnect()
		await this.destroyGui()
	}
	async loadPlugin(descriptor: WAM2PluginDescriptor): Promise<void> {
		await this.disconnect()
		this.#url = wam2Registry.getPluginUrl(descriptor)
		await this.connect()
	}
	private async destroyPluginGui() {
		if (this.#pluginGui) {
			await this.#plugin?.destroyGui?.(this.#pluginGui)
			this.#pluginGui.remove()
			this.#pluginGui = null
		}
	}
	private async showPluginGui() {
		await this.destroyPluginGui()
		if (this.#guiHost && this.#plugin?.createGui) {
			this.#pluginGui = await this.#plugin.createGui()
			if (this.#pluginGui) {
				this.#guiHost.append(this.#pluginGui)
			}
		}
	}
	async createGui(): Promise<HTMLElement> {
		if (this.#container) {
			return this.#container
		}
		const container = document.createElement("div")
		if (!this.showPluginBrowser) {
			this.#container = container
			this.#guiHost = container
			await this.showPluginGui()
			return container
		}
		const search = document.createElement("input")
		search.type = "search"
		search.placeholder = `Search ${this.label} instruments`
		search.setAttribute("aria-label", search.placeholder)
		const select = document.createElement("select")
		select.setAttribute("aria-label", `${this.label} instrument`)
		const load = document.createElement("button")
		load.type = "button"
		load.textContent = "Load instrument"
		const status = document.createElement("p")
		status.setAttribute("role", "status")
		this.#guiHost = document.createElement("div")
		container.append(search, select, load, status, this.#guiHost)
		if (this.acceptsPluginUrl) {
			const url = document.createElement("input")
			url.type = "url"
			url.placeholder = "WAM2 plugin URL"
			url.setAttribute("aria-label", url.placeholder)
			const customLoad = document.createElement("button")
			customLoad.type = "button"
			customLoad.textContent = "Load plugin URL"
			customLoad.addEventListener("click", async () => {
				if (!url.reportValidity() || !url.value.trim()) {
					return
				}
				customLoad.disabled = load.disabled = true
				try {
					const path = new URL(url.value.trim()).href
					await this.loadPlugin({
						identifier: path,
						name: "Custom WAM2",
						vendor: "",
						description: "",
						keywords: [],
						category: ["Instrument"],
						path
					})
					status.textContent = `${this.name} ready`
				} catch (error) {
					status.textContent = `Unable to load plugin: ${error instanceof Error ? error.message : error}`
				} finally {
					customLoad.disabled = load.disabled = false
				}
			})
			container.append(url, customLoad)
		}
		const plugins = await this.availablePlugins()
		const render = () => {
			select.replaceChildren()
			for (const plugin of plugins.filter((p) =>
				`${p.name} ${p.vendor} ${p.description}`
					.toLowerCase()
					.includes(search.value.toLowerCase())
			)) {
				const option = document.createElement("option")
				option.value = plugin.identifier
				option.textContent = `${plugin.name} — ${plugin.vendor}`
				option.selected = wam2Registry.getPluginUrl(plugin) === this.#url
				select.append(option)
			}
			load.disabled = select.options.length === 0
		}
		search.addEventListener("input", render)
		load.addEventListener("click", async () => {
			const plugin = plugins.find((p) => p.identifier === select.value)
			if (!plugin) {
				return
			}
			load.disabled = true
			status.textContent = `Loading ${plugin.name}…`
			try {
				await this.loadPlugin(plugin)
				status.textContent = `${plugin.name} ready`
			} catch (error) {
				status.textContent = `Unable to load ${plugin.name}: ${error instanceof Error ? error.message : error}`
			} finally {
				load.disabled = false
			}
		})
		render()
		this.#container = container
		await this.showPluginGui()
		return container
	}
	async destroyGui(): Promise<void> {
		await this.destroyPluginGui()
		this.#container?.remove()
		this.#container = null
		this.#guiHost = null
	}
}