export const MOOG_ID = 'org.harmoneasy.moog'
export const MOOG_URL = 'harmoneasy:moog'
export const MOOG_PARAMETERS = {
    frequency: { label: 'Cutoff', defaultValue: 1200, minValue: 20, maxValue: 20000, units: 'Hz' },
    gain: { label: 'Resonance', defaultValue: 2, minValue: 0, maxValue: 4 },
    waveform: { label: 'Waveform', type: 'choice', defaultValue: 0, minValue: 0, maxValue: 3, choices: ['Saw', 'Square', 'Triangle', 'Sine'] },
    attack: { label: 'Attack', defaultValue: 0.01, minValue: 0.001, maxValue: 2, units: 's' },
    release: { label: 'Release', defaultValue: 0.2, minValue: 0.005, maxValue: 4, units: 's' },
    volume: { label: 'Volume', defaultValue: 0.3, minValue: 0, maxValue: 1 },
}
export const MOOG_DESCRIPTOR = {
    identifier: MOOG_ID, name: 'Moog', vendor: 'Harmoneasy',
    description: 'Polyphonic synthesizer with the Photosynth MoogFF ladder filter',
    version: '1.0.0', apiVersion: '2.0.0',
    keywords: ['moog', 'ladder', 'synthesizer'], category: ['Instrument'], path: MOOG_URL,
    isInstrument: true, hasAudioInput: false, hasAudioOutput: true,
    hasMidiInput: true, hasMidiOutput: false,
}
