import type { SamplerLayer } from "./sampler-state.js"
export interface SamplerEditorBackend {
	getLayers(key: number): SamplerLayer[]
	updateLayer(key: number, index: number, changes: Partial<SamplerLayer>): SamplerLayer
	clearLayer(key: number, index: number): void
	loadSample(key: number, index: number, file: File): Promise<void>
	preview(note: number, velocity?: number): void
	stopPreview(): void
}
export function setupSamplerEditor(
	root: HTMLElement,
	getBackend: () => SamplerEditorBackend | null
): {
	refresh(): void
	destroy(): void
}