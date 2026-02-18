/**
 * OPFS Storage Worker - Handles real-time file I/O for AudioCommands
 * Runs off main thread to prevent blocking audio processing
 */

import {
  OPFS_MESSAGE_TYPE_INIT,
  OPFS_MESSAGE_TYPE_APPEND,
  OPFS_MESSAGE_TYPE_READ,
  OPFS_MESSAGE_TYPE_CLEAR,
  OPFS_MESSAGE_TYPE_DELETE,
  OPFS_MESSAGE_TYPE_INFO,
  OPFS_RESPONSE_TYPE_WRITE_COMPLETE,
  OPFS_RESPONSE_TYPE_WRITE_ERROR
} from './opfs-constants.ts'

interface WorkerMessage {
  type: string
  data: unknown
  id?: string
}

interface WorkerResponse {
  success?: boolean
  message?: string
  error?: string
  count?: number
  commands?: unknown[]
  name?: string
  size?: number
  lastModified?: number
  queueLength?: number
  queued?: boolean
  id?: string
}

let fileHandle: FileSystemFileHandle | null = null
let writer: FileSystemWritableFileStream | null = null
let writeQueue: unknown[] = []
let isWriting: boolean = false
let sessionMetadata: unknown | null = null

const METADATA_MARKER = 'METADATA'

/**
 * Initialize OPFS storage with a file
 */
const initStorage = async (filename: string): Promise<WorkerResponse> => {
  try {
    const root = await navigator.storage.getDirectory()
    fileHandle = await root.getFileHandle(filename, { create: true })
    return { success: true, message: `Storage initialized: ${filename}` }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Append AudioCommand to file
 */
const appendCommand = async (command: unknown): Promise<WorkerResponse> => {
  writeQueue.push(command)
  
  if (!isWriting) {
    processQueue()
  }
  
  return { queued: true }
}

/**
 * Write length-prefixed binary data
 */
const writeBinaryRecord = async (writer: FileSystemWritableFileStream, data: Uint8Array): Promise<void> => {
  // Write 4-byte length prefix (little-endian)
  const lengthBuffer = new ArrayBuffer(4)
  const lengthView = new DataView(lengthBuffer)
  lengthView.setUint32(0, data.length, true)
  
  await writer.write(new Uint8Array(lengthBuffer))
  await writer.write(data)
}

/**
 * Process write queue
 */
const processQueue = async (): Promise<void> => {
  if (isWriting || writeQueue.length === 0) return
  
  isWriting = true
  
  try {
    if (!fileHandle) throw new Error('File handle not initialized')
    
    writer = await fileHandle.createWritable({ keepExistingData: true })
    
    // Seek to end of file
    const file = await fileHandle.getFile()
    await writer.seek(file.size)
    
    while (writeQueue.length > 0) {
      const command = writeQueue.shift()
      // Commands come pre-encoded from main thread
      await writeBinaryRecord(writer, command as Uint8Array)
    }
    
    await writer.close()
    postMessage({ type: OPFS_RESPONSE_TYPE_WRITE_COMPLETE, count: 1 })
  } catch (error) {
    postMessage({ type: OPFS_RESPONSE_TYPE_WRITE_ERROR, error: (error as Error).message })
  } finally {
    isWriting = false
    if (writeQueue.length > 0) {
      processQueue()
    }
  }
}

/**
 * Read binary record with length prefix
 */
const readBinaryRecord = async (buffer: Uint8Array, offset: number): Promise<{ data: Uint8Array; nextOffset: number } | null> => {
  if (offset + 4 > buffer.length) return null
  
  const lengthView = new DataView(buffer.buffer, buffer.byteOffset + offset, 4)
  const length = lengthView.getUint32(0, true)
  
  const dataOffset = offset + 4
  if (dataOffset + length > buffer.length) return null
  
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset + dataOffset, length)
  return { data: new Uint8Array(data), nextOffset: dataOffset + length }
}

/**
 * Read metadata from beginning of file
 */
const readMetadataFromFile = async (buffer: Uint8Array): Promise<unknown | null> => {
  try {
    if (buffer.length < 4) return null
    
    // Check for metadata marker at start
    const markerBytes = new TextEncoder().encode(METADATA_MARKER)
    const bufferMarker = buffer.slice(0, markerBytes.length)
    const bufferMarkerStr = new TextDecoder().decode(bufferMarker)
    
    if (bufferMarkerStr !== METADATA_MARKER) return null
    
    // Read metadata record after marker
    const markerEnd = markerBytes.length
    const record = await readBinaryRecord(buffer, markerEnd)
    if (!record) return null
    
    const metadataJson = new TextDecoder().decode(record.data)
    return JSON.parse(metadataJson)
  } catch (error) {
    return null
  }
}

/**
 * Read all commands from file
 */
const readAllCommands = async (): Promise<WorkerResponse> => {
  try {
    if (!fileHandle) throw new Error('File handle not initialized')
    
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(buffer)
    
    // Try to read metadata
    const metadata = await readMetadataFromFile(uint8Array)
    
    // Find where metadata ends or start from beginning if no metadata
    let offset = 0
    if (metadata) {
      const markerBytes = new TextEncoder().encode(METADATA_MARKER)
      offset = markerBytes.length
      const metadataRecord = await readBinaryRecord(uint8Array, offset)
      if (metadataRecord) {
        offset = metadataRecord.nextOffset
      }
    }
    
    const commands: unknown[] = []
    
    while (offset < uint8Array.length) {
      const record = await readBinaryRecord(uint8Array, offset)
      if (!record) break
      
      // Assume each binary record is pre-encoded MessagePack
      // Return as raw binary for client to decode
      commands.push(Array.from(record.data))
      offset = record.nextOffset
    }
    
    return { success: true, commands, count: commands.length, metadata }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Clear file contents
 */
const clearFile = async (): Promise<WorkerResponse> => {
  try {
    if (!fileHandle) throw new Error('File handle not initialized')
    
    writer = await fileHandle.createWritable()
    await writer.truncate(0)
    await writer.close()
    writeQueue = []
    
    return { success: true, message: 'File cleared' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Delete the storage file
 */
const deleteFile = async (): Promise<WorkerResponse> => {
  try {
    if (!fileHandle) throw new Error('File handle not initialized')
    
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(fileHandle.name)
    fileHandle = null
    writer = null
    writeQueue = []
    
    return { success: true, message: 'File deleted' }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Get file info
 */
const getFileInfo = async (): Promise<WorkerResponse> => {
  try {
    if (!fileHandle) throw new Error('File handle not initialized')
    
    const file = await fileHandle.getFile()
    
    return {
      success: true,
      name: fileHandle.name,
      size: file.size,
      lastModified: file.lastModified,
      queueLength: writeQueue.length
    }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

// Handle messages from main thread
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, data, id } = event.data
  
  try {
    let response: WorkerResponse = {}
    
    switch (type) {
      case OPFS_MESSAGE_TYPE_INIT:
        response = await initStorage((data as { filename: string }).filename)
        break
      case OPFS_MESSAGE_TYPE_APPEND:
        response = await appendCommand((data as { command: unknown }).command)
        break
      case OPFS_MESSAGE_TYPE_READ:
        response = await readAllCommands()
        break
      case OPFS_MESSAGE_TYPE_CLEAR:
        response = await clearFile()
        break
      case OPFS_MESSAGE_TYPE_DELETE:
        response = await deleteFile()
        break
      case OPFS_MESSAGE_TYPE_INFO:
        response = await getFileInfo()
        break
      case 'saveMetadata':
        sessionMetadata = JSON.parse((data as { metadata: string }).metadata)
        response = { success: true, message: 'Metadata saved' }
        break
      default:
        response = { error: `Unknown message type: ${type}` }
    }
    
    if (id) {
      response.id = id
    }
    
    postMessage(response)
  } catch (error) {
    const response: WorkerResponse = {
      error: (error as Error).message,
      id
    }
    postMessage(response)
  }
}

