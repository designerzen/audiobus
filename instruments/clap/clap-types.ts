/**
 * CLAP Types
 * Shared type definitions for CLAP plugins
 */

/**
 * CLAP Patch Configuration
 * Represents a CLAP plugin patch with its metadata
 */
import type { DeviceClassification, DeviceAttribution } from "../../io/device-classification"

export interface CLAPPatch {
	id: string
	name: string
	url: string // URL to the .wclap bundle or tar.gz
	category?: string
	description?: string
	author?: string
	version?: string
	factory?: string // Factory ID within the plugin
	features?: string[]
	title?: string
	type?: DeviceClassification["type"]
	subtype?: DeviceClassification["subtype"]
	attribution?: DeviceAttribution
}