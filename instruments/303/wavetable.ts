let wavetable: Promise<Float32Array> | undefined
export function load303Wavetable(): Promise<Float32Array> {
	return (wavetable ??= fetch(new URL("./wavetable.bin", import.meta.url))
		.then(async (response) => {
			if (!response.ok) {
				throw new Error(`303 wavetable: HTTP ${response.status}`)
			}
			const bytes = await response.arrayBuffer()
			if (bytes.byteLength !== 4194304) {
				throw new Error("Invalid 303 wavetable size")
			}
			const view = new DataView(bytes)
			const table = new Float32Array(1048576)
			for (let i = 0; i < table.length; i++) {
				table[i] = view.getFloat32(i * 4, true)
				if (!Number.isFinite(table[i]) || Math.abs(table[i]) > 2) {
					throw new Error("Invalid 303 wavetable sample")
				}
			}
			return table
		})
		.catch((error) => {
			wavetable = undefined
			throw error
		}))
}