import { CanvasAudioViz } from "../audio-viz/audio-viz.ts"

export class VerticalBarsAudioViz extends CanvasAudioViz {
    protected readonly kind = "vertical-bars" as const
}

if (!customElements.get("vertical-bars-audio-viz")) customElements.define("vertical-bars-audio-viz", VerticalBarsAudioViz)

declare global {
    interface HTMLElementTagNameMap {
        "vertical-bars-audio-viz": VerticalBarsAudioViz
    }
}
