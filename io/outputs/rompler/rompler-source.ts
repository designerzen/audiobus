import { isSoundFont, parseMidiJsPack, parseSoundFont, type SoundFontBank } from "./soundfont-file"

/** Where the Rompler's sounds come from: streamed OpenGM24 notes or a whole soundfont file */
export type RomplerSource =
	| { kind: "stream"; name: string }
	| { kind: "bank"; name: string; bank: SoundFontBank }
	| { kind: "pack"; name: string; pack: Map<number, string> }

export const STREAMED_SOURCE: RomplerSource = { kind: "stream", name: "OpenGM24" }

// Files opened from disk are kept in this browser under keys with this prefix
export const LOCAL_SOURCE = "local:"

export const SOUNDFONT_EXTENSIONS = ".sf2,.sf3,.js,.json"

export const sourceName = (key: string): string => {
	if (!key) {
		return STREAMED_SOURCE.name
	}
	if (key.startsWith(LOCAL_SOURCE)) {
		return key.slice(LOCAL_SOURCE.length).replace(/:\d+$/, "")
	}
	const file = key.split(/[?#]/)[0].split("/").pop()
	try {
		return decodeURIComponent(file || key)
	} catch {
		return file || key
	}
}

/** Tells SoundFont banks from MIDI.js packs by their bytes rather than their names */
export function openSource(buffer: ArrayBuffer, name: string): RomplerSource {
	return isSoundFont(buffer)
		? { kind: "bank", name, bank: parseSoundFont(buffer) }
		: { kind: "pack", name, pack: parseMidiJsPack(new TextDecoder().decode(buffer)) }
}

/** Downloads a whole file, reporting bytes as they arrive */
export async function download(
	url: string,
	signal: AbortSignal,
	progress: (received: number, total: number) => void
): Promise<ArrayBuffer> {
	const response = await fetch(url, { signal })
	if (!response.ok) {
		throw Error(`HTTP ${response.status}`)
	}
	const total = Number(response.headers.get("content-length")) || 0
	if (!response.body) {
		return response.arrayBuffer()
	}
	const reader = response.body.getReader()
	// Fill one buffer sized from the header, growing only when it was missing or wrong
	let bytes = new Uint8Array(total || 1 << 20)
	let received = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) {
			break
		}
		if (received + value.length > bytes.length) {
			const grown = new Uint8Array(Math.max(bytes.length * 2, received + value.length))
			grown.set(bytes.subarray(0, received))
			bytes = grown
		}
		bytes.set(value, received)
		received += value.length
		progress(received, total)
	}
	return received === bytes.length ? bytes.buffer : bytes.buffer.slice(0, received)
}

let database: Promise<IDBDatabase> | undefined
const db = () =>
	(database ??= new Promise((resolve, reject) => {
		const request = indexedDB.open("harmoneasy-soundfonts", 1)
		request.onupgradeneeded = () => request.result.createObjectStore("files")
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	}))

// Files opened this session, in case browser storage is unavailable or full
const sessionFiles = new Map<string, Blob>()

/** Keeps a file opened from disk for this session and the next; returns its source key */
export async function rememberFile(file: File): Promise<string> {
	const key = `${LOCAL_SOURCE}${file.name}:${file.size}`
	sessionFiles.set(key, file)
	await storeBlob(key, file)
	return key
}

async function storeBlob(key: string, blob: Blob): Promise<void> {
	try {
		const database = await db()
		await new Promise<void>((resolve, reject) => {
			const transaction = database.transaction("files", "readwrite")
			transaction.objectStore("files").put(blob, key)
			transaction.oncomplete = () => resolve()
			transaction.onerror = transaction.onabort = () => reject(transaction.error)
		})
	} catch {
		/* Still plays this session if storage is unavailable or full */
	}
}

export async function storedFile(key: string): Promise<Blob | undefined> {
	try {
		const database = await db()
		return await new Promise((resolve, reject) => {
			const request = database.transaction("files").objectStore("files").get(key)
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error)
		})
	} catch {
		return undefined
	}
}
/** Downloads a soundfont once, then reads it back from this browser on later visits */
export async function fetchSoundFont(
	url: string,
	signal: AbortSignal,
	progress: (received: number, total: number) => void
): Promise<ArrayBuffer> {
	const stored = await storedFile(url)
	if (stored) {
		return stored.arrayBuffer()
	}
	const buffer = await download(url, signal, progress)
	void storeBlob(url, new Blob([buffer]))
	return buffer
}
type Progress = (received: number, total: number) => void

interface SharedSource {
	source: Promise<RomplerSource>
	users: number
	controller: AbortController
	listeners: Set<Progress>
}

/** A hold on an opened soundfont; release it once it is no longer played */
export interface SourceLease {
	source: Promise<RomplerSource>
	release(): void
}

const shared = new Map<string, SharedSource>()

async function loadSource(
	key: string,
	signal: AbortSignal,
	progress: Progress
): Promise<RomplerSource> {
	if (!key) {
		return STREAMED_SOURCE
	}
	const name = sourceName(key)
	if (key.startsWith(LOCAL_SOURCE)) {
		const file = sessionFiles.get(key) ?? (await storedFile(key))
		if (!file) {
			throw Error("it is no longer stored in this browser, so open the file again")
		}
		return openSource(await file.arrayBuffer(), name)
	}
	return openSource(await fetchSoundFont(key, signal, progress), name)
}

/**
 * Opens a soundfont once however many Romplers play it, so they share one
 * download and one copy in memory. The download stops, and the memory is
 * freed, once every lease on it is released.
 */
export function acquireSource(key: string, progress: Progress): SourceLease {
	let entry = shared.get(key)
	if (!entry) {
		const controller = new AbortController()
		const listeners = new Set<Progress>()
		const created: SharedSource = {
			users: 0,
			controller,
			listeners,
			source: loadSource(key, controller.signal, (received, total) =>
				listeners.forEach((listener) => listener(received, total))
			)
		}
		// A failed open is retried by the next request rather than remembered
		created.source.catch(() => {
			if (shared.get(key) === created) {
				shared.delete(key)
			}
		})
		shared.set(key, created)
		entry = created
	}
	const current = entry
	current.users++
	current.listeners.add(progress)
	let released = false
	return {
		source: current.source,
		release: () => {
			if (released) {
				return
			}
			released = true
			current.listeners.delete(progress)
			if (--current.users <= 0) {
				current.controller.abort()
				if (shared.get(key) === current) {
					shared.delete(key)
				}
			}
		}
	}
}