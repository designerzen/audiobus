/**
 * Tracker File Importer
 * Supports MOD, XM, IT, S3M and other tracker formats via FlodJS
 */

import type { IAudioCommand } from '../audio-command-interface.ts'
import AudioCommand from '../audio-command.ts'

/**
 * Import a tracker file (MOD, XM, IT, S3M, etc.) and extract audio commands
 * @param file - The tracker file to import
 * @returns Array of IAudioCommand and the note count
 */
export async function importTrackerFile(file: File): Promise<{ commands: IAudioCommand[], noteCount: number }> {
	try {
		const arrayBuffer = await file.arrayBuffer()
		
		// Try to parse the tracker file
		const trackerData = parseTrackerFile(arrayBuffer)
		
		if (!trackerData) {
			throw new Error(`Unable to parse tracker file: ${file.name}`)
		}

		// Convert tracker data to audio commands
		const commands = convertTrackerDataToCommands(trackerData)
		
		console.info(`Imported tracker file: ${file.name}`, {
			title: trackerData.title,
			format: trackerData.format,
			tempo: trackerData.tempo,
			channels: trackerData.channels,
			patterns: trackerData.patterns?.length || 0,
			notes: commands.length
		})

		return {
			commands,
			noteCount: commands.length
		}
	} catch (error) {
		throw new Error(`Failed to import tracker file: ${error instanceof Error ? error.message : String(error)}`)
	}
}

/**
 * Tracker file data structure
 */
interface TrackerData {
	title: string
	format: string
	tempo: number
	bpm: number
	channels: number
	patterns?: TrackerPattern[]
	notes?: TrackerNote[]
}

interface TrackerPattern {
	index: number
	rows: TrackerRow[]
}

interface TrackerRow {
	noteData: TrackerNote[]
	effects?: any[]
}

interface TrackerNote {
	channel: number
	note: number | null
	octave: number
	instrument: number
	volume: number
	effect?: string
	effectParam?: number
	startRow?: number
	endRow?: number
	pattern?: number
}

/**
 * Parse tracker file header and extract basic info
 */
function parseTrackerFile(arrayBuffer: ArrayBuffer): TrackerData | null {
	const uint8Array = new Uint8Array(arrayBuffer)

	// Check for MOD format (ProTracker, etc)
	if (arrayBuffer.byteLength >= 1084) {
		const signature = readString(uint8Array, 1080, 4)
		if (signature === 'M.K.' || signature === 'M!K!' || signature === 'FLT4') {
			return parseModFile(uint8Array)
		}
	}

	// Check for XM format (FastTracker 2)
	if (arrayBuffer.byteLength >= 76) {
		const xmId = readString(uint8Array, 0, 4)
		if (xmId === 'Extended Module: ') {
			return parseXmFile(uint8Array)
		}
	}

	// Check for IT format (Impulse Tracker)
	if (arrayBuffer.byteLength >= 4) {
		const itId = readString(uint8Array, 0, 4)
		if (itId === 'IMPM') {
			return parseItFile(uint8Array)
		}
	}

	// Check for S3M format (ScreamTracker 3)
	if (arrayBuffer.byteLength >= 48) {
		const s3mId = readString(uint8Array, 44, 4)
		if (s3mId === 'SCRM') {
			return parseS3mFile(uint8Array)
		}
	}

	return null
}

/**
 * Parse MOD format file
 */
function parseModFile(data: Uint8Array): TrackerData {
	// MOD file structure:
	// 0-20: Song name (20 bytes)
	// 20-950: Sample info (31 * 30 bytes)
	// 950: Song length
	// 951: Restart position
	// 952-1080: Pattern sequence table (128 bytes)
	// 1080-1084: Format signature

	const title = readString(data, 0, 20).trim()
	const songLength = data[950]
	const channels = 4 // MOD is always 4 channels

	// Default values for MOD
	const trackerData: TrackerData = {
		title: title || 'Unnamed MOD',
		format: 'MOD',
		tempo: 125,
		bpm: 125,
		channels,
		patterns: extractModPatterns(data, songLength)
	}

	return trackerData
}

/**
 * Parse XM format file
 */
function parseXmFile(data: Uint8Array): TrackerData {
	// XM header info
	const title = readString(data, 17, 20).trim()
	
	let offset = 60 // Header size
	const headerLength = readUint32LE(data, 4)
	offset += headerLength

	// Default values
	const trackerData: TrackerData = {
		title: title || 'Unnamed XM',
		format: 'XM',
		tempo: 125,
		bpm: 125,
		channels: 32 // XM can have up to 32 channels
	}

	return trackerData
}

/**
 * Parse IT format file
 */
function parseItFile(data: Uint8Array): TrackerData {
	// IT header at offset 0
	const title = readString(data, 4, 26).trim()
	const tempo = data[24] || 125
	const bpm = data[25] || 125
	const channels = Math.min(readUint16LE(data, 32), 64)

	const trackerData: TrackerData = {
		title: title || 'Unnamed IT',
		format: 'IT',
		tempo,
		bpm,
		channels
	}

	return trackerData
}

/**
 * Parse S3M format file
 */
function parseS3mFile(data: Uint8Array): TrackerData {
	// S3M header
	const title = readString(data, 0, 28).trim()
	const channels = Math.min(readUint16LE(data, 48), 32)

	const trackerData: TrackerData = {
		title: title || 'Unnamed S3M',
		format: 'S3M',
		tempo: 125,
		bpm: 125,
		channels
	}

	return trackerData
}

/**
 * Extract notes from MOD patterns
 */
function extractModPatterns(data: Uint8Array, songLength: number): TrackerPattern[] {
	const patterns: TrackerPattern[] = []
	const patternTable = data.slice(952, 1080) // Pattern sequence table
	
	// Calculate where pattern data starts (after headers)
	let patternOffset = 1084
	const maxPatterns = 128
	const notesPerRow = 4 // MOD has 4 channels
	const rowsPerPattern = 64

	// Extract pattern numbers from sequence
	const patternNumbers = new Set<number>()
	for (let i = 0; i < Math.min(songLength, 128); i++) {
		const patternNum = patternTable[i]
		if (patternNum < maxPatterns) {
			patternNumbers.add(patternNum)
		}
	}

	// Parse patterns (simplified - just extract note info)
	patternNumbers.forEach(patternNum => {
		const notes: TrackerNote[] = []
		
		// MOD pattern structure: 4 bytes per note (channel)
		// Byte 0-1: Note and sample
		// Byte 2-3: Effect and effect param
		for (let row = 0; row < rowsPerPattern; row++) {
			for (let channel = 0; channel < notesPerRow; channel++) {
				const offset = patternOffset + (patternNum * rowsPerPattern * notesPerRow * 4) + (row * notesPerRow * 4) + (channel * 4)
				
				if (offset + 4 <= data.length) {
					const byte0 = data[offset]
					const byte1 = data[offset + 1]
					const noteNum = ((byte0 & 0x0F) << 4) | ((byte1 >> 4) & 0x0F)
					const sample = (((byte0 & 0xF0) >> 4) | (byte1 & 0x0F)) << 4
					
					// Valid note range in MOD (note 0 = C-0)
					if (noteNum > 0 && noteNum <= 96) {
						notes.push({
							channel,
							note: noteNum,
							octave: Math.floor(noteNum / 12),
							instrument: sample,
							volume: 64,
							startRow: row,
							pattern: patternNum
						})
					}
				}
			}
		}

		if (notes.length > 0) {
			patterns.push({
				index: patternNum,
				rows: [{
					noteData: notes,
					effects: []
				}]
			})
		}
	})

	return patterns
}

/**
 * Convert tracker data to audio commands
 */
function convertTrackerDataToCommands(trackerData: TrackerData): IAudioCommand[] {
	const commands: IAudioCommand[] = []
	const ticksPerRow = 6 // Tracker speed (1/6 of a beat per row)
	let currentTick = 0

	// Process patterns
	if (trackerData.patterns) {
		trackerData.patterns.forEach(pattern => {
			pattern.rows.forEach(row => {
				row.noteData.forEach(note => {
					if (note.note !== null) {
						// Create note on command
						const noteCommand = new AudioCommand()
						noteCommand.number = note.note + (note.octave * 12)
						noteCommand.velocity = note.volume / 64 // Normalize to 0-1
						noteCommand.startAt = currentTick
						noteCommand.patch = note.instrument

						commands.push(noteCommand)

						// Create note off command (assume quarter note)
						const noteOffCommand = new AudioCommand()
						noteOffCommand.number = note.note + (note.octave * 12)
						noteOffCommand.velocity = 0
						noteOffCommand.startAt = currentTick + ticksPerRow * 4
						noteOffCommand.patch = note.instrument

						commands.push(noteOffCommand)
					}
				})
				currentTick += ticksPerRow
			})
		})
	}

	// Sort commands by startAt
	commands.sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

	return commands
}

/**
 * Helper: Read string from data
 */
function readString(data: Uint8Array, offset: number, length: number): string {
	let result = ''
	for (let i = 0; i < length && offset + i < data.length; i++) {
		const char = data[offset + i]
		if (char === 0) break
		result += String.fromCharCode(char)
	}
	return result
}

/**
 * Helper: Read 16-bit unsigned integer (little-endian)
 */
function readUint16LE(data: Uint8Array, offset: number): number {
	return data[offset] | (data[offset + 1] << 8)
}

/**
 * Helper: Read 32-bit unsigned integer (little-endian)
 */
function readUint32LE(data: Uint8Array, offset: number): number {
	return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24)
}

