import type { SpeechAudio } from "./kokoro-speech.ts"
let database: Promise<IDBDatabase> | undefined
function db() {
	return (database ??= new Promise((resolve, reject) => {
		const request = indexedDB.open("harmoneasy-speech", 1)
		request.onupgradeneeded = () => request.result.createObjectStore("audio")
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	}))
}
export async function savedSpeech(key: string): Promise<SpeechAudio | undefined> {
	try {
		const database = await db()
		return await new Promise((resolve, reject) => {
			const request = database.transaction("audio").objectStore("audio").get(key)
			request.onsuccess = () => resolve(request.result)
			request.onerror = () => reject(request.error)
		})
	} catch {
		return undefined
	}
}
export async function saveSpeech(key: string, audio: SpeechAudio) {
	try {
		const database = await db()
		await new Promise<void>((resolve, reject) => {
			const tx = database.transaction("audio", "readwrite")
			tx.objectStore("audio").put(audio, key)
			tx.oncomplete = () => resolve()
			tx.onerror = tx.onabort = () => reject(tx.error)
		})
	} catch {
		/* Narration still works if storage is unavailable or full. */
	}
}