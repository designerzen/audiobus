import { zip, unzip, strToU8, strFromU8 } from "fflate"
import { compressToBase64 } from "lz-string"
import { parseMusicTools } from "./music-tools"
import { parseEventClip, type EventClip } from "./event-clip"

export const MAX_BUNDLE_BYTES = 64 * 1024 * 1024
export interface ProjectManifest {
	format: "harmoneasy-project"
	version: 1
	name: string
	workspace: Record<string, any>
	bpm: number
	swing: number
	midiControls: { enabled: boolean; bindings: unknown[] }
	assets: { path: string; name: string; type: string }[]
	dependencies: string[]
	exclusions: string[]
}
export interface ProjectBundle {
	manifest: ProjectManifest
	events?: EventClip
	files: Record<string, Uint8Array>
}
const CREDENTIAL_KEY = /api.?key|access.?key|token|password|secret|authorization|credential/i
/** Transformer configurations themselves contain JSON strings; scrub recursively through them too. */
export function portableData(value: any, exclusions: Set<string> = new Set(), depth = 0): any {
	if (depth > 40) {
		throw new Error("Project nesting is too deep")
	}
	if (typeof value === "string") {
		const trimmed = value.trim()
		if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
			let parsed: unknown
			try {
				parsed = JSON.parse(trimmed)
			} catch {
				return value
			}
			return JSON.stringify(portableData(parsed, exclusions, depth + 1))
		}
		if (/^https?:\/\//i.test(value)) {
			const url = new URL(value)
			if (
				url.username ||
				url.password ||
				[...url.searchParams.keys()].some((key) => CREDENTIAL_KEY.test(key))
			) {
				exclusions.add("Credential-bearing URLs omitted")
				return ""
			}
		}
		if (/^(blob:|data:)/i.test(value)) {
			exclusions.add("Temporary asset URLs omitted; attach the original asset separately")
			return ""
		}
		return value
	}
	if (Array.isArray(value)) {
		return value.map((item) => portableData(item, exclusions, depth + 1))
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => {
					if (!CREDENTIAL_KEY.test(key)) {
						return true
					}
					exclusions.add("Credentials omitted")
					return false
				})
				.map(([key, item]) => [key, portableData(item, exclusions, depth + 1)])
		)
	}
	return value
}
export async function createProjectBundle(options: {
	name: string
	workspace: Record<string, any>
	bpm: number
	swing: number
	midiControls?: { enabled: boolean; bindings: unknown[] }
	events?: EventClip
	assets?: { name: string; type: string; bytes: Uint8Array }[]
}): Promise<Uint8Array> {
	const exclusions = new Set([
		"Plugin binaries and remote samples are referenced, not redistributed",
		"Hardware ports may need reassignment on another device"
	])
	const workspace = portableData(options.workspace, exclusions)
	const files: Record<string, Uint8Array> = {}
	const assets = (options.assets ?? []).map((asset, index) => {
		const path = `assets/${index}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
		files[path] = asset.bytes
		return { path, name: asset.name, type: asset.type }
	})
	const dependencies: string[] = [
		...new Set<string>(
			(workspace.devices ?? []).map((device: any) =>
				String(device.definition?.type ?? device.definition?.factory)
			)
		)
	]
	const manifest: ProjectManifest = {
		format: "harmoneasy-project",
		version: 1,
		name: options.name.slice(0, 120),
		workspace,
		bpm: options.bpm,
		swing: options.swing,
		midiControls: portableData(
			options.midiControls ?? { enabled: true, bindings: [] },
			exclusions
		),
		assets,
		dependencies,
		exclusions: [...exclusions]
	}
	files["project.json"] = strToU8(JSON.stringify(manifest))
	if (options.events) {
		files["events.json"] = strToU8(JSON.stringify(parseEventClip(options.events)))
	}
	if (Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0) > MAX_BUNDLE_BYTES) {
		throw new Error("Project exceeds the 64 MB bundle limit")
	}
	return new Promise((resolve, reject) =>
		zip(files, { level: 1 }, (error, data) => (error ? reject(error) : resolve(data)))
	)
}
export async function readProjectBundle(bytes: Uint8Array): Promise<ProjectBundle> {
	if (bytes.byteLength > MAX_BUNDLE_BYTES) {
		throw new Error("Project archive exceeds 64 MB")
	}
	let size = 0
	let count = 0
	const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) =>
		unzip(
			bytes,
			{
				filter(file) {
					size += file.originalSize
					count++
					if (
						count > 256 ||
						size > MAX_BUNDLE_BYTES ||
						!Number.isFinite(size) ||
						file.name.includes("..") ||
						file.name.startsWith("/") ||
						file.name.includes("\\")
					) {
						return false
					}
					return true
				}
			},
			(error, data) => (error ? reject(error) : resolve(data))
		)
	)
	if (size > MAX_BUNDLE_BYTES || count > 256) {
		throw new Error("Expanded project exceeds its limits")
	}
	if (!files["project.json"] || files["project.json"].length > 8 * 1024 * 1024) {
		throw new Error("Project manifest missing or oversized")
	}
	const manifest = JSON.parse(strFromU8(files["project.json"])) as ProjectManifest
	if (
		!manifest ||
		manifest.format !== "harmoneasy-project" ||
		manifest.version !== 1 ||
		typeof manifest.name !== "string" ||
		manifest.name.length > 120 ||
		!manifest.workspace ||
		manifest.workspace.version !== 2 ||
		!Array.isArray(manifest.workspace.devices) ||
		!Array.isArray(manifest.workspace.chains) ||
		!Number.isFinite(manifest.bpm) ||
		manifest.bpm < 20 ||
		manifest.bpm > 400 ||
		!Number.isFinite(manifest.swing) ||
		manifest.swing < 0 ||
		manifest.swing > 1 ||
		!Array.isArray(manifest.assets) ||
		manifest.assets.length > 128 ||
		!Array.isArray(manifest.dependencies) ||
		!Array.isArray(manifest.exclusions) ||
		!manifest.midiControls ||
		typeof manifest.midiControls.enabled !== "boolean" ||
		!Array.isArray(manifest.midiControls.bindings)
	) {
		throw new Error("Invalid project manifest")
	}
	parseMusicTools(manifest.workspace.musicTools)
	for (const asset of manifest.assets) {
		if (
			!asset ||
			typeof asset.path !== "string" ||
			!asset.path.startsWith("assets/") ||
			!files[asset.path] ||
			typeof asset.name !== "string" ||
			typeof asset.type !== "string"
		) {
			throw new Error("Missing or invalid project asset")
		}
	}
	return {
		manifest,
		files,
		events: files["events.json"]
			? parseEventClip(JSON.parse(strFromU8(files["events.json"])))
			: undefined
	}
}
export function bundleWorkspace(manifest: ProjectManifest): string {
	return "workspace:" + compressToBase64(JSON.stringify(manifest.workspace))
}