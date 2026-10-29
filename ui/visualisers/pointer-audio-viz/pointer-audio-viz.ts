import { CanvasAudioViz } from "../audio-viz/audio-viz.ts"

export class PointerAudioViz extends CanvasAudioViz {
    protected readonly kind = "pointer" as const
}

if (!customElements.get("pointer-audio-viz")) customElements.define("pointer-audio-viz", PointerAudioViz)

declare global {
    interface HTMLElementTagNameMap {
        "pointer-audio-viz": PointerAudioViz
    }
}
