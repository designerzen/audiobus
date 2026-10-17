import catalogue from './transformer-presets.json'
import { tranformerFactory } from './transformer-factory'
import type { PresetLibrary, TransformerPreset } from './preset-library'
export type { PresetStep, TransformerPreset } from './preset-library'

export const DEFAULT_PRESET_LIBRARY = catalogue as PresetLibrary
export const PRESETS = DEFAULT_PRESET_LIBRARY.presets
export const PRESET_CATEGORIES = [...new Set(PRESETS.map(preset => preset.category))]

export function createPresetTransformers(preset: TransformerPreset) {
    return preset.steps.map(({ type, config }) => tranformerFactory(type, structuredClone(config)))
}
