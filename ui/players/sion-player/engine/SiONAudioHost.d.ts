/** Native browser services used by the preserved SiON engine. */
interface LegacySound {
    pcm: number[][] | null;
    bytesLoaded: number;
    bytesTotal: number;
    provide(): number[];
    setPCM(channels: number[][]): void;
    dispatchEvent(event: unknown): void;
}
interface LegacyChannel {
    soundTransform: {
        volume: number;
        pan: number;
    };
    dispatchEvent(event: unknown): void;
}
type Registry = Record<string, Record<string, any>>;
export declare class SiONAudioHost {
    readonly context: AudioContext;
    private registry;
    readonly destination: AudioNode;
    onError?: (error: unknown) => void;
    private states;
    private loading;
    private module?;
    constructor(context: AudioContext, registry: Registry, destination?: AudioNode);
    private event;
    load(sound: LegacySound, url: string): Promise<void>;
    decode(sound: LegacySound, bytes: ArrayBuffer): Promise<void>;
    private fromBuffer;
    pcm(sound: LegacySound, channels: ArrayLike<number>[], rate: number): void;
    close(sound: LegacySound): void;
    start(channel: LegacyChannel, sound: LegacySound, startTime: number, loops: number): void;
    private startSource;
    update(channel: LegacyChannel): void;
    position(channel: LegacyChannel): number;
    peak(channel: LegacyChannel, _channelIndex: number): number;
    stop(channel: LegacyChannel): void;
    dispose(): void;
}
export declare function installSiONAudio(context: AudioContext, registry: Registry, destination?: AudioNode): SiONAudioHost;
export {};
