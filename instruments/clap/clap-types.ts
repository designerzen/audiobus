/**
 * CLAP Types
 * Shared type definitions for CLAP plugins
 */

/**
 * CLAP Patch Configuration
 * Represents a CLAP plugin patch with its metadata
 */
export interface CLAPPatch {
	id: string
	name: string
	url: string // URL to the .wclap bundle or tar.gz
	category?: string
	description?: string
	author?: string
	version?: string
	factory?: string // Factory ID within the plugin
}
