/**
 * Fontana Moog VCF model, adapted from the Photosynth AudioWorklet.
 * Original Java: Federico Fontana, August 2007.
 * SuperCollider C++: Dan Stowell. Photosynth AudioWorklet: @designerzen.
 * Fontana, "Preserving the Structure of the Moog VCF in the Digital Domain",
 * ICMC 2007, pp. 291-294.
 * https://quod.lib.umich.edu/i/icmc/bbp2372.2007.062
 * Author-derived reference: SuperCollider server/plugins/FilterUGens.cpp, MoogFF.
 * https://doc.sccode.org/Classes/MoogFF.html
 * Checked against the supplied paper, p. 292, equations (4)-(8).
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
            this.heldNotes = []
            this.voiceMode = 0
            this.lfoPhase = 0
            this.noiseSeed = 0x12345678
        }
        _generateWamParameterInfo() {
            return Object.fromEntries(Object.entries(definitions).map(([id, config]) => [id, new WamParameterInfo(id, config)]))
        }
        _filterCoefficients(frequency, state = this) {
            // Paper equations (6)-(7): bilinear transform with prewarping.
            // Restrict only to the
            // valid digital frequency domain (strictly below Nyquist).
            const cutoff = Math.max(0, Math.min(rate * (0.5 - 1e-6), frequency))
            if (cutoff === state.filterCutoff) return
            const T = 1 / rate
            const wcD = (2 / T) * Math.tan(T * Math.PI * cutoff)
            const TwcD = T * wcD
            state.filterCutoff = cutoff
            state.b0 = TwcD / (TwcD + 2)
            state.a1 = (TwcD - 2) / (TwcD + 2)
        }
        _filterSample(input, state, b0, a1, k) {
            // Paper equations (8), (5), (4), in that order.
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
        _parameter(id) {
            return this._parameterState?.[id]?.value ?? this._parameterInterpolators[id].values[0]
        }
        _createVoice(note, channel, velocity, pitch = note) {
            return { note, channel, velocity: velocity / 127, pitch, phase: 0, phase2: 0, subPhase: 0,
                amp: { value: 0, stage: 0, releaseStart: 0 },
                filter: { value: 0, stage: 0, releaseStart: 0 },
                held: true, released: false, s1: 0, s2: 0, s3: 0, s4: 0 }
        }
        _setVoiceMode(mode) {
            if (mode === this.voiceMode) return
            this.voiceMode = mode
            if (mode === 0) {
                this.voices = this.heldNotes.slice(-16).map(n => {
                    const voice = this._createVoice(n.note, n.channel, n.velocity)
                    voice.held = n.held
                    return voice
                })
            } else {
                const last = this.heldNotes[this.heldNotes.length - 1]
                const existing = last && this.voices.find(v => v.note === last.note && v.channel === last.channel)
                this.voices = last ? [existing ?? this._createVoice(last.note, last.channel, last.velocity)] : []
            }
        }
        _selectMonoNote(next, retrigger = false) {
            const voice = this.voices[0]
            if (!next) {
                if (voice) { voice.held = false; voice.released = true }
                return
            }
            if (!voice || voice.released) {
                this.voices = [this._createVoice(next.note, next.channel, next.velocity,
                    this._parameter('glide') > 0 && voice ? voice.pitch : next.note)]
            } else if (voice.note !== next.note || voice.channel !== next.channel || (retrigger && this.voiceMode === 1)) {
                voice.note = next.note
                voice.channel = next.channel
                voice.velocity = next.velocity / 127
                if (this.voiceMode === 1) {
                    voice.amp.value = voice.filter.value = 0
                    voice.amp.stage = voice.filter.stage = 0
                }
            }
            this.voices[0].held = next.held
            this.voices[0].released = false
        }
        _refreshHeldNotes() {
            this.heldNotes = this.heldNotes.filter(n => n.held || this.sustain[n.channel])
            if (this.voiceMode) this._selectMonoNote(this.heldNotes[this.heldNotes.length - 1])
        }
        _onMidi({ bytes }) {
            const [status, note, velocity] = bytes
            const channel = status & 15
            const kind = status & 0xf0
            this._setVoiceMode(Math.round(this._parameter('voiceMode')))
            if (kind === 0x90 && velocity > 0) {
                this.heldNotes = this.heldNotes.filter(n => n.note !== note || n.channel !== channel)
                this.heldNotes.push({ note, channel, velocity, held: true })
                if (this.voiceMode) this._selectMonoNote(this.heldNotes[this.heldNotes.length - 1], true)
                else {
                    const previous = this.voices[this.voices.length - 1]
                    this.voices = this.voices.filter(v => v.note !== note || v.channel !== channel)
                    if (this.voices.length >= 16) this.voices.shift()
                    this.voices.push(this._createVoice(note, channel, velocity,
                        this._parameter('glide') > 0 && previous ? previous.pitch : note))
                }
            } else if (kind === 0x80 || kind === 0x90) {
                for (const n of this.heldNotes) if (n.note === note && n.channel === channel) n.held = false
                if (!this.voiceMode) for (const v of this.voices) if (v.note === note && v.channel === channel) {
                    v.held = false
                    v.released = !this.sustain[channel]
                }
                this._refreshHeldNotes()
            } else if (kind === 0xe0) {
                this.bend[channel] = ((note | velocity << 7) - 8192) / 8192 * 2
            } else if (kind === 0xb0) {
                if (note === 120) {
                    this.voices = this.voices.filter(v => v.channel !== channel)
                    this.heldNotes = this.heldNotes.filter(n => n.channel !== channel)
                    this._refreshHeldNotes()
                } else if (note === 64 || note === 121 || note === 123) {
                    if (note === 64) this.sustain[channel] = velocity >= 64 ? 1 : 0
                    if (note === 121) { this.sustain[channel] = 0; this.bend[channel] = 0 }
                    if (note === 123) {
                        for (const n of this.heldNotes) if (n.channel === channel) n.held = false
                        for (const v of this.voices) if (v.channel === channel) v.held = false
                    }
                    if (!this.voiceMode) for (const v of this.voices) {
                        if (v.channel === channel && !v.held && !this.sustain[channel]) v.released = true
                    }
                    this._refreshHeldNotes()
                }
            }
        }
        _advanceEnvelope(env, released, attack, decay, sustain, release) {
            if (released && env.stage !== 3) { env.stage = 3; env.releaseStart = env.value }
            if (env.stage === 0) {
                env.value = Math.min(1, env.value + 1 / (Math.max(0.001, attack) * rate))
                if (env.value === 1) env.stage = 1
            } else if (env.stage === 1) {
                env.value = Math.max(sustain, env.value - (1 - sustain) / (Math.max(0.001, decay) * rate))
                if (env.value <= sustain) env.stage = 2
            } else if (env.stage === 2) env.value = sustain
            else env.value = Math.max(0, env.value - env.releaseStart / (Math.max(0.005, release) * rate))
            return env.value
        }
        _polyBlep(phase, step) {
            if (phase < step) { const t = phase / step; return t + t - t * t - 1 }
            if (phase > 1 - step) { const t = (phase - 1) / step; return t * t + t + t + 1 }
            return 0
        }
        _oscillator(phase, step, waveform) {
            if (waveform === 0) return 2 * phase - 1 - this._polyBlep(phase, step)
            if (waveform === 1) return (phase < 0.5 ? 1 : -1) + this._polyBlep(phase, step) - this._polyBlep((phase + 0.5) % 1, step)
            if (waveform === 2) return 1 - 4 * Math.abs(phase - 0.5)
            return Math.sin(phase * 2 * Math.PI)
        }
        _process(start, end, _inputs, outputs) {
            const channels = outputs[0]
            if (!channels?.length) return
            const p = this._parameterInterpolators
            const value = (id, i) => p[id].values[i]
            for (let i = start; i < end; i++) {
                this._setVoiceMode(Math.round(value('voiceMode', i)))
                const resonance = Math.max(0, Math.min(4, value('gain', i)))
                const waveform = Math.round(value('waveform', i))
                const waveform2 = Math.round(value('waveform2', i))
                const lfoWave = Math.round(value('lfoWaveform', i))
                const lfo = lfoWave === 0 ? Math.sin(2 * Math.PI * this.lfoPhase)
                    : lfoWave === 1 ? 1 - 4 * Math.abs(this.lfoPhase - 0.5) : this.lfoPhase < 0.5 ? 1 : -1
                this.lfoPhase = (this.lfoPhase + value('lfoRate', i) / rate) % 1
                const glide = value('glide', i)
                const glideCoefficient = glide > 0 ? Math.exp(-Math.log(1000) / (glide * rate)) : 0
                let mixed = 0
                for (const v of this.voices) {
                    v.pitch = v.note + (v.pitch - v.note) * glideCoefficient
                    const pitch = v.pitch + this.bend[v.channel] + lfo * value('lfoPitch', i)
                    const fundamental = 440 * 2 ** ((pitch - 69) / 12)
                    const step = Math.min(0.45, fundamental * 2 ** (Math.round(value('octave', i)) - 2) / rate)
                    const step2 = Math.min(0.45, fundamental * 2 ** (Math.round(value('octave2', i)) - 2 + value('detune', i) / 1200) / rate)
                    const subStep = Math.min(0.45, fundamental * 2 ** (Math.round(value('octave', i)) - 3) / rate)
                    const mix = value('oscillatorMix', i), sub = value('sub', i), noise = value('noise', i)
                    this.noiseSeed ^= this.noiseSeed << 13
                    this.noiseSeed ^= this.noiseSeed >>> 17
                    this.noiseSeed ^= this.noiseSeed << 5
                    const white = (this.noiseSeed >>> 0) / 2147483648 - 1
                    const oscillator = ((1 - mix) * this._oscillator(v.phase, step, waveform)
                        + mix * this._oscillator(v.phase2, step2, waveform2)
                        + sub * this._oscillator(v.subPhase, subStep, 1) + noise * white) / (1 + sub + noise)
                    v.phase = (v.phase + step) % 1
                    v.phase2 = (v.phase2 + step2) % 1
                    v.subPhase = (v.subPhase + subStep) % 1
                    const amp = this._advanceEnvelope(v.amp, v.released, value('attack', i), value('decay', i), value('sustain', i), value('release', i))
                    const envelope = this._advanceEnvelope(v.filter, v.released, value('filterAttack', i), value('filterDecay', i), value('filterSustain', i), value('filterRelease', i))
                    const octaves = (v.pitch - 60) / 12 * value('keyTracking', i)
                        + envelope * value('filterAmount', i) + lfo * value('lfoFilter', i)
                    const cutoff = Math.max(20, value('frequency', i) * 2 ** octaves)
                    this._filterCoefficients(cutoff, v)
                    const tremolo = 1 - value('lfoAmp', i) * (1 - lfo) / 2
                    mixed += this._filterSample(oscillator * v.velocity, v, v.b0, v.a1, resonance) * amp * tremolo
                }
                // Fontana's model is linear: no extra saturator or clipping.
                const sample = mixed * value('volume', i)
                for (const channel of channels) channel[i] = sample
            }
            this.voices = this.voices.filter(v => !v.released || v.amp.value > 0)
        }
    }
    globalThis.registerProcessor(moduleId, MoogProcessor)
}
