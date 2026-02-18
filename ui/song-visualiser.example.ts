/**
 * SongVisualiser Usage Examples
 */

import SongVisualiser from "./song-visualiser.js"
import { SongVisualiserUI } from "./song-visualiser-ui.js"
import AudioCommand from "../audio-command.ts"
import OPFSStorage from "../storage/opfs-storage.ts"
import { NOTE_ON, NOTE_OFF } from "../commands.ts"

/**
 * Example 1: Basic usage with manual commands
 */
export async function example1_BasicUsage() {
  // Create visualiser element
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Create some test AudioCommands
  const commands: AudioCommand[] = []

  // Create a C major scale
  const notes = [60, 62, 64, 65, 67, 69, 71, 72] // C D E F G A B C
  let currentTime = 0

  for (const noteNum of notes) {
    // NoteOn
    const noteOn = new AudioCommand()
    noteOn.subtype = NOTE_ON
    noteOn.noteNumber = noteNum
    noteOn.velocity = 0.8
    noteOn.startAt = currentTime
    noteOn.time = currentTime
    commands.push(noteOn)

    // NoteOff (half second later)
    const noteOff = new AudioCommand()
    noteOff.subtype = NOTE_OFF
    noteOff.noteNumber = noteNum
    noteOff.velocity = 0
    noteOff.startAt = currentTime + 500
    noteOff.time = currentTime + 500
    commands.push(noteOff)

    currentTime += 500
  }

  // Load commands
  await visualiser.loadCommands(commands)
}

/**
 * Example 2: Using with UI wrapper
 */
export async function example2_WithUIWrapper() {
  // Create UI wrapper
  const ui = new SongVisualiserUI()
  document.body.appendChild(ui)

  // Create test commands
  const commands = createTestCommands()

  // Load commands
  await ui.loadCommands(commands)

  // Listen for note clicks
  ui.getVisualiser()?.addEventListener("noteClick", (e: any) => {
    console.log("User clicked note:", e.detail)
  })
}

/**
 * Example 3: Loading from OPFS
 */
export async function example3_LoadFromOPFS() {
  // Initialize OPFS storage
  const storage = new OPFSStorage()
  const initialized = await storage.prepare("my-song.jsonl")

  if (!initialized) {
    console.error("OPFS not available")
    return
  }

  // Create visualiser
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Load from OPFS
  const success = await visualiser.loadFromOPFS(storage)

  if (success) {
    console.log("Commands loaded from OPFS")
    const commands = visualiser.getCommands()
    console.log(`Loaded ${commands.length} commands`)
  } else {
    console.error("Failed to load from OPFS")
  }
}

/**
 * Example 4: Configuration and styling
 */
export async function example4_CustomConfiguration() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Configure visualiser
  visualiser.setOptions({
    pixelsPerSecond: 200, // Zoom in (more pixels per second)
    noteHeight: 12, // Bigger notes
    startNote: 48, // C3 (middle-ish)
    endNote: 84, // C6
    showLabels: true,
    darkMode: true // Enable dark mode
  })

  // Load commands
  const commands = createTestCommands()
  await visualiser.loadCommands(commands)

  // Style with CSS
  visualiser.style.border = "2px solid #007bff"
  visualiser.style.borderRadius = "8px"
  visualiser.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)"
}

/**
 * Example 5: Interactive note selection and playback
 */
export async function example5_InteractivePlayback() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  const commands = createTestCommands()
  await visualiser.loadCommands(commands)

  // Track selected notes
  const selectedNotes: number[] = []

  // Listen for clicks
  visualiser.addEventListener("noteClick", (e: any) => {
    const noteBar = e.detail
    console.log(
      `Selected: Note ${noteBar.noteNumber}, Duration: ${noteBar.endTime - noteBar.startTime}ms`
    )

    selectedNotes.push(noteBar.noteNumber)

    // Could play the note here using Web Audio API
    // playNote(noteBar.noteNumber, noteBar.velocity)
  })

  // Export function
  const exportBtn = document.createElement("button")
  exportBtn.textContent = "Export Selection"
  exportBtn.onclick = () => {
    const json = visualiser.exportAsJSON()
    console.log("Exported:", json)

    // Download as file
    const blob = new Blob([json], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `song-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  document.body.appendChild(exportBtn)
}

/**
 * Example 6: Comparing multiple files
 */
export async function example6_CompareMultipleFiles() {
  const container = document.createElement("div")
  container.style.display = "grid"
  container.style.gridTemplateColumns = "1fr 1fr"
  container.style.gap = "20px"
  container.style.height = "500px"
  document.body.appendChild(container)

  // Load two different command sets
  const commands1 = createTestCommands()
  const commands2 = createTestCommands(12) // Transposed by octave

  // Create two visualisers
  const vis1 = new SongVisualiser()
  const vis2 = new SongVisualiser()

  container.appendChild(vis1)
  container.appendChild(vis2)

  // Configure both
  vis1.setOptions({ darkMode: false })
  vis2.setOptions({ darkMode: false })

  // Load different data
  await vis1.loadCommands(commands1)
  await vis2.loadCommands(commands2)

  // Add labels
  const label1 = document.createElement("div")
  label1.textContent = "Original"
  label1.style.position = "absolute"
  label1.style.padding = "10px"
  label1.style.fontWeight = "bold"

  const label2 = document.createElement("div")
  label2.textContent = "Transposed"
  label2.style.position = "absolute"
  label2.style.padding = "10px"
  label2.style.fontWeight = "bold"

  container.appendChild(label1)
  container.appendChild(label2)
}

/**
 * Helper function to create test commands
 */
function createTestCommands(transpose: number = 0): AudioCommand[] {
  const commands: AudioCommand[] = []

  // Pentatonic scale pattern
  const notes = [60, 62, 64, 67, 69, 72] // C D E G A C
  let currentTime = 0

  // Play 3 octaves
  for (let octave = 0; octave < 3; octave++) {
    for (const baseNote of notes) {
      const noteNum = baseNote + octave * 12 + transpose

      // Validate note range (0-127)
      if (noteNum < 0 || noteNum > 127) continue

      // NoteOn
      const noteOn = new AudioCommand()
      noteOn.subtype = NOTE_ON
      noteOn.noteNumber = noteNum
      noteOn.velocity = 0.7 + Math.random() * 0.2
      noteOn.startAt = currentTime
      noteOn.time = currentTime
      noteOn.colour = getColourForNote(noteNum)
      commands.push(noteOn)

      // Random duration between 200-600ms
      const duration = 200 + Math.random() * 400

      // NoteOff
      const noteOff = new AudioCommand()
      noteOff.subtype = NOTE_OFF
      noteOff.noteNumber = noteNum
      noteOff.velocity = 0
      noteOff.startAt = currentTime + duration
      noteOff.time = currentTime + duration
      commands.push(noteOff)

      // Gap before next note
      currentTime += duration + 100
    }
  }

  return commands
}

/**
 * Helper to get colour for a note
 */
function getColourForNote(noteNum: number): string {
  // Map note to colour based on note class (C, C#, D, etc.)
  const hue = ((noteNum % 12) / 12) * 360
  return `hsl(${hue}, 70%, 50%)`
}

/**
 * Example 7: Realtime recording visualization
 */
export async function example7_RealtimeRecording() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  const recordedCommands: AudioCommand[] = []

  // Mock recording from input
  const recordBtn = document.createElement("button")
  recordBtn.textContent = "Record (Demo)"
  recordBtn.style.marginBottom = "10px"

  let isRecording = false

  recordBtn.onclick = async () => {
    isRecording = !isRecording
    recordBtn.textContent = isRecording ? "Stop Recording" : "Start Recording"

    if (isRecording) {
      // Simulate recording
      const startTime = Date.now()
      const notes = [60, 64, 67, 72] // C E G C

      for (const note of notes) {
        const noteOn = new AudioCommand()
        noteOn.subtype = NOTE_ON
        noteOn.noteNumber = note
        noteOn.velocity = 0.8
        noteOn.startAt = Date.now() - startTime
        recordedCommands.push(noteOn)

        // Wait 500ms then send noteOff
        await new Promise((r) => setTimeout(r, 500))

        const noteOff = new AudioCommand()
        noteOff.subtype = NOTE_OFF
        noteOff.noteNumber = note
        noteOff.startAt = Date.now() - startTime
        recordedCommands.push(noteOff)

        // Update visualisation in real-time
        await visualiser.loadCommands([...recordedCommands])

        await new Promise((r) => setTimeout(r, 200))
      }

      isRecording = false
      recordBtn.textContent = "Start Recording"
    }
  }

  document.body.insertBefore(recordBtn, visualiser)
}

/**
 * Example 8: Keyboard-controlled zooming and panning
 */
export async function example8_ZoomAndPan() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  const commands = createTestCommands()
  await visualiser.loadCommands(commands)

  let pixelsPerSecond = 100

  // Keyboard controls
  document.addEventListener("keydown", (e) => {
    if (e.key === "+") {
      pixelsPerSecond += 20
      visualiser.setOptions({ pixelsPerSecond })
    } else if (e.key === "-") {
      pixelsPerSecond = Math.max(20, pixelsPerSecond - 20)
      visualiser.setOptions({ pixelsPerSecond })
    }
  })

  // Info
  const info = document.createElement("div")
  info.style.padding = "10px"
  info.style.fontSize = "12px"
  info.textContent = "Press + or - to zoom"
  document.body.insertBefore(info, visualiser)
}


