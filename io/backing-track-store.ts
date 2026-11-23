/** Large audio stays outside workspace JSON and its localStorage size limit. */
async function trackStore<T>(
	mode: IDBTransactionMode,
	run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	return new Promise((resolve, reject) => {
		const opening = indexedDB.open("audiobus-backing-tracks", 1)
		opening.onupgradeneeded = () => opening.result.createObjectStore("tracks")
		opening.onerror = () => reject(new Error("Local audio storage is unavailable"))
		opening.onsuccess = () => {
			const db = opening.result
			const transaction = db.transaction("tracks", mode)
			const request = run(transaction.objectStore("tracks"))
			transaction.oncomplete = () => {
				db.close()
				resolve(request.result)
			}
			transaction.onabort = () => {
				db.close()
				reject(new Error("Could not store audio locally; check available storage"))
			}
		}
	})
}

export const saveBackingTrack = (id: string, bytes: ArrayBuffer) =>
	trackStore("readwrite", (store) => store.put(bytes, id))
export const readBackingTrack = (id: string): Promise<ArrayBuffer | undefined> =>
	trackStore("readonly", (store) => store.get(id))