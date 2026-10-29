import { PitchSurface } from "../pitch-surfaces/pitch-surfaces.ts"

export class PitchBendGrid extends PitchSurface {
    protected kind = "bend" as const
}

if (!customElements.get("pitch-bend-grid")) customElements.define("pitch-bend-grid", PitchBendGrid)

declare global {
    interface HTMLElementTagNameMap {
        "pitch-bend-grid": PitchBendGrid
    }
}
