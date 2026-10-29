// Vite emits every referenced legacy asset in web and Electron builds.
const assets = import.meta.glob(
	[
		"./yoshimi/worklet/*.{js,wasm}",
		"./yoshimi/libs/wam-processor.js",
		"./yoshimi/banks/**/*.{xiz,json}"
	],
	{ eager: true, query: "?url", import: "default" }
) as Record<string, string>
export function yoshimiAsset(path: string): string {
	const url = assets[`./yoshimi/${path}`]
	if (!url) {
		throw new Error(`Unknown Yoshimi asset: ${path}`)
	}
	return new URL(url, document.baseURI).href
}
const worklets = new WeakMap<AudioContext, Promise<{ wasm: ArrayBuffer; js: string }>>()
export function loadYoshimi(context: AudioContext) {
	let loading = worklets.get(context)
	if (!loading) {
		loading = (async () => {
			const [wasm, js] = await Promise.all([
				fetch(yoshimiAsset("worklet/yoshimi.wasm")).then((r) => {
					if (!r.ok) {
						throw new Error("Unable to load Yoshimi WASM")
					}
					return r.arrayBuffer()
				}),
				fetch(yoshimiAsset("worklet/yoshimi.js")).then((r) => {
					if (!r.ok) {
						throw new Error("Unable to load Yoshimi engine")
					}
					return r.text()
				})
			])
			await context.audioWorklet.addModule(yoshimiAsset("libs/wam-processor.js"))
			await context.audioWorklet.addModule(yoshimiAsset("worklet/yoshimi-awp.js"))
			return { wasm, js }
		})()
		worklets.set(context, loading)
		loading.catch(() => worklets.delete(context))
	}
	return loading
}