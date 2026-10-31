import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { Timer } from "netronome"

export interface ITransformer {
	uuid: string
	fields: FieldConfig[]
	name: string
	description: string

	transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[]
	tick?(now: number, timer: Timer): IAudioCommand[]
	setMusicalBeat?(beat: number): void
	setHarmony?(state: import("../harmony").HarmonicState): void
	readonly handlesMidiControls?: boolean
	reset(): void
	destroy(): void
	exportConfig(): string
}

export interface FieldConfig {
	name: string
	label?: string
	group?: string
	help?: string
	placeholder?: string
	type: string
	enabled?: boolean
	values?: Array<string | number | { name: string; value: string | number | number[] }>
	default?: string | number | boolean | number[]
}