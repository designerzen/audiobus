export const MAGENTA_GENERATE = 'magenta:generate'
export const MAGENTA_RESULT = 'magenta:result'
export const MAGENTA_STATUS = 'magenta:status'
export const MAGENTA_ERROR = 'magenta:error'

export interface MelodyNote {
    pitch: number
    quantizedStartStep: number
    quantizedEndStep: number
}

export interface MagentaRequest {
    kind: typeof MAGENTA_GENERATE
    id: number
    model: string
    notes: MelodyNote[]
    totalQuantizedSteps: number
    steps: number
    temperature: number
    chords: string[]
}
