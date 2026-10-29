import { UI_INPUT_COMPONENTS } from "./input-components.ts"

export const UI_COMPONENTS: Record<string, () => Promise<unknown>> = {
	...Object.fromEntries(
		Object.values(UI_INPUT_COMPONENTS).map((component) => [component.tag, component.load])
	),
	"horizontal-bars-audio-viz": () =>
		import("./visualisers/horizontal-bars-audio-viz/horizontal-bars-audio-viz.ts"),
	"vertical-bars-audio-viz": () =>
		import("./visualisers/vertical-bars-audio-viz/vertical-bars-audio-viz.ts"),
	"waveform-audio-viz": () => import("./visualisers/waveform-audio-viz/waveform-audio-viz.ts"),
	"spectrum-audio-viz": () => import("./visualisers/spectrum-audio-viz/spectrum-audio-viz.ts"),
	"pointer-audio-viz": () => import("./visualisers/pointer-audio-viz/pointer-audio-viz.ts"),
	"song-audio-viz": () => import("./visualisers/song-audio-viz/song-audio-viz.ts"),
	"spectrum-visualiser": () => import("./visualisers/spectrum-visualiser/spectrum-visualiser.ts"),
	"butterchurn-visualiser": () =>
		import("./visualisers/butterchurn-visualiser/butterchurn-visualiser.ts"),
	"svg-keyboard-audio-controller": UI_INPUT_COMPONENTS["svg-keyboard"].load,
	"sion-player": () => import("./players/sion-player/sion-player.ts")
}

export async function loadUIComponent(tag: string): Promise<void> {
	const load = UI_COMPONENTS[tag]
	if (!load) {
		throw new Error(`Unknown UI component: ${tag}`)
	}
	await load()
}