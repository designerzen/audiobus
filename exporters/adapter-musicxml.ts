import type RecorderAudioEvent from '../audio-event-recorder'
import type AudioEvent from '../audio-event'
import type Timer from '../timing/timer'
import { NOTE_ON } from '../commands'

/**
 * Convert MIDI note number to pitch notation (A4, C#5, etc.)
 */
function midiToPitch(midiNote: number): { step: string; octave: number; alter?: number } {
  const notes = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B']
  const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0]
  
  const octave = Math.floor(midiNote / 12) - 1
  const noteInOctave = midiNote % 12
  
  const result = {
    step: notes[noteInOctave],
    octave: octave,
    ...(alters[noteInOctave] !== 0 && { alter: alters[noteInOctave] })
  }
  
  return result
}

/**
 * Convert duration in seconds to note type and divisions
 */
function durationToNoteType(duration: number, quarterNoteDuration: number): { type: string; dots: number } {
  const quarterNotes = duration / quarterNoteDuration
  
  if (quarterNotes <= 0.25) return { type: 'sixteenth', dots: 0 }
  if (quarterNotes <= 0.5) return { type: 'eighth', dots: 0 }
  if (quarterNotes <= 0.75) return { type: 'eighth', dots: 1 }
  if (quarterNotes <= 1) return { type: 'quarter', dots: 0 }
  if (quarterNotes <= 1.5) return { type: 'quarter', dots: 1 }
  if (quarterNotes <= 2) return { type: 'half', dots: 0 }
  if (quarterNotes <= 3) return { type: 'half', dots: 1 }
  if (quarterNotes <= 4) return { type: 'whole', dots: 0 }
  
  return { type: 'whole', dots: 0 }
}

/**
 * Download blob as file
 */
export const saveBlobToLocalFileSystem = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.musicxml`

  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Create MusicXML file from audio event recording
 * @param recording Audio event recording with notes
 * @param timer Timer for BPM and timing information
 * @returns Promise<Blob> MusicXML file as blob
 */
export const createMusicXMLFromAudioEventRecording = async (
  recording: RecorderAudioEvent,
  timer: Timer
): Promise<Blob> => {
  const BPM = timer.BPM
  const data: AudioEvent[] = recording.exportData()
  const duration: number = recording.duration

  // MusicXML uses divisions per quarter note (typically 4)
  const divisions = 4
  const quarterNoteDuration = (60 / BPM) // Duration in seconds

  // Filter for NOTE_ON events and sort by start time
  const notes = data
    .filter(command => command.type === NOTE_ON && command.noteNumber != null)
    .sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

  // Build MusicXML document
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n'
  xml += '<score-partwise version="4.0">\n'

  // Work info
  xml += '  <work>\n'
  xml += `    <work-title>${escapeXml(recording.name)}</work-title>\n`
  xml += '  </work>\n'

  // Part list
  xml += '  <part-list>\n'
  xml += '    <score-part id="P1">\n'
  xml += `      <part-name>${escapeXml(recording.name)}</part-name>\n`
  xml += '    </score-part>\n'
  xml += '  </part-list>\n'

  // Part content
  xml += '  <part id="P1">\n'

  // Create measures based on notes
  if (notes.length > 0) {
    let measureNum = 1
    let currentTime = 0
    const fourQuartersMs = (240 / BPM) * 1000 // Milliseconds in a measure

    // Group notes by measure
    let noteIndex = 0
    while (noteIndex < notes.length && currentTime < duration) {
      xml += `    <measure number="${measureNum}">\n`

      // Attributes (time signature, divisions) for first measure
      if (measureNum === 1) {
        xml += '      <attributes>\n'
        xml += `        <divisions>${divisions}</divisions>\n`
        xml += '        <time>\n'
        xml += '          <beats>4</beats>\n'
        xml += '          <beat-type>4</beat-type>\n'
        xml += '        </time>\n'
        xml += '        <clef>\n'
        xml += '          <sign>G</sign>\n'
        xml += '          <line>2</line>\n'
        xml += '        </clef>\n'
        xml += '      </attributes>\n'
      }

      // Add notes that fall within this measure
      let measureEndTime = currentTime + fourQuartersMs

      while (noteIndex < notes.length && (notes[noteIndex].startAt || 0) < measureEndTime) {
        const note = notes[noteIndex]
        const pitch = midiToPitch(note.noteNumber || 60)
        const noteDuration = note.duration || 0.5
        const noteType = durationToNoteType(noteDuration, quarterNoteDuration)

        xml += '      <note>\n'
        xml += '        <pitch>\n'
        xml += `          <step>${pitch.step}</step>\n`
        if (pitch.alter !== undefined) {
          xml += `          <alter>${pitch.alter}</alter>\n`
        }
        xml += `          <octave>${pitch.octave}</octave>\n`
        xml += '        </pitch>\n'
        xml += `        <duration>${Math.round((noteDuration / quarterNoteDuration) * divisions)}</duration>\n`
        xml += `        <type>${noteType.type}</type>\n`

        // Add dots if needed
        for (let i = 0; i < noteType.dots; i++) {
          xml += '        <dot/>\n'
        }

        xml += '      </note>\n'
        noteIndex++
      }

      // Add rests if needed to fill measure
      if (noteIndex >= notes.length || (notes[noteIndex]?.startAt || 0) >= measureEndTime) {
        const restDuration = divisions * 4 // Full measure
        xml += '      <note>\n'
        xml += '        <rest/>\n'
        xml += `        <duration>${restDuration}</duration>\n`
        xml += '        <type>whole</type>\n'
        xml += '      </note>\n'
      }

      xml += '    </measure>\n'
      currentTime = measureEndTime
      measureNum++
    }
  } else {
    // Empty piece with one measure
    xml += '    <measure number="1">\n'
    xml += '      <attributes>\n'
    xml += `        <divisions>${divisions}</divisions>\n`
    xml += '        <time>\n'
    xml += '          <beats>4</beats>\n'
    xml += '          <beat-type>4</beat-type>\n'
    xml += '        </time>\n'
    xml += '      </attributes>\n'
    xml += '      <note>\n'
    xml += '        <rest/>\n'
    xml += '        <duration>16</duration>\n'
    xml += '        <type>whole</type>\n'
    xml += '      </note>\n'
    xml += '    </measure>\n'
  }

  xml += '  </part>\n'
  xml += '</score-partwise>\n'

  return new Blob([xml], { type: 'application/xml' })
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}


