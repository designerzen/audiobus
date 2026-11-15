export interface IVisualiser {
	readonly dataDomain?: "frequency" | "time"
	update(spectrum: Uint8Array<ArrayBuffer>, time: number, bufferLength: number): void
}