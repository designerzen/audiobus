declare module "butterchurn" {
	export interface Visualizer {
		connectAudio(source: AudioNode): void
		disconnectAudio(source: AudioNode): void
		loadPreset(preset: object, blendTime: number): void
		setRendererSize(width: number, height: number): void
		render(): void
	}
	const butterchurn: {
		createVisualizer(
			context: BaseAudioContext,
			canvas: HTMLCanvasElement,
			options: { width: number; height: number; pixelRatio: number }
		): Visualizer
	}
	export default butterchurn
}
declare module "butterchurn-presets" {
	const presets: { getPresets(): Record<string, object> }
	export default presets
}