/** Seeded motifs, diatonic harmony and voice leading over the shared genre arrangements. */
export function composeSong(options?: {}): {
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
export function songProject(song: any): {
    version: number;
    tempo: any;
    repeats: number;
    tracks: any;
};
export const keyNames: string[];
import { moodPresets } from "./pop-song.mjs";
import { rhythmPresets } from "./pop-song.mjs";
export { moodPresets, rhythmPresets };
