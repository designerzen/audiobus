import type { DeviceClassification } from "../io/device-classification.ts"
import { defineDevice } from "../io/device-definition"
import { OUTPUT_PREVIEWS } from "../io/output-previews"
import { requiring, type DeviceRequirementId } from "../io/device-requirements"
/**
 * Factory interface for creating instrument UI factories
 * Bridges InstrumentFactory with the UI layer
 */
import type { IAudioOutput } from "../io/outputs/output-interface.ts"
import {
	InstrumentFactory,
	type InstrumentMetadata,
	INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT,
	INSTRUMENT_CATEGORY_WAM2,
	EXTERNAL_DATA_KEY_SCSYNTH
} from "./instrument-factory.ts"

export interface InstrumentUIFactory extends DeviceClassification<"engine"> {
	id: string
	name: string
	description: string
	category: string
	preview?: string
	isAvailable: () => boolean
	requires?: readonly DeviceRequirementId[]
	create: (
		audioContext: BaseAudioContext | AudioContext,
		options?: Record<string, any>
	) => IAudioOutput | Promise<IAudioOutput>
}

/**
 * Create an instrument instance for UI use
 */
const createInstrument = async (
	audioContext: BaseAudioContext | AudioContext,
	instrumentId: string,
	options?: Record<string, any>
): Promise<IAudioOutput> => {
	const externalData: Record<string, any> = {}

	// Handle special cases that need external data
	switch (instrumentId) {
		case INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT:
			// Check if scsynth is available
			if ((window as any).scsynth) {
				externalData[EXTERNAL_DATA_KEY_SCSYNTH] = (window as any).scsynth
			} else {
				throw new Error("SuperCollider (scsynth) not available")
			}
			break
		// Sampler doesn't require external data at creation time
		// but options can include sample URLs
	}

	const instrument = await InstrumentFactory.createInstrument(
		instrumentId,
		audioContext,
		externalData,
		options
	)
	if (instrument.output && "connect" in instrument.output && options?.mixer) {
		instrument.output.connect(options.mixer)
	}
	return instrument
}

/**
 * Convert InstrumentMetadata to InstrumentUIFactory
 */
const metadataToUIFactory = (metadata: InstrumentMetadata): InstrumentUIFactory => ({
	id: metadata.id,
	type: metadata.type,
	subtype: metadata.subtype,
	name: metadata.name,
	description: metadata.description,
	category: metadata.category,
	preview:
		OUTPUT_PREVIEWS[`instrument:${metadata.id}`] ??
		(metadata.category === INSTRUMENT_CATEGORY_WAM2
			? OUTPUT_PREVIEWS[`output:${metadata.id}`]
			: undefined),
	// Sample URLs can be provided later, so only scsynth is required up front
	...requiring(
		"webAudio",
		...(metadata.category === INSTRUMENT_CATEGORY_WAM2 ? (["audioWorklet"] as const) : []),
		...(metadata.requiresExternalData?.includes(EXTERNAL_DATA_KEY_SCSYNTH)
			? (["scsynth"] as const)
			: [])
	),
	create: (audioContext, options) => createInstrument(audioContext, metadata.id, options)
})

/**
 * Get all available instrument UI factories
 */
export function getAvailableInstrumentFactories(): InstrumentUIFactory[] {
	return getInstrumentFactories().filter((factory) => factory.isAvailable())
}

/**
 * Get every instrument UI factory, including those this browser cannot run
 */
export function getInstrumentFactories(): InstrumentUIFactory[] {
	return InstrumentFactory.getAvailableInstruments().map(metadataToUIFactory)
}

/**
 * Get instrument factories by category
 */
export function getInstrumentFactoriesByCategory(category: string): InstrumentUIFactory[] {
	const factories = getAvailableInstrumentFactories()
	return factories.filter((factory) => factory.category === category)
}

/**
 * Create an instrument by ID
 */
export async function createInstrumentById(
	audioContext: BaseAudioContext | AudioContext,
	id: string,
	options?: Record<string, any>
): Promise<IAudioOutput> {
	const metadata = InstrumentFactory.getInstrumentMetadata(id)
	if (!metadata) {
		throw new Error(`Instrument not found: ${id}`)
	}

	const factory = metadataToUIFactory(metadata)
	if (!factory.isAvailable()) {
		throw new Error(`Instrument not available: ${metadata.name}`)
	}

	return defineDevice(await factory.create(audioContext, options), {
		factory: "instrument",
		type: id,
		options
	})
}

/**
 * Get instrument categories with available instruments
 */
export function getInstrumentCategories(): Array<{
	category: string
	instruments: InstrumentUIFactory[]
}> {
	const factories = getAvailableInstrumentFactories()
	const categories = new Map<string, InstrumentUIFactory[]>()

	for (const factory of factories) {
		if (!categories.has(factory.category)) {
			categories.set(factory.category, [])
		}
		categories.get(factory.category)!.push(factory)
	}

	return Array.from(categories.entries()).map(([category, instruments]) => ({
		category,
		instruments
	}))
}