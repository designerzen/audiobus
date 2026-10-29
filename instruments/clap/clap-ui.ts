import { webclapUrl, type CLAPNode } from "./clap-host"

const providers = new Map<string, CLAPNode>()
let ready: Promise<ServiceWorkerRegistration> | undefined
let listening = false

export async function openCLAPInterface(
	node: CLAPNode
): Promise<{ frame: HTMLIFrameElement; close: () => void }> {
	if (!node.openInterface) {
		throw new Error("This plugin provides parameter controls only")
	}
	if (!navigator.serviceWorker) {
		throw new Error("Plugin interfaces require HTTPS or localhost")
	}
	if (!listening) {
		navigator.serviceWorker.addEventListener("message", async (event) => {
			const { webclapUI, id, kind, path } = event.data ?? {}
			const provider = webclapUI && providers.get(id)
			if (!provider || !event.ports[0]) {
				return
			}
			try {
				const data =
					kind === "file"
						? await provider.getFile(path)
						: await provider.getResource(path)
				event.ports[0].postMessage({ data })
			} catch {
				event.ports[0].postMessage({ data: null })
			}
		})
		listening = true
	}
	// Scoped to virtual UI files: the app's existing service worker is untouched.
	if (!ready) {
		ready = navigator.serviceWorker
			.register(webclapUrl("ui-sw.js"), { scope: webclapUrl("ui/") })
			.then(async (registration) => {
				const worker = registration.installing ?? registration.waiting
				if (!registration.active && worker) {
					await new Promise<void>((resolve, reject) => {
						worker.addEventListener("statechange", () => {
							if (worker.state === "activated") {
								resolve()
							}
							if (worker.state === "redundant") {
								reject(new Error("Plugin UI service worker failed"))
							}
						})
					})
				}
				return registration
			})
			.catch((error) => {
				ready = undefined
				throw error
			})
	}
	await ready
	const id = crypto.randomUUID()
	providers.set(id, node)
	try {
		const prefix = new URL(webclapUrl(`ui/${id}/`), document.baseURI).href
		const frame = node.openInterface({
			filePrefix: prefix + "file",
			resourcePrefix: prefix + "resource"
		})
		frame.title = `${node.descriptor.name} plugin controls`
		frame.style.cssText =
			"display:block;width:100%;flex:1 0 480px;min-height:480px;border:0;background:white;color-scheme:normal;"
		return {
			frame,
			close: () => {
				node.closeInterface?.()
				frame.remove()
				providers.delete(id)
			}
		}
	} catch (error) {
		providers.delete(id)
		throw error
	}
}