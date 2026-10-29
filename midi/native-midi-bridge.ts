export interface NativeMidiDevice {
	index: number
	name: string
	id?: string
	protocol?: number
	purpose?: number
}
export interface NativeMidiBridge {
	getUmpInputs(diagnostics?: boolean): Promise<NativeMidiDevice[]>
	getUmpOutputs(diagnostics?: boolean): Promise<NativeMidiDevice[]>
	getCapabilities(): Promise<{ midi2Support: boolean; umpSupport: boolean; perNoteCC: boolean }>
	openUmpInput(index: number): Promise<void>
	closeUmpInput(index: number): Promise<void>
	openUmpOutput(index: number): Promise<void>
	closeUmpOutput(index: number): Promise<void>
	sendUmp(index: number, words: number[]): Promise<void>
	onUmpInput(
		callback: (index: number, words: number[], nativeTimestamp?: number) => void
	): () => void
}

export function getNativeMidiBridge(): NativeMidiBridge {
	const bridge = (globalThis as any).window?.electronAPI?.midi2
	if (!bridge) {
		throw new Error("Native MIDI requires the Electron desktop app")
	}
	return bridge
}