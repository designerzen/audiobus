import { CanvasAudioViz } from "../audio-viz/audio-viz.ts"

export class WaveformAudioViz extends CanvasAudioViz {
    protected readonly kind = "waveform" as const
}

if (!customElements.get("waveform-audio-viz")) customElements.define("waveform-audio-viz", WaveformAudioViz)

declare global {
    interface HTMLElementTagNameMap {
        "waveform-audio-viz": WaveformAudioViz
    }
}
