/** Convert MIDI velocity (0–127) to a bounded linear amplitude. */
export const velocityToGain = (velocity: number): number =>
    Number.isFinite(velocity) ? Math.max(0, Math.min(127, velocity)) / 127 : 0
