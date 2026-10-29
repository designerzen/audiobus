import { CanvasAudioViz } from "../audio-viz/audio-viz.ts"

export class SongAudioViz extends CanvasAudioViz {
    protected readonly kind = "song" as const
}

if (!customElements.get("song-audio-viz")) customElements.define("song-audio-viz", SongAudioViz)

declare global {
    interface HTMLElementTagNameMap {
        "song-audio-viz": SongAudioViz
    }
}
