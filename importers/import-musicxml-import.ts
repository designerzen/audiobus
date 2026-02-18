import type AudioCommand from '../audio-command'
import type { IAudioCommand } from '../audio-command-interface'
import * as Commands from '../commands'

/**
 * Import MusicXML file and convert to audio commands
 * @param file The MusicXML file to import
 * @returns Commands array and note count
 */
export const importMusicXMLFile = async (file: File): Promise<{ commands: IAudioCommand[], noteCount: number }> => {
	try {
		const text = await file.text()
		const parser = new DOMParser()
		const doc = parser.parseFromString(text, 'application/xml')

		if (doc.getElementsByTagName('parsererror').length > 0) {
			throw new Error('Invalid XML format')
		}

		const commands: IAudioCommand[] = []
		let noteCount = 0
		let currentTime = 0
		const divisions = parseInt(doc.querySelector('part-list divisions')?.textContent || '4')
		const tempos = doc.querySelectorAll('sound[tempo]')
		const bpm = tempos.length > 0 ? parseInt(tempos[0].getAttribute('tempo') || '120') : 120
		const beatDuration = (60 / bpm) * (4 / divisions) // seconds per note

		// Get all measures and notes
		const measures = doc.querySelectorAll('measure')

		measures.forEach((measure) => {
			const notes = measure.querySelectorAll('note')

			notes.forEach((noteEl) => {
				const rest = noteEl.querySelector('rest')
				if (rest) {
					// Handle rest
					const durationEl = noteEl.querySelector('duration')
					const duration = durationEl ? parseInt(durationEl.textContent || '1') : 1
					currentTime += duration * beatDuration
					return
				}

				const pitchEl = noteEl.querySelector('pitch')
				if (!pitchEl) return

				const stepEl = pitchEl.querySelector('step')
				const octaveEl = pitchEl.querySelector('octave')
				const alterEl = pitchEl.querySelector('alter')

				if (!stepEl || !octaveEl) return

				const step = stepEl.textContent || 'C'
				const octave = parseInt(octaveEl.textContent || '4')
				const alter = alterEl ? parseInt(alterEl.textContent || '0') : 0

				// Convert step + octave to MIDI note number
				const noteMap = { 'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11 }
				const midiNote = (octave + 1) * 12 + (noteMap[step] || 0) + alter

				const durationEl = noteEl.querySelector('duration')
				const duration = durationEl ? parseInt(durationEl.textContent || '1') : 1

				// Get velocity from dynamics if available
				const dynamicsEl = measure.querySelector('dynamics')
				let velocity = 100
				if (dynamicsEl) {
					const dynamicType = dynamicsEl.querySelector('pppp, ppp, pp, p, mp, mf, f, ff, fff, ffff')?.tagName
					const velocityMap = { 'pppp': 10, 'ppp': 20, 'pp': 31, 'p': 49, 'mp': 64, 'mf': 80, 'f': 96, 'ff': 112, 'fff': 120, 'ffff': 127 }
					velocity = velocityMap[dynamicType] || 100
				}

				// Create NOTE_ON command
				const noteOn: IAudioCommand = {
					type: Commands.NOTE_ON,
					number: midiNote,
					velocity: velocity,
					startAt: currentTime,
					duration: duration * beatDuration,
					from: file.name,
					channel: 1
				} as any

				// Create NOTE_OFF command
				const noteOff: IAudioCommand = {
					type: Commands.NOTE_OFF,
					number: midiNote,
					velocity: velocity,
					startAt: currentTime + (duration * beatDuration),
					duration: 0,
					from: file.name,
					channel: 1
				} as any

				commands.push(noteOn)
				commands.push(noteOff)
				noteCount++

				// Only advance time for notes without chord marker
				const chord = noteEl.querySelector('chord')
				if (!chord) {
					currentTime += duration * beatDuration
				}
			})
		})

		// Sort by start time
		commands.sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

		console.info('MusicXML file loaded successfully', {
			fileName: file.name,
			noteCount,
			duration: currentTime,
			bpm
		})

		return { commands, noteCount }
	} catch (error) {
		console.error('Error importing MusicXML file:', error)
		throw error
	}
}


