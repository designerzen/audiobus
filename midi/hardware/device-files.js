import { cp, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const MIDI_DEVICE_DIRECTORY = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"devices"
)

const DEVICE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MIME = {
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".avif": "image/avif",
	".gif": "image/gif"
}

export function createMidiDeviceStore(getRoots) {
	return {
		async list() {
			const ids = new Set()
			for (const root of getRoots()) {
				let entries
				try {
					entries = await readdir(root, { withFileTypes: true })
				} catch (error) {
					if (error.code === "ENOENT") {
						continue
					}
					throw error
				}
				for (const entry of entries) {
					if (entry.isDirectory() && DEVICE_ID.test(entry.name)) {
						try {
							if (
								(
									await stat(path.join(root, entry.name, `${entry.name}.json`))
								).isFile()
							) {
								ids.add(entry.name)
							}
						} catch (error) {
							if (error.code !== "ENOENT") {
								throw error
							}
						}
					}
				}
			}
			return [...ids].sort()
		},
		async read(relative) {
			if (relative === "index.json") {
				return {
					type: "application/json",
					bytes: Buffer.from(JSON.stringify(await this.list()))
				}
			}
			const parts = relative.split("/")
			if (
				relative !== "profile.schema.json" &&
				(parts.length < 2 || !DEVICE_ID.test(parts[0]))
			) {
				return null
			}
			if (
				parts.some((part) => !part || part === "." || part === ".." || /[\\\0:]/.test(part))
			) {
				return null
			}
			const type = MIME[path.extname(relative).toLowerCase()]
			if (!type) {
				return null
			}
			for (const root of getRoots()) {
				try {
					const base = await realpath(root)
					const file = await realpath(path.join(base, ...parts))
					if (!file.startsWith(base + path.sep)) {
						continue
					}
					return { type, bytes: await readFile(file) }
				} catch (error) {
					if (error.code !== "ENOENT" && error.code !== "ENOTDIR") {
						throw error
					}
				}
			}
			return null
		}
	}
}

export function midiDeviceFilesPlugin() {
	let config
	const middleware = (root) => {
		const store = createMidiDeviceStore(() => [root])
		return async (request, response, next) => {
			const prefix = `${config.base === "./" ? "/" : config.base}midi-devices/`
			let pathname
			try {
				pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname)
			} catch {
				return next()
			}
			if (!pathname.startsWith(prefix)) {
				return next()
			}
			if (request.method !== "GET" && request.method !== "HEAD") {
				response.statusCode = 405
				response.end()
				return
			}
			try {
				const relative = pathname.slice(prefix.length)
				const file = relative
					? await store.read(relative)
					: { type: "application/json", bytes: JSON.stringify(await store.list()) }
				response.setHeader("Cache-Control", "no-store")
				if (!file) {
					response.statusCode = 404
					response.end()
					return
				}
				response.setHeader("Content-Type", file.type)
				response.end(request.method === "HEAD" ? undefined : file.bytes)
			} catch (error) {
				next(error)
			}
		}
	}
	return {
		name: "runtime-midi-device-files",
		configResolved(resolved) {
			config = resolved
		},
		configureServer(server) {
			server.middlewares.use(middleware(MIDI_DEVICE_DIRECTORY))
		},
		async writeBundle() {
			const destination = path.resolve(config.root, config.build.outDir, "midi-devices")
			await cp(MIDI_DEVICE_DIRECTORY, destination, { recursive: true })
			const store = createMidiDeviceStore(() => [MIDI_DEVICE_DIRECTORY])
			await writeFile(
				path.join(destination, "index.json"),
				JSON.stringify(await store.list())
			)
		},
		configurePreviewServer(server) {
			server.middlewares.use(
				middleware(path.resolve(config.root, config.build.outDir, "midi-devices"))
			)
		}
	}
}