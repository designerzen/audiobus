/**
 * Factory interface for creating instrument UI factories
 * Bridges InstrumentFactory with the UI layer
 */
import type { IAudioOutput } from "../io/outputs/output-interface.ts"
import {
	InstrumentFactory,
	type InstrumentMetadata,
	INSTRUMENT_TYPE_SCSYNTH_INSTRUMENT,
	EXTERNAL_DATA_KEY_SCSYNTH,
	EXTERNAL_DATA_KEY_SAMPLE_URLS
} from "./instrument-factory.ts"

export interface InstrumentUIFactory {
	id: string
	name: string
	description: string
	category: string
	isAvailable: () => boolean
	create: (options?: Record<string, any>) => IAudioOutput | Promise<IAudioOutput>
}

/**
 * Get audio context - uses the global context if available
 */
const getAudioContext = (): BaseAudioContext | AudioContext => {
	// Try to get from window first
	if ((window as any).audioContext) {
		return (window as any).audioContext
	}
	
	// Try to create a new one
	const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext
	if (AudioContextClass) {
		return new AudioContextClass()
	}
	
	throw new Error("Web Audio API not available")
}

/**
 * Create an instrument instance for UI use
 */
const createInstrument = async (
	instrumentId: string,
	options?: Record<string, any>
): Promise<IAudioOutput> => {
	const audioContext = getAudioContext()
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

	return InstrumentFactory.createInstrument(instrumentId, audioContext, externalData, options)
}

/**
 * Convert InstrumentMetadata to InstrumentUIFactory
 */
const metadataToUIFactory = (metadata: InstrumentMetadata): InstrumentUIFactory => ({
	id: metadata.id,
	name: metadata.name,
	description: metadata.description,
	category: metadata.category,
	isAvailable: () => {
		// Check if required external data is available
		const requiredData = metadata.requiresExternalData ?? []
		
		for (const key of requiredData) {
			switch (key) {
				case EXTERNAL_DATA_KEY_SCSYNTH:
					if (!(window as any).scsynth) return false
					break
				case EXTERNAL_DATA_KEY_SAMPLE_URLS:
					// Sampler always available, sample URLs can be provided later
					break
			}
		}
		
		// Check for Web Audio API
		return typeof (window as any).AudioContext !== "undefined" || 
		       typeof (window as any).webkitAudioContext !== "undefined"
	},
	create: (options) => createInstrument(metadata.id, options)
})

/**
 * Get all available instrument UI factories
 */
export function getAvailableInstrumentFactories(): InstrumentUIFactory[] {
	const allInstruments = InstrumentFactory.getAvailableInstruments()
	return allInstruments
		.map(metadataToUIFactory)
		.filter((factory) => factory.isAvailable())
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

	return factory.create(options)
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
