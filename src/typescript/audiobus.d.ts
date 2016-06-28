interface Window {
    DeviceOrientationEvent: any;
}
declare module audiobus {
    class Conductor {
    }
}
declare module audiobus {
    class Engine {
        static context: AudioContext;
        static create(window: any): AudioContext;
    }
}
declare module audiobus.envelopes {
    class Envelope {
        context: AudioContext;
        envelope: GainNode;
        static CURVE_TYPE_LINEAR: string;
        static CURVE_TYPE_EXPONENTIAL: string;
        static CURVE_TYPE_LINEAR_EXPONENTIAL: string;
        static CURVE_TYPE_EXPONENTIAL_LINEAR: string;
        delayTime: number;
        attackTime: number;
        amplitude: number;
        decayTime: number;
        sustainVolume: number;
        holdTime: number;
        hold: boolean;
        releaseTime: number;
        gain: number;
        attackType: string;
        decayType: string;
        releaseType: string;
        SILENCE: number;
        duration: number;
        constructor(audioContext: AudioContext, outputTo?: AudioNode, source?: AudioNode);
        connect(outputTo: AudioNode, source: AudioNode): void;
        private fade(curveType, volume, time, length?);
        start(startPosition?: number, clearExisting?: boolean): number;
        stop(startPosition?: number, clearExisting?: boolean): number;
    }
}
interface IMixerItem {
    volume: number;
}
interface ISoundControl {
}
declare module audiobus.instruments {
    class Instrument implements IMixerItem {
        context: AudioContext;
        gain: GainNode;
        isPlaying: boolean;
        hasInitialised: boolean;
        needsUpdate: boolean;
        private amplitude;
        envelope: audiobus.envelopes.Envelope;
        SILENCE: number;
        volume: number;
        constructor(audioContext: AudioContext, outputTo?: GainNode, source?: AudioNode);
        connect(outputTo: AudioNode, source?: AudioNode): void;
        start(...args: any[]): boolean;
        note(frequency: number): boolean;
        stop(): boolean;
    }
}
declare module audiobus.instruments.basics {
    class Oscillator extends Instrument implements ISoundControl {
        private oscillator;
        constructor(audioContext: AudioContext, outputTo: AudioNode, type?: string);
        private create(type);
        start(frequency?: number): boolean;
        stop(): boolean;
        note(frequency: number): boolean;
    }
}
declare module audiobus.instruments.basics {
    class CustomWave extends Instrument implements ISoundControl {
        private customShape;
        constructor(audioContext: AudioContext, outputTo: AudioNode);
        private makeDistortionCurve(amount?);
        private create();
        start(frequency?: number): boolean;
        note(frequency: number): boolean;
    }
}
declare module audiobus.instruments.basics {
    class DualOscillator extends Instrument implements ISoundControl {
        private oscillatorA;
        private oscillatorB;
        drift: number;
        constructor(audioContext: AudioContext, outputTo: AudioNode, type?: string);
        private create(type);
        start(frequency?: number): boolean;
        stop(): boolean;
        note(frequency: number): boolean;
    }
}
declare module audiobus.instruments.basics {
    class SawToothWave extends Oscillator implements ISoundControl {
        constructor(audioContext: AudioContext, outputTo: AudioNode);
    }
}
declare module audiobus.instruments.basics {
    class SineWave extends Oscillator implements ISoundControl {
        constructor(audioContext: AudioContext, outputTo: AudioNode);
    }
}
declare module audiobus.instruments.basics {
    class SquareWave extends Oscillator implements ISoundControl {
        constructor(audioContext: AudioContext, outputTo: AudioNode);
    }
}
declare module audiobus.instruments.basics {
    class TriangleWave extends Oscillator implements ISoundControl {
        constructor(audioContext: AudioContext, outputTo: AudioNode);
    }
}
declare module audiobus.instruments.beats {
    class Drum extends Instrument {
        constructor(audioContext: AudioContext);
    }
}
declare module audiobus.instruments.beats {
    class BassDrum extends Drum implements ISoundControl {
        private bass;
        constructor(audioContext: AudioContext, outputTo: AudioNode);
        start(startFrequency?: number, endFrequency?: number, length?: number): boolean;
    }
}
declare module audiobus.instruments.beats {
    class Conga extends Drum {
        private osc;
        constructor(audioContext: AudioContext, outputTo: AudioNode);
        start(f?: number, offsetA?: number): boolean;
    }
}
declare module audiobus.instruments.beats {
    class CowBell extends Drum {
        private oscB;
        private oscC;
        constructor(audioContext: AudioContext, outputTo: AudioNode);
        start(offsetA?: number, offsetB?: number, offsetC?: number): boolean;
    }
}
declare module audiobus.instruments.beats {
    class HiHat extends Drum {
        private osc5;
        private osc6;
        private osc7;
        private osc8;
        private osc9;
        private oscA;
        biQuadFilterA: BiquadFilterNode;
        biQuadFilterB: BiquadFilterNode;
        constructor(audioContext: AudioContext, outputTo: AudioNode);
        start(): boolean;
    }
}
declare module audiobus.instruments.beats {
    class Snare extends Drum {
        private noise;
        private noiseBuffer;
        private noiseData;
        constructor(audioContext: AudioContext, outputTo: AudioNode);
        start(l?: number, attack?: number, offsetB?: number, offsetC?: number): boolean;
    }
}
declare module audiobus.instruments.beats {
    class Tom extends Drum implements ISoundControl {
        private bass;
        constructor(audioContext: AudioContext, outputTo: AudioNode);
        start(startFrequency?: number, endFrequency?: number): boolean;
    }
}
declare module audiobus.instruments {
    class DrumSet extends Instrument {
        bassdrum: audiobus.instruments.beats.BassDrum;
        snare: audiobus.instruments.beats.Snare;
        hihat: audiobus.instruments.beats.HiHat;
        conga: audiobus.instruments.beats.Conga;
        cowbell: audiobus.instruments.beats.CowBell;
        tom: audiobus.instruments.beats.Tom;
        constructor(audioContext?: AudioContext, outputTo?: GainNode);
        private setup();
        trigger(id?: number): void;
    }
}
declare module audiobus.instruments {
    class DrumMachine extends DrumSet {
        bpm: number;
        tempo: number;
        constructor(audioContext?: AudioContext, outputTo?: GainNode);
    }
}
declare module audiobus.instruments {
    class OscillatorTypes {
        static SINE: string;
        static SQUARE: string;
        static SAWTOOTH: string;
        static TRIANGLE: string;
        static CUSTOM: string;
    }
}
declare module audiobus.instruments {
    class Synthesizer extends Instrument {
        noise: AudioBufferSourceNode;
        noiseBuffer: AudioBuffer;
        noiseData: Float32Array;
        naeg: GainNode;
        f1: BiquadFilterNode;
        f2: BiquadFilterNode;
        aeg1: GainNode;
        aeg2: GainNode;
        aeg3: GainNode;
        aeg4: GainNode;
        aeg5: GainNode;
        aeg6: GainNode;
        private osc1;
        private osc2;
        private osc3;
        private osc4;
        private osc5;
        private osc6;
        private osc7;
        private osc8;
        private osc9;
        private oscA;
        private oscB;
        private oscC;
        constructor(audioContext: AudioContext, outputTo: GainNode);
        private setup();
        bassdrum(l?: number, offsetA?: number, offsetB?: number, offsetC?: number): void;
        snare(): void;
        hihat(): void;
        conga(): void;
        cowbell(offsetA?: number, offsetB?: number, offsetC?: number): void;
        trigger(id?: number): void;
    }
}
declare module audiobus.instruments {
    class Theremin extends Instrument implements ISoundControl {
        private osc;
        private oscFilter;
        initialVolume: GainNode;
        oscVolume: GainNode;
        finalVolume: GainNode;
        scuzzVolume: GainNode;
        feedbackGain: GainNode;
        filter: BiquadFilterNode;
        delay: DelayNode;
        analyser: AnalyserNode;
        compressor: DynamicsCompressorNode;
        constructor(audioContext: AudioContext, outputTo: GainNode);
        private create();
        setFilterFrequency(b: number): number;
        start(frequency: number): boolean;
    }
}
declare module audiobus.io {
    class Midi {
        inputID: string;
        outputID: string;
        available: boolean;
        availableIn: boolean;
        availableOut: boolean;
        connectedInput: WebMidi.MIDIInput;
        connectedOutput: WebMidi.MIDIOutput;
        onmidiconnected: Function;
        onmididisconnected: Function;
        onmidimessage: Function;
        midiAccess: WebMidi.MIDIAccess;
        private messagePool;
        static PORT_TYPE_INPUT: string;
        static PORT_TYPE_OUTPUT: string;
        static PORT_DEVICE_STATE_CONNECTED: string;
        static PORT_DEVICE_STATE_DISCONNECTED: string;
        static PORT_CONNECTION_STATE_OPEN: string;
        static PORT_CONNECTION_STATE_CLOSED: string;
        static PORT_CONNECTION_STATE_PENDING: string;
        constructor();
        static frequencyFromNote(note: number): number;
        connect(requestedDevice?: string): boolean;
        private createMessage(data);
        private connectInput(deviceName);
        private onMIDISuccess(access);
        private getInput(name);
        private getInputs();
        private onStateChange(event);
        private onMIDIMessage(event);
        private onMIDIFailure(e);
        private getOutput(name);
        private getOutputs();
    }
    class MidiMessage {
        data: Uint8Array;
        cmd: number;
        channel: number;
        type: number;
        note: number;
        velocity: number;
        action: string;
        static ACTION_NOTE_ON: string;
        static ACTION_NOTE_OFF: string;
        static ACTION_AFTERTOUCH: string;
        static ACTION_CONTROL_CHANGE: string;
        static ACTION_PITCH_BEND: string;
        static ACTION_SYSTEM_MESSAGE: string;
        static ACTION_CHANNEL_PRESSURE: string;
        static ACTION_PATCH_CHANGE: string;
        static ACTIONS: Array<string>;
        constructor(eventData?: Uint8Array);
        toString(): string;
        private convertCommand(command);
        reset(eventData: Uint8Array): void;
    }
}
declare module audiobus.io.devices {
    class TB3 extends Midi {
        static PORT_TYPE_INPUT: string;
        constructor();
        connect(): boolean;
    }
}
declare module audiobus.io {
    class Microphone {
        context: AudioContext;
        gain: GainNode;
        constructor(audioContext: AudioContext, outputTo: GainNode);
        getMic(): void;
        private onMicAvailable(stream);
        private onMicUnAvailable(error);
    }
}
declare module audiobus.io {
    class MidiFile {
        id: string;
        onmidiconnected: Function;
        onmididisconnected: Function;
        onmidimessage: Function;
        constructor();
        private loadBase64(file, completeCallback);
        private loadFile(file, completeCallback);
        load(file: string, completeCallback: Function): void;
    }
}
declare module audiobus.io {
    class MidiStream {
        private position;
        private str;
        constructor(str: string);
        read(length: number): string;
        readInt32(): number;
        readInt16(): number;
        readInt8(signed: boolean): number;
        eof(): boolean;
        readVarInt(): number;
    }
}
interface IRackItem {
    connect(destination: IRackItem, output: number, input: number): IRackItem;
}
declare module audiobus {
    class Mixer {
        private channels;
        constructor();
        mute(): boolean;
        solo(): boolean;
        addToChannel(channel: any, item: any): void;
    }
    class Channel implements IMixerItem {
        name: string;
        private items;
        private amplitude;
        volume: number;
        constructor(initialVolume?: number);
        add(item: IMixerItem): void;
        remove(item: IMixerItem): void;
        mute(): boolean;
    }
}
declare module audiobus {
    class Rack {
        context: AudioContext;
        constructor(context: AudioContext);
    }
}
declare module audiobus {
    class Scales {
        constructor();
    }
}
declare module audiobus.timing {
    class Timer {
        now: Function;
        period: number;
        lastBarTimeStamp: number;
        playing: boolean;
        startTime: number;
        percentage: number;
        ontick: Function;
        onprogress: Function;
        constructor();
        start(rate?: number): void;
        stop(): void;
        onTimer(): void;
    }
}
declare module audiobus.timing {
    class Metronome extends Timer {
        constructor();
        private setBpm(beatsPerMinute);
        private getBpm();
        start(bpm?: number): void;
        stop(): void;
        onTimer(): void;
    }
}
declare module audiobus.timing {
    class Netronome extends Timer {
        static EPOCH: number;
        private setBpm(beatsPerMinute);
        private getBpm();
        constructor();
        start(bpm?: number): void;
        stop(): void;
        private determineStartTime();
        private incrementCuePoints(now?);
        onTimer(): void;
    }
}
declare module audiobus.timing {
    class Sequencer extends Timer {
        constructor();
    }
}
declare module audiobus.timing {
    class TimeUtilities {
        static NOW: Function;
        static now(): number;
    }
}
declare module audiobus.visualisation.colour {
    class Colour {
        red: number;
        green: number;
        blue: number;
        constructor(r: number, g: number, b: number);
    }
}
declare module audiobus.visualisation.colour {
    class Rainbows {
        static colour(frequency1?: number, frequency2?: number, frequency3?: number, phase1?: number, phase2?: number, phase3?: number, center?: number, width?: number, length?: number): Array<Colour>;
    }
}
declare module audiobus.visualisation {
    class SpectrumAnalyzer {
        now: Function;
        private audioContext;
        analyser: AnalyserNode;
        frequencyData: Uint8Array;
        private visualContext;
        canvas: HTMLCanvasElement;
        private running;
        private sampleRate;
        private type;
        head: audiobus.visualisation.visualisers.Visualiser;
        tail: audiobus.visualisation.visualisers.Visualiser;
        onanalysis: Function;
        static TYPE_FREQUENCY: string;
        static TYPE_TIME_DOMAIN: string;
        constructor(audioContext: AudioContext, type?: string, fftSize?: number);
        setFidelity(fftSize: number): void;
        connect(outputTo: AudioNode, source: AudioNode): void;
        createCanvas(width?: number, height?: number, id?: string): HTMLCanvasElement;
        setCanvas(canvas: HTMLCanvasElement): void;
        setSize(): void;
        append(slave: audiobus.visualisation.visualisers.Visualiser): void;
        prepend(slave: audiobus.visualisation.visualisers.Visualiser): void;
        start(): void;
        stop(): void;
        private update();
    }
}
interface IVisualiser {
    update(spectrum: Uint8Array, time: number, bufferLength: number): void;
}
declare module audiobus.visualisation.visualisers {
    class Visualiser implements IVisualiser {
        context: CanvasRenderingContext2D;
        canvas: HTMLCanvasElement;
        bitmapData: ImageData;
        name: string;
        width: number;
        height: number;
        centreX: number;
        centreY: number;
        next: Visualiser;
        previous: Visualiser;
        master: boolean;
        constructor(title: string);
        toString(): string;
        unlink(): Visualiser;
        createCanvas(width?: number, height?: number): void;
        setCanvas(canvas: HTMLCanvasElement): void;
        setAsMaster(): Visualiser;
        appendSlave(slave: Visualiser): Visualiser;
        prependSlave(slave: Visualiser): Visualiser;
        drawPixel(x: number, y: number, r: number, g: number, b: number, alpha: number): void;
        clearScreen(): void;
        update(spectrum: Uint8Array, time: number, bufferLength: number): void;
    }
}
declare module audiobus.visualisation.visualisers {
    class Bars extends Visualiser implements IVisualiser {
        opacity: number;
        red: number;
        green: number;
        blue: number;
        constructor();
        update(spectrum: Uint8Array, time: number, bufferLength: number): void;
    }
}
declare module audiobus.visualisation.visualisers {
    class Harmongraph extends Visualiser implements IVisualiser {
        xRatio: number;
        xPhase: number;
        yRatio: number;
        yPhase: number;
        zRatio: number;
        zPhase: number;
        amplitude: number;
        decay: number;
        opacity: number;
        red: number;
        green: number;
        blue: number;
        sectionLength: number;
        deg2rad: number;
        constructor();
        update(spectrum: Uint8Array, time: number, bufferLength: number): void;
    }
}
declare module audiobus.visualisation.visualisers {
    class Plasma extends Visualiser implements IVisualiser {
        private palette;
        private paletteReds;
        private paletteGreens;
        private paletteBlues;
        private sineTable;
        private pos1;
        private pos2;
        constructor();
        private createTable();
        update(spectrum: Uint8Array, time: number, bufferLength: number): void;
    }
}
declare module audiobus.visualisation.visualisers {
    class Scope extends Visualiser implements IVisualiser {
        opacity: number;
        red: number;
        green: number;
        blue: number;
        thickness: number;
        constructor();
        update(spectrum: Uint8Array, time: number, bufferLength: number): void;
    }
}
