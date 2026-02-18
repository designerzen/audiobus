import RecorderAudioEvent from '../audio-event-recorder.ts'
import AudioEvent from '../audio-event.ts'
import { NOTE_ON } from '../commands'

import type Timer from '../timing/timer.ts'

/**
 * Create a .dawProject XML file from audio event recording
 * .dawProject is a DAWP (DAW Project) XML format for standard DAW interchange
 */
export const createDawProjectFromAudioEventRecording = async (
	recording: RecorderAudioEvent,
	timer: Timer
): Promise<Blob> => {
	const data: AudioEvent[] = recording.exportData()
	const BPM: number = timer.BPM
	const duration: number = recording.duration

	// Convert audio events to note objects
	const notes = data
		.filter((event) => event.type === NOTE_ON)
		.map((event) => ({
			note: event.noteNumber,
			velocity: event.velocity ?? 100,
			time: event.startAt,
			duration: event.duration,
		}))

	// Build notes XML
	let notesXML = ''
	notes.forEach((note) => {
		notesXML += `    <Note start="${note.time}" duration="${note.duration}" pitch="${note.note}" velocity="${note.velocity}"/>\n`
	})

	// Create .dawProject XML structure
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DAWP version="1.0">
  <Project name="${escapeXml(recording.name ?? 'New Harmoneasy Project')}" tempo="${BPM}" duration="${duration}" timeSignatureNumerator="4" timeSignatureDenominator="4">
    <Timeline>
      <Track id="track-0" name="Piano Roll" type="MIDI">
        <Region start="0" duration="${duration}">
${notesXML}        </Region>
      </Track>
    </Timeline>
    <Metadata>
      <Created>${new Date().toISOString()}</Created>
      <Source>Harmoneasy</Source>
    </Metadata>
  </Project>
</DAWP>`

	// Create blob with XML content
	const blob = new Blob([xml], { type: 'application/xml' })
	return blob
}

/**
 * Escape XML special characters
 */
const escapeXml = (str: string): string => {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;')
}

/**
 * Save .dawProject file to local filesystem
 */
export const saveDawProjectToLocalFileSystem = async (
	blob: Blob,
	filename: string = 'project.dawProject'
): Promise<void> => {
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename.endsWith('.dawProject') ? filename : `${filename}.dawProject`
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)
	URL.revokeObjectURL(url)
}


