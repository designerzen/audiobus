// oxlint-disable-next-line typescript/triple-slash-reference -- Butterchurn has no bundled types.
/// <reference path="../../shared/butterchurn.d.ts" />
import type { Visualizer } from "butterchurn"
import { AudioNodeVisualiser, disconnectTap } from "../../shared/audio-node-visualiser.ts"

export class ButterchurnVisualiser extends AudioNodeVisualiser {
	private visualizer?: Visualizer
	constructor() {
		super("Butterchurn music visualisation")
	}

	protected async prepare(source: AudioNode, isCurrent: () => boolean) {
		const [{ default: butterchurn }, { default: presets }] = await Promise.all([
			import("butterchurn"),
			import("butterchurn-presets")
		])
		if (!isCurrent()) {
			return () => {}
		}
		const canvas = this.canvas
		const gl = canvas.getContext("webgl2")
		if (!gl) {
			throw new Error("Butterchurn requires WebGL 2")
		}
		const tap = source.context.createGain()
		let visualizer: Visualizer | undefined
		let connected = false
		try {
			visualizer = butterchurn.createVisualizer(source.context, this.canvas, {
				width: this.width,
				height: this.height,
				pixelRatio: 1
			})
			const available = presets.getPresets()
			visualizer.loadPreset(
				available["Flexi, martin + geiss - dedicated to the sherwin maxawow"] ??
					Object.values(available)[0],
				0
			)
			visualizer.connectAudio(tap)
			connected = true
			source.connect(tap)
			this.visualizer = visualizer
		} catch (error) {
			if (connected) {
				visualizer?.disconnectAudio(tap)
			}
			disconnectTap(source, tap)
			gl.getExtension("WEBGL_lose_context")?.loseContext()
			this.replaceCanvas(canvas)
			throw error
		}
		return () => {
			visualizer!.disconnectAudio(tap)
			disconnectTap(source, tap)
			if (this.visualizer === visualizer) {
				this.visualizer = undefined
			}
			gl.getExtension("WEBGL_lose_context")?.loseContext()
			this.replaceCanvas(canvas)
		}
	}
	protected resizeRenderer() {
		this.visualizer?.setRendererSize(this.width, this.height)
	}
	protected renderFrame() {
		this.visualizer?.render()
	}
}

if (!customElements.get("butterchurn-visualiser")) {
	customElements.define("butterchurn-visualiser", ButterchurnVisualiser)
}

declare global {
	interface HTMLElementTagNameMap {
		"butterchurn-visualiser": ButterchurnVisualiser
	}
}