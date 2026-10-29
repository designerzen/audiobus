import { CanvasAudioViz } from "../audio-viz/audio-viz.ts"

export class SpectrumAudioViz extends CanvasAudioViz {
	protected readonly kind = "spectrum" as const
}

if (!customElements.get("spectrum-audio-viz")) {
	customElements.define("spectrum-audio-viz", SpectrumAudioViz)
}

declare global {
	interface HTMLElementTagNameMap {
		"spectrum-audio-viz": SpectrumAudioViz
	}
}