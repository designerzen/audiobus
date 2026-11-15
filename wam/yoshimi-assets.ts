// Vite emits every referenced legacy asset in web and Electron builds.
let assets: Record<string, string> | undefined
try {
	assets = import.meta.glob(
		[
			"./yoshimi/worklet/*.{js,wasm}",
			"./yoshimi/libs/wam-processor.js",
			"./yoshimi/banks/**/*.{xiz,json}"
		],
		{ eager: true, query: "?url", import: "default" }
	) as Record<string, string>
} catch {
	// Other bundlers have no glob imports, so the host serves the yoshimi folder itself.
}
let assetBase = `${import.meta.env?.BASE_URL ?? "/"}yoshimi/`

/** Where the yoshimi folder is served from when the bundler has not emitted its files. */
export function setYoshimiAssetBase(url: string) {
	assetBase = url.endsWith("/") ? url : `${url}/`
}
export function yoshimiAsset(path: string): string {
	const url = assets ? assets[`./yoshimi/${path}`] : assetBase + path
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