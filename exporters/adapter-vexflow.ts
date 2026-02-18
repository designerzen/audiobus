import { Renderer, Stave, StaveNote, Voice, Formatter, System, GhostNote } from 'vexflow'
import type RecorderAudioEvent from '../audio-event-recorder'
import type AudioEvent from '../audio-event'
import type Timer from '../timing/timer'
import { NOTE_ON } from '../commands'

/**
 * Convert MIDI note number to VexFlow pitch notation (C4, D#5, etc.)
 */
function midiToPitch(midiNote: number | undefined): string {
    if (midiNote === undefined || midiNote === null || isNaN(midiNote)) {
        midiNote = 60 // Default to C4
    }
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    const octave = Math.floor(midiNote / 12) - 1
    const noteInOctave = midiNote % 12
    const pitchStr = `${notes[noteInOctave]}/${octave}`
    return pitchStr
}

/**
 * Convert duration in seconds to VexFlow note duration string
 * Caps duration at whole note (4 beats)
 */
function durationToNoteDuration(duration: number, quarterNoteDuration: number): string {
    // Clamp duration to reasonable range
    if (duration <= 0 || isNaN(duration)) duration = 0.25

    const quarterNotes = Math.min(duration / quarterNoteDuration, 4) // Cap at 4 beats max

    if (quarterNotes <= 0.25) return '16'
    if (quarterNotes <= 0.5) return '8'
    if (quarterNotes <= 0.75) return '8d'
    if (quarterNotes <= 1) return 'q'
    if (quarterNotes <= 1.5) return 'qd'
    if (quarterNotes <= 2) return 'h'
    if (quarterNotes <= 3) return 'hd'

    return 'w'
}

/**
 * Render sheet music to container using VexFlow
 */
export const renderVexFlowToContainer = (container: HTMLElement, recording: RecorderAudioEvent, timer: Timer): void => {
    const BPM = timer.BPM
    const data: AudioEvent[] = recording.exportData()

    // Filter for NOTE_ON events and sort by start time
    const notes = data
        .filter(command => command.type === NOTE_ON && command.noteNumber != null)
        .sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

    if (notes.length === 0) {
        container.innerHTML = '<p>No notes to display</p>'
        return
    }

    try {
        // Pagination setup
        const notesPerMeasure = 4
        const measuresPerPage = 16
        const totalMeasures = Math.ceil(notes.length / notesPerMeasure)
        const totalPages = Math.ceil(totalMeasures / measuresPerPage)

        let currentPage = 0

        // Create outer container
        const outerContainer = document.createElement('div')
        outerContainer.style.cssText = 'display: flex; flex-direction: column; height: 100%;'

        // Create controls area
        const controlsDiv = document.createElement('div')
        controlsDiv.style.cssText = 'padding: 10px 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;'

        const pageInfoSpan = document.createElement('span')
        pageInfoSpan.style.cssText = 'font-weight: bold;'
        pageInfoSpan.textContent = `Page 1 of ${totalPages}`

        const buttonsDiv = document.createElement('div')
        buttonsDiv.style.cssText = 'display: flex; gap: 10px;'

        const prevBtn = document.createElement('button')
        prevBtn.textContent = '← Previous'
        prevBtn.style.cssText = 'padding: 8px 12px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;'
        prevBtn.disabled = true

        const nextBtn = document.createElement('button')
        nextBtn.textContent = 'Next →'
        nextBtn.style.cssText = 'padding: 8px 12px; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;'
        nextBtn.disabled = totalPages <= 1

        buttonsDiv.appendChild(prevBtn)
        buttonsDiv.appendChild(nextBtn)
        controlsDiv.appendChild(pageInfoSpan)
        controlsDiv.appendChild(buttonsDiv)

        // Create scrollable content area
        const contentDiv = document.createElement('div')
        contentDiv.style.cssText = 'overflow-y: auto; flex: 1; padding: 20px;'

        // Function to render current page
        const renderPage = (pageNum: number) => {
            contentDiv.innerHTML = ''
            const startMeasureIdx = pageNum * measuresPerPage
            const endMeasureIdx = Math.min(startMeasureIdx + measuresPerPage, totalMeasures)

            for (let measureIndex = startMeasureIdx; measureIndex < endMeasureIdx; measureIndex++) {
                const startNoteIdx = measureIndex * notesPerMeasure
                const endNoteIdx = Math.min(startNoteIdx + notesPerMeasure, notes.length)

                const measureNotes = notes.slice(startNoteIdx, endNoteIdx)

                // Create container for this stave
                const staveDiv = document.createElement('div')
                staveDiv.style.marginBottom = '20px'

                try {
                    const renderer = new Renderer(staveDiv, Renderer.Backends.SVG)
                    renderer.resize(900, 150)

                    const context = renderer.getContext()
                    const stave = new Stave(10, 40, 880)

                    // Add clef only on first measure of first page
                    if (pageNum === 0 && measureIndex === 0) {
                        stave.addClef('treble').addTimeSignature('4/4').addKeySignature('C')
                    }

                    stave.setContext(context).draw()

                    // Build notes for this measure - exactly 4 quarter notes
                    const vexNotes: StaveNote[] = []

                    // Add the actual notes
                    measureNotes.forEach(note => {
                        const pitch = midiToPitch(note.noteNumber || 60)
                        const vexNote = new StaveNote({
                            keys: [pitch],
                            duration: 'q'
                        })
                        vexNotes.push(vexNote)
                    })

                    // Fill remaining slots with rests to complete the measure
                    while (vexNotes.length < notesPerMeasure) {
                        vexNotes.push(new StaveNote({ keys: ['b/4'], duration: 'q' }))
                    }

                    // Create voice for exactly one measure (4 beats)
                    const voice = new Voice({ num_beats: 4, beat_value: 4 })
                    voice.addTickables(vexNotes)

                    // Format and draw
                    const formatter = new Formatter()
                    formatter.joinVoices([voice]).format([voice], 860)
                    voice.draw(context, stave)

                    contentDiv.appendChild(staveDiv)
                } catch (error) {
                    console.error(`Error rendering measure ${measureIndex}`, error)
                }
            }

            // Update page info and button states
            currentPage = pageNum
            pageInfoSpan.textContent = `Page ${pageNum + 1} of ${totalPages}`
            prevBtn.disabled = pageNum === 0
            nextBtn.disabled = pageNum === totalPages - 1
        }

        // Button event listeners
        prevBtn.onclick = () => {
            if (currentPage > 0) {
                renderPage(currentPage - 1)
                contentDiv.scrollTop = 0
            }
        }

        nextBtn.onclick = () => {
            if (currentPage < totalPages - 1) {
                renderPage(currentPage + 1)
                contentDiv.scrollTop = 0
            }
        }

        // Assemble UI
        outerContainer.appendChild(controlsDiv)
        outerContainer.appendChild(contentDiv)

        // Initial render
        renderPage(0)

        container.innerHTML = ''
        container.appendChild(outerContainer)
    } catch (error) {
        console.error('Error rendering VexFlow sheet music', error)
        container.innerHTML = `<p>Error rendering sheet music. ${error instanceof Error ? error.message : ''}</p>`
    }
}

/**
 * Create HTML page with paginated note table
 */
export const createVexFlowHTMLFromAudioEventRecording = async (
    recording: RecorderAudioEvent,
    timer: Timer
): Promise<Blob> => {
    const BPM = timer.BPM
    const data: AudioEvent[] = recording.exportData()

    // Filter for NOTE_ON events and sort by start time
    const notes = data
        .filter(command => command.type === NOTE_ON && command.noteNumber != null)
        .sort((a, b) => (a.startAt || 0) - (b.startAt || 0))

    // Pagination setup
    const notesPerPage = 50
    const totalPages = Math.ceil(notes.length / notesPerPage)

    // Generate page data
    const pages: string[] = []
    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
        const startIdx = pageNum * notesPerPage
        const endIdx = Math.min(startIdx + notesPerPage, notes.length)
        const pageNotes = notes.slice(startIdx, endIdx)

        let pageTable = ''
        pageNotes.forEach((note, idx) => {
            const globalIdx = startIdx + idx
            const noteNum = note.noteNumber || 60
            const noteDuration = (note.endAt || note.startAt || 0) - (note.startAt || 0) || 0.5
            const pitch = midiToPitch(noteNum)
            const startTime = (note.startAt || 0).toFixed(3)
            const duration = noteDuration.toFixed(3)

            pageTable += `
                <tr>
                    <td>${globalIdx + 1}</td>
                    <td>${pitch}</td>
                    <td>${noteNum}</td>
                    <td>${startTime}s</td>
                    <td>${duration}s</td>
                </tr>`
        })

        pages.push(pageTable)
    }

    // Generate page content divs
    let pageContent = ''
    for (let i = 0; i < pages.length; i++) {
        const displayStyle = i === 0 ? 'display: block;' : 'display: none;'
        pageContent += `
        <div id="page-${i}" class="page" style="${displayStyle}">
            <table>
                <thead>
                    <tr>
                        <th>Note #</th>
                        <th>Pitch</th>
                        <th>MIDI Note</th>
                        <th>Start Time</th>
                        <th>Duration</th>
                    </tr>
                </thead>
                <tbody>
                    ${pages[i]}
                </tbody>
            </table>
        </div>`
    }

    // Create HTML document with pagination
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(recording.name)}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .metadata {
            color: #666;
            margin-bottom: 20px;
            font-size: 14px;
        }
        .controls {
            margin: 20px 0;
            padding: 15px;
            background-color: #f9f9f9;
            border-radius: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .page-info {
            font-weight: bold;
        }
        button {
            padding: 8px 16px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        button:disabled {
            background-color: #ccc;
            cursor: not-allowed;
        }
        button:hover:not(:disabled) {
            background-color: #0056b3;
        }
        .button-group {
            display: flex;
            gap: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .page {
            display: none;
        }
        .page.active {
            display: block;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${escapeHtml(recording.name)}</h1>
        <div class="metadata">
            <p><strong>BPM:</strong> ${BPM}</p>
            <p><strong>Duration:</strong> ${recording.duration.toFixed(2)}s</p>
            <p><strong>Total Notes:</strong> ${notes.length}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div class="controls">
            <span class="page-info">Page <span id="current-page">1</span> of ${totalPages}</span>
            <div class="button-group">
                <button id="prev-btn" onclick="changePage(-1)">← Previous</button>
                <button id="next-btn" onclick="changePage(1)">Next →</button>
            </div>
        </div>

        <div id="pages">
            ${pageContent}
        </div>
    </div>

    <script>
        let currentPage = 0;
        const totalPages = ${totalPages};

        function showPage(pageNum) {
            // Hide all pages
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

            // Show current page
            const page = document.getElementById('page-' + pageNum);
            if (page) {
                page.classList.add('active');
            }

            // Update page info
            document.getElementById('current-page').textContent = pageNum + 1;

            // Update button states
            document.getElementById('prev-btn').disabled = pageNum === 0;
            document.getElementById('next-btn').disabled = pageNum === totalPages - 1;

            currentPage = pageNum;
        }

        function changePage(direction) {
            const newPage = currentPage + direction;
            if (newPage >= 0 && newPage < totalPages) {
                showPage(newPage);
            }
        }

        // Initialize
        showPage(0);
    </script>
</body>
</html>`

    return new Blob([html], { type: 'text/html;charset=utf-8' })
}

/**
 * Download blob as file
 */
export const saveBlobToLocalFileSystem = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}.html`

    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

/**
 * Escape special HTML characters
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}


