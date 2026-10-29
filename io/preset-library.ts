import { TRANSFORMERS } from "./transformer-factory"
import { ID_TIMING_HUMANISER } from "./transformers/transformer-timing-humaniser"
import type IOChain from "./IO-chain"
import type { DeviceDefinition } from "./device-definition"

export const PRESET_LIBRARY_FORMAT = "harmoneasy-preset-library"
export const PRESET_LIBRARY_VERSION = 1
export interface PresetStep {
	type: string
	config: Record<string, unknown>
	summary: string
}
export interface TransformerPreset {
	id: string
	name: string
	category: string
	description: string
	useCase: string
	steps: PresetStep[]
	options?: ReturnType<IOChain["exportConfiguration"]>["options"]
}
// A setup owns independent chain snapshots; IDs scope routing within that setup.
export interface PresetSetup {
	id: string
	name: string
	description: string
	activeChainId: string | null
	devices: { id: string; direction: "input" | "output"; definition: DeviceDefinition }[]
	chains: {
		id: string
		options: NonNullable<TransformerPreset["options"]>
		steps: PresetStep[]
		inputs: string[]
		outputs: string[]
	}[]
}
export interface PresetLibrary {
	format: typeof PRESET_LIBRARY_FORMAT
	version: typeof PRESET_LIBRARY_VERSION
	presets: TransformerPreset[]
	setups: PresetSetup[]
}
const supported = new Set([...TRANSFORMERS, ID_TIMING_HUMANISER, "identity"])
function object(value: any): asserts value is Record<string, any> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Expected a JSON object")
	}
}
function text(value: unknown, label: string, required = true) {
	if (typeof value !== "string" || (required && !value.trim())) {
		throw new Error(`Invalid ${label}`)
	}
}
function unique(items: any[], label: string) {
	const ids = new Set<string>()
	for (const item of items) {
		object(item)
		text(item.id, `${label} ID`)
		if (ids.has(item.id)) {
			throw new Error(`Duplicate ${label} ID: ${item.id}`)
		}
		ids.add(item.id)
	}
	return ids
}
function steps(value: any) {
	if (!Array.isArray(value)) {
		throw new Error("Invalid transformer steps")
	}
	for (const step of value) {
		object(step)
		if (!supported.has(step.type)) {
			throw new Error(`Unsupported transformer: ${step.type}`)
		}
		object(step.config)
		text(step.summary, "transformer summary", false)
		if ("type" in step.config) {
			throw new Error("Transformer type belongs outside config")
		}
	}
}
function options(value: any) {
	object(value)
	if (value.name !== undefined) {
		text(value.name, "chain name")
	}
	if (value.active !== undefined && typeof value.active !== "boolean") {
		throw new Error("Invalid chain active state")
	}
	if (
		value.graphLayout !== undefined &&
		!["horizontal", "vertical"].includes(value.graphLayout)
	) {
		throw new Error("Invalid graph layout")
	}
	if (value.positions !== undefined) {
		object(value.positions)
		for (const position of Object.values(value.positions)) {
			object(position)
			if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) {
				throw new Error("Invalid graph position")
			}
		}
	}
}
export function parsePresetLibrary(json: string): PresetLibrary {
	const data = JSON.parse(json)
	object(data)
	if (data.format !== PRESET_LIBRARY_FORMAT) {
		throw new Error("Not a Harmoneasy preset library")
	}
	if (data.version !== PRESET_LIBRARY_VERSION) {
		throw new Error(`Unsupported preset library version: ${data.version}`)
	}
	if (!Array.isArray(data.presets) || !Array.isArray(data.setups)) {
		throw new Error("Expected presets and setups arrays")
	}
	unique(data.presets, "preset")
	unique(data.setups, "setup")
	for (const preset of data.presets) {
		text(preset.name, "preset name")
		text(preset.category, "preset category")
		text(preset.description, "preset description", false)
		text(preset.useCase, "preset use case", false)
		steps(preset.steps)
		if (preset.options !== undefined) {
			options(preset.options)
		}
	}
	for (const setup of data.setups) {
		text(setup.name, "setup name")
		text(setup.description, "setup description", false)
		if (!Array.isArray(setup.devices) || !Array.isArray(setup.chains)) {
			throw new Error("Invalid setup chains or devices")
		}
		unique(setup.devices, "device")
		const chainIds = unique(setup.chains, "chain")
		if (setup.activeChainId !== null && !chainIds.has(setup.activeChainId)) {
			throw new Error("Invalid active chain reference")
		}
		for (const device of setup.devices) {
			object(device.definition)
			if (
				!["input", "output"].includes(device.direction) ||
				![
					"input",
					"output",
					"instrument",
					"keyboard-input",
					"keyboard-output",
					"polyphonic",
					"external"
				].includes(device.definition.factory)
			) {
				throw new Error("Invalid setup device")
			}
			if (
				device.definition.inputId !== undefined &&
				!setup.devices.some(
					(input: any) =>
						input.id === device.definition.inputId && input.direction === "input"
				)
			) {
				throw new Error("Invalid dependent input reference")
			}
		}
		for (const chain of setup.chains) {
			options(chain.options)
			steps(chain.steps)
			for (const direction of ["input", "output"]) {
				const refs = chain[`${direction}s`]
				if (
					!Array.isArray(refs) ||
					new Set(refs).size !== refs.length ||
					refs.some(
						(id) =>
							!setup.devices.some(
								(device: any) => device.id === id && device.direction === direction
							)
					)
				) {
					throw new Error("Invalid setup device reference")
				}
			}
		}
	}
	return data as PresetLibrary
}
export function configurationSteps(transformers: string): PresetStep[] {
	return JSON.parse(transformers).map((value: string | Record<string, unknown>) => {
		const { type, ...config } = typeof value === "string" ? JSON.parse(value) : value
		return { type, config, summary: `${type} — saved transformer settings.` }
	})
}
export function stepsConfiguration(value: PresetStep[]): string {
	return JSON.stringify(value.map(({ type, config }) => JSON.stringify({ ...config, type })))
}