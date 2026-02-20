import type { IAudioOutput } from "../io/outputs/output-interface.ts"
import {
	INSTRUMENT_TYPE_SYNTH_OSCILLATOR,
	INSTRUMENT_TYPE_TONE_SYNTH,
	INSTRUMENT_TYPE_TONE_MONO_SYNTH,
	INSTRUMENT_TYPE_TONE_FM_SYNTH,
	INSTRUMENT_TYPE_TONE_PLUCK_STRING,
	INSTRUMENT_TYPE_TONE_SAMPLER,
	INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT,
	EXTERNAL_DATA_KEY_SCSYNTH,
	EXTERNAL_DATA_KEY_SAMPLE_URLS,
	INSTRUMENTS,
	type InstrumentMetadata
} from "./instrument-types.ts"

// Re-export constants and types for external use
export {
	INSTRUMENT_TYPE_SYNTH_OSCILLATOR,
	INSTRUMENT_TYPE_TONE_SYNTH,
	INSTRUMENT_TYPE_TONE_MONO_SYNTH,
	INSTRUMENT_TYPE_TONE_FM_SYNTH,
	INSTRUMENT_TYPE_TONE_PLUCK_STRING,
	INSTRUMENT_TYPE_TONE_SAMPLER,
	INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT,
	INSTRUMENT_CATEGORY_OSCILLATOR,
	INSTRUMENT_CATEGORY_SYNTHESIS,
	INSTRUMENT_CATEGORY_FM,
	INSTRUMENT_CATEGORY_PHYSICAL,
	INSTRUMENT_CATEGORY_SAMPLING,
	INSTRUMENT_CATEGORY_SUPERCOLLIDER,
	EXTERNAL_DATA_KEY_SCSYNTH,
	EXTERNAL_DATA_KEY_SAMPLE_URLS,
	type InstrumentMetadata
} from "./instrument-types.ts"

/**
 * Factory for creating and managing instrument instances with lazy loading
 */
export class InstrumentFactory {
	private static readonly INSTRUMENTS_REGISTRY: Map<string, InstrumentMetadata> = INSTRUMENTS

	/**
	 * Get list of available instruments
	 */
	static getAvailableInstruments(): InstrumentMetadata[] {
		return Array.from(this.INSTRUMENTS_REGISTRY.values())
	}

	/**
	 * Get instrument metadata by ID
	 */
	static getInstrumentMetadata(instrumentId: string): InstrumentMetadata | null {
		return this.INSTRUMENTS_REGISTRY.get(instrumentId) ?? null
	}

	/**
	 * Get instruments by category
	 */
	static getInstrumentsByCategory(
		category: InstrumentMetadata["category"]
	): InstrumentMetadata[] {
		return Array.from(this.INSTRUMENTS_REGISTRY.values()).filter((m) => m.category === category)
	}

	/**
	 * Create an instrument instance with lazy loading
	 * @param instrumentId - The ID of the instrument to create
	 * @param audioContext - The Web Audio API context
	 * @param externalData - Any required external data (scsynth instance, sample URLs, etc.)
	 * @param options - Instrument-specific options
	 * @returns Promise resolving to the instrument instance
	 */
	static async createInstrument(
		instrumentId: string,
		audioContext: BaseAudioContext | AudioContext,
		externalData: Record<string, any> = {},
		options: Record<string, any> = {}
	): Promise<IAudioOutput> {
		const metadata = this.INSTRUMENTS_REGISTRY.get(instrumentId)

		if (!metadata) {
			throw new Error(`Unknown instrument: ${instrumentId}`)
		}

		// Check for required external data
		if (metadata.requiresExternalData) {
			const missing = metadata.requiresExternalData.filter(
				(key) => !(key in externalData)
			)
			if (missing.length > 0) {
				throw new Error(
					`Missing required data for ${instrumentId}: ${missing.join(", ")}`
				)
			}
		}

		// Lazy load the module
		const module = await metadata.loader()
		const InstrumentClass = module.default

		// Instantiate based on instrument type
		let instance: IAudioOutput

		switch (instrumentId) {
			case INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT:
				// SuperCollider instrument requires scsynth instance
				instance = new InstrumentClass(
					audioContext,
					externalData[EXTERNAL_DATA_KEY_SCSYNTH],
					options
				)
				break

			case INSTRUMENT_TYPE_SYNTH_OSCILLATOR:
			case INSTRUMENT_TYPE_TONE_SYNTH:
			case INSTRUMENT_TYPE_TONE_MONO_SYNTH:
			case INSTRUMENT_TYPE_TONE_FM_SYNTH:
			case INSTRUMENT_TYPE_TONE_PLUCK_STRING:
			case INSTRUMENT_TYPE_TONE_SAMPLER:
				// Standard instruments with audioContext and options
				instance = new InstrumentClass(audioContext, options)
				break

			default:
				throw new Error(`No instantiation pattern for ${instrumentId}`)
		}

		return instance
	}

	/**
	 * Batch create multiple instruments
	 */
	static async createInstruments(
		definitions: Array<{
			instrumentId: string
			externalData?: Record<string, any>
			options?: Record<string, any>
		}>,
		audioContext: BaseAudioContext | AudioContext
	): Promise<Array<{ id: string; instance: IAudioOutput; error?: Error }>> {
		const results = await Promise.all(
			definitions.map(async (def) => {
				try {
					const instance = await this.createInstrument(
						def.instrumentId,
						audioContext,
						def.externalData,
						def.options
					)
					return {
						id: def.instrumentId,
						instance
					}
				} catch (error) {
					return {
						id: def.instrumentId,
						error: error as Error
					}
				}
			})
		)
		return results
	}

	/**
	 * Check if an instrument requires external data
	 */
	static requiresExternalData(instrumentId: string): string[] {
		const metadata = this.INSTRUMENTS.get(instrumentId)
		return metadata?.requiresExternalData ?? []
	}

	/**
	 * Register a custom instrument
	 */
	static registerCustomInstrument(
		id: string,
		metadata: Omit<InstrumentMetadata, "id">
	): void {
		this.INSTRUMENTS_REGISTRY.set(id, { id, ...metadata })
	}

	/**
	 * Unregister an instrument
	 */
	static unregisterInstrument(id: string): boolean {
		return this.INSTRUMENTS_REGISTRY.delete(id)
	}
}

/**
 * Convenience function for creating a single instrument
 */
export async function createInstrument(
	instrumentId: string,
	audioContext: BaseAudioContext | AudioContext,
	externalData?: Record<string, any>,
	options?: Record<string, any>
): Promise<IAudioOutput> {
	return InstrumentFactory.createInstrument(instrumentId, audioContext, externalData, options)
}

/**
 * Get available instruments
 */
export function getAvailableInstruments() {
	return InstrumentFactory.getAvailableInstruments()
}

/**
 * Get instrument metadata
 */
export function getInstrumentMetadata(instrumentId: string) {
	return InstrumentFactory.getInstrumentMetadata(instrumentId)
}
