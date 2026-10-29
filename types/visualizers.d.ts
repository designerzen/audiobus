declare module "butterchurn" {
	interface Visualizer {
		connectAudio(node: AudioNode): void
		disconnectAudio(node?: AudioNode): void
		loadPreset(preset: unknown, blendTime: number): void
		render(): void
		setRendererSize(width: number, height: number): void
	}
	export function createVisualizer(
		context: BaseAudioContext,
		canvas: HTMLCanvasElement,
		options: { width: number; height: number; pixelRatio: number }
	): Visualizer
	const api: {
		createVisualizer: typeof createVisualizer
		default?: { createVisualizer: typeof createVisualizer }
	}
	export default api
}

declare module "butterchurn-presets" {
	export function getPresets(): Record<string, unknown>
	const api: { getPresets: typeof getPresets; default?: { getPresets: typeof getPresets } }
	export default api
}