export class SiONAudioHost {
    context;
    registry;
    destination;
    onError;
    states = new Map();
    loading = new Map();
    module;
    constructor(context, registry, destination = context.destination) {
        this.context = context;
        this.registry = registry;
        this.destination = destination;
    }
    event(target, name, error) {
        const events = this.registry['flash.events'];
        target.dispatchEvent(error
            ? new events.IOErrorEvent(name, false, false, String(error))
            : new events.Event(name));
    }
    async load(sound, url) {
        this.close(sound);
        const abort = new AbortController();
        this.loading.set(sound, abort);
        try {
            const response = await fetch(url, { signal: abort.signal });
            if (!response.ok)
                throw new Error(`Audio download failed: ${response.status}`);
            const bytes = await response.arrayBuffer();
            if (abort.signal.aborted)
                return;
            sound.bytesLoaded = sound.bytesTotal = bytes.byteLength;
            const buffer = await this.context.decodeAudioData(bytes);
            if (!abort.signal.aborted)
                this.fromBuffer(sound, buffer);
        }
        catch (error) {
            if (!abort.signal.aborted)
                this.event(sound, 'ioError', error);
        }
        finally {
            if (this.loading.get(sound) === abort)
                this.loading.delete(sound);
        }
    }
    async decode(sound, bytes) {
        try {
            const buffer = await this.context.decodeAudioData(bytes.slice(0));
            sound.bytesLoaded = sound.bytesTotal = bytes.byteLength;
            this.fromBuffer(sound, buffer);
        }
        catch (error) {
            this.event(sound, 'ioError', error);
        }
    }
    fromBuffer(sound, buffer) {
        this.pcm(sound, [buffer.getChannelData(0), buffer.getChannelData(Math.min(1, buffer.numberOfChannels - 1))], buffer.sampleRate);
    }
    pcm(sound, channels, rate) {
        if (!(rate > 0) || !Number.isFinite(rate))
            throw new RangeError('Invalid PCM sample rate');
        const length = Math.ceil(channels[0].length * 44100 / rate);
        const result = channels.map(channel => Array.from({ length }, (_, i) => {
            const position = i * rate / 44100, index = Math.floor(position);
            const a = channel[Math.min(index, channel.length - 1)] ?? 0;
            const b = channel[Math.min(index + 1, channel.length - 1)] ?? 0;
            return a + (b - a) * (position - index);
        }));
        sound.setPCM(result);
    }
    close(sound) { this.loading.get(sound)?.abort(); this.loading.delete(sound); }
    start(channel, sound, startTime, loops) {
        const gain = this.context.createGain(), pan = this.context.createStereoPanner(), analyser = this.context.createAnalyser();
        gain.connect(pan).connect(analyser).connect(this.destination);
        const state = { stopped: false, started: this.context.currentTime, offset: startTime, gain, pan, analyser };
        this.states.set(channel, state);
        this.update(channel);
        void this.startSource(channel, state, sound, loops).catch(error => {
            this.stop(channel);
            this.event(sound, 'ioError', error);
            this.onError?.(error);
        });
    }
    async startSource(channel, state, sound, loops) {
        if (sound.pcm) {
            const frames = sound.pcm[0].length;
            if (!frames) {
                this.stop(channel);
                this.event(channel, 'soundComplete');
                return;
            }
            const buffer = this.context.createBuffer(2, frames, 44100);
            buffer.copyToChannel(Float32Array.from(sound.pcm[0]), 0);
            buffer.copyToChannel(Float32Array.from(sound.pcm[1]), 1);
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            source.loop = loops > 0;
            source.connect(state.gain);
            source.onended = () => { if (!state.stopped) {
                this.stop(channel);
                this.event(channel, 'soundComplete');
            } };
            state.source = source;
            state.started = this.context.currentTime;
            const offset = Math.min(buffer.duration, Math.max(0, state.offset / 1000));
            source.start(0, offset);
            if (loops > 0)
                source.stop(this.context.currentTime + buffer.duration * (loops + 1) - offset);
            return;
        }
        this.module ??= this.context.audioWorklet.addModule(new URL('./sion-stream-processor.js', import.meta.url)).catch(error => { this.module = undefined; throw error; });
        await this.module;
        if (state.stopped)
            return;
        const node = new AudioWorkletNode(this.context, 'sion-stream', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2] });
        state.source = node;
        const fill = () => {
            if (state.stopped)
                return;
            const data = Float32Array.from(sound.provide());
            if (!data.length) {
                this.stop(channel);
                this.event(channel, 'soundComplete');
                return;
            }
            if (!state.stopped)
                node.port.postMessage({ type: 'samples', data }, [data.buffer]);
        };
        node.port.onmessage = ({ data }) => { if (data.type === 'need')
            fill(); };
        fill();
        fill();
        state.started = this.context.currentTime;
        node.connect(state.gain);
    }
    update(channel) {
        const state = this.states.get(channel);
        if (!state)
            return;
        state.gain.gain.value = channel.soundTransform.volume;
        state.pan.pan.value = Math.max(-1, Math.min(1, channel.soundTransform.pan));
    }
    position(channel) {
        const state = this.states.get(channel);
        return state ? (this.context.currentTime - state.started) * 1000 + state.offset : 0;
    }
    peak(channel, _channelIndex) {
        const state = this.states.get(channel);
        if (!state)
            return 0;
        const data = new Float32Array(state.analyser.fftSize);
        state.analyser.getFloatTimeDomainData(data);
        return data.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0);
    }
    stop(channel) {
        const state = this.states.get(channel);
        if (!state)
            return;
        state.stopped = true;
        if (state.source instanceof AudioWorkletNode) {
            state.source.port.postMessage({ type: 'stop' });
            state.source.port.close();
        }
        else
            state.source?.stop();
        state.source?.disconnect();
        state.gain.disconnect();
        state.pan.disconnect();
        state.analyser.disconnect();
        this.states.delete(channel);
    }
    dispose() {
        this.registry['org.si.sion']?.SiONDriver.mutex?.stop();
        for (const channel of this.states.keys())
            this.stop(channel);
        for (const sound of this.loading.keys())
            this.close(sound);
        const host = globalThis;
        if (host.__sionHost === this)
            delete host.__sionHost;
    }
}
export function installSiONAudio(context, registry, destination) {
    const host = globalThis;
    host.__sionHost?.dispose();
    return host.__sionHost = new SiONAudioHost(context, registry, destination);
}
