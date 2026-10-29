import type { InstrumentInterface } from "./instrument.ts"

/** Audio alone is sufficient; hosts may forward note feedback when available. */
export interface AudioNodeVisualiserInterface extends Partial<
    Pick<
        InstrumentInterface,
        "noteOn" | "noteOff" | "setActiveNote" | "setActiveNotes" | "clearActiveNotes"
    >
> {
    audioNode: AudioNode | null
    audioContext: BaseAudioContext | null
    width: number
    height: number
}