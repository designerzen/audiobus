export interface SampleDataEventMembers {
    position: number;
    data: ByteArray;
    clone(): any;
}
export type SampleDataEvent = SampleDataEventMembers;
export interface SampleDataEventConstructor {
    new (type: string, bubbles?: boolean, cancelable?: boolean, position?: number, data?: ByteArray | null): SampleDataEvent;
    readonly SAMPLE_DATA: string;
}
export declare const SampleDataEvent: SampleDataEventConstructor;
export interface SoundMembers {
    bytesLoaded: number;
    bytesTotal: number;
    url: string;
    pcm: any[];
    length: number;
    isBuffering: boolean;
    isURLInaccessible: boolean;
    id3: any;
    load(stream: any, context?: any): void;
    close(): void;
    play(startTime?: number, loops?: number, transform?: SoundTransform | null): SoundChannel;
    extract(target: ByteArray, length: number, startPosition?: number): number;
    provide(): any[];
    setPCM(channels: any[]): void;
    loadCompressedDataFromByteArray(bytes: ByteArray, length: number): void;
    loadPCMFromByteArray(bytes: ByteArray, samples: number, format?: string, stereo?: boolean, sampleRate?: number): void;
}
export type Sound = SoundMembers;
export interface SoundConstructor {
    new (stream?: any, context?: any): Sound;
}
export declare const Sound: SoundConstructor;
export interface SoundChannelMembers {
    stop(): void;
    position: number;
    leftPeak: number;
    rightPeak: number;
    soundTransform: SoundTransform;
}
export type SoundChannel = SoundChannelMembers;
export interface SoundChannelConstructor {
    new (sound: Sound, startTime?: number, loops?: number, transform?: SoundTransform | null): SoundChannel;
}
export declare const SoundChannel: SoundChannelConstructor;
export interface SoundTransformMembers {
    volume: number;
    pan: number;
    leftToLeft: number;
    leftToRight: number;
    rightToLeft: number;
    rightToRight: number;
    clone(): SoundTransform;
}
export type SoundTransform = SoundTransformMembers;
export interface SoundTransformConstructor {
    new (volume?: number, pan?: number): SoundTransform;
}
export declare const SoundTransform: SoundTransformConstructor;
export interface ByteArrayMembers {
    $__properties(object?: any): any;
    $__getArrayBuffer(): any;
    $__setArrayBuffer(arrayBuffer: any): void;
    bytesAvailable: number;
    endian: string;
    length: number;
    position: number;
    clear(): void;
    readBoolean(): boolean;
    readByte(): number;
    readBytes(writeTo: ByteArray, offset?: number, length?: number): void;
    readDouble(): number;
    readFloat(): number;
    readInt(): number;
    readMultiByte(length: number, charSet: string): string;
    readShort(): number;
    readUnsignedByte(): number;
    readUnsignedInt(): number;
    readUnsignedShort(): number;
    readUTF(): string;
    readUTFBytes(length: number): string;
    writeBoolean(value: boolean): void;
    writeByte(value: number): void;
    writeBytes(readFrom: ByteArray, offset?: number, length?: number): void;
    writeDouble(value: number): void;
    writeFloat(value: number): void;
    writeInt(value: number): void;
    writeMultiByte(string: string, charSet: string): void;
    writeShort(value: number): void;
    writeUnsignedInt(value: number): void;
    writeUTF(value: string): void;
    writeUTFBytes(value: string): void;
    objectEncoding: number;
    writeObject(object: any): void;
    readObject(): any;
    toString(): string;
    compress(algorithm?: string): void;
    deflate(): void;
    inflate(): void;
    uncompress(algorithm?: string): void;
}
export type ByteArray = ByteArrayMembers;
export interface ByteArrayConstructor {
    new (): ByteArray;
    defaultObjectEncoding: number;
}
export declare const ByteArray: ByteArrayConstructor;
export interface CompressionAlgorithmMembers {
}
export type CompressionAlgorithm = CompressionAlgorithmMembers;
export interface CompressionAlgorithmConstructor {
    new (): CompressionAlgorithm;
    readonly DEFLATE: string;
    readonly ZLIB: string;
    readonly LZMA: string;
}
export declare const CompressionAlgorithm: CompressionAlgorithmConstructor;
export interface MIDIPlayerMembers {
    volume: number;
}
export type MIDIPlayer = MIDIPlayerMembers;
export interface MIDIPlayerConstructor {
    new (): MIDIPlayer;
    position: number;
    tempo: number;
    cpuLoading: number;
    isPaused: boolean;
    isPlaying: boolean;
    driver: SiONDriver;
    play(url: string, fadeInTime?: number): SMFData;
    stop(fadeOutTime?: number): void;
    pause(fadeOutTime?: number): void;
    resume(fadeInTime?: number): void;
    load(url: string): SMFData;
}
export declare const MIDIPlayer: MIDIPlayerConstructor;
export interface EffectorInstancesMembers {
    _instances: any[];
    _classInstance: new (...args: any[]) => any;
}
export type EffectorInstances = EffectorInstancesMembers;
export interface EffectorInstancesConstructor {
    new (cls: new (...args: any[]) => any): EffectorInstances;
}
export declare const EffectorInstances: EffectorInstancesConstructor;
export interface FormantEventMembers {
    next: FormantEvent;
    ifreq1: number;
    igain1: number;
    ifreq2: number;
    igain2: number;
    outputLevel: number;
    time: number;
    insertTo(list: FormantEvent): FormantEvent;
    updateTime(prog: number): number;
}
export type FormantEvent = FormantEventMembers;
export interface FormantEventConstructor {
    new (time: number, outputLevel: number, ifreq1: number, igain1: number, ifreq2: number, igain2: number): FormantEvent;
}
export declare const FormantEvent: FormantEventConstructor;
export interface SiCompositeEffectorMembers {
    slot0: any[];
    slot1: any[];
    slot2: any[];
    slot3: any[];
    slot4: any[];
    slot5: any[];
    slot6: any[];
    slot7: any[];
    dry: number;
    masterVolume: number;
    setLevel(slotNum: number, inputLevel: number, outputLevel: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiCompositeEffector = Omit<SiEffectBase, keyof SiCompositeEffectorMembers> & SiCompositeEffectorMembers;
export interface SiCompositeEffectorConstructor {
    new (): SiCompositeEffector;
}
export declare const SiCompositeEffector: SiCompositeEffectorConstructor;
export interface SiCtrlFilterBaseMembers {
    cutoff: number;
    resonance: number;
    setParameters(cut?: number, res?: number, fps?: number): void;
    control(cutoff: number, resonance: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiCtrlFilterBase = Omit<SiEffectBase, keyof SiCtrlFilterBaseMembers> & SiCtrlFilterBaseMembers;
export interface SiCtrlFilterBaseConstructor {
    new (): SiCtrlFilterBase;
}
export declare const SiCtrlFilterBase: SiCtrlFilterBaseConstructor;
export interface SiCtrlFilterHighPassMembers {
}
export type SiCtrlFilterHighPass = Omit<SiCtrlFilterBase, keyof SiCtrlFilterHighPassMembers> & SiCtrlFilterHighPassMembers;
export interface SiCtrlFilterHighPassConstructor {
    new (cutoff?: number, resonance?: number): SiCtrlFilterHighPass;
}
export declare const SiCtrlFilterHighPass: SiCtrlFilterHighPassConstructor;
export interface SiCtrlFilterLowPassMembers {
}
export type SiCtrlFilterLowPass = Omit<SiCtrlFilterBase, keyof SiCtrlFilterLowPassMembers> & SiCtrlFilterLowPassMembers;
export interface SiCtrlFilterLowPassConstructor {
    new (cutoff?: number, resonance?: number): SiCtrlFilterLowPass;
}
export declare const SiCtrlFilterLowPass: SiCtrlFilterLowPassConstructor;
export interface SiEffectAutoPanMembers {
    setParameters(frequency?: number, width?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
    processLFOmono(buffer: (number)[], startIndex: number, length: number): void;
    processLFOstereo(buffer: (number)[], startIndex: number, length: number): void;
}
export type SiEffectAutoPan = Omit<SiEffectBase, keyof SiEffectAutoPanMembers> & SiEffectAutoPanMembers;
export interface SiEffectAutoPanConstructor {
    new (frequency?: number, width?: number): SiEffectAutoPan;
}
export declare const SiEffectAutoPan: SiEffectAutoPanConstructor;
export interface SiEffectBaseMembers {
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectBase = SiEffectBaseMembers;
export interface SiEffectBaseConstructor {
    new (): SiEffectBase;
}
export declare const SiEffectBase: SiEffectBaseConstructor;
export interface SiEffectCompressorMembers {
    setParameters(thres?: number, wndTime?: number, attTime?: number, relTime?: number, maxGain?: number, mixingLevel?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectCompressor = Omit<SiEffectBase, keyof SiEffectCompressorMembers> & SiEffectCompressorMembers;
export interface SiEffectCompressorConstructor {
    new (thres?: number, wndTime?: number, attTime?: number, relTime?: number, maxGain?: number, mixingLevel?: number): SiEffectCompressor;
}
export declare const SiEffectCompressor: SiEffectCompressorConstructor;
export interface SiEffectDistortionMembers {
    setParameters(preGain?: number, postGain?: number, lpfFreq?: number, lpfSlope?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectDistortion = Omit<SiEffectBase, keyof SiEffectDistortionMembers> & SiEffectDistortionMembers;
export interface SiEffectDistortionConstructor {
    new (preGain?: number, postGain?: number, lpfFreq?: number, lpfSlope?: number): SiEffectDistortion;
}
export declare const SiEffectDistortion: SiEffectDistortionConstructor;
export interface SiEffectDownSamplerMembers {
    setParameters(freqShift?: number, bitRate?: number, channelCount?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectDownSampler = Omit<SiEffectBase, keyof SiEffectDownSamplerMembers> & SiEffectDownSamplerMembers;
export interface SiEffectDownSamplerConstructor {
    new (freqShift?: number, bitRate?: number, channelCount?: number): SiEffectDownSampler;
}
export declare const SiEffectDownSampler: SiEffectDownSamplerConstructor;
export interface SiEffectEqualiserMembers {
    setParameters(lowGain?: number, midGain?: number, highGain?: number, lowFreq?: number, highFreq?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectEqualiser = Omit<SiEffectBase, keyof SiEffectEqualiserMembers> & SiEffectEqualiserMembers;
export interface SiEffectEqualiserConstructor {
    new (lowGain?: number, midGain?: number, highGain?: number, lowFreq?: number, highFreq?: number): SiEffectEqualiser;
}
export declare const SiEffectEqualiser: SiEffectEqualiserConstructor;
export interface SiEffectModuleMembers {
    globalEffectCount: number;
    slot0: any[];
    slot1: any[];
    slot2: any[];
    slot3: any[];
    slot4: any[];
    slot5: any[];
    slot6: any[];
    slot7: any[];
    initialize(): void;
    _reset(): void;
    _prepareProcess(): void;
    _beginProcess(): void;
    _endProcess(): void;
    clear(slot: number): void;
    getEffectorList(slot: number): (SiEffectBase)[];
    setEffectorList(slot: number, list: any[]): void;
    connect(slot: number, effector: SiEffectBase): void;
    parseMML(slot: number, mml: string, postfix: string): void;
    newLocalEffect(depth: number, list: (SiEffectBase)[]): SiEffectStream;
    deleteLocalEffect(inst: SiEffectStream): void;
}
export type SiEffectModule = SiEffectModuleMembers;
export interface SiEffectModuleConstructor {
    new (module: SiOPMModule): SiEffectModule;
    register(name: string, cls: new (...args: any[]) => any): void;
    getInstance(name: string): SiEffectBase;
}
export declare const SiEffectModule: SiEffectModuleConstructor;
export interface SiEffectSpeakerSimulatorMembers {
    setParameters(hardness?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectSpeakerSimulator = Omit<SiEffectBase, keyof SiEffectSpeakerSimulatorMembers> & SiEffectSpeakerSimulatorMembers;
export interface SiEffectSpeakerSimulatorConstructor {
    new (hardness?: number): SiEffectSpeakerSimulator;
}
export declare const SiEffectSpeakerSimulator: SiEffectSpeakerSimulatorConstructor;
export interface SiEffectStereoChorusMembers {
    setParameters(delayTime?: number, feedback?: number, frequency?: number, depth?: number, wet?: number, invertPhase?: boolean): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectStereoChorus = Omit<SiEffectBase, keyof SiEffectStereoChorusMembers> & SiEffectStereoChorusMembers;
export interface SiEffectStereoChorusConstructor {
    new (delayTime?: number, feedback?: number, frequency?: number, depth?: number, wet?: number, invertPhase?: boolean): SiEffectStereoChorus;
}
export declare const SiEffectStereoChorus: SiEffectStereoChorusConstructor;
export interface SiEffectStereoDelayMembers {
    setParameters(delayTime?: number, feedback?: number, isCross?: boolean, wet?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectStereoDelay = Omit<SiEffectBase, keyof SiEffectStereoDelayMembers> & SiEffectStereoDelayMembers;
export interface SiEffectStereoDelayConstructor {
    new (delayTime?: number, feedback?: number, isCross?: boolean, wet?: number): SiEffectStereoDelay;
}
export declare const SiEffectStereoDelay: SiEffectStereoDelayConstructor;
export interface SiEffectStereoExpanderMembers {
    setParameters(width?: number, rotation?: number, phaseInvert?: boolean): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectStereoExpander = Omit<SiEffectBase, keyof SiEffectStereoExpanderMembers> & SiEffectStereoExpanderMembers;
export interface SiEffectStereoExpanderConstructor {
    new (width?: number, rotation?: number, phaseInvert?: boolean): SiEffectStereoExpander;
}
export declare const SiEffectStereoExpander: SiEffectStereoExpanderConstructor;
export interface SiEffectStereoReverbMembers {
    setParameters(delay1?: number, delay2?: number, feedback?: number, wet?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectStereoReverb = Omit<SiEffectBase, keyof SiEffectStereoReverbMembers> & SiEffectStereoReverbMembers;
export interface SiEffectStereoReverbConstructor {
    new (delay1?: number, delay2?: number, feedback?: number, wet?: number): SiEffectStereoReverb;
}
export declare const SiEffectStereoReverb: SiEffectStereoReverbConstructor;
export interface SiEffectStreamMembers {
    chain: (SiEffectBase)[];
    stream: SiOPMStream;
    pan: number;
    setAllStreamSendLevels(param: (number)[]): void;
    setStreamSend(streamNum: number, volume: number): void;
    getStreamSend(streamNum: number): number;
    initialize(depth: number): void;
    reset(): void;
    free(): void;
    connectTo(output?: SiOPMStream | null): void;
    prepareProcess(): number;
    process(startIndex: number, length: number, writeInStream?: boolean): number;
    parseMML(slot: number, mml: string, postfix: string): void;
}
export type SiEffectStream = SiEffectStreamMembers;
export interface SiEffectStreamConstructor {
    new (module: SiOPMModule, stream?: SiOPMStream | null): SiEffectStream;
}
export declare const SiEffectStream: SiEffectStreamConstructor;
export interface SiEffectTableMembers {
    sinTable: (number)[];
}
export type SiEffectTable = SiEffectTableMembers;
export interface SiEffectTableConstructor {
    new (): SiEffectTable;
    instance: SiEffectTable;
}
export declare const SiEffectTable: SiEffectTableConstructor;
export interface SiEffectWaveShaperMembers {
    setParameters(distortion?: number, outputLevel?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiEffectWaveShaper = Omit<SiEffectBase, keyof SiEffectWaveShaperMembers> & SiEffectWaveShaperMembers;
export interface SiEffectWaveShaperConstructor {
    new (distortion?: number, outputLevel?: number): SiEffectWaveShaper;
}
export declare const SiEffectWaveShaper: SiEffectWaveShaperConstructor;
export interface SiFilterAllPassMembers {
    setParameters(freq?: number, band?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterAllPass = Omit<SiFilterBase, keyof SiFilterAllPassMembers> & SiFilterAllPassMembers;
export interface SiFilterAllPassConstructor {
    new (freq?: number, band?: number): SiFilterAllPass;
}
export declare const SiFilterAllPass: SiFilterAllPassConstructor;
export interface SiFilterBandPassMembers {
    setParameters(freq?: number, band?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterBandPass = Omit<SiFilterBase, keyof SiFilterBandPassMembers> & SiFilterBandPassMembers;
export interface SiFilterBandPassConstructor {
    new (freq?: number, band?: number): SiFilterBandPass;
}
export declare const SiFilterBandPass: SiFilterBandPassConstructor;
export interface SiFilterBaseMembers {
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiFilterBase = Omit<SiEffectBase, keyof SiFilterBaseMembers> & SiFilterBaseMembers;
export interface SiFilterBaseConstructor {
    new (): SiFilterBase;
}
export declare const SiFilterBase: SiFilterBaseConstructor;
export interface SiFilterHighBoostMembers {
    setParameters(freq?: number, slope?: number, gain?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterHighBoost = Omit<SiFilterBase, keyof SiFilterHighBoostMembers> & SiFilterHighBoostMembers;
export interface SiFilterHighBoostConstructor {
    new (freq?: number, slope?: number, gain?: number): SiFilterHighBoost;
}
export declare const SiFilterHighBoost: SiFilterHighBoostConstructor;
export interface SiFilterHighPassMembers {
    setParameters(freq?: number, band?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterHighPass = Omit<SiFilterBase, keyof SiFilterHighPassMembers> & SiFilterHighPassMembers;
export interface SiFilterHighPassConstructor {
    new (freq?: number, band?: number): SiFilterHighPass;
}
export declare const SiFilterHighPass: SiFilterHighPassConstructor;
export interface SiFilterLowBoostMembers {
    setParameters(freq?: number, slope?: number, gain?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterLowBoost = Omit<SiFilterBase, keyof SiFilterLowBoostMembers> & SiFilterLowBoostMembers;
export interface SiFilterLowBoostConstructor {
    new (freq?: number, slope?: number, gain?: number): SiFilterLowBoost;
}
export declare const SiFilterLowBoost: SiFilterLowBoostConstructor;
export interface SiFilterLowPassMembers {
    setParameters(freq?: number, band?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterLowPass = Omit<SiFilterBase, keyof SiFilterLowPassMembers> & SiFilterLowPassMembers;
export interface SiFilterLowPassConstructor {
    new (freq?: number, band?: number): SiFilterLowPass;
}
export declare const SiFilterLowPass: SiFilterLowPassConstructor;
export interface SiFilterNotchMembers {
    setParameters(freq?: number, band?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterNotch = Omit<SiFilterBase, keyof SiFilterNotchMembers> & SiFilterNotchMembers;
export interface SiFilterNotchConstructor {
    new (freq?: number, band?: number): SiFilterNotch;
}
export declare const SiFilterNotch: SiFilterNotchConstructor;
export interface SiFilterPeakMembers {
    setParameters(freq?: number, band?: number, gain?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
}
export type SiFilterPeak = Omit<SiFilterBase, keyof SiFilterPeakMembers> & SiFilterPeakMembers;
export interface SiFilterPeakConstructor {
    new (freq?: number, band?: number, gain?: number): SiFilterPeak;
}
export declare const SiFilterPeak: SiFilterPeakConstructor;
export interface SiFilterVowelMembers {
    formant: (SiFilterVowelFormant)[];
    outputLevel: number;
    setVowellFormant(outputLevel: number, formFreq1: number, gain1: number, formFreq2: number, gain2: number, delay?: number): void;
    setFilterBand(formFreq1?: number, gain1?: number, bandwidth1?: number, formFreq2?: number, gain2?: number, bandwidth2?: number, formFreq3?: number, gain3?: number, bandwidth3?: number, formFreq4?: number, gain4?: number, bandwidth4?: number, formFreq5?: number, gain5?: number, bandwidth5?: number, formFreq6?: number, gain6?: number, bandwidth6?: number): void;
    initialize(): void;
    mmlCallback(args: (number)[]): void;
    prepareProcess(): number;
    process(channels: number, buffer: (number)[], startIndex: number, length: number): number;
}
export type SiFilterVowel = Omit<SiEffectBase, keyof SiFilterVowelMembers> & SiFilterVowelMembers;
export interface SiFilterVowelConstructor {
    new (): SiFilterVowel;
    readonly FORMANT_COUNT: number;
}
export declare const SiFilterVowel: SiFilterVowelConstructor;
export interface SiFilterVowelFormantMembers {
    ab1: number;
    a2: number;
    b0: number;
    b2: number;
    clear(): void;
    update(ifreq: number, iband: number, gain: number): void;
}
export type SiFilterVowelFormant = SiFilterVowelFormantMembers;
export interface SiFilterVowelFormantConstructor {
    new (): SiFilterVowelFormant;
    initialize(): void;
    calcFreqIndex(frequency: number): number;
}
export declare const SiFilterVowelFormant: SiFilterVowelFormantConstructor;
export interface SiONEventMembers {
    driver: SiONDriver;
    data: SiONData;
    streamBuffer: ByteArray;
    clone(): any;
}
export type SiONEvent = SiONEventMembers;
export interface SiONEventConstructor {
    new (type: string, driver: SiONDriver, streamBuffer?: ByteArray | null, cancelable?: boolean): SiONEvent;
    readonly QUEUE_PROGRESS: string;
    readonly QUEUE_COMPLETE: string;
    readonly QUEUE_CANCEL: string;
    readonly STREAM: string;
    readonly STREAM_START: string;
    readonly STREAM_STOP: string;
    readonly FINISH_SEQUENCE: string;
    readonly FADE_PROGRESS: string;
    readonly FADE_IN_COMPLETE: string;
    readonly FADE_OUT_COMPLETE: string;
}
export declare const SiONEvent: SiONEventConstructor;
export interface SiONMIDIEventMembers {
    controllerNumber: number;
    value: number;
    midiModule: MIDIModule;
    midiChannel: MIDIModuleChannel;
    midiChannelNumber: number;
    clone(): any;
}
export type SiONMIDIEvent = Omit<SiONTrackEvent, keyof SiONMIDIEventMembers> & SiONMIDIEventMembers;
export interface SiONMIDIEventConstructor {
    new (type: string, driver: SiONDriver, track: SiMMLTrack, channelNumber: number, bufferIndex: number, note: number, value: number): SiONMIDIEvent;
    readonly NOTE_ON: string;
    readonly NOTE_OFF: string;
    readonly CONTROL_CHANGE: string;
    readonly PROGRAM_CHANGE: string;
    readonly PITCH_BEND: string;
}
export declare const SiONMIDIEvent: SiONMIDIEventConstructor;
export interface SiONTrackEventMembers {
    track: SiMMLTrack;
    eventTriggerID: number;
    note: number;
    bufferIndex: number;
    frameTriggerDelay: number;
    clone(): any;
    _decrementTimer(frameRate: number): boolean;
}
export type SiONTrackEvent = Omit<SiONEvent, keyof SiONTrackEventMembers> & SiONTrackEventMembers;
export interface SiONTrackEventConstructor {
    new (type: string, driver: SiONDriver, track: SiMMLTrack, bufferIndex?: number, note?: number, id?: number): SiONTrackEvent;
    readonly NOTE_ON_STREAM: string;
    readonly NOTE_OFF_STREAM: string;
    readonly NOTE_ON_FRAME: string;
    readonly NOTE_OFF_FRAME: string;
    readonly BEAT: string;
    readonly CHANGE_BPM: string;
    readonly USER_DEFINED: string;
}
export declare const SiONTrackEvent: SiONTrackEventConstructor;
export interface MIDIModuleMembers {
    voiceSet: (SiONVoice)[];
    drumVoiceSet: (SiONVoice)[];
    midiChannels: (MIDIModuleChannel)[];
    onNRPN: (...args: any[]) => any;
    onSysEx: (...args: any[]) => any;
    onFinishSequence: (...args: any[]) => any;
    polyphony: number;
    midiChannelCount: number;
    freeOperatorCount: number;
    activeOperatorCount: number;
    portNumber: number;
    systemExclusiveMode: string;
    setDrumSamplerTable(table: SiOPMWaveSamplerTable): void;
    setDrumExclusiveGroup(groupID: number, voiceNumbers: any[]): void;
    setDefaultEffector(slot: number, effectorList: any[]): void;
    enableDrumNoteOff(voiceNumbers: any[], enable?: boolean): void;
    resetAllChannels(): void;
    resetVoiceSet(): void;
    noteOn(channelNum: number, note: number, velocity?: number): void;
    noteOff(channelNum: number, note: number, velocity?: number): void;
    programChange(channelNum: number, programNumber: number): void;
    channelAfterTouch(channelNum: number, value: number): void;
    pitchBend(channelNum: number, bend: number): void;
    controlChange(channelNum: number, controlerNumber: number, data: number): void;
    systemExclusive(channelNum: number, bytes: ByteArray): void;
}
export type MIDIModule = MIDIModuleMembers;
export interface MIDIModuleConstructor {
    new (polyphony?: number, midiChannelCount?: number, systemExclusiveMode?: string): MIDIModule;
    readonly GM_MODE: string;
    readonly GS_MODE: string;
    readonly XG_MODE: string;
    checkByteArray(bytes: ByteArray, checkPattern: any[], position?: number): boolean;
}
export declare const MIDIModule: MIDIModuleConstructor;
export interface MIDIModuleChannelMembers {
    activeOperatorCount: number;
    maxOperatorCount: number;
    drumMode: number;
    mute: boolean;
    programNumber: number;
    pan: number;
    modulation: number;
    pitchBend: number;
    channelAfterTouch: number;
    sustainPedal: boolean;
    portamento: boolean;
    portamentoTime: number;
    masterFineTune: number;
    masterCoarseTune: number;
    pitchBendSensitivity: number;
    modulationCycleTime: number;
    eventTriggerID: number;
    eventTriggerTypeOn: number;
    eventTriggerTypeOff: number;
    sionMIDIEventType: number;
    bankNumber: number;
    masterVolume: number;
    expression: number;
    reset(): void;
    getEffectSendLevel(slotNumber: number): number;
    setEffectSendLevel(slotNumber: number, level: number): void;
    setEventTrigger(id: number, noteOnType?: number, noteOffType?: number): void;
}
export type MIDIModuleChannel = MIDIModuleChannelMembers;
export interface MIDIModuleChannelConstructor {
    new (): MIDIModuleChannel;
}
export declare const MIDIModuleChannel: MIDIModuleChannelConstructor;
export interface MIDIModuleOperatorMembers {
}
export type MIDIModuleOperator = MIDIModuleOperatorMembers;
export interface MIDIModuleOperatorConstructor {
    new (sionTrack: SiMMLTrack): MIDIModuleOperator;
}
export declare const MIDIModuleOperator: MIDIModuleOperatorConstructor;
export interface SiONDataConverterSMFMembers {
    useMIDIModuleEffector: boolean;
    smfData: SMFData;
    midiModule: MIDIModule;
}
export type SiONDataConverterSMF = Omit<SiONData, keyof SiONDataConverterSMFMembers> & SiONDataConverterSMFMembers;
export interface SiONDataConverterSMFConstructor {
    new (smfData?: SMFData | null, midiModule?: MIDIModule | null): SiONDataConverterSMF;
}
export declare const SiONDataConverterSMF: SiONDataConverterSMFConstructor;
export interface SiONMIDIEventFlagMembers {
}
export type SiONMIDIEventFlag = SiONMIDIEventFlagMembers;
export interface SiONMIDIEventFlagConstructor {
    new (): SiONMIDIEventFlag;
    readonly NOTE_ON: number;
    readonly NOTE_OFF: number;
    readonly CONTROL_CHANGE: number;
    readonly PROGRAM_CHANGE: number;
    readonly PITCH_BEND: number;
    readonly ALL: number;
}
export declare const SiONMIDIEventFlag: SiONMIDIEventFlagConstructor;
export interface SMFDataMembers {
    format: number;
    numTracks: number;
    resolution: number;
    bpm: number;
    text: string;
    title: string;
    author: string;
    signature_n: number;
    signature_d: number;
    measures: number;
    tracks: (SMFTrack)[];
    isAvailable: boolean;
    toString(): string;
    clear(): SMFData;
    load(url: any): void;
    loadBytes(bytes: ByteArray): SMFData;
}
export type SMFData = SMFDataMembers;
export interface SMFDataConstructor {
    new (): SMFData;
}
export declare const SMFData: SMFDataConstructor;
export interface SMFEventMembers {
    type: number;
    value: number;
    byteArray: ByteArray;
    deltaTime: number;
    time: number;
    channel: number;
    note: number;
    velocity: number;
    text: string;
    toString(): string;
}
export type SMFEvent = SMFEventMembers;
export interface SMFEventConstructor {
    new (type: number, value: number, deltaTime: number, time: number): SMFEvent;
    readonly NOTE_OFF: number;
    readonly NOTE_ON: number;
    readonly KEY_PRESSURE: number;
    readonly CONTROL_CHANGE: number;
    readonly PROGRAM_CHANGE: number;
    readonly CHANNEL_PRESSURE: number;
    readonly PITCH_BEND: number;
    readonly SYSTEM_EXCLUSIVE: number;
    readonly SYSTEM_EXCLUSIVE_SHORT: number;
    readonly META: number;
    readonly META_SEQNUM: number;
    readonly META_TEXT: number;
    readonly META_AUTHOR: number;
    readonly META_TITLE: number;
    readonly META_INSTRUMENT: number;
    readonly META_LYLICS: number;
    readonly META_MARKER: number;
    readonly META_CUE: number;
    readonly META_PROGRAM_NAME: number;
    readonly META_DEVICE_NAME: number;
    readonly META_CHANNEL: number;
    readonly META_PORT: number;
    readonly META_TRACK_END: number;
    readonly META_TEMPO: number;
    readonly META_SMPTE_OFFSET: number;
    readonly META_TIME_SIGNATURE: number;
    readonly META_KEY_SIGNATURE: number;
    readonly META_SEQUENCER_SPEC: number;
    readonly CC_BANK_SELECT_MSB: number;
    readonly CC_BANK_SELECT_LSB: number;
    readonly CC_MODULATION: number;
    readonly CC_PORTAMENTO_TIME: number;
    readonly CC_DATA_ENTRY_MSB: number;
    readonly CC_DATA_ENTRY_LSB: number;
    readonly CC_VOLUME: number;
    readonly CC_BALANCE: number;
    readonly CC_PANPOD: number;
    readonly CC_EXPRESSION: number;
    readonly CC_SUSTAIN_PEDAL: number;
    readonly CC_PORTAMENTO: number;
    readonly CC_SOSTENUTO_PEDAL: number;
    readonly CC_SOFT_PEDAL: number;
    readonly CC_RESONANCE: number;
    readonly CC_RELEASE_TIME: number;
    readonly CC_ATTACK_TIME: number;
    readonly CC_CUTOFF_FREQ: number;
    readonly CC_DECAY_TIME: number;
    readonly CC_PROTAMENTO_CONTROL: number;
    readonly CC_REVERB_SEND: number;
    readonly CC_CHORUS_SEND: number;
    readonly CC_DELAY_SEND: number;
    readonly CC_NRPN_LSB: number;
    readonly CC_NRPN_MSB: number;
    readonly CC_RPN_LSB: number;
    readonly CC_RPN_MSB: number;
    readonly RPN_PITCHBEND_SENCE: number;
    readonly RPN_FINE_TUNE: number;
    readonly RPN_COARSE_TUNE: number;
}
export declare const SMFEvent: SMFEventConstructor;
export interface SMFExecutorMembers {
}
export type SMFExecutor = SMFExecutorMembers;
export interface SMFExecutorConstructor {
    new (): SMFExecutor;
}
export declare const SMFExecutor: SMFExecutorConstructor;
export interface SMFTrackMembers {
    sequence: (SMFEvent)[];
    totalTime: number;
    trackIndex: number;
    toString(): string;
}
export type SMFTrack = SMFTrackMembers;
export interface SMFTrackConstructor {
    new (smfData: SMFData, index: number, bytes: ByteArray): SMFTrack;
}
export declare const SMFTrack: SMFTrackConstructor;
export interface SiOPMChannelBaseMembers {
    setSiOPMChannelParam(param: SiOPMChannelParam, withVolume: boolean, withModulation?: boolean): void;
    getSiOPMChannelParam(param: SiOPMChannelParam): void;
    setWaveData(waveData: SiOPMWaveBase): void;
    setChannelNumber(channelNum: number): void;
    setAlgorism(cnt: number, alg: number): void;
    setFeedBack(fb: number, fbc: number): void;
    setParameters(param: (number)[]): void;
    setType(pgType: number, ptType: number): void;
    setAllAttackRate(ar: number): void;
    setAllReleaseRate(rr: number): void;
    masterVolume: number;
    pan: number;
    mute: boolean;
    activeOperatorIndex: number;
    rr: number;
    tl: number;
    fmul: number;
    phase: number;
    detune: number;
    fixedPitch: number;
    ssgec: number;
    erst: boolean;
    pitch: number;
    bufferIndex: number;
    isNoteOn: boolean;
    isIdling: boolean;
    isFilterActive: boolean;
    filterType: number;
    setAllStreamSendLevels(param: (number)[]): void;
    setStreamBuffer(streamNum: number, stream?: SiOPMStream | null): void;
    setStreamSend(streamNum: number, volume: number): void;
    getStreamSend(streamNum: number): number;
    offsetVolume(expression: number, velocity: number): void;
    setFrequencyRatio(ratio: number): void;
    initializeLFO(waveform: number, customWaveTable?: (number)[] | null): void;
    setLFOCycleTime(ms: number): void;
    setAmplitudeModulation(depth: number): void;
    setPitchModulation(depth: number): void;
    activateFilter(b: boolean): void;
    setSVFilter(cutoff?: number, resonance?: number, ar?: number, dr1?: number, dr2?: number, rr?: number, dc1?: number, dc2?: number, sc?: number, rc?: number): void;
    offsetFilter(i: number): void;
    setInput(level: number, pipeIndex: number): void;
    setRingModulation(level: number, pipeIndex: number): void;
    setOutput(outputMode: number, pipeIndex: number): void;
    setVolumeTables(vtable: (number)[], xtable: (number)[]): void;
    initialize(prev: SiOPMChannelBase, bufferIndex: number): void;
    reset(): void;
    noteOn(): void;
    noteOff(): void;
    setRegister(addr: number, data: number): void;
    resetChannelBufferStatus(): void;
    buffer(len: number): void;
    nop(len: number): void;
    channelType: number;
}
export type SiOPMChannelBase = SiOPMChannelBaseMembers;
export interface SiOPMChannelBaseConstructor {
    new (chip: SiOPMModule): SiOPMChannelBase;
    readonly OUTPUT_STANDARD: number;
    readonly OUTPUT_OVERWRITE: number;
    readonly OUTPUT_ADD: number;
    readonly INPUT_ZERO: number;
    readonly INPUT_PIPE: number;
    readonly INPUT_FEEDBACK: number;
    readonly FILTER_LP: number;
    readonly FILTER_BP: number;
    readonly FILTER_HP: number;
}
export declare const SiOPMChannelBase: SiOPMChannelBaseConstructor;
export interface SiOPMChannelFMMembers {
    operator: (SiOPMOperator)[];
    activeOperator: SiOPMOperator;
    registerMapType: number;
    registerMapChannel: number;
    toString(): string;
    setFrequencyRatio(ratio: number): void;
    initializeLFO(waveform: number, customWaveTable?: (number)[] | null): void;
    setAmplitudeModulation(depth: number): void;
    setPitchModulation(depth: number): void;
    setSiOPMChannelParam(param: SiOPMChannelParam, withVolume: boolean, withModulation?: boolean): void;
    getSiOPMChannelParam(param: SiOPMChannelParam): void;
    setSiOPMParameters(ar: number, dr: number, sr: number, rr: number, sl: number, tl: number, ksr: number, ksl: number, mul: number, dt1: number, detune: number, ams: number, phase: number, fixNote: number): void;
    setWaveData(waveData: SiOPMWaveBase): void;
    setChannelNumber(channelNum: number): void;
    setRegister(addr: number, data: number): void;
    setAlgorism(cnt: number, alg: number): void;
    setFeedBack(fb: number, fbc: number): void;
    setParameters(param: (number)[]): void;
    setType(pgType: number, ptType: number): void;
    setAllAttackRate(ar: number): void;
    setAllReleaseRate(rr: number): void;
    pitch: number;
    activeOperatorIndex: number;
    rr: number;
    tl: number;
    fmul: number;
    phase: number;
    detune: number;
    fixedPitch: number;
    ssgec: number;
    erst: boolean;
    offsetVolume(expression: number, velocity: number): void;
    initialize(prev: SiOPMChannelBase, bufferIndex: number): void;
    reset(): void;
    noteOn(): void;
    noteOff(): void;
    resetChannelBufferStatus(): void;
}
export type SiOPMChannelFM = Omit<SiOPMChannelBase, keyof SiOPMChannelFMMembers> & SiOPMChannelFMMembers;
export interface SiOPMChannelFMConstructor {
    new (chip: SiOPMModule): SiOPMChannelFM;
    idlingThreshold: number;
}
export declare const SiOPMChannelFM: SiOPMChannelFMConstructor;
export interface SiOPMChannelKSMembers {
    toString(): string;
    setKarplusStrongParam(ar?: number, dr?: number, tl?: number, fixedPitch?: number, ws?: number, tension?: number): void;
    setParameters(param: (number)[]): void;
    setType(pgType: number, ptType: number): void;
    setAllAttackRate(ar: number): void;
    setAllReleaseRate(rr: number): void;
    pitch: number;
    rr: number;
    fixedPitch: number;
    offsetVolume(expression: number, velocity: number): void;
    initialize(prev: SiOPMChannelBase, bufferIndex: number): void;
    reset(): void;
    noteOn(): void;
    noteOff(): void;
    resetChannelBufferStatus(): void;
    buffer(len: number): void;
}
export type SiOPMChannelKS = Omit<SiOPMChannelFM, keyof SiOPMChannelKSMembers> & SiOPMChannelKSMembers;
export interface SiOPMChannelKSConstructor {
    new (chip: SiOPMModule): SiOPMChannelKS;
}
export declare const SiOPMChannelKS: SiOPMChannelKSConstructor;
export interface SiOPMChannelManagerMembers {
    length: number;
    _newChannel(prev: SiOPMChannelBase, bufferIndex: number): SiOPMChannelBase;
    _deleteChannel(ch: SiOPMChannelBase): void;
    _initializeAll(): void;
    _resetAll(): void;
}
export type SiOPMChannelManager = SiOPMChannelManagerMembers;
export interface SiOPMChannelManagerConstructor {
    new (channelClass: new (...args: any[]) => any, channelType: number): SiOPMChannelManager;
    readonly CT_CHANNEL_FM: number;
    readonly CT_CHANNEL_PCM: number;
    readonly CT_CHANNEL_SAMPLER: number;
    readonly CT_CHANNEL_KS: number;
    readonly CT_MAX: number;
    initialize(chip: SiOPMModule): void;
    initializeAllChannels(): void;
    resetAllChannels(): void;
    newChannel(type: number, prev: SiOPMChannelBase, bufferIndex: number): SiOPMChannelBase;
    deleteChannel(channel: SiOPMChannelBase): void;
}
export declare const SiOPMChannelManager: SiOPMChannelManagerConstructor;
export interface SiOPMChannelPCMMembers {
    operator: SiOPMOperator;
    registerMapType: number;
    registerMapChannel: number;
    toString(): string;
    setFrequencyRatio(ratio: number): void;
    initializeLFO(waveform: number, customWaveTable?: (number)[] | null): void;
    setAmplitudeModulation(depth: number): void;
    setPitchModulation(depth: number): void;
    setSiOPMChannelParam(param: SiOPMChannelParam, withVolume: boolean, withModulation?: boolean): void;
    getSiOPMChannelParam(param: SiOPMChannelParam): void;
    setSiOPMParameters(ar: number, dr: number, sr: number, rr: number, sl: number, tl: number, ksr: number, ksl: number, mul: number, dt1: number, detune: number, ams: number, phase: number, fixNote: number): void;
    setWaveData(waveData: SiOPMWaveBase): void;
    setChannelNumber(channelNum: number): void;
    setRegister(addr: number, data: number): void;
    setAlgorism(cnt: number, alg: number): void;
    setFeedBack(fb: number, fbc: number): void;
    setParameters(param: (number)[]): void;
    setType(pgType: number, ptType: number): void;
    setAllAttackRate(ar: number): void;
    setAllReleaseRate(rr: number): void;
    pitch: number;
    activeOperatorIndex: number;
    rr: number;
    tl: number;
    fmul: number;
    phase: number;
    detune: number;
    fixedPitch: number;
    ssgec: number;
    erst: boolean;
    offsetVolume(expression: number, velocity: number): void;
    initialize(prev: SiOPMChannelBase, bufferIndex: number): void;
    reset(): void;
    noteOn(): void;
    noteOff(): void;
    resetChannelBufferStatus(): void;
    buffer(len: number): void;
}
export type SiOPMChannelPCM = Omit<SiOPMChannelBase, keyof SiOPMChannelPCMMembers> & SiOPMChannelPCMMembers;
export interface SiOPMChannelPCMConstructor {
    new (chip: SiOPMModule): SiOPMChannelPCM;
    idlingThreshold: number;
}
export declare const SiOPMChannelPCM: SiOPMChannelPCMConstructor;
export interface SiOPMChannelSamplerMembers {
    toString(): string;
    setSiOPMChannelParam(param: SiOPMChannelParam, withVolume: boolean, withModulation?: boolean): void;
    getSiOPMChannelParam(param: SiOPMChannelParam): void;
    setAlgorism(cnt: number, alg: number): void;
    setType(pgType: number, ptType: number): void;
    pitch: number;
    setWaveData(waveData: SiOPMWaveBase): void;
    offsetVolume(expression: number, velocity: number): void;
    phase: number;
    initialize(prev: SiOPMChannelBase, bufferIndex: number): void;
    reset(): void;
    noteOn(): void;
    noteOff(): void;
    buffer(len: number): void;
    nop(len: number): void;
}
export type SiOPMChannelSampler = Omit<SiOPMChannelBase, keyof SiOPMChannelSamplerMembers> & SiOPMChannelSamplerMembers;
export interface SiOPMChannelSamplerConstructor {
    new (chip: SiOPMModule): SiOPMChannelSampler;
}
export declare const SiOPMChannelSampler: SiOPMChannelSamplerConstructor;
export interface SiOPMOperatorMembers {
    ar: number;
    dr: number;
    sr: number;
    rr: number;
    sl: number;
    tl: number;
    ks: number;
    mul: number;
    dt1: number;
    dt2: number;
    ame: boolean;
    ams: number;
    ksl: number;
    ssgec: number;
    mute: boolean;
    erst: boolean;
    kc: number;
    kf: number;
    fnum: number;
    pitchFixed: boolean;
    fixedPitchIndex: number;
    pitchIndex: number;
    detune: number;
    detune2: number;
    fmul: number;
    keyOnPhase: number;
    pgType: number;
    ptType: number;
    modLevel: number;
    toString(): string;
    initialize(): void;
    reset(): void;
    setSiOPMOperatorParam(param: SiOPMOperatorParam): void;
    getSiOPMOperatorParam(param: SiOPMOperatorParam): void;
    setWaveTable(waveTable: SiOPMWaveTable): void;
    setPCMData(pcmData: SiOPMWavePCMData): void;
    noteOn(): void;
    noteOff(): void;
}
export type SiOPMOperator = SiOPMOperatorMembers;
export interface SiOPMOperatorConstructor {
    new (chip: SiOPMModule): SiOPMOperator;
    readonly EG_ATTACK: number;
    readonly EG_DECAY: number;
    readonly EG_SUSTAIN: number;
    readonly EG_RELEASE: number;
    readonly EG_OFF: number;
}
export declare const SiOPMOperator: SiOPMOperatorConstructor;
export interface ISiOPMWaveInterfaceMembers {
    setPCMWave(index: number, data: any, samplingNote?: number, keyRangeFrom?: number, keyRangeTo?: number, srcChannelCount?: number, channelCount?: number): SiOPMWavePCMData;
    setSamplerWave(index: number, data: any, ignoreNoteOff?: boolean, pan?: number, srcChannelCount?: number, channelCount?: number): SiOPMWaveSamplerData;
}
export type ISiOPMWaveInterface = ISiOPMWaveInterfaceMembers;
export interface SiOPMChannelParamMembers {
    operatorParam: (SiOPMOperatorParam)[];
    opeCount: number;
    alg: number;
    fb: number;
    fbc: number;
    fratio: number;
    lfoWaveShape: number;
    lfoFreqStep: number;
    amd: number;
    pmd: number;
    volumes: (number)[];
    pan: number;
    filterType: number;
    cutoff: number;
    resonance: number;
    far: number;
    fdr1: number;
    fdr2: number;
    frr: number;
    fdc1: number;
    fdc2: number;
    fsc: number;
    frc: number;
    initSequence: MMLSequence;
    lfoFrame: number;
    initialize(): SiOPMChannelParam;
    copyFrom(org: SiOPMChannelParam): SiOPMChannelParam;
    toString(): string;
    setByOPMRegister(channel: number, addr: number, data: number): SiOPMChannelParam;
    setByOPNARegister(addr: number, data: number): SiOPMChannelParam;
}
export type SiOPMChannelParam = SiOPMChannelParamMembers;
export interface SiOPMChannelParamConstructor {
    new (): SiOPMChannelParam;
}
export declare const SiOPMChannelParam: SiOPMChannelParamConstructor;
export interface SiOPMModuleMembers {
    initOperatorParam: SiOPMOperatorParam;
    zeroBuffer: SLLint;
    outputStream: SiOPMStream;
    streamSlot: (SiOPMStream)[];
    pcmVolume: number;
    samplerVolume: number;
    output: (number)[];
    channelCount: number;
    bitRate: number;
    bufferLength: number;
    initialize(channelCount: number, bitRate: number, bufferLength: number): void;
    reset(): void;
    _beginProcess(): void;
    _endProcess(): void;
    getPipe(pipeNum: number, index?: number): SLLint;
}
export type SiOPMModule = SiOPMModuleMembers;
export interface SiOPMModuleConstructor {
    new (): SiOPMModule;
    readonly STREAM_SEND_SIZE: number;
    readonly PIPE_SIZE: number;
}
export declare const SiOPMModule: SiOPMModuleConstructor;
export interface SiOPMOperatorParamMembers {
    pgType: number;
    ptType: number;
    ar: number;
    dr: number;
    sr: number;
    rr: number;
    sl: number;
    tl: number;
    ksr: number;
    ksl: number;
    fmul: number;
    dt1: number;
    detune: number;
    ams: number;
    phase: number;
    fixedPitch: number;
    mute: boolean;
    ssgec: number;
    modLevel: number;
    erst: boolean;
    mul: number;
    setPGType(type: number): void;
    initialize(): void;
    copyFrom(org: SiOPMOperatorParam): void;
    toString(): string;
}
export type SiOPMOperatorParam = SiOPMOperatorParamMembers;
export interface SiOPMOperatorParamConstructor {
    new (): SiOPMOperatorParam;
}
export declare const SiOPMOperatorParam: SiOPMOperatorParamConstructor;
export interface SiOPMStreamMembers {
    channels: number;
    buffer: (number)[];
    clear(): void;
    limit(): void;
    quantize(bitRate: number): void;
    write(pointer: SLLint, start: number, len: number, vol: number, pan: number): void;
    writeStereo(pointerL: SLLint, pointerR: SLLint, start: number, len: number, vol: number, pan: number): void;
    writeVectorNumber(pointer: (number)[], startPointer: number, startBuffer: number, len: number, vol: number, pan: number, sampleChannelCount: number): void;
    writeByteArray(bytes: ByteArray, start: number, len: number, vol: number): void;
}
export type SiOPMStream = SiOPMStreamMembers;
export interface SiOPMStreamConstructor {
    new (): SiOPMStream;
}
export declare const SiOPMStream: SiOPMStreamConstructor;
export interface SiOPMTableMembers {
    eg_incTables: any[];
    eg_incTablesAtt: any[];
    eg_tableSelector: any[];
    eg_levelTables: any[];
    eg_ssgTableIndex: any[];
    eg_timerSteps: any[];
    eg_slTable: any[];
    eg_tlTables: (any)[];
    eg_tlTableLine: (number)[];
    eg_tlTable96dB: (number)[];
    eg_tlTable64dB: (number)[];
    eg_tlTable48dB: (number)[];
    eg_tlTable32dB: (number)[];
    eg_lv2tlTable: (number)[];
    lfo_timerSteps: (number)[];
    lfo_waveTables: any[];
    lfo_chorusTables: (number)[];
    filter_cutoffTable: (number)[];
    filter_feedbackTable: (number)[];
    filter_eg_rate: (number)[];
    pitchTable: (any)[];
    phaseStepShiftFilter: (number)[];
    logTable: (number)[];
    nnToKC: (number)[];
    pitchWaveLength: (number)[];
    noWaveTable: SiOPMWaveTable;
    noWaveTableOPM: SiOPMWaveTable;
    soundReference: any;
    waveTables: (SiOPMWaveTable)[];
    samplerTables: (SiOPMWaveSamplerTable)[];
    _stencilCustomWaveTables: (SiOPMWaveTable)[];
    _stencilPCMVoices: (SiMMLVoice)[];
    dt1Table: any[];
    dt2Table: (number)[];
    final_oscilator_flags: any[];
    i2n: number;
    panTable: (number)[];
    rate: number;
    clock: number;
    psg_clock: number;
    clock_ratio: number;
    sampleRatePitchShift: number;
    resetAllUserTables(): void;
    registerWaveTable(index: number, table: (number)[]): SiOPMWaveTable;
    registerSamplerData(index: number, table: any, ignoreNoteOff: boolean, pan: number, srcChannelCount: number, channelCount: number): SiOPMWaveSamplerData;
    _setGlobalPCMVoice(index: number, voice: SiMMLVoice): SiMMLVoice;
    _getGlobalPCMVoice(index: number): SiMMLVoice;
    getWaveTable(index: number): SiOPMWaveTable;
    getPCMData(index: number): SiOPMWavePCMTable;
}
export type SiOPMTable = SiOPMTableMembers;
export interface SiOPMTableConstructor {
    new (clock: number, psg_clock: number, rate: number): SiOPMTable;
    readonly ENV_BITS: number;
    readonly ENV_TIMER_BITS: number;
    readonly SAMPLING_TABLE_BITS: number;
    readonly HALF_TONE_BITS: number;
    readonly NOTE_BITS: number;
    readonly NOISE_TABLE_BITS: number;
    readonly LOG_TABLE_RESOLUTION: number;
    readonly LOG_VOLUME_BITS: number;
    readonly LOG_TABLE_MAX_BITS: number;
    readonly FIXED_BITS: number;
    readonly PCM_BITS: number;
    readonly LFO_FIXED_BITS: number;
    readonly CLOCK_RATIO_BITS: number;
    readonly NOISE_WAVE_OUTPUT: number;
    readonly SQUARE_WAVE_OUTPUT: number;
    readonly OUTPUT_MAX: number;
    readonly ENV_LSHIFT: number;
    readonly ENV_TIMER_INITIAL: number;
    readonly LFO_TIMER_INITIAL: number;
    readonly PHASE_BITS: number;
    readonly PHASE_MAX: number;
    readonly PHASE_FILTER: number;
    readonly PHASE_SIGN_RSHIFT: number;
    readonly SAMPLING_TABLE_SIZE: number;
    readonly NOISE_TABLE_SIZE: number;
    readonly PITCH_TABLE_SIZE: number;
    readonly NOTE_TABLE_SIZE: number;
    readonly HALF_TONE_RESOLUTION: number;
    readonly LOG_TABLE_SIZE: number;
    readonly LFO_TABLE_SIZE: number;
    readonly KEY_CODE_TABLE_SIZE: number;
    readonly LOG_TABLE_BOTTOM: number;
    readonly ENV_BOTTOM: number;
    readonly ENV_TOP: number;
    readonly ENV_BOTTOM_SSGEC: number;
    readonly PT_OPM: number;
    readonly PT_PCM: number;
    readonly PT_PSG: number;
    readonly PT_OPM_NOISE: number;
    readonly PT_PSG_NOISE: number;
    readonly PT_APU_NOISE: number;
    readonly PT_GB_NOISE: number;
    readonly PT_MAX: number;
    readonly PG_SINE: number;
    readonly PG_SAW_UP: number;
    readonly PG_SAW_DOWN: number;
    readonly PG_TRIANGLE_FC: number;
    readonly PG_TRIANGLE: number;
    readonly PG_SQUARE: number;
    readonly PG_NOISE: number;
    readonly PG_KNMBSMM: number;
    readonly PG_SYNC_LOW: number;
    readonly PG_SYNC_HIGH: number;
    readonly PG_OFFSET: number;
    readonly PG_SAW_VC6: number;
    readonly PG_NOISE_WHITE: number;
    readonly PG_NOISE_PULSE: number;
    readonly PG_NOISE_SHORT: number;
    readonly PG_NOISE_HIPAS: number;
    readonly PG_NOISE_PINK: number;
    readonly PG_NOISE_GB_SHORT: number;
    readonly PG_PC_NZ_16BIT: number;
    readonly PG_PC_NZ_SHORT: number;
    readonly PG_PC_NZ_OPM: number;
    readonly PG_MA3_WAVE: number;
    readonly PG_PULSE: number;
    readonly PG_PULSE_SPIKE: number;
    readonly PG_RAMP: number;
    readonly PG_CUSTOM: number;
    readonly PG_PCM: number;
    readonly PG_USER_CUSTOM: number;
    readonly PG_USER_PCM: number;
    readonly DEFAULT_PG_MAX: number;
    readonly PG_FILTER: number;
    readonly WAVE_TABLE_MAX: number;
    readonly PCM_DATA_MAX: number;
    readonly SAMPLER_TABLE_MAX: number;
    readonly SAMPLER_DATA_MAX: number;
    readonly VM_LINEAR: number;
    readonly VM_DR96DB: number;
    readonly VM_DR64DB: number;
    readonly VM_DR48DB: number;
    readonly VM_DR32DB: number;
    readonly VM_MAX: number;
    readonly LFO_WAVE_SAW: number;
    readonly LFO_WAVE_SQUARE: number;
    readonly LFO_WAVE_TRIANGLE: number;
    readonly LFO_WAVE_NOISE: number;
    readonly LFO_WAVE_MAX: number;
    _instance: SiOPMTable;
    instance: SiOPMTable;
    calcLogTableIndex(n: number): number;
}
export declare const SiOPMTable: SiOPMTableConstructor;
export interface SiOPMWaveBaseMembers {
    moduleType: number;
}
export type SiOPMWaveBase = SiOPMWaveBaseMembers;
export interface SiOPMWaveBaseConstructor {
    new (moduleType: number): SiOPMWaveBase;
}
export declare const SiOPMWaveBase: SiOPMWaveBaseConstructor;
export interface SiOPMWavePCMDataMembers {
    wavelet: (number)[];
    channelCount: number;
    samplingPitch: number;
    sampleCount: number;
    samplingOctave: number;
    startPoint: number;
    endPoint: number;
    loopPoint: number;
    initialize(data: any, samplingPitch?: number, srcChannelCount?: number, channelCount?: number): SiOPMWavePCMData;
    slice(startPoint?: number, endPoint?: number, loopPoint?: number): SiOPMWavePCMData;
    getInitialSampleIndex(phase?: number): number;
    loopTailSamples(sampleCount?: number, tailMargin?: number, crossFade?: boolean): SiOPMWavePCMData;
}
export type SiOPMWavePCMData = Omit<SiOPMWaveBase, keyof SiOPMWavePCMDataMembers> & SiOPMWavePCMDataMembers;
export interface SiOPMWavePCMDataConstructor {
    new (data?: any, samplingPitch?: number, srcChannelCount?: number, channelCount?: number): SiOPMWavePCMData;
    maxSampleLengthFromSound: number;
}
export declare const SiOPMWavePCMData: SiOPMWavePCMDataConstructor;
export interface SiOPMWavePCMTableMembers {
    _table: (SiOPMWavePCMData)[];
    _volumeTable: (number)[];
    _panTable: (number)[];
    clear(pcmData?: SiOPMWavePCMData | null): SiOPMWavePCMTable;
    setSample(pcmData: SiOPMWavePCMData, keyRangeFrom?: number, keyRangeTo?: number): SiOPMWavePCMData;
    setKeyScaleVolume(centerNoteNumber?: number, keyRange?: number, volumeRange?: number): SiOPMWavePCMTable;
    setKeyScalePan(centerNoteNumber?: number, keyRange?: number, panWidth?: number): SiOPMWavePCMTable;
    _free(): void;
}
export type SiOPMWavePCMTable = Omit<SiOPMWaveBase, keyof SiOPMWavePCMTableMembers> & SiOPMWavePCMTableMembers;
export interface SiOPMWavePCMTableConstructor {
    new (): SiOPMWavePCMTable;
}
export declare const SiOPMWavePCMTable: SiOPMWavePCMTableConstructor;
export interface SiOPMWaveSamplerDataMembers {
    soundData: Sound;
    waveData: (number)[];
    channelCount: number;
    pan: number;
    length: number;
    isExtracted: boolean;
    ignoreNoteOff: boolean;
    startPoint: number;
    endPoint: number;
    loopPoint: number;
    peakList: (number)[];
    initialize(data: any, ignoreNoteOff?: boolean, pan?: number, srcChannelCount?: number, channelCount?: number, peakList?: (number)[] | null): SiOPMWaveSamplerData;
    slice(startPoint?: number, endPoint?: number, loopPoint?: number): SiOPMWaveSamplerData;
    extract(): void;
    getInitialSampleIndex(phase?: number): number;
    constructPeakList(): PeakDetector;
}
export type SiOPMWaveSamplerData = Omit<SiOPMWaveBase, keyof SiOPMWaveSamplerDataMembers> & SiOPMWaveSamplerDataMembers;
export interface SiOPMWaveSamplerDataConstructor {
    new (data?: any, ignoreNoteOff?: boolean, pan?: number, srcChannelCount?: number, channelCount?: number, peakList?: (number)[] | null): SiOPMWaveSamplerData;
    extractThreshold: number;
}
export declare const SiOPMWaveSamplerData: SiOPMWaveSamplerDataConstructor;
export interface SiOPMWaveSamplerTableMembers {
    stencil: SiOPMWaveSamplerTable;
    clear(sampleData?: SiOPMWaveSamplerData | null): SiOPMWaveSamplerTable;
    setSample(sample: SiOPMWaveSamplerData, keyRangeFrom?: number, keyRangeTo?: number): SiOPMWaveSamplerData;
    getSample(sampleNumber: number): SiOPMWaveSamplerData;
    _free(): void;
}
export type SiOPMWaveSamplerTable = Omit<SiOPMWaveBase, keyof SiOPMWaveSamplerTableMembers> & SiOPMWaveSamplerTableMembers;
export interface SiOPMWaveSamplerTableConstructor {
    new (): SiOPMWaveSamplerTable;
}
export declare const SiOPMWaveSamplerTable: SiOPMWaveSamplerTableConstructor;
export interface SiOPMWaveTableMembers {
    wavelet: (number)[];
    fixedBits: number;
    defaultPTType: number;
    initialize(wavelet: (number)[], defaultPTType?: number): SiOPMWaveTable;
    copyFrom(src: SiOPMWaveTable): SiOPMWaveTable;
    free(): void;
}
export type SiOPMWaveTable = Omit<SiOPMWaveBase, keyof SiOPMWaveTableMembers> & SiOPMWaveTableMembers;
export interface SiOPMWaveTableConstructor {
    new (): SiOPMWaveTable;
    alloc(wavelet: (number)[], defaultPTType?: number): SiOPMWaveTable;
}
export declare const SiOPMWaveTable: SiOPMWaveTableConstructor;
export interface BeatPerMinutesMembers {
    beat16PerSample: number;
    samplePerBeat16: number;
    tickPerSample: number;
    bpm: number;
    sampleRate: number;
    update(beatPerMinutes: number, sampleRate: number): boolean;
}
export type BeatPerMinutes = BeatPerMinutesMembers;
export interface BeatPerMinutesConstructor {
    new (bpm: number, sampleRate: number, resolution?: number): BeatPerMinutes;
}
export declare const BeatPerMinutes: BeatPerMinutesConstructor;
export interface MECElementMembers {
    number: number;
    modulation: number;
    parent: MECElement;
    next: MECElement;
    firstChild: MECElement;
    initialize(num: number): MECElement;
}
export type MECElement = MECElementMembers;
export interface MECElementConstructor {
    new (): MECElement;
    free(elem: MECElement): void;
    alloc(number: number): MECElement;
}
export declare const MECElement: MECElementConstructor;
export interface MMLDataMembers {
    sequenceGroup: MMLSequenceGroup;
    globalSequence: MMLSequence;
    defaultFPS: number;
    title: string;
    author: string;
    tcommandMode: number;
    tcommandResolution: number;
    defaultVCommandShift: number;
    defaultVelocityMode: number;
    defaultExpressionMode: number;
    _initialBPM: BeatPerMinutes;
    _systemCommands: any[];
    sequenceCount: number;
    bpm: number;
    systemCommands: any[];
    tickCount: number;
    hasRepeatAll: boolean;
    clear(): void;
    appendNewSequence(sequence?: (MMLEvent)[] | null): MMLSequence;
    getSequence(index: number): MMLSequence;
    _calcBPMfromTcommand(param: number): number;
}
export type MMLData = MMLDataMembers;
export interface MMLDataConstructor {
    new (): MMLData;
    readonly TCOMMAND_BPM: number;
    readonly TCOMMAND_TIMERB: number;
    readonly TCOMMAND_FRAME: number;
}
export declare const MMLData: MMLDataConstructor;
export interface MMLEventMembers {
    id: number;
    data: number;
    length: number;
    next: MMLEvent;
    jump: MMLEvent;
    toString(): string;
    initialize(id: number, data: number, length: number): MMLEvent;
    getParameters(param: (number)[], length: number): MMLEvent;
    free(): void;
    pack(): number;
    unpack(d: number): void;
}
export type MMLEvent = MMLEventMembers;
export interface MMLEventConstructor {
    new (id?: number, data?: number, length?: number): MMLEvent;
    readonly NOP: number;
    readonly PROCESS: number;
    readonly REST: number;
    readonly NOTE: number;
    readonly KEY_ON_DELAY: number;
    readonly QUANT_RATIO: number;
    readonly QUANT_COUNT: number;
    readonly VOLUME: number;
    readonly VOLUME_SHIFT: number;
    readonly FINE_VOLUME: number;
    readonly SLUR: number;
    readonly SLUR_WEAK: number;
    readonly PITCHBEND: number;
    readonly REPEAT_BEGIN: number;
    readonly REPEAT_BREAK: number;
    readonly REPEAT_END: number;
    readonly MOD_TYPE: number;
    readonly MOD_PARAM: number;
    readonly INPUT_PIPE: number;
    readonly OUTPUT_PIPE: number;
    readonly REPEAT_ALL: number;
    readonly PARAMETER: number;
    readonly SEQUENCE_HEAD: number;
    readonly SEQUENCE_TAIL: number;
    readonly SYSTEM_EVENT: number;
    readonly TABLE_EVENT: number;
    readonly GLOBAL_WAIT: number;
    readonly TEMPO: number;
    readonly TIMER: number;
    readonly REGISTER: number;
    readonly DEBUG_INFO: number;
    readonly INTERNAL_CALL: number;
    readonly INTERNAL_WAIT: number;
    readonly DRIVER_NOTE: number;
    readonly USER_DEFINE: number;
    readonly COMMAND_MAX: number;
    nopEvent: MMLEvent;
}
export declare const MMLEvent: MMLEventConstructor;
export interface MMLExecutorMembers {
    pointer: MMLEvent;
    endRepeatCount: number;
    sequence: MMLSequence;
    currentEvent: MMLEvent;
    noteWaitingFor: number;
    initialize(seq: MMLSequence): void;
    clear(): void;
    resetPointer(): void;
    stop(): void;
    singleNote(note: number, tickLength: number): void;
    bendingFrom(note: number, tickLength: number): boolean;
    _publishProessingEvent(e: MMLEvent): MMLEvent;
    _onTempoChanged(changingRatio: number): void;
}
export type MMLExecutor = MMLExecutorMembers;
export interface MMLExecutorConstructor {
    new (): MMLExecutor;
}
export declare const MMLExecutor: MMLExecutorConstructor;
export interface MMLExecutorConnectorMembers {
    executorCount: number;
    sequenceCount: number;
    clear(): void;
    parse(form: string): void;
    connect(seqGroup: MMLSequenceGroup, prev: MMLSequence): MMLSequence;
}
export type MMLExecutorConnector = MMLExecutorConnectorMembers;
export interface MMLExecutorConnectorConstructor {
    new (): MMLExecutorConnector;
}
export declare const MMLExecutorConnector: MMLExecutorConnectorConstructor;
export interface MMLParserMembers {
}
export type MMLParser = MMLParserMembers;
export interface MMLParserConstructor {
    new (): MMLParser;
    keySign: string;
    parseProgress: number;
    addMMLEvent(id: number, data?: number, length?: number, noteOption?: boolean): MMLEvent;
    getEventID(mmlCommand: string): number;
    prepareParse(setting: MMLParserSetting, mml: string): void;
    parse(interrupt?: number): MMLEvent;
    errorUnknown(n: string): Error;
    errorNoteOutofRange(note: number): Error;
    errorSyntax(syn: string): Error;
    errorRangeOver(cmd: string, min: number, max: number): Error;
    errorStacUnderflow(cmd: string): Error;
    errorStacOverflow(cmd: string): Error;
    errorKeySign(ksign: string): Error;
}
export declare const MMLParser: MMLParserConstructor;
export interface MMLParserSettingMembers {
    resolution: number;
    defaultBPM: number;
    defaultLValue: number;
    minQuantRatio: number;
    maxQuantRatio: number;
    defaultQuantRatio: number;
    minQuantCount: number;
    maxQuantCount: number;
    defaultQuantCount: number;
    maxVolume: number;
    defaultVolume: number;
    maxFineVolume: number;
    defaultFineVolume: number;
    minOctave: number;
    maxOctave: number;
    volumePolarization: number;
    octavePolarization: number;
    mml2nn: number;
    defaultLength: number;
    defaultOctave: number;
    initialize(initializer?: any): void;
    update(initializer: any): void;
}
export type MMLParserSetting = MMLParserSettingMembers;
export interface MMLParserSettingConstructor {
    new (initializer?: any): MMLParserSetting;
}
export declare const MMLParserSetting: MMLParserSettingConstructor;
export interface MMLSequenceMembers {
    headEvent: MMLEvent;
    tailEvent: MMLEvent;
    isActive: boolean;
    _prevSequence: MMLSequence;
    _nextSequence: MMLSequence;
    _isTerminal: boolean;
    _callbackInternalCall: any[];
    _owner: MMLData;
    nextSequence: MMLSequence;
    mmlString: string;
    mmlLength: number;
    hasRepeatAll: boolean;
    toString(): string;
    toVector(lengthLimit?: number, offset?: number, eventID?: number): (MMLEvent)[];
    fromVector(events: (MMLEvent)[]): MMLSequence;
    initialize(): MMLSequence;
    free(): void;
    isEmpty(): boolean;
    pack(seq: ByteArray): void;
    unpack(seq: ByteArray): void;
    appendNewEvent(id: number, data: number, length?: number): MMLEvent;
    appendNewCallback(func: (...args: any[]) => any, data: number): MMLEvent;
    prependNewEvent(id: number, data: number, length?: number): MMLEvent;
    push(e: MMLEvent): MMLEvent;
    pop(): MMLEvent;
    unshift(e: MMLEvent): MMLEvent;
    shift(): MMLEvent;
    connectBefore(secondHead: MMLEvent): MMLSequence;
    isSystemCommand(): boolean;
    getSystemCommand(): string;
    _cutout(head: MMLEvent): MMLEvent;
    _removeFromChain(): MMLSequence;
}
export type MMLSequence = MMLSequenceMembers;
export interface MMLSequenceConstructor {
    new (term?: boolean): MMLSequence;
}
export declare const MMLSequence: MMLSequenceConstructor;
export interface MMLSequenceGroupMembers {
    sequenceCount: number;
    headSequence: MMLSequence;
    tickCount: number;
    hasRepeatAll: boolean;
    alloc(headEvent: MMLEvent): void;
    free(): void;
    getSequence(index: number): MMLSequence;
    appendNewSequence(): MMLSequence;
}
export type MMLSequenceGroup = MMLSequenceGroupMembers;
export interface MMLSequenceGroupConstructor {
    new (owner: MMLData): MMLSequenceGroup;
}
export declare const MMLSequenceGroup: MMLSequenceGroupConstructor;
export interface MMLSequencerMembers {
    setting: MMLParserSetting;
    sampleRate: number;
    _eventCommandLetter: any[];
    bpm: number;
    getEventID(mmlCommand: string): number;
    getEventLetter(eventID: number): string;
    prepareCompile(data: MMLData, mml: string): boolean;
    compile(interval?: number): number;
    _prepareProcess(data: MMLData, sampleRate: number, bufferLength: number): void;
    _process(): void;
    setGlobalSequence(seq: MMLSequence): void;
}
export type MMLSequencer = MMLSequencerMembers;
export interface MMLSequencerConstructor {
    new (): MMLSequencer;
    _tempExecutor: MMLExecutor;
}
export declare const MMLSequencer: MMLSequencerConstructor;
export interface SiMMLChannelSettingMembers {
    type: number;
}
export type SiMMLChannelSetting = SiMMLChannelSettingMembers;
export interface SiMMLChannelSettingConstructor {
    new (type: number, offset: number, length: number, step: number, channelCount: number): SiMMLChannelSetting;
    readonly SELECT_TONE_NOP: number;
    readonly SELECT_TONE_NORMAL: number;
    readonly SELECT_TONE_FM: number;
}
export declare const SiMMLChannelSetting: SiMMLChannelSettingConstructor;
export interface SiMMLDataMembers {
    envelopes: (SiMMLEnvelopTable)[];
    waveTables: (SiOPMWaveTable)[];
    fmVoices: (SiMMLVoice)[];
    pcmVoices: (SiMMLVoice)[];
    samplerTables: (SiOPMWaveSamplerTable)[];
    voices: (SiMMLVoice)[];
    clear(): void;
    setEnvelopTable(index: number, envelope: SiMMLEnvelopTable): void;
    setVoice(index: number, voice: SiMMLVoice): void;
    setWaveTable(index: number, data: (number)[]): SiOPMWaveTable;
    _getPCMVoice(index: number): SiMMLVoice;
}
export type SiMMLData = Omit<MMLData, keyof SiMMLDataMembers> & SiMMLDataMembers;
export interface SiMMLDataConstructor {
    new (): SiMMLData;
}
export declare const SiMMLData: SiMMLDataConstructor;
export interface SiMMLEnvelopTableMembers {
    head: SLLint;
    tail: SLLint;
    toVector(length: number, min?: number, max?: number, dst?: (number)[] | null): (number)[];
    free(): void;
    copyFrom(src: SiMMLEnvelopTable): SiMMLEnvelopTable;
    parseMML(tableNumbers: string, postfix: string, maxIndex?: number): SiMMLEnvelopTable;
    _initialize(head_: SLLint, tail_: SLLint): void;
}
export type SiMMLEnvelopTable = SiMMLEnvelopTableMembers;
export interface SiMMLEnvelopTableConstructor {
    new (table?: (number)[] | null, loopPoint?: number): SiMMLEnvelopTable;
}
export declare const SiMMLEnvelopTable: SiMMLEnvelopTableConstructor;
export interface SiMMLSequencerMembers {
    tracks: (SiMMLTrack)[];
    _maxTrackCount: number;
    isReadyToProcess: boolean;
    title: string;
    processedSampleCount: number;
    isFinished: boolean;
    isSequenceFinished: boolean;
    isEnableChangeBPM: boolean;
    callbackOnParsingSystemCommand: (...args: any[]) => any;
    streamWritingBeat: number;
    streamWritingPositionResidue: number;
    currentTrack: SiMMLTrack;
    _setBeatCallbackFilter(filter: number): void;
    _setTimerCallback(func: (...args: any[]) => any): void;
    _setBeatCallback(func: (...args: any[]) => any): void;
    _isDummyProcess(): boolean;
    _resetAllTracks(): void;
    _stopSequence(): void;
    _findActiveTrack(internalTrackID: number, delay?: number): SiMMLTrack;
    _newControlableTrack(internalTrackID?: number, isDisposable?: boolean): SiMMLTrack;
    prepareCompile(data: MMLData, mml: string): boolean;
    _prepareProcess(data: MMLData, sampleRate: number, bufferLength: number): void;
    _process(): void;
    dummyProcess(sampleCount: number): void;
    calcSampleLength(beat16: number): number;
    calcSampleDelay(sampleOffset?: number, beat16Offset?: number, quant?: number): number;
}
export type SiMMLSequencer = Omit<MMLSequencer, keyof SiMMLSequencerMembers> & SiMMLSequencerMembers;
export interface SiMMLSequencerConstructor {
    new (module: SiOPMModule, eventTriggerOn: (...args: any[]) => any, eventTriggerOff: (...args: any[]) => any, tempoChanged: (...args: any[]) => any): SiMMLSequencer;
}
export declare const SiMMLSequencer: SiMMLSequencerConstructor;
export interface SiMMLTableMembers {
    channelModuleSetting: any[];
    effectModuleSetting: any[];
    simulators: any[];
    tss_s2ar: (string)[];
    tss_s2dr: (string)[];
    tss_s2sr: (string)[];
    tss_s2rr: (string)[];
    presetRegisterYM2413: (number)[];
    presetRegisterVRC7: (number)[];
    presetRegisterVRC7Drums: (number)[];
    presetVoiceYM2413: (SiMMLVoice)[];
    presetVoiceVRC7: (SiMMLVoice)[];
    presetVoiceVRC7Drums: (SiMMLVoice)[];
    alg_opm: any[];
    alg_opl: any[];
    alg_ma3: any[];
    alg_opx: any[];
    alg_init: any[];
    resetAllUserTables(): void;
    getEnvelopTable(index: number): SiMMLEnvelopTable;
    getSiMMLVoice(index: number): SiMMLVoice;
}
export type SiMMLTable = SiMMLTableMembers;
export interface SiMMLTableConstructor {
    new (): SiMMLTable;
    readonly MT_PSG: number;
    readonly MT_APU: number;
    readonly MT_NOISE: number;
    readonly MT_MA3: number;
    readonly MT_CUSTOM: number;
    readonly MT_ALL: number;
    readonly MT_FM: number;
    readonly MT_PCM: number;
    readonly MT_PULSE: number;
    readonly MT_RAMP: number;
    readonly MT_SAMPLE: number;
    readonly MT_KS: number;
    readonly MT_GB: number;
    readonly MT_VRC6: number;
    readonly MT_SID: number;
    readonly MT_FM_OPM: number;
    readonly MT_FM_OPN: number;
    readonly MT_FM_OPNA: number;
    readonly MT_FM_OPLL: number;
    readonly MT_FM_OPL3: number;
    readonly MT_FM_MA3: number;
    readonly MT_MAX: number;
    readonly ENV_TABLE_MAX: number;
    readonly VOICE_MAX: number;
    _instance: SiMMLTable;
    instance: SiMMLTable;
    registerMasterEnvelopTable(index: number, table: SiMMLEnvelopTable): void;
    registerMasterVoice(index: number, voice: SiMMLVoice): void;
    getPGType(moduleType: number, channelNum: number, toneNum?: number): number;
    isSuitableForFMVoice(moduleType: number): boolean;
}
export declare const SiMMLTable: SiMMLTableConstructor;
export interface SiMMLTrackMembers {
    channel: SiOPMChannelBase;
    executor: MMLExecutor;
    noteShift: number;
    pitchShift: number;
    keyOnDelay: number;
    quantRatio: number;
    quantCount: number;
    eventMask: number;
    _internalTrackID: number;
    _trackNumber: number;
    _channelNumber: number;
    _vcommandShift: number;
    trackNumber: number;
    trackID: number;
    trackTypeID: number;
    eventTriggerID: number;
    eventTriggerTypeOn: number;
    eventTriggerTypeOff: number;
    note: number;
    trackStartDelay: number;
    trackStopDelay: number;
    isActive: boolean;
    isDisposable: boolean;
    isPlaySequence: boolean;
    isFinished: boolean;
    velocity: number;
    expression: number;
    masterVolume: number;
    effectSend1: number;
    effectSend2: number;
    effectSend3: number;
    effectSend4: number;
    mute: boolean;
    pan: number;
    pitchBend: number;
    onUpdateRegister: (...args: any[]) => any;
    velocityMode: number;
    expressionMode: number;
    channelNumber: number;
    programNumber: number;
    outputLevel: number;
    mmlData: SiMMLData;
    priority: number;
    setTrackCallback(noteOn?: (...args: any[]) => any | null, noteOff?: (...args: any[]) => any | null): SiMMLTrack;
    keyOn(note: number, tickLength?: number, sampleDelay?: number): SiMMLTrack;
    keyOff(sampleDelay?: number, stopWithReset?: boolean): SiMMLTrack;
    dispatchEventTrigger(noteOn: boolean): boolean;
    sequenceOn(seq: MMLSequence, sampleLength?: number, sampleDelay?: number): SiMMLTrack;
    sequenceOff(sampleDelay?: number, stopWithReset?: boolean): SiMMLTrack;
    limitLength(stopDelay: number): void;
    setDisposable(): void;
    setNote(note: number, sampleLength: number, slur?: boolean): void;
    setPitchBend(noteFrom: number, tickLength: number): void;
    setChannelModuleType(type: number, channelNum?: number, toneNum?: number): void;
    setPortament(frame: number): void;
    setEventTrigger(id: number, noteOnType?: number, noteOffType?: number): void;
    dispatchNoteOnEvent(id: number, noteOnType?: number): void;
    setEnvelopFPS(fps: number): void;
    setReleaseSweep(sweep: number): void;
    setModulationEnvelop(isPitchMod: boolean, depth: number, end_depth: number, delay: number, term: number): void;
    setToneEnvelop(noteOn: number, table: SiMMLEnvelopTable, step: number): void;
    setAmplitudeEnvelop(noteOn: number, table: SiMMLEnvelopTable, step: number, offset?: boolean): void;
    setFilterEnvelop(noteOn: number, table: SiMMLEnvelopTable, step: number): void;
    setPitchEnvelop(noteOn: number, table: SiMMLEnvelopTable, step: number): void;
    setNoteEnvelop(noteOn: number, table: SiMMLEnvelopTable, step: number): void;
    _resetVolumeOffset(): void;
}
export type SiMMLTrack = SiMMLTrackMembers;
export interface SiMMLTrackConstructor {
    new (): SiMMLTrack;
    readonly TRACK_ID_FILTER: number;
    readonly TRACK_TYPE_FILTER: number;
    readonly MML_TRACK: number;
    readonly MIDI_TRACK: number;
    readonly DRIVER_NOTE: number;
    readonly DRIVER_SEQUENCE: number;
    readonly DRIVER_BACKGROUND: number;
    readonly USER_CONTROLLED: number;
    readonly NO_MASK: number;
    readonly MASK_VOLUME: number;
    readonly MASK_PAN: number;
    readonly MASK_QUANTIZE: number;
    readonly MASK_OPERATOR: number;
    readonly MASK_ENVELOP: number;
    readonly MASK_MODULATE: number;
    readonly MASK_SLUR: number;
}
export declare const SiMMLTrack: SiMMLTrackConstructor;
export interface SiMMLVoiceMembers {
    chipType: string;
    updateTrackParamaters: boolean;
    updateVolumes: boolean;
    moduleType: number;
    channelNum: number;
    toneNum: number;
    preferableNote: number;
    channelParam: SiOPMChannelParam;
    waveData: SiOPMWaveBase;
    pmsTension: number;
    defaultGateTime: number;
    defaultGateTicks: number;
    defaultKeyOnDelayTicks: number;
    pitchShift: number;
    noteShift: number;
    portament: number;
    releaseSweep: number;
    velocity: number;
    expression: number;
    velocityMode: number;
    vcommandShift: number;
    expressionMode: number;
    amDepth: number;
    amDepthEnd: number;
    amDelay: number;
    amTerm: number;
    pmDepth: number;
    pmDepthEnd: number;
    pmDelay: number;
    pmTerm: number;
    noteOnToneEnvelop: SiMMLEnvelopTable;
    noteOnAmplitudeEnvelop: SiMMLEnvelopTable;
    noteOnFilterEnvelop: SiMMLEnvelopTable;
    noteOnPitchEnvelop: SiMMLEnvelopTable;
    noteOnNoteEnvelop: SiMMLEnvelopTable;
    noteOffToneEnvelop: SiMMLEnvelopTable;
    noteOffAmplitudeEnvelop: SiMMLEnvelopTable;
    noteOffFilterEnvelop: SiMMLEnvelopTable;
    noteOffPitchEnvelop: SiMMLEnvelopTable;
    noteOffNoteEnvelop: SiMMLEnvelopTable;
    noteOnToneEnvelopStep: number;
    noteOnAmplitudeEnvelopStep: number;
    noteOnFilterEnvelopStep: number;
    noteOnPitchEnvelopStep: number;
    noteOnNoteEnvelopStep: number;
    noteOffToneEnvelopStep: number;
    noteOffAmplitudeEnvelopStep: number;
    noteOffFilterEnvelopStep: number;
    noteOffPitchEnvelopStep: number;
    noteOffNoteEnvelopStep: number;
    isFMVoice: boolean;
    isPCMVoice: boolean;
    isSamplerVoice: boolean;
    isWaveTableVoice: boolean;
    _isSuitableForFMVoice: boolean;
    setModuleType(moduleType: number, channelNum?: number, toneNum?: number): void;
    updateTrackVoice(track: SiMMLTrack): SiMMLTrack;
    setTrackVoice(track: SiMMLTrack): SiMMLTrack;
    initialize(): void;
    copyFrom(src: SiMMLVoice): void;
    _newBlankPCMVoice(channelNum: number): SiMMLVoice;
}
export type SiMMLVoice = SiMMLVoiceMembers;
export interface SiMMLVoiceConstructor {
    new (): SiMMLVoice;
}
export declare const SiMMLVoice: SiMMLVoiceConstructor;
export interface SiMMLSimulatorAPUMembers {
}
export type SiMMLSimulatorAPU = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorAPUMembers> & SiMMLSimulatorAPUMembers;
export interface SiMMLSimulatorAPUConstructor {
    new (): SiMMLSimulatorAPU;
}
export declare const SiMMLSimulatorAPU: SiMMLSimulatorAPUConstructor;
export interface SiMMLSimulatorBaseMembers {
    type: number;
    initializeTone(track: SiMMLTrack, chNum: number, bufferIndex: number): number;
    selectTone(track: SiMMLTrack, voiceIndex: number): MMLSequence;
}
export type SiMMLSimulatorBase = SiMMLSimulatorBaseMembers;
export interface SiMMLSimulatorBaseConstructor {
    new (type: number, channelCount: number, defaultVoiceSet: SiMMLSimulatorVoiceSet, isSuitableForFMVoice?: boolean): SiMMLSimulatorBase;
    readonly MT_PSG: number;
    readonly MT_APU: number;
    readonly MT_NOISE: number;
    readonly MT_MA3: number;
    readonly MT_CUSTOM: number;
    readonly MT_ALL: number;
    readonly MT_FM: number;
    readonly MT_PCM: number;
    readonly MT_PULSE: number;
    readonly MT_RAMP: number;
    readonly MT_SAMPLE: number;
    readonly MT_KS: number;
    readonly MT_GB: number;
    readonly MT_VRC6: number;
    readonly MT_SID: number;
    readonly MT_FM_OPM: number;
    readonly MT_FM_OPN: number;
    readonly MT_FM_OPNA: number;
    readonly MT_FM_OPLL: number;
    readonly MT_FM_OPL3: number;
    readonly MT_FM_MA3: number;
    readonly MT_MAX: number;
}
export declare const SiMMLSimulatorBase: SiMMLSimulatorBaseConstructor;
export interface SiMMLSimulatorBaseFMMembers {
    selectTone(track: SiMMLTrack, voiceIndex: number): MMLSequence;
}
export type SiMMLSimulatorBaseFM = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorBaseFMMembers> & SiMMLSimulatorBaseFMMembers;
export interface SiMMLSimulatorBaseFMConstructor {
    new (type: number, channelCount: number): SiMMLSimulatorBaseFM;
}
export declare const SiMMLSimulatorBaseFM: SiMMLSimulatorBaseFMConstructor;
export interface SiMMLSimulatorDCSGMembers {
}
export type SiMMLSimulatorDCSG = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorDCSGMembers> & SiMMLSimulatorDCSGMembers;
export interface SiMMLSimulatorDCSGConstructor {
    new (): SiMMLSimulatorDCSG;
}
export declare const SiMMLSimulatorDCSG: SiMMLSimulatorDCSGConstructor;
export interface SiMMLSimulatorFMMA3Members {
}
export type SiMMLSimulatorFMMA3 = Omit<SiMMLSimulatorBaseFM, keyof SiMMLSimulatorFMMA3Members> & SiMMLSimulatorFMMA3Members;
export interface SiMMLSimulatorFMMA3Constructor {
    new (): SiMMLSimulatorFMMA3;
}
export declare const SiMMLSimulatorFMMA3: SiMMLSimulatorFMMA3Constructor;
export interface SiMMLSimulatorFMOPL3Members {
}
export type SiMMLSimulatorFMOPL3 = Omit<SiMMLSimulatorBaseFM, keyof SiMMLSimulatorFMOPL3Members> & SiMMLSimulatorFMOPL3Members;
export interface SiMMLSimulatorFMOPL3Constructor {
    new (): SiMMLSimulatorFMOPL3;
}
export declare const SiMMLSimulatorFMOPL3: SiMMLSimulatorFMOPL3Constructor;
export interface SiMMLSimulatorFMOPLLMembers {
}
export type SiMMLSimulatorFMOPLL = Omit<SiMMLSimulatorBaseFM, keyof SiMMLSimulatorFMOPLLMembers> & SiMMLSimulatorFMOPLLMembers;
export interface SiMMLSimulatorFMOPLLConstructor {
    new (): SiMMLSimulatorFMOPLL;
}
export declare const SiMMLSimulatorFMOPLL: SiMMLSimulatorFMOPLLConstructor;
export interface SiMMLSimulatorFMOPMMembers {
}
export type SiMMLSimulatorFMOPM = Omit<SiMMLSimulatorBaseFM, keyof SiMMLSimulatorFMOPMMembers> & SiMMLSimulatorFMOPMMembers;
export interface SiMMLSimulatorFMOPMConstructor {
    new (): SiMMLSimulatorFMOPM;
}
export declare const SiMMLSimulatorFMOPM: SiMMLSimulatorFMOPMConstructor;
export interface SiMMLSimulatorFMOPNMembers {
}
export type SiMMLSimulatorFMOPN = Omit<SiMMLSimulatorBaseFM, keyof SiMMLSimulatorFMOPNMembers> & SiMMLSimulatorFMOPNMembers;
export interface SiMMLSimulatorFMOPNConstructor {
    new (): SiMMLSimulatorFMOPN;
}
export declare const SiMMLSimulatorFMOPN: SiMMLSimulatorFMOPNConstructor;
export interface SiMMLSimulatorFMOPNAMembers {
}
export type SiMMLSimulatorFMOPNA = Omit<SiMMLSimulatorBaseFM, keyof SiMMLSimulatorFMOPNAMembers> & SiMMLSimulatorFMOPNAMembers;
export interface SiMMLSimulatorFMOPNAConstructor {
    new (): SiMMLSimulatorFMOPNA;
}
export declare const SiMMLSimulatorFMOPNA: SiMMLSimulatorFMOPNAConstructor;
export interface SiMMLSimulatorFMSiOPMMembers {
}
export type SiMMLSimulatorFMSiOPM = Omit<SiMMLSimulatorBaseFM, keyof SiMMLSimulatorFMSiOPMMembers> & SiMMLSimulatorFMSiOPMMembers;
export interface SiMMLSimulatorFMSiOPMConstructor {
    new (): SiMMLSimulatorFMSiOPM;
}
export declare const SiMMLSimulatorFMSiOPM: SiMMLSimulatorFMSiOPMConstructor;
export interface SiMMLSimulatorGBMembers {
}
export type SiMMLSimulatorGB = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorGBMembers> & SiMMLSimulatorGBMembers;
export interface SiMMLSimulatorGBConstructor {
    new (): SiMMLSimulatorGB;
}
export declare const SiMMLSimulatorGB: SiMMLSimulatorGBConstructor;
export interface SiMMLSimulatorKSMembers {
}
export type SiMMLSimulatorKS = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorKSMembers> & SiMMLSimulatorKSMembers;
export interface SiMMLSimulatorKSConstructor {
    new (): SiMMLSimulatorKS;
}
export declare const SiMMLSimulatorKS: SiMMLSimulatorKSConstructor;
export interface SiMMLSimulatorMA3WaveTableMembers {
}
export type SiMMLSimulatorMA3WaveTable = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorMA3WaveTableMembers> & SiMMLSimulatorMA3WaveTableMembers;
export interface SiMMLSimulatorMA3WaveTableConstructor {
    new (): SiMMLSimulatorMA3WaveTable;
}
export declare const SiMMLSimulatorMA3WaveTable: SiMMLSimulatorMA3WaveTableConstructor;
export interface SiMMLSimulatorNoiseMembers {
}
export type SiMMLSimulatorNoise = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorNoiseMembers> & SiMMLSimulatorNoiseMembers;
export interface SiMMLSimulatorNoiseConstructor {
    new (): SiMMLSimulatorNoise;
}
export declare const SiMMLSimulatorNoise: SiMMLSimulatorNoiseConstructor;
export interface SiMMLSimulatorPCMMembers {
}
export type SiMMLSimulatorPCM = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorPCMMembers> & SiMMLSimulatorPCMMembers;
export interface SiMMLSimulatorPCMConstructor {
    new (): SiMMLSimulatorPCM;
}
export declare const SiMMLSimulatorPCM: SiMMLSimulatorPCMConstructor;
export interface SiMMLSimulatorPSGMembers {
}
export type SiMMLSimulatorPSG = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorPSGMembers> & SiMMLSimulatorPSGMembers;
export interface SiMMLSimulatorPSGConstructor {
    new (): SiMMLSimulatorPSG;
}
export declare const SiMMLSimulatorPSG: SiMMLSimulatorPSGConstructor;
export interface SiMMLSimulatorPulseMembers {
}
export type SiMMLSimulatorPulse = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorPulseMembers> & SiMMLSimulatorPulseMembers;
export interface SiMMLSimulatorPulseConstructor {
    new (): SiMMLSimulatorPulse;
}
export declare const SiMMLSimulatorPulse: SiMMLSimulatorPulseConstructor;
export interface SiMMLSimulatorRampMembers {
}
export type SiMMLSimulatorRamp = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorRampMembers> & SiMMLSimulatorRampMembers;
export interface SiMMLSimulatorRampConstructor {
    new (): SiMMLSimulatorRamp;
}
export declare const SiMMLSimulatorRamp: SiMMLSimulatorRampConstructor;
export interface SiMMLSimulatorSamplerMembers {
}
export type SiMMLSimulatorSampler = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorSamplerMembers> & SiMMLSimulatorSamplerMembers;
export interface SiMMLSimulatorSamplerConstructor {
    new (): SiMMLSimulatorSampler;
}
export declare const SiMMLSimulatorSampler: SiMMLSimulatorSamplerConstructor;
export interface SiMMLSimulatorSIDMembers {
}
export type SiMMLSimulatorSID = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorSIDMembers> & SiMMLSimulatorSIDMembers;
export interface SiMMLSimulatorSIDConstructor {
    new (): SiMMLSimulatorSID;
}
export declare const SiMMLSimulatorSID: SiMMLSimulatorSIDConstructor;
export interface SiMMLSimulatorSiOPMMembers {
}
export type SiMMLSimulatorSiOPM = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorSiOPMMembers> & SiMMLSimulatorSiOPMMembers;
export interface SiMMLSimulatorSiOPMConstructor {
    new (): SiMMLSimulatorSiOPM;
}
export declare const SiMMLSimulatorSiOPM: SiMMLSimulatorSiOPMConstructor;
export interface SiMMLSimulatorVoiceMembers {
    pgType: number;
    ptType: number;
    channelType: number;
}
export type SiMMLSimulatorVoice = SiMMLSimulatorVoiceMembers;
export interface SiMMLSimulatorVoiceConstructor {
    new (pgType: number, ptType: number, channelType?: number): SiMMLSimulatorVoice;
}
export declare const SiMMLSimulatorVoice: SiMMLSimulatorVoiceConstructor;
export interface SiMMLSimulatorVoiceSetMembers {
    voices: (SiMMLSimulatorVoice)[];
    initVoiceIndex: number;
}
export type SiMMLSimulatorVoiceSet = SiMMLSimulatorVoiceSetMembers;
export interface SiMMLSimulatorVoiceSetConstructor {
    new (length: number, offset?: number, channelType?: number): SiMMLSimulatorVoiceSet;
}
export declare const SiMMLSimulatorVoiceSet: SiMMLSimulatorVoiceSetConstructor;
export interface SiMMLSimulatorVRC6Members {
}
export type SiMMLSimulatorVRC6 = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorVRC6Members> & SiMMLSimulatorVRC6Members;
export interface SiMMLSimulatorVRC6Constructor {
    new (): SiMMLSimulatorVRC6;
}
export declare const SiMMLSimulatorVRC6: SiMMLSimulatorVRC6Constructor;
export interface SiMMLSimulatorWTMembers {
}
export type SiMMLSimulatorWT = Omit<SiMMLSimulatorBase, keyof SiMMLSimulatorWTMembers> & SiMMLSimulatorWTMembers;
export interface SiMMLSimulatorWTConstructor {
    new (): SiMMLSimulatorWT;
}
export declare const SiMMLSimulatorWT: SiMMLSimulatorWTConstructor;
export interface SiONDataMembers {
    setPCMWave(index: number, data: any, samplingNote?: number, keyRangeFrom?: number, keyRangeTo?: number, srcChannelCount?: number, channelCount?: number): SiOPMWavePCMData;
    setSamplerWave(index: number, data: any, ignoreNoteOff?: boolean, pan?: number, srcChannelCount?: number, channelCount?: number): SiOPMWaveSamplerData;
    setPCMVoice(index: number, voice: SiONVoice): void;
    setSamplerTable(bank: number, table: SiOPMWaveSamplerTable): void;
    setPCMData(index: number, data: (number)[], samplingOctave?: number, keyRangeFrom?: number, keyRangeTo?: number, isSourceDataStereo?: boolean): SiOPMWavePCMData;
    setPCMSound(index: number, sound: Sound, samplingOctave?: number, keyRangeFrom?: number, keyRangeTo?: number): SiOPMWavePCMData;
    setSamplerData(index: number, data: (number)[], ignoreNoteOff?: boolean, channelCount?: number): SiOPMWaveSamplerData;
    setSamplerSound(index: number, sound: Sound, ignoreNoteOff?: boolean, channelCount?: number): SiOPMWaveSamplerData;
}
export type SiONData = Omit<SiMMLData, keyof SiONDataMembers> & SiONDataMembers;
export interface SiONDataConstructor {
    new (): SiONData;
}
export declare const SiONData: SiONDataConstructor;
export interface SiONDriverMembers {
    module: SiOPMModule;
    effector: SiEffectModule;
    sequencer: SiMMLSequencer;
    mmlString: string;
    data: SiONData;
    sound: Sound;
    soundChannel: SoundChannel;
    fader: Fader;
    trackCount: number;
    bufferLength: number;
    sampleRate: number;
    bitRate: number;
    volume: number;
    pan: number;
    compileTime: number;
    renderTime: number;
    processTime: number;
    jobProgress: number;
    jobQueueProgress: number;
    latency: number;
    jobQueueLength: number;
    isJobExecuting: boolean;
    isPlaying: boolean;
    isPaused: boolean;
    backgroundSound: Sound;
    backgroundSoundTrack: SiMMLTrack;
    backgroundSoundFadeOutTime: number;
    backgroundSoundFadeInTime: number;
    backgroundSoundFadeGapTime: number;
    backgroundSoundVolume: number;
    midiModule: MIDIModule;
    position: number;
    maxTrackCount: number;
    bpm: number;
    autoStop: boolean;
    pauseWhileLoading: boolean;
    debugMode: boolean;
    noteOnExceptionMode: number;
    dispatchChangeBPMEventWhenPositionChanged: boolean;
    compile(mml: string, data?: SiONData | null): SiONData;
    compileQueue(mml: string, data: SiONData): number;
    render(data: any, renderBuffer?: (number)[] | null, renderBufferChannelCount?: number, resetEffector?: boolean): (number)[];
    renderQueue(data: any, renderBuffer: (number)[], renderBufferChannelCount?: number, resetEffector?: boolean): number;
    startQueue(interval?: number): number;
    listenSoundLoadingStatus(sound: any, prior?: number): boolean;
    clearSoundLoadingList(): void;
    setSoundReferenceTable(soundReferenceTable?: any): void;
    play(data?: any, resetEffector?: boolean): SoundChannel;
    stop(): void;
    reset(): void;
    pause(): void;
    resume(): void;
    setBackgroundSound(sound: Sound, mixLevel?: number, loopPoint?: number): void;
    stopBackgroundSound(): void;
    setBackgroundSoundFadeTime(fadeInTime: number, fadeOutTime: number, gapTime: number): void;
    fadeIn(time: number): void;
    fadeOut(time: number): void;
    setTimerInterruption(length16th?: number, callback?: (...args: any[]) => any | null): void;
    setBeatCallbackInterval(length16th?: number): void;
    forceDispatchStreamEvent(dispatch?: boolean): void;
    setWaveTable(index: number, table: (number)[]): SiOPMWaveTable;
    setPCMWave(index: number, data: any, samplingNote?: number, keyRangeFrom?: number, keyRangeTo?: number, srcChannelCount?: number, channelCount?: number): SiOPMWavePCMData;
    setSamplerWave(index: number, data: any, ignoreNoteOff?: boolean, pan?: number, srcChannelCount?: number, channelCount?: number): SiOPMWaveSamplerData;
    setPCMVoice(index: number, voice: SiONVoice): void;
    setSamplerTable(bank: number, table: SiOPMWaveSamplerTable): void;
    setPCMData(index: number, data: (number)[], samplingOctave?: number, keyRangeFrom?: number, keyRangeTo?: number, isSourceDataStereo?: boolean): SiOPMWavePCMData;
    setPCMSound(index: number, sound: Sound, samplingOctave?: number, keyRangeFrom?: number, keyRangeTo?: number): SiOPMWavePCMData;
    setSamplerData(index: number, data: (number)[], ignoreNoteOff?: boolean, channelCount?: number): SiOPMWaveSamplerData;
    setSamplerSound(index: number, sound: Sound, ignoreNoteOff?: boolean, channelCount?: number): SiOPMWaveSamplerData;
    setEnvelopTable(index: number, table: (number)[], loopPoint?: number): void;
    setVoice(index: number, voice: SiONVoice): void;
    clearAllUserTables(): void;
    playSound(sampleNumber: number, length?: number, delay?: number, quant?: number, trackID?: number, isDisposable?: boolean): SiMMLTrack;
    noteOn(note: number, voice?: SiONVoice | null, length?: number, delay?: number, quant?: number, trackID?: number, isDisposable?: boolean): SiMMLTrack;
    noteOff(note: number, trackID?: number, delay?: number, quant?: number, stopImmediately?: boolean): (SiMMLTrack)[];
    sequenceOn(data: SiONData, voice?: SiONVoice | null, length?: number, delay?: number, quant?: number, trackID?: number, isDisposable?: boolean): (SiMMLTrack)[];
    sequenceOff(trackID: number, delay?: number, quant?: number, stopWithReset?: boolean): (SiMMLTrack)[];
    newUserControlableTrack(trackID?: number): SiMMLTrack;
    dispatchUserDefinedTrackEvent(eventTriggerID: number, note: number): void;
    _checkMIDIEventListeners(): number;
    _dispatchMIDIEvent(type: string, track: SiMMLTrack, channelNumber: number, note: number, data: number): void;
}
export type SiONDriver = SiONDriverMembers;
export interface SiONDriverConstructor {
    new (bufferLength?: number, channelCount?: number, sampleRate?: number, bitRate?: number): SiONDriver;
    readonly VERSION: string;
    readonly NEM_IGNORE: number;
    readonly NEM_REJECT: number;
    readonly NEM_OVERWRITE: number;
    readonly NEM_SHIFT: number;
    mutex: SiONDriver;
    allowPluralDrivers: boolean;
}
export declare const SiONDriver: SiONDriverConstructor;
export interface SiONDriverJobMembers {
    mml: string;
    buffer: (number)[];
    data: SiONData;
    channelCount: number;
    resetEffector: boolean;
}
export type SiONDriverJob = SiONDriverJobMembers;
export interface SiONDriverJobConstructor {
    new (mml_: string, buffer_: (number)[], data_: SiONData, channelCount_: number, resetEffector_: boolean): SiONDriverJob;
}
export declare const SiONDriverJob: SiONDriverJobConstructor;
export interface SiONVoiceMembers {
    name: string;
    clone(): SiONVoice;
    param: any[];
    paramOPL: any[];
    paramOPM: any[];
    paramOPN: any[];
    paramOPX: any[];
    paramMA3: any[];
    paramAL: any[];
    getMML(index: number, type?: string | null, appendPostfixMML?: boolean): string;
    setByMML(mml: string): number;
    initialize(): void;
    setWaveTable(data: (number)[]): SiOPMWaveTable;
    setPCMVoice(data: any, samplingNote?: number, srcChannelCount?: number, channelCount?: number): SiOPMWavePCMData;
    setMP3Voice(wave: Sound, ignoreNoteOff?: boolean, channelCount?: number): SiOPMWaveSamplerData;
    setPCMWave(index: number, data: any, samplingNote?: number, keyRangeFrom?: number, keyRangeTo?: number, srcChannelCount?: number, channelCount?: number): SiOPMWavePCMData;
    setSamplerWave(index: number, data: any, ignoreNoteOff?: boolean, pan?: number, srcChannelCount?: number, channelCount?: number): SiOPMWaveSamplerData;
    setSamplerTable(table: SiOPMWaveSamplerTable): SiONVoice;
    setPMSGuitar(ar?: number, dr?: number, tl?: number, fixedPitch?: number, ws?: number, tension?: number): SiONVoice;
    setAnalogLike(connectionType: number, ws1?: number, ws2?: number, balance?: number, vco2pitch?: number): SiONVoice;
    setEnvelop(ar: number, dr: number, sr: number, rr: number, sl: number, tl: number): SiONVoice;
    setFilterEnvelop(filterType?: number, cutoff?: number, resonance?: number, far?: number, fdr1?: number, fdr2?: number, frr?: number, fdc1?: number, fdc2?: number, fsc?: number, frc?: number): SiONVoice;
    setLPFEnvelop(cutoff?: number, resonance?: number, far?: number, fdr1?: number, fdr2?: number, frr?: number, fdc1?: number, fdc2?: number, fsc?: number, frc?: number): SiONVoice;
    setAmplitudeModulation(depth?: number, end_depth?: number, delay?: number, term?: number): SiONVoice;
    setPitchModulation(depth?: number, end_depth?: number, delay?: number, term?: number): SiONVoice;
}
export type SiONVoice = Omit<SiMMLVoice, keyof SiONVoiceMembers> & SiONVoiceMembers;
export interface SiONVoiceConstructor {
    new (moduleType?: number, channelNum?: number, ar?: number, rr?: number, dt?: number, connectionType?: number, ws2?: number, dt2?: number): SiONVoice;
    readonly CHIPTYPE_SIOPM: string;
    readonly CHIPTYPE_OPL: string;
    readonly CHIPTYPE_OPM: string;
    readonly CHIPTYPE_OPN: string;
    readonly CHIPTYPE_OPX: string;
    readonly CHIPTYPE_MA3: string;
    readonly CHIPTYPE_PMS_GUITAR: string;
    readonly CHIPTYPE_ANALOG_LIKE: string;
}
export declare const SiONVoice: SiONVoiceConstructor;
export interface BPMAnalyzerMembers {
    filterbanks: (PeakDetector)[];
    bpm: number;
    bpmProbability: number;
    pickedupCount: number;
    pickedupBPMList: (number)[];
    pickedupBPMProbabilityList: (number)[];
    snapShotPosition: number;
    estimateBPM(sound: Sound, rememberFilterbanksSnapShot?: boolean): number;
    estimateBPMFromSamples(sample: (number)[], channels: number): number;
}
export type BPMAnalyzer = BPMAnalyzerMembers;
export interface BPMAnalyzerConstructor {
    new (filterbankCount?: number): BPMAnalyzer;
}
export declare const BPMAnalyzer: BPMAnalyzerConstructor;
export interface ChordMembers {
    name: string;
    bassNote: number;
    copyFrom(src: Scale): Scale;
}
export type Chord = Omit<Scale, keyof ChordMembers> & ChordMembers;
export interface ChordConstructor {
    new (chordName?: string, defaultCenterOctave?: number): Chord;
}
export declare const Chord: ChordConstructor;
export interface FaderMembers {
    isActive: boolean;
    isIncrement: boolean;
    value: number;
    setFade(callback: (...args: any[]) => any, valueFrom?: number, valueTo?: number, frames?: number): Fader;
    execute(): boolean;
    stop(): void;
}
export type Fader = FaderMembers;
export interface FaderConstructor {
    new (callback?: (...args: any[]) => any | null, valueFrom?: number, valueTo?: number, frames?: number): Fader;
}
export declare const Fader: FaderConstructor;
export interface MMLTalksParserMembers {
}
export type MMLTalksParser = MMLTalksParserMembers;
export interface MMLTalksParserConstructor {
    new (): MMLTalksParser;
    presetVoices: SiONPresetVoice;
    allowMIDIFile: boolean;
    initialize(driver: SiONDriver, onError?: (...args: any[]) => any | null, onProgress?: (...args: any[]) => any | null): void;
    setURL(url: string): SoundLoaderFileData;
    compile(mml: string, onComplete: (...args: any[]) => any, data?: SiONData | null): void;
}
export declare const MMLTalksParser: MMLTalksParserConstructor;
export interface PCMSampleMembers {
    sampleType: number;
    baseNote: number;
    beatCount: number;
    timeSignatureDenominator: number;
    timeSignatureNumber: number;
    bpm: number;
    samples: (number)[];
    sampleLength: number;
    sampleRate: number;
    channels: number;
    bitRate: number;
    waveDataChunks: any;
    waveData: ByteArray;
    waveDataSampleRate: number;
    waveDataBitRate: number;
    waveDataChannels: number;
    internalSampleRate: number;
    internalChannels: number;
    toString(): string;
    loadFromVector(src: (number)[], srcChannels?: number, srcSampleRate?: number, linear?: boolean): PCMSample;
    appendSamples(src: (number)[], sampleCount?: number, srcOffset?: number): PCMSample;
    appendSamplesFromByteArrayFloat(bytes: ByteArray, sampleCount?: number): PCMSample;
    extract(dst?: (number)[] | null, length?: number, offset?: number): (number)[];
    clearCache(): PCMSample;
    clearWaveDataCache(): PCMSample;
    loadWaveFromByteArray(waveFile: ByteArray): PCMSample;
    saveWaveAsByteArray(): ByteArray;
}
export type PCMSample = PCMSampleMembers;
export interface PCMSampleConstructor {
    new (channels?: number, sampleRate?: number, samples?: (number)[] | null): PCMSample;
    basicInfoChunkID: string;
    extendedInfoChunkID: string;
    readSTRCChunk(strcChunk: ByteArray): any[];
}
export declare const PCMSample: PCMSampleConstructor;
export interface PeakDetectorMembers {
    windowLength: number;
    frequency: number;
    bandWidth: number;
    signalToNoiseRatio: number;
    samples: (number)[];
    samplesChannelCount: number;
    powerProfile: (number)[];
    differencialOfLogPowerProfile: (number)[];
    average: number;
    maximum: number;
    peakList: (number)[];
    peaksPerMinuteEstimationScoreTable: (number)[];
    peaksPerMinute: number;
    peaksPerMinuteProbability: number;
    setSamples(samples: (number)[], channelCount?: number, isStreaming?: boolean): PeakDetector;
    calcPeakIntencity(peakPosition: number, integrateLength?: number): number;
}
export type PeakDetector = PeakDetectorMembers;
export interface PeakDetectorConstructor {
    new (frequency?: number, bandWidth?: number, windowLength?: number, signalToNoiseRatio?: number): PeakDetector;
    maxPeaksPerMinute: number;
    mergePeakList(arrayOfPeakList: any[], singlePeakLength?: number): (number)[];
    calcPeaksPerMinuteEstimationScoreTable(peakList: (number)[], scoreTable?: (number)[] | null): (number)[];
}
export declare const PeakDetector: PeakDetectorConstructor;
export interface ScaleMembers {
    name: string;
    centerOctave: number;
    rootNote: number;
    bassNote: number;
    setScaleTable(name: string, rootNote: number, table: any[]): void;
    check(note: number): boolean;
    shift(note: number): number;
    getScaleIndex(note: number): number;
    getNote(index: number): number;
    copyFrom(src: Scale): Scale;
}
export type Scale = ScaleMembers;
export interface ScaleConstructor {
    new (scaleName?: string, defaultCenterOctave?: number): Scale;
}
export declare const Scale: ScaleConstructor;
export interface SiONPresetVoiceMembers {
    [key: string]: any;
    categolies: any[];
    waveTables: any[];
    waveTablesHex: any[];
}
export type SiONPresetVoice = SiONPresetVoiceMembers;
export interface SiONPresetVoiceConstructor {
    new (includeFlag?: number): SiONPresetVoice;
    readonly INCLUDE_DEFAULT: number;
    readonly INCLUDE_VALSOUND: number;
    readonly INCLUDE_MIDI: number;
    readonly INCLUDE_MIDIDRUM: number;
    readonly INCLUDE_WAVETABLE: number;
    readonly INCLUDE_SINGLE_DRUM: number;
    readonly INCLUDE_YM2413: number;
    readonly INCLUDE_VC7: number;
    readonly INCLUDE_ALL: number;
    mutex: SiONPresetVoice;
}
export declare const SiONPresetVoice: SiONPresetVoiceConstructor;
export interface SiONUtilMembers {
}
export type SiONUtil = SiONUtilMembers;
export interface SiONUtilConstructor {
    new (): SiONUtil;
    logTrans(data: Sound, dst?: (number)[] | null, dstChannelCount?: number, sampleMax?: number, startPosition?: number, maximize?: boolean): (number)[];
    logTransVector(src: (number)[], srcChannelCount?: number, dst?: (number)[] | null, dstChannelCount?: number, maximize?: boolean): (number)[];
    logTransByteArray(src: ByteArray, dst?: (number)[] | null, dstChannelCount?: number, maximize?: boolean): (number)[];
    extract(src: Sound, dst?: (number)[] | null, dstChannelCount?: number, length?: number, startPosition?: number): (number)[];
    extractDPCM(src: ByteArray, initValue?: number, dst?: (number)[] | null, dstChannelCount?: number): (number)[];
    extractYM2151ADPCM(src: ByteArray, dst?: (number)[] | null, dstChannelCount?: number): (number)[];
    extractYM2608ADPCM(src: ByteArray, dst?: (number)[] | null, dstChannelCount?: number): (number)[];
    calcSampleLength(bpm: number, beat16?: number): number;
    getHeadSilence(src: Sound, rmsThreshold?: number): number;
    getEndGap(src: Sound, rmsThreshold?: number, maxLength?: number): number;
    getPeakDistance(sample: (number)[]): number;
    waveColor(color: number, waveType?: number, dst?: (number)[] | null): (number)[];
}
export declare const SiONUtil: SiONUtilConstructor;
export interface SoundClassMembers {
}
export type SoundClass = SoundClassMembers;
export interface SoundClassConstructor {
    new (): SoundClass;
    loadMP3FromByteArray(bytes: ByteArray, onComplete: (...args: any[]) => any): void;
    loadPCMFromByteArray(src: ByteArray, onComplete: (...args: any[]) => any, compressed?: boolean, sampleRate?: number, bitRate?: number, channels?: number): void;
    create(samples: (number)[], onComplete: (...args: any[]) => any): void;
}
export declare const SoundClass: SoundClassConstructor;
export interface SiONSoundFontMembers {
    sounds: any;
    envelopes: (SiMMLEnvelopTable)[];
    waveTables: (SiOPMWaveTable)[];
    fmVoices: (SiONVoice)[];
    pcmVoices: (SiONVoice)[];
    samplerTables: (SiOPMWaveSamplerTable)[];
    defaultFPS: number;
    defaultVelocityMode: number;
    defaultExpressionMode: number;
    defaultVCommandShift: number;
    apply(data?: SiONData | null, pcmVoiceOffset?: number, samplerTableOffset?: number, fmVoiceOffset?: number, waveTableOffset?: number, envelopeOffset?: number): void;
}
export type SiONSoundFont = SiONSoundFontMembers;
export interface SiONSoundFontConstructor {
    new (sounds?: any): SiONSoundFont;
}
export declare const SiONSoundFont: SiONSoundFontConstructor;
export interface SiONSoundFontContainerMembers {
    sounds: any;
    mml: string;
    version: string;
}
export type SiONSoundFontContainer = SiONSoundFontContainerMembers;
export interface SiONSoundFontContainerConstructor {
    new (): SiONSoundFontContainer;
}
export declare const SiONSoundFontContainer: SiONSoundFontContainerConstructor;
export interface SiONSoundFontLoaderMembers {
    soundFont: SiONSoundFont;
    bytesLoaded: number;
    bytesTotal: number;
    load(url: any, loadAsBinary?: boolean, checkPolicyFile?: boolean): void;
    loadBytes(bytes: ByteArray): void;
}
export type SiONSoundFontLoader = SiONSoundFontLoaderMembers;
export interface SiONSoundFontLoaderConstructor {
    new (): SiONSoundFontLoader;
}
export declare const SiONSoundFontLoader: SiONSoundFontLoaderConstructor;
export interface SoundLoaderMembers {
    hash: any;
    bytesTotal: number;
    bytesLoaded: number;
    loadingFileCount: number;
    loadedFileCount: number;
    loadImgFileAsSoundFont: boolean;
    loadMP3FileAsBinary: boolean;
    rememberHistory: boolean;
    toString(): string;
    setURL(urlRequest: any, id?: string | null, type?: string | null, checkPolicyFile?: boolean): SoundLoaderFileData;
    setByteArraySound(byteArray: ByteArray, id: string): SoundLoaderFileData;
    setByteArrayImage(byteArray: ByteArray, id: string): SoundLoaderFileData;
    loadAll(): number;
}
export type SoundLoader = SoundLoaderMembers;
export interface SoundLoaderConstructor {
    new (eventPriority?: number, loadImgFileAsSoundFont?: boolean, loadMP3FileAsBinary?: boolean, rememberHistory?: boolean): SoundLoader;
}
export declare const SoundLoader: SoundLoaderConstructor;
export interface SoundLoaderFileDataMembers {
    dataID: string;
    data: any;
    urlString: string;
    type: string;
    bytesLoaded: number;
    bytesTotal: number;
}
export type SoundLoaderFileData = SoundLoaderFileDataMembers;
export interface SoundLoaderFileDataConstructor {
    new (soundLoader: SoundLoader, id: string, urlRequest: any, byteArray: ByteArray, ext: string, checkPolicyFile: boolean): SoundLoaderFileData;
}
export declare const SoundLoaderFileData: SoundLoaderFileDataConstructor;
export interface TranslatorMembers {
}
export type Translator = TranslatorMembers;
export interface TranslatorConstructor {
    new (): Translator;
    mckc(mckcMML: string): string;
    flmml(flMML: string): string;
    tsscp(tsscpMML: string, volumeByX?: boolean): string;
    parseEffectorMML(mml: string, postfix?: string): any[];
    parseParam(param: SiOPMChannelParam, dataString: string): SiOPMChannelParam;
    parseOPLParam(param: SiOPMChannelParam, dataString: string): SiOPMChannelParam;
    parseOPMParam(param: SiOPMChannelParam, dataString: string): SiOPMChannelParam;
    parseOPNParam(param: SiOPMChannelParam, dataString: string): SiOPMChannelParam;
    parseOPXParam(param: SiOPMChannelParam, dataString: string): SiOPMChannelParam;
    parseMA3Param(param: SiOPMChannelParam, dataString: string): SiOPMChannelParam;
    parseALParam(param: SiOPMChannelParam, dataString: string): SiOPMChannelParam;
    setParam(param: SiOPMChannelParam, data: any[]): SiOPMChannelParam;
    setOPLParam(param: SiOPMChannelParam, data: any[]): SiOPMChannelParam;
    setOPMParam(param: SiOPMChannelParam, data: any[]): SiOPMChannelParam;
    setOPNParam(param: SiOPMChannelParam, data: any[]): SiOPMChannelParam;
    setOPXParam(param: SiOPMChannelParam, data: any[]): SiOPMChannelParam;
    setMA3Param(param: SiOPMChannelParam, data: any[]): SiOPMChannelParam;
    setALParam(param: SiOPMChannelParam, data: any[]): SiOPMChannelParam;
    getParam(param: SiOPMChannelParam): any[];
    getOPLParam(param: SiOPMChannelParam): any[];
    getOPMParam(param: SiOPMChannelParam): any[];
    getOPNParam(param: SiOPMChannelParam): any[];
    getOPXParam(param: SiOPMChannelParam): any[];
    getMA3Param(param: SiOPMChannelParam): any[];
    getALParam(param: SiOPMChannelParam): any[];
    mmlParam(param: SiOPMChannelParam, separator?: string, lineEnd?: string, comment?: string | null): string;
    mmlOPLParam(param: SiOPMChannelParam, separator?: string, lineEnd?: string, comment?: string | null): string;
    mmlOPMParam(param: SiOPMChannelParam, separator?: string, lineEnd?: string, comment?: string | null): string;
    mmlOPNParam(param: SiOPMChannelParam, separator?: string, lineEnd?: string, comment?: string | null): string;
    mmlOPXParam(param: SiOPMChannelParam, separator?: string, lineEnd?: string, comment?: string | null): string;
    mmlMA3Param(param: SiOPMChannelParam, separator?: string, lineEnd?: string, comment?: string | null): string;
    mmlALParam(param: SiOPMChannelParam, separator?: string, lineEnd?: string, comment?: string | null): string;
    extractSystemCommand(mml: string): any[];
    parseVoiceSetting(voice: SiMMLVoice, mml: string, envelopes?: (SiMMLEnvelopTable)[] | null): SiMMLVoice;
    mmlVoiceSetting(voice: SiMMLVoice): string;
    parseTableNumbers(tableNumbers: string, postfix: string, maxIndex?: number): any;
    parseWAV(tableNumbers: string, postfix: string): (number)[];
    parseWAVB(hex: string): (number)[];
    parseSamplerWave(table: SiOPMWaveSamplerTable, noteNumber: number, mml: string, soundReferTable: any): boolean;
    parsePCMWave(table: SiOPMWavePCMTable, mml: string, soundReferTable: any): boolean;
    parsePCMVoice(voice: SiMMLVoice, mml: string, postfix: string, envelopes?: (SiMMLEnvelopTable)[] | null): boolean;
    setOPMVoicesByRegister(regData: (number)[], address: number, enableLFO?: boolean, voiceSet?: any[] | null): any[];
    errorToneParameterNotValid(cmd: string, chParam: number, opParam: number): Error;
    errorParameterNotValid(cmd: string, param: string): Error;
    errorTranslation(str: string): Error;
    errorUnknown(str: string): Error;
}
export declare const Translator: TranslatorConstructor;
export interface ArpeggiatorMembers {
    note: number;
    scale: Scale;
    scaleName: string;
    scaleIndex: number;
    noteLength: number;
    pattern: any[];
    changePatternOnNextSegment: boolean;
    noteQuantize: number;
    reset(): void;
}
export type Arpeggiator = Omit<PatternSequencer, keyof ArpeggiatorMembers> & ArpeggiatorMembers;
export interface ArpeggiatorConstructor {
    new (scale?: any, noteLength?: number, pattern?: any[] | null): Arpeggiator;
}
export declare const Arpeggiator: ArpeggiatorConstructor;
export interface BassSequencerMembers {
    presetPattern: BassSequencerPresetPattern;
    note: number;
    scale: Scale;
    chordName: string;
    patternNumberMax: number;
    patternNumber: number;
    pattern: any[];
    changePatternOnNextSegment: boolean;
}
export type BassSequencer = Omit<PatternSequencer, keyof BassSequencerMembers> & BassSequencerMembers;
export interface BassSequencerConstructor {
    new (chord?: any, patternNumber?: number, changePatternOnSegment?: boolean): BassSequencer;
}
export declare const BassSequencer: BassSequencerConstructor;
export interface ChordPadMembers {
    operators: (Sequencer)[];
    operatorCount: number;
    note: number;
    chord: Chord;
    chordName: string;
    voiceMode: number;
    noteLength: number;
    pattern: any[];
    changePatternOnSegment: boolean;
    play(): void;
    stop(): void;
}
export type ChordPad = Omit<MultiTrackSoundObject, keyof ChordPadMembers> & ChordPadMembers;
export interface ChordPadConstructor {
    new (chord?: any, operatorCount?: number, voiceMode?: number, pattern?: any[] | null, changePatternOnSegment?: boolean): ChordPad;
    readonly CLOSED: number;
    readonly OPENED: number;
    readonly MIDDLE: number;
    readonly HIGH: number;
    readonly OPENED_HIGH: number;
}
export declare const ChordPad: ChordPadConstructor;
export interface EffectChainMembers {
    isActive: boolean;
    effectList: any[];
    streamingBuffer: SiOPMStream;
    _activateLocalEffect(depth: number): void;
    _inactivateLocalEffect(): void;
    setAllStreamSendLevels(volumes: (number)[]): void;
    setStreamSend(slot: number, volume: number): void;
    connectTo(ec: EffectChain): void;
    free(): void;
}
export type EffectChain = EffectChainMembers;
export interface EffectChainConstructor {
    new (...list: any[]): EffectChain;
    alloc(effectList: any[]): EffectChain;
}
export declare const EffectChain: EffectChainConstructor;
export interface DrumMachineMembers {
    presetVoice: DrumMachinePresetVoice;
    presetPattern: DrumMachinePresetPattern;
    bassPatternNumberMax: number;
    snarePatternNumberMax: number;
    hihatPatternNumberMax: number;
    bassVoiceNumberMax: number;
    snareVoiceNumberMax: number;
    hihatVoiceNumberMax: number;
    bass: Sequencer;
    snare: Sequencer;
    hihat: Sequencer;
    bassPattern: (Note)[];
    snarePattern: (Note)[];
    hihatPattern: (Note)[];
    bassPatternNumber: number;
    snarePatternNumber: number;
    hihatPatternNumber: number;
    bassVoiceNumber: number;
    snareVoiceNumber: number;
    hihatVoiceNumber: number;
    bassVolume: number;
    snareVolume: number;
    hihatVolume: number;
    changePatternOnNextSegment: boolean;
    play(): void;
    stop(): void;
    setPatternNumbers(bassPatternNumber: number, snarePatternNumber: number, hihatPatternNumber: number): DrumMachine;
}
export type DrumMachine = Omit<MultiTrackSoundObject, keyof DrumMachineMembers> & DrumMachineMembers;
export interface DrumMachineConstructor {
    new (bassPatternNumber?: number, snarePatternNumber?: number, hihatPatternNumber?: number, bassVoiceNumber?: number, snareVoiceNumber?: number, hihatVoiceNumber?: number): DrumMachine;
}
export declare const DrumMachine: DrumMachineConstructor;
export interface FlashSoundPlayerEventMembers {
    _sound: Sound;
    _onComplete: (...args: any[]) => any;
    _onError: (...args: any[]) => any;
    _keyRangeFrom: number;
    _keyRangeTo: number;
    _startPoint: number;
    _endPoint: number;
    _loopPoint: number;
    sound: Sound;
    keyRangeFrom: number;
    keyRangeTo: number;
}
export type FlashSoundPlayerEvent = FlashSoundPlayerEventMembers;
export interface FlashSoundPlayerEventConstructor {
    new (sound: Sound, onComplete: (...args: any[]) => any, onError: (...args: any[]) => any, keyRangeFrom: number, keyRangeTo: number, startPoint: number, endPoint: number, loopPoint: number): FlashSoundPlayerEvent;
    readonly COMPLETE: string;
}
export declare const FlashSoundPlayerEvent: FlashSoundPlayerEventConstructor;
export interface SoundObjectEventMembers {
    _soundObject: SoundObject;
    _track: SiMMLTrack;
    _eventTriggerID: number;
    _note: number;
    _bufferIndex: number;
    soundObject: SoundObject;
    track: SiMMLTrack;
    eventTriggerID: number;
    note: number;
    bufferIndex: number;
}
export type SoundObjectEvent = SoundObjectEventMembers;
export interface SoundObjectEventConstructor {
    new (type: string, soundObject: SoundObject, trackEvent: SiONTrackEvent): SoundObjectEvent;
    readonly NOTE_ON_STREAM: string;
    readonly NOTE_OFF_STREAM: string;
    readonly NOTE_ON_FRAME: string;
    readonly NOTE_OFF_FRAME: string;
    readonly ENTER_FRAME: string;
    readonly ENTER_SEGMENT: string;
}
export declare const SoundObjectEvent: SoundObjectEventConstructor;
export interface FlashSoundPlayerMembers {
    soundData: Sound;
    isPlaying: boolean;
    isSoundDataAvailable: boolean;
    voice: SiONVoice;
    synthesizer: VoiceReference;
    play(): void;
    stop(): void;
    load(url: any, context?: any): void;
    setSoundData(sound: Sound, keyRangeFrom?: number, keyRangeTo?: number, startPoint?: number, endPoint?: number, loopPoint?: number): void;
}
export type FlashSoundPlayer = Omit<PatternSequencer, keyof FlashSoundPlayerMembers> & FlashSoundPlayerMembers;
export interface FlashSoundPlayerConstructor {
    new (soundData?: Sound | null): FlashSoundPlayer;
}
export declare const FlashSoundPlayer: FlashSoundPlayerConstructor;
export interface MDXDataMembers {
    isPCM8: boolean;
    bpm: number;
    title: string;
    pdxFileName: string;
    voices: (SiONVoice)[];
    tracks: (MDXTrack)[];
    executors: (MDXExecutor)[];
    isAvailable(): boolean;
    toString(): string;
    clear(): MDXData;
    convertToSiONData(data?: SiONData | null, pdxData?: PDXData | null): SiONData;
    loadBytes(bytes: ByteArray): MDXData;
}
export type MDXData = Omit<AbstructLoader, keyof MDXDataMembers> & MDXDataMembers;
export interface MDXDataConstructor {
    new (url?: any): MDXData;
    loadPDXDataAutomaticaly: boolean;
}
export declare const MDXData: MDXDataConstructor;
export interface MDXEventMembers {
    type: number;
    data: number;
    data2: number;
    deltaClock: number;
    toString(): string;
}
export type MDXEvent = MDXEventMembers;
export interface MDXEventConstructor {
    new (type: number, data: number, data2: number, deltaClock: number): MDXEvent;
    readonly REST: number;
    readonly NOTE: number;
    readonly TIMERB: number;
    readonly REGISTER: number;
    readonly VOICE: number;
    readonly PAN: number;
    readonly VOLUME: number;
    readonly VOLUME_DEC: number;
    readonly VOLUME_INC: number;
    readonly GATE: number;
    readonly SLUR: number;
    readonly REPEAT_BEGIN: number;
    readonly REPEAT_END: number;
    readonly REPEAT_BREAK: number;
    readonly DETUNE: number;
    readonly PORTAMENT: number;
    readonly DATA_END: number;
    readonly KEY_ON_DELAY: number;
    readonly SYNC_SEND: number;
    readonly SYNC_WAIT: number;
    readonly FREQUENCY: number;
    readonly PITCH_LFO: number;
    readonly VOLUME_LFO: number;
    readonly OPM_LFO: number;
    readonly LFO_DELAY: number;
    readonly SET_PCM8: number;
    readonly FADEOUT: number;
}
export declare const MDXEvent: MDXEventConstructor;
export interface MDXExecutorMembers {
}
export type MDXExecutor = MDXExecutorMembers;
export interface MDXExecutorConstructor {
    new (): MDXExecutor;
}
export declare const MDXExecutor: MDXExecutorConstructor;
export interface MDXTrackMembers {
    sequence: (MDXEvent)[];
    segnoPointer: MDXEvent;
    timerB: number;
    owner: MDXData;
    channelNumber: number;
    hasNoData: boolean;
    toString(): string;
    clear(): MDXTrack;
    loadBytes(bytes: ByteArray): MDXTrack;
}
export type MDXTrack = MDXTrackMembers;
export interface MDXTrackConstructor {
    new (owner: MDXData, channelNumber: number): MDXTrack;
}
export declare const MDXTrack: MDXTrackConstructor;
export interface PDXDataMembers {
    fileName: string;
    adpcmData: (ByteArray)[];
    pcmData: (any)[];
    clear(): PDXData;
    loadBytes(bytes: ByteArray, extractAll?: boolean): PDXData;
    extract(noteNumber: number): (number)[];
}
export type PDXData = Omit<AbstructLoader, keyof PDXDataMembers> & PDXDataMembers;
export interface PDXDataConstructor {
    new (): PDXData;
}
export declare const PDXData: PDXDataConstructor;
export interface PDXDataStorageMembers {
    [key: string]: any;
    clear(): void;
    load(url: any): PDXData;
    extractFileName(url: string): string;
}
export type PDXDataStorage = PDXDataStorageMembers;
export interface PDXDataStorageConstructor {
    new (): PDXDataStorage;
}
export declare const PDXDataStorage: PDXDataStorageConstructor;
export interface MMLPlayerMembers {
    mml: string;
    data: SiONData;
    controlTrackNumber: number;
    trackCount: number;
    soloTrackNumber: number;
    coarseTune: number;
    fineTune: number;
    gateTime: number;
    eventMask: number;
    mute: boolean;
    volume: number;
    pan: number;
    effectSend1: number;
    effectSend2: number;
    effectSend3: number;
    effectSend4: number;
    pitchBend: number;
    play(): void;
    stop(): void;
}
export type MMLPlayer = Omit<SoundObject, keyof MMLPlayerMembers> & MMLPlayerMembers;
export interface MMLPlayerConstructor {
    new (mml?: string | null): MMLPlayer;
}
export declare const MMLPlayer: MMLPlayerConstructor;
export interface MonophonicSynthesizerMembers {
    note: number;
    quantize: number;
    delay: number;
    play(): void;
    stop(): void;
    noteOn(note: number, velocity?: number, length?: number): void;
    noteOff(): void;
}
export type MonophonicSynthesizer = Omit<PatternSequencer, keyof MonophonicSynthesizerMembers> & MonophonicSynthesizerMembers;
export interface MonophonicSynthesizerConstructor {
    new (synth?: VoiceReference | null): MonophonicSynthesizer;
}
export declare const MonophonicSynthesizer: MonophonicSynthesizerConstructor;
export interface MultiTrackSoundObjectMembers {
    trackCount: number;
    isPlaying: boolean;
    coarseTune: number;
    fineTune: number;
    gateTime: number;
    eventMask: number;
    mute: boolean;
    pan: number;
    pitchBend: number;
    reset(): void;
    play(): void;
    stop(): void;
}
export type MultiTrackSoundObject = Omit<SoundObject, keyof MultiTrackSoundObjectMembers> & MultiTrackSoundObjectMembers;
export interface MultiTrackSoundObjectConstructor {
    new (name?: string | null, synth?: VoiceReference | null): MultiTrackSoundObject;
}
export declare const MultiTrackSoundObject: MultiTrackSoundObjectConstructor;
export interface APUMembers {
    reset(): void;
    sync(cycles: number): void;
    readReg(addr: number): number;
    writeReg(addr: number, data: number): void;
}
export type APU = APUMembers;
export interface APUConstructor {
    new (): APU;
}
export declare const APU: APUConstructor;
export interface CPUMembers {
    A: number;
    X: number;
    Y: number;
    PC: number;
    SP: number;
    P: number;
    interruptFlag: number;
    enableClockedProcess: boolean;
    wait: number;
    totalCycle: number;
    ZN_TABLE: (number)[];
    mmu: MMU;
    operations: any;
    reset(): void;
    exec(cycles: number): number;
    setNMI(): void;
    setIRQ(irqFlag: number): void;
    clearIRQ(irqFlag: number): void;
    read(addr: number): number;
    readW(addr: number): number;
    write(addr: number, data: number): void;
}
export type CPU = CPUMembers;
export interface CPUConstructor {
    new (): CPU;
    readonly CF: number;
    readonly ZF: number;
    readonly IF: number;
    readonly DF: number;
    readonly BF: number;
    readonly RF: number;
    readonly VF: number;
    readonly NF: number;
    readonly IZN: number;
    readonly NMI_FLAG: number;
    readonly IRQ_FLAG: number;
    readonly IRQ_FRAMEIRQ: number;
    readonly IRQ_DPCM: number;
    readonly IRQ_MAPPER: number;
    readonly IRQ_MAPPER2: number;
    readonly IRQ_TRIGGER: number;
    readonly IRQ_TRIGGER2: number;
    readonly $NMI: number;
    readonly $RES: number;
    readonly $IRQ: number;
}
export declare const CPU: CPUConstructor;
export interface CPUIOPortMembers {
    read(addr: number): number;
    write(addr: number, data: number): void;
}
export type CPUIOPort = Omit<MMUBank, keyof CPUIOPortMembers> & CPUIOPortMembers;
export interface CPUIOPortConstructor {
    new (): CPUIOPort;
}
export declare const CPUIOPort: CPUIOPortConstructor;
export interface MapperMembers {
    bank3WRAM: number;
    write(addr: number, data: number): void;
    readLow(addr: number): number;
    writeLow(addr: number, data: number): void;
    ExCmdRead(cmd: number): number;
    ExCmdWrite(cmd: number, data: number): void;
    ExRead(addr: number): number;
    ExWrite(addr: number, data: number): void;
    sync(cycles: number): void;
    HSync(scanline: number): void;
    VSync(): void;
    PPU_Latch(addr: number): void;
    PPU_ChrLatch(addr: number): void;
    PPU_ExtLatchX(x: number): void;
    PPU_ExtLatch(addr: number): any;
}
export type Mapper = MapperMembers;
export interface MapperConstructor {
    new (): Mapper;
}
export declare const Mapper: MapperConstructor;
export interface MapperNSFMembers {
    ExRead(addr: number): number;
    ExWrite(addr: number, data: number): void;
    overwriteCodeData(data: NSFData): void;
}
export type MapperNSF = Omit<Mapper, keyof MapperNSFMembers> & MapperNSFMembers;
export interface MapperNSFConstructor {
    new (): MapperNSF;
    readonly $WAIT: number;
    readonly $INIT: number;
    readonly $PLAY: number;
}
export declare const MapperNSF: MapperNSFConstructor;
export interface MMUMembers {
    RAM: (number)[];
    WRAM: (number)[];
    DRAM: (number)[];
    ERAM: (number)[];
    CRAM: (number)[];
    VRAM: (number)[];
    SPRAM: (number)[];
    BGPAL: (number)[];
    SPPAL: (number)[];
    PROM: ByteArray;
    VROM: ByteArray;
    onReadPPUport: (...args: any[]) => any;
    onReadCPUport: (...args: any[]) => any;
    onWritePPUport: (...args: any[]) => any;
    onWriteCPUport: (...args: any[]) => any;
    CPU_MEM_BANK: (MMUBank)[];
    reset(ram?: number, clearWRAM?: boolean): void;
}
export type MMU = MMUMembers;
export interface MMUConstructor {
    new (): MMU;
    $: MMU;
}
export declare const MMU: MMUConstructor;
export interface MMUBankMembers {
    type: number;
    read(addr: number): number;
    readW(addr: number): number;
    write(addr: number, data: number): void;
}
export type MMUBank = MMUBankMembers;
export interface MMUBankConstructor {
    new (type?: number): MMUBank;
    readonly BANK_ROM: number;
    readonly BANK_RAM: number;
    readonly BANK_DRAM: number;
    readonly BANK_MAPPER: number;
}
export declare const MMUBank: MMUBankConstructor;
export interface MMUBankRAMMembers {
    read(addr: number): number;
    write(addr: number, data: number): void;
}
export type MMUBankRAM = Omit<MMUBank, keyof MMUBankRAMMembers> & MMUBankRAMMembers;
export interface MMUBankRAMConstructor {
    new (): MMUBankRAM;
}
export declare const MMUBankRAM: MMUBankRAMConstructor;
export interface MMUBankROMMembers {
    offset: number;
    read(addr: number): number;
    write(addr: number, data: number): void;
}
export type MMUBankROM = Omit<MMUBank, keyof MMUBankROMMembers> & MMUBankROMMembers;
export interface MMUBankROMConstructor {
    new (): MMUBankROM;
}
export declare const MMUBankROM: MMUBankROMConstructor;
export interface MMUBankROMLowMembers {
    read(addr: number): number;
    write(addr: number, data: number): void;
}
export type MMUBankROMLow = Omit<MMUBankROM, keyof MMUBankROMLowMembers> & MMUBankROMLowMembers;
export interface MMUBankROMLowConstructor {
    new (): MMUBankROMLow;
}
export declare const MMUBankROMLow: MMUBankROMLowConstructor;
export interface NESMembers {
}
export type NES = NESMembers;
export interface NESConstructor {
    new (): NES;
    cpu: CPU;
    apu: APU;
    ppu: PPU;
    pad: PAD;
    rom: ROM;
    map: Mapper;
    cfg: NESconfig;
}
export declare const NES: NESConstructor;
export interface NESconfigMembers {
    cpuClock: number;
    frameRate: number;
    framePeriod: number;
    totalScanlines: number;
    scanlineCycles: number;
    hDrawCycles: number;
    hBlankCycles: number;
    scanlineEndCycles: number;
    frameCycles: number;
    frameIrqCycles: number;
}
export type NESconfig = NESconfigMembers;
export interface NESconfigConstructor {
    new (cl: number, sl: number, slc: number, hdc: number, hbc: number, sec: number, fic: number, fr: number): NESconfig;
    NTSC: NESconfig;
    PAL: NESconfig;
}
export declare const NESconfig: NESconfigConstructor;
export interface NSFDataMembers {
    version: number;
    songCount: number;
    startSongID: number;
    loadAddress: number;
    initAddress: number;
    playAddress: number;
    title: string;
    artist: string;
    copyright: string;
    speedNRSC: number;
    speedPAL: number;
    NTSC_PALbits: number;
    bankSwitch: (number)[];
    extraChipFlag: number;
    reserved: number;
    isAvailable(): boolean;
    toString(): string;
    clear(): NSFData;
    loadBytes(bytes: ByteArray): NSFData;
}
export type NSFData = NSFDataMembers;
export interface NSFDataConstructor {
    new (): NSFData;
}
export declare const NSFData: NSFDataConstructor;
export interface PADMembers {
}
export type PAD = PADMembers;
export interface PADConstructor {
    new (): PAD;
}
export declare const PAD: PADConstructor;
export interface PPUMembers {
}
export type PPU = PPUMembers;
export interface PPUConstructor {
    new (): PPU;
}
export declare const PPU: PPUConstructor;
export interface PPUIOPortMembers {
    read(addr: number): number;
    write(addr: number, data: number): void;
}
export type PPUIOPort = Omit<MMUBank, keyof PPUIOPortMembers> & PPUIOPortMembers;
export interface PPUIOPortConstructor {
    new (): PPUIOPort;
}
export declare const PPUIOPort: PPUIOPortConstructor;
export interface ROMMembers {
}
export type ROM = ROMMembers;
export interface ROMConstructor {
    new (): ROM;
}
export declare const ROM: ROMConstructor;
export interface BassSequencerPresetPatternMembers {
    [key: string]: any;
    categolies: any[];
}
export type BassSequencerPresetPattern = BassSequencerPresetPatternMembers;
export interface BassSequencerPresetPatternConstructor {
    new (): BassSequencerPresetPattern;
}
export declare const BassSequencerPresetPattern: BassSequencerPresetPatternConstructor;
export interface DrumMachinePresetPatternMembers {
    [key: string]: any;
    categolies: any[];
}
export type DrumMachinePresetPattern = DrumMachinePresetPatternMembers;
export interface DrumMachinePresetPatternConstructor {
    new (): DrumMachinePresetPattern;
}
export declare const DrumMachinePresetPattern: DrumMachinePresetPatternConstructor;
export interface NoteMembers {
    note: number;
    velocity: number;
    length: number;
    voiceIndex: number;
    gateTime: number;
    data: any;
    setNote(note?: number, velocity?: number, length?: number, voiceIndex?: number, gateTime?: number, data?: any): Note;
    setRest(): Note;
    copyFrom(src: Note): Note;
    clone(): Note;
}
export type Note = NoteMembers;
export interface NoteConstructor {
    new (note?: number, velocity?: number, length?: number, voiceIndex?: number, gateTime?: number, data?: any): Note;
}
export declare const Note: NoteConstructor;
export interface PMLParserMembers {
    rule: any;
    parse(pml: string): any[];
}
export type PMLParser = PMLParserMembers;
export interface PMLParserConstructor {
    new (rule?: any): PMLParser;
}
export declare const PMLParser: PMLParserConstructor;
export interface ScalerMembers {
    pattern: any[];
    scale: Scale;
    scaleIndex: number;
}
export type Scaler = Omit<any[], keyof ScalerMembers> & ScalerMembers;
export interface ScalerConstructor {
    new (scale?: Scale | null, pattern?: any[] | null): Scaler;
}
export declare const Scaler: ScalerConstructor;
export interface SequencerMembers {
    pattern: (Note)[];
    nextPattern: (Note)[];
    voiceList: any[];
    onEnterFrame: (...args: any[]) => any;
    onExitFrame: (...args: any[]) => any;
    onEnterSegment: (...args: any[]) => any;
    segmentFrameCount: number;
    gridStep: number;
    portament: number;
    frameCount: number;
    sequencePointer: number;
    mute: boolean;
    note: number;
    velocity: number;
    gateTime: number;
    length: number;
    eventTriggerID: number;
    noteOnTriggerType: number;
    noteOffTriggerType: number;
    defaultNote: number;
    defaultVelocity: number;
    defaultLength: number;
    defaultGateTime: number;
    division: number;
    play(track: SiMMLTrack): SiMMLTrack;
    stop(): void;
    setPortament(p: number): number;
}
export type Sequencer = SequencerMembers;
export interface SequencerConstructor {
    new (owner: SoundObject, data: SiONData, defaultNote?: number, defaultVelocity?: number, defaultLength?: number, defaultGateTime?: number, gridShiftPattern?: (number)[] | null): Sequencer;
}
export declare const Sequencer: SequencerConstructor;
export interface PatternSequencerMembers {
    sequencer: Sequencer;
    portament: number;
    note: number;
    length: number;
    gateTime: number;
    onEnterFrame: (...args: any[]) => any;
    onEnterSegment: (...args: any[]) => any;
    onExitFrame: (...args: any[]) => any;
    play(): void;
    stop(): void;
}
export type PatternSequencer = Omit<SoundObject, keyof PatternSequencerMembers> & PatternSequencerMembers;
export interface PatternSequencerConstructor {
    new (defaultNote?: number, defaultVelocity?: number, defaultLength?: number, synth?: VoiceReference | null): PatternSequencer;
}
export declare const PatternSequencer: PatternSequencerConstructor;
export interface PolyphonicSynthesizerMembers {
    reset(): void;
    play(): void;
    stop(): void;
    noteOn(note: number, velocity?: number, length?: number): void;
    noteOff(note: number, stopWithReset?: boolean): void;
}
export type PolyphonicSynthesizer = Omit<MultiTrackSoundObject, keyof PolyphonicSynthesizerMembers> & PolyphonicSynthesizerMembers;
export interface PolyphonicSynthesizerConstructor {
    new (synth?: VoiceReference | null): PolyphonicSynthesizer;
}
export declare const PolyphonicSynthesizer: PolyphonicSynthesizerConstructor;
export interface SoundObjectMembers {
    name: string;
    driver: SiONDriver;
    parent: SoundObjectContainer;
    isPlaying: boolean;
    note: number;
    voice: SiONVoice;
    synthesizer: VoiceReference;
    length: number;
    quantize: number;
    delay: number;
    coarseTune: number;
    fineTune: number;
    gateTime: number;
    eventMask: number;
    trackID: number;
    eventTriggerID: number;
    noteOnTriggerType: number;
    noteOffTriggerType: number;
    mute: boolean;
    volume: number;
    pan: number;
    effectSend1: number;
    effectSend2: number;
    effectSend3: number;
    effectSend4: number;
    pitchBend: number;
    effectors: any[];
    reset(): void;
    setVolume(slot: number, volume: number): void;
    fadeIn(time: number): void;
    fadeOut(time: number): void;
    play(): void;
    stop(): void;
}
export type SoundObject = SoundObjectMembers;
export interface SoundObjectConstructor {
    new (name?: string | null, synth?: VoiceReference | null): SoundObject;
}
export declare const SoundObject: SoundObjectConstructor;
export interface SoundObjectContainerMembers {
    numChildren: number;
    isPlaying: boolean;
    note: number;
    voice: SiONVoice;
    synthesizer: VoiceReference;
    length: number;
    quantize: number;
    delay: number;
    eventMask: number;
    eventTriggerID: number;
    coarseTune: number;
    fineTune: number;
    gateTime: number;
    effectSend1: number;
    effectSend2: number;
    effectSend3: number;
    effectSend4: number;
    pitchBend: number;
    reset(): void;
    setVolume(slot: number, volume: number): void;
    play(): void;
    stop(): void;
    addChild(sound: SoundObject): SoundObject;
    addChildAt(sound: SoundObject, index: number): SoundObject;
    removeChild(sound: SoundObject): SoundObject;
    removeChildAt(index: number): SoundObject;
    getChildAt(index: number): SoundObject;
    getChildByName(name: string): SoundObject;
    getChildIndex(sound: SoundObject): number;
    setChildIndex(child: SoundObject, index: number): SoundObject;
}
export type SoundObjectContainer = Omit<SoundObject, keyof SoundObjectContainerMembers> & SoundObjectContainerMembers;
export interface SoundObjectContainerConstructor {
    new (name?: string): SoundObjectContainer;
}
export declare const SoundObjectContainer: SoundObjectContainerConstructor;
export interface AnalogSynthMembers {
    con: number;
    ws1: number;
    ws2: number;
    balance: number;
    vco2pitch: number;
    attackTime: number;
    decayTime: number;
    sustainLevel: number;
    releaseTime: number;
    cutoff: number;
    vcfAttackTime: number;
    vcfDecayTime: number;
    vcfPeakCutoff: number;
    setVCAEnvelop(attackTime: number, decayTime: number, sustainLevel: number, releaseTime: number): AnalogSynth;
    setVCFEnvelop(cutoff?: number, resonance?: number, attackTime?: number, decayTime?: number, peakCutoff?: number): AnalogSynth;
}
export type AnalogSynth = Omit<BasicSynth, keyof AnalogSynthMembers> & AnalogSynthMembers;
export interface AnalogSynthConstructor {
    new (connectionType?: number, ws1?: number, ws2?: number, balance?: number, vco2pitch?: number): AnalogSynth;
    readonly CONNECT_NORMAL: number;
    readonly CONNECT_RING: number;
    readonly CONNECT_SYNC: number;
    readonly SAW: number;
    readonly SQUARE: number;
    readonly TRIANGLE: number;
    readonly SINE: number;
    readonly NOISE: number;
}
export declare const AnalogSynth: AnalogSynthConstructor;
export interface BasicSynthMembers {
    voice: SiONVoice;
    cutoff: number;
    resonance: number;
    filterType: number;
    lfoWaveShape: number;
    lfoCycleFrames: number;
    amplitudeModulation: number;
    pitchModulation: number;
    attackTime: number;
    releaseTime: number;
    setFilterEnvelop(filterType?: number, cutoff?: number, resonance?: number, far?: number, fdr1?: number, fdr2?: number, frr?: number, fdc1?: number, fdc2?: number, fsc?: number, frc?: number): void;
    setLPFEnvelop(cutoff?: number, resonance?: number, far?: number, fdr1?: number, fdr2?: number, frr?: number, fdc1?: number, fdc2?: number, fsc?: number, frc?: number): void;
    setAmplitudeModulation(depth?: number, end_depth?: number, delay?: number, term?: number): void;
    setPitchModulation(depth?: number, end_depth?: number, delay?: number, term?: number): void;
    _registerTrack(track: SiMMLTrack): void;
    _registerTracks(tracks: (SiMMLTrack)[]): void;
    _unregisterTracks(firstTrack: SiMMLTrack, count?: number): void;
}
export type BasicSynth = Omit<VoiceReference, keyof BasicSynthMembers> & BasicSynthMembers;
export interface BasicSynthConstructor {
    new (moduleType?: number, channelNum?: number, ar?: number, rr?: number, dt?: number): BasicSynth;
}
export declare const BasicSynth: BasicSynthConstructor;
export interface DrumMachinePresetVoiceMembers {
    [key: string]: any;
    categolies: any[];
    type: string;
    index: number;
}
export type DrumMachinePresetVoice = Omit<VoiceReference, keyof DrumMachinePresetVoiceMembers> & DrumMachinePresetVoiceMembers;
export interface DrumMachinePresetVoiceConstructor {
    new (): DrumMachinePresetVoice;
    readonly BASS: string;
    readonly SNARE: string;
    readonly HIHAT: string;
    readonly PERCUSSION: string;
}
export declare const DrumMachinePresetVoice: DrumMachinePresetVoiceConstructor;
export interface FMSynthMembers {
    operators: (FMSynthOperator)[];
    alg: number;
    fb: number;
    fbc: number;
    voice: SiONVoice;
}
export type FMSynth = Omit<BasicSynth, keyof FMSynthMembers> & FMSynthMembers;
export interface FMSynthConstructor {
    new (channelNumber?: number): FMSynth;
}
export declare const FMSynth: FMSynthConstructor;
export interface FMSynthOperatorMembers {
    ws: number;
    ar: number;
    dr: number;
    sr: number;
    rr: number;
    sl: number;
    tl: number;
    ksr: number;
    ksl: number;
    mul: number;
    dt1: number;
    dt2: number;
    det: number;
    ams: number;
    ph: number;
    fn: number;
    mute: boolean;
    ssgec: number;
    erst: boolean;
    setAllParameters(ws: number, ar: number, dr: number, sr: number, rr: number, sl: number, tl: number, ksr: number, ksl: number, mul: number, dt1: number, detune: number, ams: number, phase: number, fixNote: number): void;
}
export type FMSynthOperator = FMSynthOperatorMembers;
export interface FMSynthOperatorConstructor {
    new (owner: FMSynth, opeIndex: number): FMSynthOperator;
}
export declare const FMSynthOperator: FMSynthOperatorConstructor;
export interface IFlashSoundOperatorMembers {
}
export type IFlashSoundOperator = Omit<BasicSynth, keyof IFlashSoundOperatorMembers> & IFlashSoundOperatorMembers;
export interface IFlashSoundOperatorConstructor {
    new (): IFlashSoundOperator;
}
export declare const IFlashSoundOperator: IFlashSoundOperatorConstructor;
export interface NESSynthMembers {
    channelNumber: number;
    setEnevlop(table: any[], loopPoint?: number, step?: number): void;
    setPitchEnevlop(table: any[], loopPoint?: number, step?: number): void;
    setNoteEnevlop(table: any[], loopPoint?: number, step?: number): void;
    setToneEnevlop(table: any[], loopPoint?: number, step?: number): void;
    setEnevlopNoteOff(table: any[], loopPoint?: number, step?: number): void;
    setPitchEnevlopNoteOff(table: any[], loopPoint?: number, step?: number): void;
    setNoteEnevlopNoteOff(table: any[], loopPoint?: number, step?: number): void;
    setToneEnevlopNoteOff(table: any[], loopPoint?: number, step?: number): void;
}
export type NESSynth = Omit<BasicSynth, keyof NESSynthMembers> & NESSynthMembers;
export interface NESSynthConstructor {
    new (channelNumber?: number): NESSynth;
}
export declare const NESSynth: NESSynthConstructor;
export interface PCMSynthMembers {
    setSample(data: any, samplingNote?: number, keyRangeFrom?: number, keyRangeTo?: number, channelCount?: number): SiOPMWavePCMData;
}
export type PCMSynth = Omit<IFlashSoundOperator, keyof PCMSynthMembers> & PCMSynthMembers;
export interface PCMSynthConstructor {
    new (data?: any, samplingNote?: number, channelCount?: number): PCMSynth;
}
export declare const PCMSynth: PCMSynthConstructor;
export interface PMGuitarSynthMembers {
    tensoin: number;
    plunkVelocity: number;
    seedWaveShape: number;
    seedPitch: number;
    attackTime: number;
    releaseTime: number;
    setPMSGuitar(ar?: number, dr?: number, tl?: number, fixedPitch?: number, ws?: number, tension?: number): PMGuitarSynth;
}
export type PMGuitarSynth = Omit<BasicSynth, keyof PMGuitarSynthMembers> & PMGuitarSynthMembers;
export interface PMGuitarSynthConstructor {
    new (tension?: number): PMGuitarSynth;
}
export declare const PMGuitarSynth: PMGuitarSynthConstructor;
export interface PresetVoiceLoaderMembers {
    voiceNumber: number;
    voiceNumberMax: number;
}
export type PresetVoiceLoader = Omit<VoiceReference, keyof PresetVoiceLoaderMembers> & PresetVoiceLoaderMembers;
export interface PresetVoiceLoaderConstructor {
    new (categoly: string): PresetVoiceLoader;
}
export declare const PresetVoiceLoader: PresetVoiceLoaderConstructor;
export interface PSGSynthMembers {
    channelNumber: number;
    channelMode: number;
    noiseFreq: number;
    channelGain: number;
    envelopControlMode: number;
    envelopFreq: number;
}
export type PSGSynth = Omit<BasicSynth, keyof PSGSynthMembers> & PSGSynthMembers;
export interface PSGSynthConstructor {
    new (channelNumber?: number): PSGSynth;
}
export declare const PSGSynth: PSGSynthConstructor;
export interface SamplerSynthMembers {
    ignoreNoteOff: boolean;
    setSample(data: any, ignoreNoteOff?: boolean, keyRangeFrom?: number, keyRangeTo?: number, channelCount?: number): SiOPMWaveSamplerData;
}
export type SamplerSynth = Omit<IFlashSoundOperator, keyof SamplerSynthMembers> & SamplerSynthMembers;
export interface SamplerSynthConstructor {
    new (data?: any, ignoreNoteOff?: boolean, channelCount?: number): SamplerSynth;
}
export declare const SamplerSynth: SamplerSynthConstructor;
export interface VoiceReferenceMembers {
    _voice: SiONVoice;
    _voiceUpdateNumber: number;
    voice: SiONVoice;
    _registerTrack(track: SiMMLTrack): void;
    _registerTracks(tracks: (SiMMLTrack)[]): void;
    _unregisterTracks(firstTrack: SiMMLTrack, count?: number): void;
}
export type VoiceReference = VoiceReferenceMembers;
export interface VoiceReferenceConstructor {
    new (): VoiceReference;
}
export declare const VoiceReference: VoiceReferenceConstructor;
export interface WaveTableSynthMembers {
    wavelet: (number)[];
    color: number;
    layerType: string;
    layerDetune: number;
    updateWavelet(): void;
}
export type WaveTableSynth = Omit<BasicSynth, keyof WaveTableSynthMembers> & WaveTableSynthMembers;
export interface WaveTableSynthConstructor {
    new (layerType?: string, waveColor?: number): WaveTableSynth;
    readonly SINGLE: string;
    readonly DETUNE: string;
    readonly TRIPLE_DETUNE: string;
    readonly POWER: string;
    readonly DETUNE_POWER: string;
    readonly SUS4: string;
    readonly SUS2: string;
}
export declare const WaveTableSynth: WaveTableSynthConstructor;
export interface AbstructLoaderMembers {
    load(url: any): void;
    addChild(child: AbstructLoader): void;
}
export type AbstructLoader = AbstructLoaderMembers;
export interface AbstructLoaderConstructor {
    new (priority?: number): AbstructLoader;
}
export declare const AbstructLoader: AbstructLoaderConstructor;
export interface ByteArrayExtMembers {
    name: string;
    fromBitmapData(bmd: any): ByteArrayExt;
    toBitmapData(width?: number, height?: number, transparent?: boolean, fillColor?: number): any;
    toPNGData(width?: number, height?: number): ByteArrayExt;
    writeChunk(chunkID: string, data: ByteArray, listType?: string | null): void;
    readChunk(bytes: ByteArray, offset?: number, searchChunkID?: string | null): any;
    readAllChunks(): any;
    load(url: string, onComplete?: (...args: any[]) => any | null, onCancel?: (...args: any[]) => any | null, onError?: (...args: any[]) => any | null): void;
    browse(onComplete?: (...args: any[]) => any | null, onCancel?: (...args: any[]) => any | null, onError?: (...args: any[]) => any | null, fileFilterName?: string | null, extensions?: string | null): void;
    save(defaultFileName?: string | null, onComplete?: (...args: any[]) => any | null, onCancel?: (...args: any[]) => any | null, onError?: (...args: any[]) => any | null): void;
    expandZipFile(): (ByteArrayExt)[];
}
export type ByteArrayExt = Omit<ByteArray, keyof ByteArrayExtMembers> & ByteArrayExtMembers;
export interface ByteArrayExtConstructor {
    new (copyFrom?: ByteArray | null): ByteArrayExt;
    calculateCRC32(byteArray: ByteArray, offset?: number, length?: number): number;
}
export declare const ByteArrayExt: ByteArrayExtConstructor;
export interface FFTMembers {
    re: (number)[];
    im: (number)[];
    length: number;
    cdft(isgn: number, src: (number)[]): void;
    rdft(isgn: number, src: (number)[]): void;
    ddct(isgn: number, src: (number)[]): void;
    ddst(isgn: number, src: (number)[]): void;
    setData(src: (number)[]): FFT;
    getData(dst?: (number)[] | null): (number)[];
    getIntensity(dst?: (number)[] | null): (number)[];
    getMagnitude(dst?: (number)[] | null): (number)[];
    getPhase(dst?: (number)[] | null): (number)[];
    scale(n: number): FFT;
    calcFFT(): FFT;
    calcIFFT(): FFT;
    calcRealFFT(): FFT;
    calcRealIFFT(): FFT;
    calcDCT(): FFT;
    calcIDCT(): FFT;
}
export type FFT = FFTMembers;
export interface FFTConstructor {
    new (len: number): FFT;
}
export declare const FFT: FFTConstructor;
export interface FFT_originalMembers {
    cdft(isgn: number, src: (number)[]): void;
    rdft(isgn: number, src: (number)[]): void;
    ddct(isgn: number, src: (number)[]): void;
    ddst(isgn: number, src: (number)[]): void;
}
export type FFT_original = FFT_originalMembers;
export interface FFT_originalConstructor {
    new (length: number): FFT_original;
}
export declare const FFT_original: FFT_originalConstructor;
export interface SLLintMembers {
    i: number;
    next: SLLint;
}
export type SLLint = SLLintMembers;
export interface SLLintConstructor {
    new (i?: number): SLLint;
    alloc(i?: number): SLLint;
    allocList(size: number, defaultData?: number): SLLint;
    allocRing(size: number, defaultData?: number): SLLint;
    newRing(...args: any[]): SLLint;
    free(elem: SLLint): void;
    freeList(firstElem: SLLint): void;
    freeRing(firstElem: SLLint): void;
    createListPager(firstElem: SLLint, fixedSize: boolean): (SLLint)[];
    createRingPager(firstElem: SLLint, fixedSize: boolean): (SLLint)[];
}
export declare const SLLint: SLLintConstructor;
export interface SLLNumberMembers {
    n: number;
    next: SLLNumber;
}
export type SLLNumber = SLLNumberMembers;
export interface SLLNumberConstructor {
    new (n?: number): SLLNumber;
    alloc(n?: number): SLLNumber;
    allocList(size: number, defaultData?: number): SLLNumber;
    allocRing(size: number, defaultData?: number): SLLNumber;
    newRing(...args: any[]): SLLNumber;
    free(elem: SLLNumber): void;
    freeList(firstElem: SLLNumber): void;
    freeRing(firstElem: SLLNumber): void;
    createListPager(firstElem: SLLNumber, fixedSize: boolean): (SLLNumber)[];
    createRingPager(firstElem: SLLNumber, fixedSize: boolean): (SLLNumber)[];
}
export declare const SLLNumber: SLLNumberConstructor;
export interface timerMembers {
}
export type timer = timerMembers;
export interface timerConstructor {
    new (): timer;
    title: string;
    initialize(parent: any, averagingCount: number, ...stat: any[]): void;
    start(slot?: number): void;
    pause(slot?: number): void;
}
export declare const timer: timerConstructor;
