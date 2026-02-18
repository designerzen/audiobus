import type { IAudioCommand } from '../audio-command-interface'
import * as Commands from '../commands'
import { unzipSync } from 'fflate'

/**
 * Import .dawProject file and convert to audio commands
 * .dawProject is a ZIP file containing JSON data
 * @param file The .dawProject file to import
 * @returns Commands array and note count
 */
export const importDawProjectFile = async (file: File): Promise<{ commands: IAudioCommand[], noteCount: number }> => {
	try {
		// .dawProject files are ZIP archives
		const arrayBuffer = await file.arrayBuffer()
		const uint8Array = new Uint8Array(arrayBuffer)

		// Check if it's a valid ZIP file (starts with PK)
		const isZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B // 'PK'

		if (!isZip) {
			throw new Error('.dawProject file must be a valid ZIP archive')
		}

		let projectData: any = null

		// Attempt to extract and parse project.json from the ZIP using fflate
		try {
			const unzipped = unzipSync(uint8Array)

			// Look for project.json or similar
			let projectFile = unzipped['project.json'] || unzipped['project.xml']
			
			// If no standard names found, get the first file
			if (!projectFile) {
				const firstKey = Object.keys(unzipped)[0]
				projectFile = firstKey ? unzipped[firstKey] : null
			}

			if (!projectFile) {
				throw new Error('No project data found in .dawProject file')
			}

			const text = new TextDecoder().decode(projectFile)
			projectData = JSON.parse(text)
		} catch (zipError) {
			console.warn('Could not parse as ZIP with fflate:', zipError)
			// Try treating as JSON directly (some tools export raw JSON)
			try {
				const text = new TextDecoder().decode(uint8Array)
				projectData = JSON.parse(text)
			} catch (jsonError) {
				throw new Error('Invalid .dawProject format: ' + (jsonError as Error).message)
			}
		}

		const commands: IAudioCommand[] = []
		let noteCount = 0

		// Parse project data structure
		// The structure varies by DAW, so we look for common patterns
		const getTracks = () => {
			if (projectData.tracks) return projectData.tracks
			if (projectData.song?.tracks) return projectData.song.tracks
			if (projectData.arrangement?.tracks) return projectData.arrangement.tracks
			return []
		}

		const getNotes = (track: any) => {
			if (track.notes) return track.notes
			if (track.events) return track.events.filter((e: any) => e.type === 'note')
			if (track.clips) {
				const allNotes: any[] = []
				track.clips.forEach((clip: any) => {
					if (clip.notes) allNotes.push(...clip.notes)
				})
				return allNotes
			}
			return []
		}

		const tracks = getTracks()
		let bpm = projectData.bpm || projectData.tempo || 120

		tracks.forEach((track: any, trackIndex: number) => {
			const notes = getNotes(track)
			const channel = track.channel || trackIndex + 1

			notes.forEach((note: any) => {
				// Handle different note formats
				const midiNote = note.pitch || note.note || note.midi || 60
				const startTime = note.time || note.start || note.startTime || 0
				const duration = note.duration || note.length || 0.25
				const velocity = note.velocity || note.volume || 100

				const noteOn: IAudioCommand = {
					type: Commands.NOTE_ON,
					number: midiNote,
					velocity: velocity,
					startAt: startTime,
					duration: duration,
					from: file.name,
					channel: channel
				} as any

				const noteOff: IAudioCommand = {
					type: Commands.NOTE_OFF,
					number: midiNote,
					velocity: velocity,
					startAt: startTime + duration,
					duration: 0,
					from: file.name,
					channel: channel
				} as any

				commands.push(noteOn)
				commands.push(noteOff)
				noteCount++
			})
		})

		// Sort by start time
		commands.sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

		console.info('.dawProject file loaded successfully', {
			fileName: file.name,
			noteCount,
			tracks: tracks.length,
			bpm
		})

		return { commands, noteCount }
	} catch (error) {
		console.error('Error importing .dawProject file:', error)
		throw error
	}
}


