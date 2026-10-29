// Plays SiON's 44.1kHz interleaved stereo callback buffers at the context rate.
class SiONStreamProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffers = [];
        this.position = 0;
        this.pending = false;
        this.stopped = false;
        this.port.onmessage = ({ data }) => {
            if (data.type === 'stop') {
                this.stopped = true;
                this.buffers = [];
            }
            else if (data.type === 'samples') {
                if (data.data.length)
                    this.buffers.push(data.data);
                this.pending = false;
            }
        };
    }
    process(_inputs, outputs) {
        if (this.stopped)
            return false;
        const output = outputs[0];
        if (!output?.length)
            return true;
        const step = 44100 / sampleRate;
        for (let i = 0; i < output[0].length; i++) {
            const buffer = this.buffers[0];
            if (!buffer)
                continue;
            const index = Math.floor(this.position), fraction = this.position - index;
            for (let channel = 0; channel < output.length; channel++) {
                const a = buffer[index * 2 + channel] ?? 0;
                const b = buffer[(index + 1) * 2 + channel] ?? this.buffers[1]?.[channel] ?? a;
                output[channel][i] = a + (b - a) * fraction;
            }
            this.position += step;
            if (this.position >= buffer.length / 2) {
                this.position -= buffer.length / 2;
                this.buffers.shift();
            }
        }
        if (this.buffers.length < 2 && !this.pending) {
            this.pending = true;
            this.port.postMessage({ type: 'need' });
        }
        return true;
    }
}
registerProcessor('sion-stream', SiONStreamProcessor);
export {};
