/** Colored noise algorithms from AudioBus's ts2wp2es6pug branch (MIT).
 * Pink noise uses Paul Kellet's refined filter; brown uses a leaky integrator.
 */
export type NoiseColor = 'white' | 'pink' | 'brown'

export function fillNoise(output: Float32Array, color: NoiseColor = 'white', random: () => number = Math.random): Float32Array {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0
    for (let i = 0; i < output.length; i++) {
        const white = random() * 2 - 1
        if (color === 'pink') {
            b0 = 0.99886 * b0 + white * 0.0555179
            b1 = 0.99332 * b1 + white * 0.0750759
            b2 = 0.969 * b2 + white * 0.153852
            b3 = 0.8665 * b3 + white * 0.3104856
            b4 = 0.55 * b4 + white * 0.5329522
            b5 = -0.7616 * b5 - white * 0.016898
            output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
            b6 = white * 0.115926
        } else if (color === 'brown') {
            last = (last + 0.02 * white) / 1.02
            output[i] = last * 3.5
        } else output[i] = white
    }
    return output
}

/** Uses the caller's context and sample rate without creating extra contexts. */
export function createNoiseBuffer(context: BaseAudioContext, color: NoiseColor = 'white', seconds = 2): AudioBuffer {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('Noise duration must be positive and finite')
    const buffer = context.createBuffer(1, Math.max(1, Math.round(seconds * context.sampleRate)), context.sampleRate)
    fillNoise(buffer.getChannelData(0), color)
    return buffer
}
