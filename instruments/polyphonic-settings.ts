export const POLYSYNTH_WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'] as const

export const POLYSYNTH_PARAMETERS = {
    volume: { label: 'Volume', min: 0, max: 1, step: 0.01, default: 1, unit: '%' },
    attack: { label: 'Attack', min: 0, max: 4, step: 0.01, default: 0.4, unit: 's' },
    decay: { label: 'Decay', min: 0, max: 4, step: 0.01, default: 0.9, unit: 's' },
    sustain: { label: 'Sustain', min: 0, max: 1, step: 0.01, default: 0.85, unit: '%' },
    release: { label: 'Release', min: 0, max: 8, step: 0.01, default: 0.3, unit: 's' },
    filterCutOff: { label: 'Cutoff', min: 20, max: 20000, step: 1, default: 2200, unit: 'Hz' },
    filterResonance: { label: 'Resonance', min: 0, max: 20, step: 0.1, default: 1.8, unit: 'Q' },
} as const

export interface PolySynthSettings {
    shape: typeof POLYSYNTH_WAVEFORMS[number]
    volume: number
    attack: number
    decay: number
    sustain: number
    release: number
    filterCutOff: number
    filterResonance: number
}

export const POLYSYNTH_DEFAULTS: PolySynthSettings = {
    shape: 'sine',
    ...Object.fromEntries(Object.entries(POLYSYNTH_PARAMETERS).map(([key, parameter]) => [key, parameter.default])),
} as PolySynthSettings
