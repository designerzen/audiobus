/**
 * Definitions Index
 *
 * Central export point for all device and transformer definitions
 * Provides unified access to metadata for inputs, outputs, and transformers
 */

// Input definitions
export {
	INPUT_DEFINITIONS,
	getInputDefinition,
	getInputIcon,
	getInputsByCategory,
	type InputDefinition,
} from "./input-definitions.ts"

// Output definitions
export {
	OUTPUT_DEFINITIONS,
	getOutputDefinition,
	getOutputIcon,
	getOutputsByCategory,
	type OutputDefinition,
} from "./output-definitions.ts"

// Transformer definitions
export {
	TRANSFORMER_DEFINITIONS,
	getTransformerDefinition,
	getTransformerIcon,
	getTransformersByCategory,
	type TransformerDefinition,
} from "./transformer-definitions.ts"

/**
 * Combined definition type for use in UI contexts that handle multiple device types
 */
export interface DeviceDefinition {
	id: string
	name: string
	description: string
	icon: string
	category: string
	type: "input" | "output" | "transformer"
}

/**
 * Get all device definitions combined
 */
export function getAllDeviceDefinitions(): DeviceDefinition[] {
	const { INPUT_DEFINITIONS } = await import("./input-definitions.ts")
	const { OUTPUT_DEFINITIONS } = await import("./output-definitions.ts")
	const { TRANSFORMER_DEFINITIONS } = await import("./transformer-definitions.ts")

	const devices: DeviceDefinition[] = []

	Object.values(INPUT_DEFINITIONS).forEach((def) => {
		devices.push({ ...def, type: "input" })
	})

	Object.values(OUTPUT_DEFINITIONS).forEach((def) => {
		devices.push({ ...def, type: "output" })
	})

	Object.values(TRANSFORMER_DEFINITIONS).forEach((def) => {
		devices.push({ ...def, type: "transformer" })
	})

	return devices
}

/**
 * Get all devices grouped by category
 */
export async function getAllDevicesByCategory(): Promise<
	Record<string, DeviceDefinition[]>
> {
	const grouped: Record<string, DeviceDefinition[]> = {}
	const devices = await getAllDeviceDefinitions()

	devices.forEach((device) => {
		if (!grouped[device.category]) {
			grouped[device.category] = []
		}
		grouped[device.category].push(device)
	})

	return grouped
}
