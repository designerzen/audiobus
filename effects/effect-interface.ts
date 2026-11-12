import type { IAudioOutput } from "../io/outputs/output-interface"

export type EffectValue = number | string

export interface EffectChoice {
	readonly value: string
	readonly label: string
}

/** Numeric parameters use min, max and step; choice parameters use choices. */
export interface EffectParameter {
	readonly id: string
	readonly name: string
	readonly initial: EffectValue
	readonly min?: number
	readonly max?: number
	readonly step?: number
	readonly unit?: string
	readonly choices?: readonly EffectChoice[]
}

export interface EffectDefinition {
	readonly id: string
	readonly name: string
	readonly description: string
	readonly parameters: readonly EffectParameter[]
	/** Initial dry/wet balance, or false for effects that process the whole signal. */
	readonly mix: number | false
}

/**
 * An audio processor in an Output chain: upstream Outputs connect to audioInput,
 * and processed audio leaves through output.
 */
export interface IEffect extends IAudioOutput {
	readonly type: string
	readonly audioInput: AudioNode
	readonly output: AudioNode
	readonly parameters: readonly EffectParameter[]
	readonly options: Record<string, EffectValue | undefined>
	getParameter(id: string): EffectValue | undefined
	setParameter(id: string, value: EffectValue): void
	createGui(): Promise<HTMLElement>
	destroyGui(): Promise<void>
	destroy(): Promise<void>
}