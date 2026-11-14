import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { wamArchiveWorkerSource } from "../wam/archive-files.js"

const require = createRequire(import.meta.url)
const fileName = "coi-serviceworker.js"
const workerPath = require.resolve("coi-serviceworker/coi-serviceworker.js")
const headers = {
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Embedder-Policy": "require-corp"
}
const workerSource = () => wamArchiveWorkerSource + readFileSync(workerPath, "utf8")

/** Isolate the page so engines can use SharedArrayBuffer, with a worker fallback for hosts that ignore headers. */
export function crossOriginIsolationPlugin() {
	let config
	const serve = (server) => {
		const prefix = config.base === "./" ? "/" : config.base
		server.middlewares.use((request, response, next) => {
			for (const [key, value] of Object.entries(headers)) {
				response.setHeader(key, value)
			}
			if (new URL(request.url, "http://localhost").pathname !== `${prefix}${fileName}`) {
				return next()
			}
			response.setHeader("Content-Type", "text/javascript")
			response.setHeader("Cache-Control", "no-cache")
			response.end(request.method === "HEAD" ? undefined : workerSource())
		})
	}
	return {
		name: "cross-origin-isolation",
		configResolved(resolved) {
			config = resolved
		},
		configureServer: serve,
		configurePreviewServer: serve,
		transformIndexHtml() {
			// GitHub Pages ignores _headers; the worker supplies isolation there.
			return [
				{
					tag: "script",
					attrs: { src: `${config.base}${fileName}` },
					injectTo: "head-prepend"
				}
			]
		},
		generateBundle() {
			this.emitFile({ type: "asset", fileName, source: workerSource() })
		}
	}
}
