import { decodeAudioCommand } from "../audio-command-decoder.ts"
import { encodeAudioCommand } from "../audio-command-encoder.ts"
import type AudioCommand from "../audio-command.ts"
import {
	OPFS_MESSAGE_TYPE_INIT,
	OPFS_MESSAGE_TYPE_APPEND,
	OPFS_MESSAGE_TYPE_READ,
	OPFS_MESSAGE_TYPE_CLEAR,
	OPFS_MESSAGE_TYPE_DELETE,
	OPFS_MESSAGE_TYPE_INFO
} from "./opfs-constants.ts"

import OPFS_WORKER from "./opfs-storage.worker.ts?worker&url"

interface SessionMetadata {
	name: string
	duration: number
	createdAt: number
	updatedAt: number
}

interface WorkerResponse {
	success?: boolean
	message?: string
	error?: string
	count?: number
	commands?: unknown[]
	metadata?: SessionMetadata
	name?: string
	size?: number
	lastModified?: number
	queueLength?: number
	queued?: boolean
	id?: string
	type?: string
}

interface FileInfo {
	name: string
	size: number
	lastModified: number
	queueLength: number
	type?: string
}

export const hasOPFS = () => {
	if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
		console.error('OPFS not supported in this browser')
		return false
	}

	return true
}

/**
 * OPFSStorage - Manages real-time persistence of AudioCommands to OPFS
 * 
 * Uses a dedicated worker thread to prevent blocking audio processing.
 * Stores commands as newline-delimited JSON for streaming read capability.
 */
export default class OPFSStorage {

	private worker: Worker | null = null
	private isInitialised: boolean = false
	private pendingCallbacks: Map<string, (result: WorkerResponse) => void> = new Map()
	private messageId: number = 0

	/**
	 * Initialize OPFS storage with worker
	 */
	async prepare(filename: string = 'audio-commands.jsonl'): Promise<boolean> {

		if (this.isInitialised) {
			return true
		}

		// Check if OPFS is supported
		if (!hasOPFS()) {
			return false
		}
		try {

			// this won't work on github pages :(
			this.worker = new Worker(
				new URL( OPFS_WORKER, import.meta.url ),{ type: 'module' }
			)

			this.worker.onmessage = (event) => this.handleWorkerMessage(event)
			this.worker.onerror = (error) => console.error('Worker error:', error)

			// Initialize storage in worker
			const result = await this.sendMessage(OPFS_MESSAGE_TYPE_INIT, { filename })

			if (result && (result as WorkerResponse).success) {
				this.isInitialised = true
				return true
			} else {
				console.error('Failed to initialize storage:', (result as WorkerResponse).error)
				return false
			}
		} catch (error) {
			console.error('Error initializing OPFS storage:', error)
			return false
		}
	}

	/**
	 * Append a single AudioCommand to storage
	 */
	async addEvent(command: AudioCommand): Promise<boolean> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized. Call init() first.')
			return false
		}
		try {
			const encoded = encodeAudioCommand(command)
			const result = await this.sendMessage(OPFS_MESSAGE_TYPE_APPEND, { command: encoded })
			return (result as WorkerResponse).queued ?? false
		} catch (error) {
			console.error('Error appending command:', error)
			return false
		}
	}

	/**
	 * Append multiple AudioCommands to storage
	 */
	async addEventBatch(commands: AudioCommand[]): Promise<boolean> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized. Call init() first.')
			return false
		}
		try {
			for (const command of commands) {
				await this.addEvent(command)
			}
			return true
		} catch (error) {
			console.error('Error appending batch:', error)
			return false
		}
	}

	/**
	 * Read all commands from storage with metadata
	 */
	async readAll(): Promise<AudioCommand[]> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized. Call init() first.')
			return []
		}

		try {
			const result = await this.sendMessage(OPFS_MESSAGE_TYPE_READ, {})
			if (!(result as WorkerResponse).success) {
				return []
			}
			const encodedCommands = (result as WorkerResponse).commands as number[][]
			const audioCommands = encodedCommands.map(encoded => {
				const uint8Array = new Uint8Array(encoded)
				return decodeAudioCommand(uint8Array)
			})

			return audioCommands
		} catch (error) {
			console.error('Error reading commands:', error)
			return []
		}
	}

	/**
	 * Read session metadata
	 */
	async readMetadata(): Promise<SessionMetadata | null> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized. Call init() first.')
			return null
		}
		try {
			const result = await this.sendMessage(OPFS_MESSAGE_TYPE_READ, {})
			return (result as WorkerResponse).metadata ?? null
		} catch (error) {
			console.error('Error reading metadata:', error)
			return null
		}
	}

	/**
	 * Save session metadata
	 */
	async saveMetadata(metadata: SessionMetadata): Promise<boolean> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized. Call init() first.')
			return false
		}
		try {
			const encoded = JSON.stringify(metadata)
			const result = await this.sendMessage('saveMetadata', { metadata: encoded })
			return (result as WorkerResponse).success ?? false
		} catch (error) {
			console.error('Error saving metadata:', error)
			return false
		}
	}

	/**
	 * Clear all commands from storage
	 */
	async clear(): Promise<boolean> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized. Call init() first.')
			return false
		}
		try {
			const result = await this.sendMessage(OPFS_MESSAGE_TYPE_CLEAR, {})
			return (result as WorkerResponse).success ?? false
		} catch (error) {
			console.error('Error clearing storage:', error)
			return false
		}
	}

	/**
	 * Delete the storage file entirely
	 */
	async delete(): Promise<boolean> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized.')
			return false
		}
		try {
			const result = await this.sendMessage(OPFS_MESSAGE_TYPE_DELETE, {})
			this.isInitialised = false
			return (result as WorkerResponse).success ?? false
		} catch (error) {
			console.error('Error deleting storage:', error)
			return false
		}
	}

	/**
	 * Get file info (size, lastModified, etc)
	 */
	async getInfo(): Promise<FileInfo | null> {
		if (!this.isInitialised) {
			console.warn('Storage not initialized. Call init() first.')
			return null
		}

		try {
			const result = await this.sendMessage(OPFS_MESSAGE_TYPE_INFO, {})
			return (result as WorkerResponse).success
				? {
					name: (result as WorkerResponse).name ?? '',
					size: (result as WorkerResponse).size ?? 0,
					lastModified: (result as WorkerResponse).lastModified ?? 0,
					queueLength: (result as WorkerResponse).queueLength ?? 0
				}
				: null
		} catch (error) {
			console.error('Error getting file info:', error)
			return null
		}
	}

	/**
	 * Terminate the worker
	 */
	dispose(): void {
		if (this.worker) {
			this.worker.terminate()
			this.worker = null
			this.isInitialised = false
		}
	}

	/**
	 * Send a message to the worker and wait for response
	 */
	private sendMessage(type: string, data: unknown): Promise<WorkerResponse> {
		return new Promise((resolve, reject) => {
			const id = `${type}-${this.messageId++}`

			const timeout = setTimeout(() => {
				this.pendingCallbacks.delete(id)
				reject(new Error(`Message timeout: ${type}`))
			}, 30000)

			this.pendingCallbacks.set(id, (result: WorkerResponse) => {
				clearTimeout(timeout)
				resolve(result)
			})

			if (this.worker) {
				this.worker.postMessage({ type, data, id })
			}
		})
	}

	/**
	 * Handle messages from worker
	 */
	private handleWorkerMessage(event: MessageEvent<WorkerResponse>): void {
		const { id, ...result } = event.data

		if (id && this.pendingCallbacks.has(id)) {
			const callback = this.pendingCallbacks.get(id)
			this.pendingCallbacks.delete(id)
			if (callback) {
				callback(result as WorkerResponse)
			}
		}

		// Handle broadcast messages (no ID)
		if (!id && (result as WorkerResponse).type) {
			if ((result as WorkerResponse).type === 'write_complete') {
				// Could emit event here for UI updates
			} else if ((result as WorkerResponse).type === 'write_error') {
				console.error('Storage write error:', (result as WorkerResponse).error)
			}
		}
	}
}

