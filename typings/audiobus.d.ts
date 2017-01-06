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
        readonly duration: number;
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
declare module audiobus.instruments {
    class Violin extends Instrument {
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
    }
}
declare module audiobus.io {
    class MidiHardware {
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
        private connectInput(deviceName);
        private onMIDISuccess(access);
        private getInput(name);
        private getInputs();
        private onStateChange(event);
        private onMIDIMessage(event);
        private onMIDIFailure(e);
        private getOutput(name);
        private getOutputs();
        send(command: MidiCommand): void;
    }
    class MidiCommandFactory {
        constructor();
        static convertChannelMessage(command: number): string;
        static create(eventData: Uint8Array): MidiCommand;
    }
}
declare module audiobus.io.devices {
    class KMix extends MidiHardware {
        static PORT_TYPE_INPUT: string;
        constructor();
        connect(): boolean;
    }
}
declare module audiobus.io.devices {
    class TB3 extends MidiHardware {
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
    class MidiCommand {
        static TYPE_CHANNEL: string;
        static TYPE_META: string;
        static TYPE_SYSTEM_EXCLUSIVE: string;
        static TYPE_DIVIDED_SYSTEM_EXCLUSIVE: string;
        static COMMAND_NOTE_OFF: string;
        static COMMAND_NOTE_ON: string;
        static COMMAND_NOTE_AFTER_TOUCH: string;
        static COMMAND_CONTROLLER: string;
        static COMMAND_PROGRAM_CHANGE: string;
        static COMMAND_CHANNEL_AFTER_TOUCH: string;
        static COMMAND_CHANNEL_PRESSURE: string;
        static COMMAND_PITCH_BEND: string;
        static COMMAND_SYSTEM_MESSAGE: string;
        static COMMANDS: Array<string>;
        raw: Uint8Array;
        deltaTime: number;
        frameRate: number;
        channel: number;
        type: string;
        subtype: string;
        text: string;
        data: string;
        hour: number;
        min: number;
        sec: number;
        frame: number;
        subframe: number;
        microsecondsPerBeat: number;
        key: number;
        scale: number;
        numerator: number;
        denominator: number;
        metronome: number;
        thirtyseconds: number;
        amount: number;
        noteNumber: number;
        velocity: number;
        value: number;
        controllerType: number;
        programNumber: number;
        sequenceNumber: number;
        toString(): string;
    }
}
declare module audiobus.io {
    class MidiHeader {
        formatType: number;
        trackCount: number;
        ticksPerBeat: number;
    }
    class MidiTrack {
        header: MidiHeader;
        tracks: Array<MidiCommand>;
        trackName: string;
        meta: string;
        copyrightNotice: string;
        lyrics: string;
        constructor(header?: MidiHeader);
        addEvent(index: number, event: MidiCommand): void;
    }
}
declare module audiobus.io {
    class MidiChunk {
        id: string;
        length: number;
        data: string;
    }
    class MidiDecoder {
        private lastEventTypeByte;
        constructor();
        private readChunk(stream);
        decode(stream: MidiStream): MidiTrack;
        private decodeHeader(stream);
        private decodeTracks(track, stream);
        readEvent(stream: MidiStream): MidiCommand;
        private decodeSystemEvent(stream, event, eventTypeByte);
        private decodeChannelEvent(stream, event, eventTypeByte);
    }
}
declare module audiobus.io {
    class MidiFile {
        track: MidiTrack;
        constructor();
        load(file: string, completeCallback: Function): void;
        private loadBase64(file, completeCallback);
        private convertResponse(data);
        private loadFile(file, completeCallback);
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
        readInt8(signed?: boolean): number;
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
        static frequencyFromNote(note: number): number;
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
        toRGB(): string;
        toRGBA(alpha: number): string;
        toString(): string;
    }
}
declare module audiobus.visualisation.colour {
    class Rainbows {
        static colour(frequency1?: number, frequency2?: number, frequency3?: number, phase1?: number, phase2?: number, phase3?: number, center?: number, width?: number, length?: number): Array<Colour>;
    }
}
declare module audiobus.visualisation {
    class ExampleVisualiser {
        private analyser;
        private harmongraph;
        private bars;
        private scope;
        private plasma;
        private visualisers;
        private activeVisualiser;
        private counter;
        private count;
        private rainbow;
        constructor(audioContext: AudioContext, source: GainNode, type?: string, fftSize?: number);
        start(): void;
        update(spectrum: Uint8Array): void;
        next(): void;
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
        connect(outputTo: AudioNode, source?: AudioNode): void;
        createCanvas(width?: number, height?: number, id?: string): HTMLCanvasElement;
        setCanvas(canvas: HTMLCanvasElement): void;
        checkCanvasExists(id: string): boolean;
        setSize(width?: number, height?: number): void;
        solo(slave: audiobus.visualisation.visualisers.Visualiser): void;
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
        rainbow: Array<audiobus.visualisation.colour.Colour>;
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
declare module examples {
    class Example {
        isCurrentlyTouching: boolean;
        isCurrentlyMousePressed: boolean;
        usingTouch: boolean;
        hasTouch: boolean;
        constructor();
        getScreenPercentageX(x: number): number;
        getScreenPercentageY(y: number): number;
        addMotionListeners(): boolean;
        addMouseListeners(): boolean;
        addTouchListeners(): boolean;
        onMouse(e: MouseEvent): void;
        onMouseDown(e: MouseEvent): void;
        onMouseUp(e: MouseEvent): void;
        onMouseMove(e: MouseEvent): void;
        onTouch(e: TouchEvent): void;
        onTouchStart(e: TouchEvent): void;
        onTouchMove(e: TouchEvent): void;
        onTouchEnd(e: TouchEvent): void;
        private onDeviceOrientation(event);
        onOrientation(event: DeviceOrientationEvent): void;
        private onDeviceMotion(event);
        onMotion(event: DeviceMotionEvent): void;
    }
}
declare module examples {
    class ExampleDrumKeyboard {
        private drums;
        private bass;
        private metronome;
        private netronome;
        private harmongraph;
        constructor();
        private onTouch(e);
        private onMouse(e);
        private onKeyDown(e);
        private onKeyUp(e);
    }
}
declare module examples {
    class ExampleFingerSynth extends Example {
        private bass1;
        private bass2;
        private bass3;
        private bass4;
        private bass;
        private visualiser;
        private lastX;
        private lastY;
        private lastZ;
        private lastMotionTime;
        private shakeThreshold;
        private shakeTimeOut;
        constructor();
        onTouch(e: TouchEvent): void;
        onMouse(e: MouseEvent): void;
        onShake(): void;
        onMotion(event: DeviceMotionEvent): void;
    }
}
declare module examples {
    class Main {
        private drums;
        private bass;
        private metronome;
        private netronome;
        private midiDevice;
        private midiFile;
        private harmongraph;
        constructor();
        private sendMIDI();
        private onMidiFile(midiTrack);
        private onMIDIMessage(e);
        private onPageScroll(e);
        private onDeviceOrientation(event);
        private onDeviceMotion(event);
        private onMouseWheel(e);
        private onMouse(e);
        private onKeyDown(e);
        private onKeyUp(e);
    }
}
