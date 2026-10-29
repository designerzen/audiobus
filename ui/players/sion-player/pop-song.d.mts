export function randomFromSeed(seed: any): () => number;
export function createSong(options?: {}): {
    settings: {
        seed: string;
        tempo: number;
        key: number;
        mood: any;
        groove: any;
        energy: number;
        length: string;
    };
    beats: number;
    stepsPerBeat: number;
    rhythm: any;
    minor: boolean;
    sections: {
        start: number;
        name: string;
        bars: number;
        intensity: number;
    }[];
    tracks: {
        mute: boolean;
        bars: {
            step: number;
            note: number;
            duration: number;
        }[][];
        id: string;
        name: string;
        detail: string;
        voice: number;
        volume: number;
        pan: number;
        color: string;
    }[];
    totalBars: number;
    duration: number;
    title: string;
    chords: any;
};
/** Keep the musical history and mix while changing only upcoming bars. */
export function changeSongMood(song: any, mood: any, fromBar?: number): {
    settings: {
        seed: string;
        tempo: number;
        key: number;
        mood: any;
        groove: any;
        energy: number;
        length: string;
    };
    beats: number;
    stepsPerBeat: number;
    rhythm: any;
    minor: boolean;
    sections: {
        start: number;
        name: string;
        bars: number;
        intensity: number;
    }[];
    tracks: {
        mute: boolean;
        bars: {
            step: number;
            note: number;
            duration: number;
        }[][];
        id: string;
        name: string;
        detail: string;
        voice: number;
        volume: number;
        pan: number;
        color: string;
    }[];
    totalBars: number;
    duration: number;
    title: string;
    chords: any;
};
/** Serialize one aligned part for reuse by the song generator and track editor. */
export function songPartMML(song: any, track: any): string;
/** Each part has exactly the same duration, even when muted or resting. */
export function songMML(song: any): string;
export { rhythmPresets } from "./genre-song.mjs";
/** Deterministic composition. Legacy grooves use sixteenths; genre arrangements retain swing and metre. */
export const layers: {
    id: string;
    name: string;
    detail: string;
    voice: number;
    volume: number;
    pan: number;
    color: string;
}[];
export const voices: "\n#OPN@0{3 7 31 0 0 0 0 33 0 0 3 0 15 0 0 1 0 30 0 1 7 0 22 0 0 1 0 28 0 0 7 0 18 0 0 6 0 0 0 1 0 0};\n#OPN@1{2 6 31 15 8 6 2 35 0 12 3 0 31 6 2 6 2 32 0 3 0 0 31 6 2 6 1 32 0 1 7 0 31 8 6 7 4 0 0 2 0 0};\n#OPN@2{3 7 21 0 0 0 0 30 0 1 1 0 14 7 7 6 3 25 0 2 6 0 15 0 0 5 0 38 0 5 6 0 18 0 0 6 0 0 0 2 0 0};\n#OPN@3{5 6 31 0 0 0 0 41 0 1 0 0 20 0 0 10 0 0 0 1 1 0 24 0 0 8 0 0 0 1 2 0 20 0 0 10 0 0 0 1 3 0};\n#@4{0 0 0 0 63 0 0 28 0 0 1 0 1 0 0 0 0 0};\n#@5{0 0 0 17 63 0 0 36 0 0 1 0 1 0 0 0 0 0};\n#@6{0 0 0 19 63 0 0 40 0 0 1 0 1 0 0 0 0 0};\n#OPN@7{4 3 31 12 0 10 5 38 0 6 3 0 31 8 4 6 11 4 0 2 3 0 31 12 4 6 2 40 0 6 7 0 31 6 4 6 11 0 0 2 7 0};\n#OPN@8{3 7 31 0 0 7 0 35 0 4 0 0 25 14 0 4 2 42 0 4 0 0 31 0 0 8 0 38 0 2 0 0 18 7 0 8 1 0 0 1 0 0};\n#OPN@9{4 5 31 5 0 0 0 23 0 1 3 0 20 10 3 7 8 0 0 1 3 0 31 3 0 0 0 25 0 1 7 0 31 12 3 7 10 2 0 1 7 0};";
export const moodPresets: {
    id: string;
    emoji: string;
    name: string;
    description: string;
    minor: boolean;
}[];
