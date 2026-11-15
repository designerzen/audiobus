import { readdirSync, readFileSync } from "node:fs"
import { cp, mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const MIDI_DEVICE_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)))

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

// Device IDs remain stable while their physical folders are grouped by manufacturer/model.
export function midiDeviceFolders(root = MIDI_DEVICE_DIRECTORY) {
	const devices = []
	const directories = (folder) => {
		try {
			return readdirSync(folder, { withFileTypes: true }).filter(
				(entry) => entry.isDirectory() && DEVICE_ID.test(entry.name)
			)
		} catch (error) {
			if (error.code === "ENOENT") {
				return []
			}
			throw error
		}
	}
	for (const manufacturer of directories(root)) {
		for (const model of directories(path.join(root, manufacturer.name))) {
			const relative = `${manufacturer.name}/${model.name}`
			for (const file of readdirSync(path.join(root, relative))) {
				if (file.endsWith(".json") && DEVICE_ID.test(file.slice(0, -5))) {
					try {
						const profile = JSON.parse(
							readFileSync(path.join(root, relative, file), "utf8")
						)
						if (profile.id === file.slice(0, -5)) {
							devices.push({ id: profile.id, path: relative })
						}
					} catch (error) {
						if (!(error instanceof SyntaxError) && error.code !== "ENOENT") {
							throw error
						}
					}
				}
			}
		}
	}
	return devices
}
export function midiDeviceDirectory(id, root = MIDI_DEVICE_DIRECTORY) {
	const device = midiDeviceFolders(root).find((device) => device.id === id)
	if (!device) {
		throw new Error(`Unknown MIDI device: ${id}`)
	}
	return path.join(root, device.path)
}

export function createMidiDeviceStore(getRoots) {
	return {
		async entries() {
			const devices = new Map()
			for (const root of getRoots()) {
				for (const device of midiDeviceFolders(root)) {
					if (!devices.has(device.id)) {
						devices.set(device.id, device)
					}
				}
			}
			return [...devices.values()].sort((a, b) => a.id.localeCompare(b.id))
		},
		async list() {
			return (await this.entries()).map(({ id }) => id)
		},
		async read(relative) {
			if (relative === "index.json") {
				return {
					type: "application/json",
					bytes: Buffer.from(JSON.stringify(await this.entries()))
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
					: { type: "application/json", bytes: JSON.stringify(await store.entries()) }
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
			await mkdir(destination, { recursive: true })
			for (const entry of readdirSync(MIDI_DEVICE_DIRECTORY, { withFileTypes: true })) {
				if (entry.isDirectory() || entry.name === "profile.schema.json") {
					await cp(
						path.join(MIDI_DEVICE_DIRECTORY, entry.name),
						path.join(destination, entry.name),
						{ recursive: true }
					)
				}
			}
			const store = createMidiDeviceStore(() => [MIDI_DEVICE_DIRECTORY])
			await writeFile(
				path.join(destination, "index.json"),
				JSON.stringify(await store.entries())
			)
		},
		configurePreviewServer(server) {
			server.middlewares.use(
				middleware(path.resolve(config.root, config.build.outDir, "midi-devices"))
			)
		}
	}
}