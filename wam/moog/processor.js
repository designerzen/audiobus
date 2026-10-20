/**
 * Fontana Moog VCF model, adapted from the Photosynth AudioWorklet.
 * Original Java: Federico Fontana, August 2007.
 * SuperCollider C++: Dan Stowell. Photosynth AudioWorklet: @designerzen.
 * Fontana, "Preserving the Structure of the Moog VCF in the Digital Domain",
 * ICMC 2007, pp. 291-294.
 * https://quod.lib.umich.edu/i/icmc/bbp2372.2007.062
 * Author-derived reference: SuperCollider server/plugins/FilterUGens.cpp, MoogFF.
 * https://doc.sccode.org/Classes/MoogFF.html
 * Preserve the four-section, delay-free feedback equations. The timbre.js
 * output gain/clipping and its omitted second-stage input update are excluded.
 * This function is injected into the worklet and must remain self-contained.
 */
export default function registerMoogProcessor(moduleId, definitions) {
    const { WamProcessor, WamParameterInfo } = globalThis.webAudioModules.getModuleScope(moduleId)
    const rate = globalThis.sampleRate
    class MoogProcessor extends WamProcessor {
        constructor(options) {
            super(options)
            this.voices = []
            this.bend = new Float64Array(16)
            this.sustain = new Uint8Array(16)
        }
        _generateWamParameterInfo() {
            return Object.fromEntries(Object.entries(definitions).map(([id, config]) => [id, new WamParameterInfo(id, config)]))
        }
        _filterCoefficients(frequency) {
            // Bilinear transform with cutoff prewarping. Restrict only to the
            // valid digital frequency domain (strictly below Nyquist).
            const cutoff = Math.max(0, Math.min(rate * (0.5 - 1e-6), frequency))
            if (cutoff === this.filterCutoff) return
            const T = 1 / rate
            const wcD = (2 / T) * Math.tan(T * Math.PI * cutoff)
            const TwcD = T * wcD
            this.filterCutoff = cutoff
            this.b0 = TwcD / (TwcD + 2)
            this.a1 = (TwcD - 2) / (TwcD + 2)
        }
        _filterSample(input, state, b0, a1, k) {
            // Four cascaded sections H1(z) = b0(1 + z^-1)/(1 + a1 z^-1).
            // With y = b0^4 u + s and u = input - k*y, solve the
            // current-sample feedback loop explicitly; do not delay y.
            const s = state.s4 + b0 * (state.s3 + b0 * (state.s2 + b0 * state.s1))
            const b = b0 ** 4
            const output = (b * input + s) / (1 + k * b)
            const u = input - k * output
            const y1 = b0 * u + state.s1
            const y2 = b0 * y1 + state.s2
            const y3 = b0 * y2 + state.s3
            state.s1 = b0 * u - a1 * y1
            state.s2 = b0 * y1 - a1 * y2
            state.s3 = b0 * y2 - a1 * y3
            state.s4 = b0 * y3 - a1 * output
            return output
        }
        _onMidi({ bytes }) {
            const [status, note, velocity] = bytes
            const channel = status & 15
            const kind = status & 0xf0
            if (kind === 0x90 && velocity > 0) {
                this.voices = this.voices.filter(v => v.note !== note || v.channel !== channel)
                if (this.voices.length >= 16) this.voices.shift()
                this.voices.push({ note, channel, velocity: velocity / 127, phase: 0, envelope: 0,
                    held: true, released: false, s1: 0, s2: 0, s3: 0, s4: 0 })
            } else if (kind === 0x80 || kind === 0x90) {
                for (const v of this.voices) if (v.note === note && v.channel === channel) {
                    v.held = false
                    v.released = !this.sustain[channel]
                }
            } else if (kind === 0xe0) {
                this.bend[channel] = ((note | velocity << 7) - 8192) / 8192 * 2
            } else if (kind === 0xb0) {
                if (note === 64) {
                    this.sustain[channel] = velocity >= 64 ? 1 : 0
                    if (!this.sustain[channel]) for (const v of this.voices) {
                        if (v.channel === channel && !v.held) v.released = true
                    }
                } else if (note === 120) {
                    this.voices = this.voices.filter(v => v.channel !== channel)
                } else if (note === 123) {
                    for (const v of this.voices) if (v.channel === channel) {
                        v.held = false
                        v.released = !this.sustain[channel]
                    }
                } else if (note === 121) {
                    this.bend[channel] = 0
                    this.sustain[channel] = 0
                    for (const v of this.voices) if (v.channel === channel && !v.held) v.released = true
                }
            }
        }
        _process(start, end, _inputs, outputs) {
            const channels = outputs[0]
            if (!channels?.length) return
            const p = this._parameterInterpolators
            const value = (id, i) => p[id].values[i]
            const blep = (phase, step) => {
                if (phase < step) { const t = phase / step; return t + t - t * t - 1 }
                if (phase > 1 - step) { const t = (phase - 1) / step; return t * t + t + t + 1 }
                return 0
            }
            for (let i = start; i < end; i++) {
                this._filterCoefficients(value('frequency', i))
                const b0 = this.b0, a1 = this.a1
                const resonance = Math.max(0, Math.min(4, value('gain', i)))
                const waveform = Math.round(value('waveform', i))
                const attack = 1 / (Math.max(0.001, value('attack', i)) * rate)
                const release = Math.exp(-Math.log(1000) / (Math.max(0.005, value('release', i)) * rate))
                let mixed = 0
                for (const v of this.voices) {
                    const step = Math.min(0.45, 440 * 2 ** ((v.note - 69 + this.bend[v.channel]) / 12) / rate)
                    const phase = v.phase
                    let oscillator
                    if (waveform === 0) oscillator = 2 * phase - 1 - blep(phase, step)
                    else if (waveform === 1) oscillator = (phase < 0.5 ? 1 : -1) + blep(phase, step) - blep((phase + 0.5) % 1, step)
                    else if (waveform === 2) oscillator = 1 - 4 * Math.abs(phase - 0.5)
                    else oscillator = Math.sin(phase * 2 * Math.PI)
                    v.phase = (phase + step) % 1
                    v.envelope = v.released ? v.envelope * release : Math.min(1, v.envelope + attack)
                    const input = oscillator * v.velocity * v.envelope
                    mixed += this._filterSample(input, v, b0, a1, resonance)
                }
                // Fontana's model is linear: no extra saturator or clipping.
                const sample = mixed * value('volume', i)
                for (const channel of channels) channel[i] = sample
            }
            this.voices = this.voices.filter(v => !v.released || v.envelope > 0.00001)
        }
    }
    globalThis.registerProcessor(moduleId, MoogProcessor)
}
