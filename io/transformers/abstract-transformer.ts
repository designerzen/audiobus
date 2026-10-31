import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { Timer } from "netronome"
import type { FieldConfig, ITransformer } from "./interface-transformer.ts"
import {
	fieldsDescriptor,
	componentBindings,
	notifyControls,
	subscribeControls
} from "../component-ui"
import { createDomGui } from "control-surface/dom"
import type { ControlValue } from "control-surface/types"

export interface TransformerConfig {
	available?: boolean
	enabled?: boolean | number
}

const DEFAULT_TRANSFORMER_OPTIONS: TransformerConfig = {
	available: false,
	enabled: true
}

export abstract class Transformer<Config = TransformerConfig> implements ITransformer {
	static ID: number = 0

	static getUniqueID(name: string = "Transformer") {
		return `Transformer-${name}-${String(Transformer.ID++)}`
	}

	// order in Transformer sequence
	index: number = -1

	#id: string = Transformer.getUniqueID(this.name)

	type: string = "AbstractTransformer"
	protected category: string = "Uncategorised"

	protected config: Config & TransformerConfig & Record<string, unknown>

	get fields(): FieldConfig[] {
		return []
	}
	private generatedGui?: ReturnType<typeof createDomGui>
	getUiDescriptor() {
		const descriptor = fieldsDescriptor(this.fields)
		for (const control of descriptor.controls) {
			if (control.id === "enabled" && typeof this.config.enabled === "boolean") {
				control.widget = "toggle"
				control.choices = undefined
				control.defaultValue = Boolean(control.defaultValue)
			}
		}
		return descriptor
	}
	getControlValue(id: string): ControlValue | undefined {
		return this.config[id] as ControlValue | undefined
	}
	setControlValue(id: string, value: ControlValue): void {
		this.setConfig(id, value)
		notifyControls(this)
	}
	subscribeControls(listener: () => void): () => void {
		return subscribeControls(this, listener)
	}
	async createGui(): Promise<HTMLElement> {
		if (!this.generatedGui) {
			this.generatedGui = createDomGui(await componentBindings(this, this.midiControlId))
		}
		return this.generatedGui.element
	}
	destroyGui(): void {
		this.generatedGui?.destroy()
		this.generatedGui = undefined
	}

	get options(): Config {
		return this.config
	}

	get name(): string {
		return "Transformer"
	}

	get description(): string {
		return "Pass-through"
	}

	get uuid(): string {
		return this.#id
	}

	get midiControlId(): string {
		return (this.config as Record<string, unknown>).midiControlId as string
	}

	constructor(config: Partial<Config> = {}) {
		this.config = { ...DEFAULT_TRANSFORMER_OPTIONS, ...config } as Config &
			TransformerConfig &
			Record<string, unknown>
		this.setConfig(
			"midiControlId",
			(config as Record<string, unknown>).midiControlId ?? crypto.randomUUID()
		)
		this.setFieldDefaults(this.config)
		this.setConfig("available", true)
	}

	/**
	 * Export the transformer's configuration as a JSON string
	 * @returns JSON String
	 */
	exportConfig(): string {
		return JSON.stringify({ ...this.config, type: this.type })
	}

	/**
	 *  loop through and set the default fields in the config
	 * @param config
	 */
	setFieldDefaults(config: Config & Record<string, unknown>): void {
		for (const field of this.fields) {
			if (config[field.name] !== undefined) {
				const value = config[field.name]
				if (
					typeof value === "string" ||
					typeof value === "number" ||
					typeof value === "boolean"
				) {
					field.default = value
				}
			}
		}
	}

	/**
	 * Overwrite a field in the config (and cause side effects)
	 * @param key
	 * @param value
	 */
	setConfig(key: string, value: unknown): void {
		Object.assign(this.config, { [key]: value })
		notifyControls(this)
	}

	abstract transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[]

	/**
	 * Reset the transformer to its initial state
	 */
	reset(): void {
		// No state to reset for this transformer
	}

	/**
	 * Destroy the transformer and clean up any resources
	 */
	destroy(): void {
		this.destroyGui()
	}
}