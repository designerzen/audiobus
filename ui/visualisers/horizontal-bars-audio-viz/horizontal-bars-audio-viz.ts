import { CanvasAudioViz } from "../audio-viz/audio-viz.ts"

export class HorizontalBarsAudioViz extends CanvasAudioViz {
    protected readonly kind = "horizontal-bars" as const
}

if (!customElements.get("horizontal-bars-audio-viz")) customElements.define("horizontal-bars-audio-viz", HorizontalBarsAudioViz)

declare global {
    interface HTMLElementTagNameMap {
        "horizontal-bars-audio-viz": HorizontalBarsAudioViz
    }
}
