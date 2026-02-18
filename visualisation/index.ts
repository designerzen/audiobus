/**
 * Audio Visualisation Module
 * Spectrum analysis and real-time visualization of audio data
 */

// Core visualisation classes
export { SpectrumAnalyzer } from './SpectrumAnalyzer.ts'
export { FilterDisplay } from './FilterDisplay.ts'
export { ExampleVisualiser } from './ExampleVisualiser.ts'

// Visualiser types
export { Visualiser } from './visualisers/Visualiser.ts'
export type { IVisualiser } from './visualisers/IVisualiser.ts'

// Individual visualisers
export { Harmongraph } from './visualisers/Harmongraph.ts'
export { Bars } from './visualisers/Bars.ts'
export { Scope } from './visualisers/Scope.ts'
export { Plasma } from './visualisers/Plasma.ts'

// Colour utilities
export { Colour } from './colour/Colour.ts'
export { Rainbows } from './colour/Rainbows.ts'
