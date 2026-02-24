/**
 * SongVisualiser Usage Examples
 */

import SongVisualiser from "./song-visualiser.js"
import { SongVisualiserUI } from "./song-visualiser-ui.js"
import AudioCommand from "../audio-command.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"
import type OPFSStorage from "../storage/opfs-storage.ts"
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
    noteOn.number = noteNum
    noteOn.velocity = 0.8
    noteOn.startAt = currentTime
    noteOn.time = currentTime
    commands.push(noteOn)

    // NoteOff (half second later)
    const noteOff = new AudioCommand()
    noteOff.subtype = NOTE_OFF
    noteOff.number = noteNum
    noteOff.velocity = 0
    noteOff.startAt = currentTime + 500
    noteOff.time = currentTime + 500
    commands.push(noteOff)

    currentTime += 500
  }

  // Load commands
  await visualiser.loadCommands(commands as IAudioCommand[])
}

/**
 * Example 2: Using with UI wrapper
 */
export async function example2_WithUIWrapper() {
  // Create UI wrapper
  const ui = new SongVisualiserUI()
  document.body.appendChild(ui)

  // Create test commands
  const commands: AudioCommand[] = []

  // Create a simple melody
  const melody = [
    { note: 60, duration: 500 },   // C
    { note: 62, duration: 500 },   // D
    { note: 64, duration: 1000 },  // E
    { note: 65, duration: 500 },   // F
    { note: 67, duration: 1500 },  // G
  ]

  let currentTime = 0
  for (const { note, duration } of melody) {
    const noteOn = new AudioCommand()
    noteOn.subtype = NOTE_ON
    noteOn.number = note
    noteOn.velocity = 1.0
    noteOn.startAt = currentTime
    noteOn.time = currentTime
    commands.push(noteOn)

    const noteOff = new AudioCommand()
    noteOff.subtype = NOTE_OFF
    noteOff.number = note
    noteOff.startAt = currentTime + duration
    noteOff.time = currentTime + duration
    commands.push(noteOff)

    currentTime += duration
  }

  // Load via UI
  await ui.loadCommands(commands as IAudioCommand[])
}

/**
 * Example 3: Live note input visualization
 */
export function example3_LiveNoteInput() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Simulate live input with keyboard
  const notes = new Map<string, number>()
  const keyMap: { [key: string]: number } = {
    a: 60, // C
    s: 62, // D
    d: 64, // E
    f: 65, // F
    g: 67, // G
    h: 69, // A
    j: 71, // B
    k: 72, // C
  }

  document.addEventListener("keydown", (e) => {
    const note = keyMap[e.key.toLowerCase()]
    if (note && !notes.has(e.key)) {
      notes.set(e.key, Date.now())
      visualiser.noteOn(note, 0.8)
    }
  })

  document.addEventListener("keyup", (e) => {
    const note = keyMap[e.key.toLowerCase()]
    if (note) {
      notes.delete(e.key)
      visualiser.noteOff(note)
    }
  })
}

/**
 * Example 4: Loading from OPFS storage
 */
export async function example4_LoadFromOPFS(storage: OPFSStorage) {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Load all commands from OPFS
  const commands = await storage.readAll()
  await visualiser.loadCommands(commands as IAudioCommand[])
}

/**
 * Example 5: With custom styling options
 */
export async function example5_CustomStyling() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Set custom options
  visualiser.setOptions({
    pixelsPerSecond: 150,
    noteHeight: 10,
    darkMode: true,
    showLabels: true,
  })

  // Create test commands
  const commands: AudioCommand[] = []

  // Create a chord progression
  const chords = [
    [60, 64, 67],  // C major
    [62, 65, 69],  // D minor
    [64, 67, 71],  // E minor
    [65, 69, 72],  // F major
  ]

  let currentTime = 0
  for (const chord of chords) {
    for (const note of chord) {
      const noteOn = new AudioCommand()
      noteOn.subtype = NOTE_ON
      noteOn.number = note
      noteOn.velocity = 0.7
      noteOn.startAt = currentTime
      noteOn.time = currentTime
      commands.push(noteOn)

      const noteOff = new AudioCommand()
      noteOff.subtype = NOTE_OFF
      noteOff.number = note
      noteOff.startAt = currentTime + 2000
      noteOff.time = currentTime + 2000
      commands.push(noteOff)
    }
    currentTime += 2000
  }

  await visualiser.loadCommands(commands as IAudioCommand[])
}

/**
 * Example 6: Event handling
 */
export async function example6_EventHandling() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Listen for note bar clicks
  visualiser.addEventListener("noteClick", (e: Event) => {
    const event = e as CustomEvent
    const bar = event.detail
    console.log(
      `Clicked note: ${bar.noteNumber}, Duration: ${bar.endTime - bar.startTime}s`,
    )
  })

  // Create test data
  const commands: AudioCommand[] = []
  let currentTime = 0

  for (let i = 0; i < 5; i++) {
    const note = 60 + Math.floor(Math.random() * 12)
    const duration = 500 + Math.floor(Math.random() * 1000)

    const noteOn = new AudioCommand()
    noteOn.subtype = NOTE_ON
    noteOn.number = note
    noteOn.startAt = currentTime
    noteOn.time = currentTime
    commands.push(noteOn)

    const noteOff = new AudioCommand()
    noteOff.subtype = NOTE_OFF
    noteOff.number = note
    noteOff.startAt = currentTime + duration
    noteOff.time = currentTime + duration
    commands.push(noteOff)

    currentTime += duration
  }

  await visualiser.loadCommands(commands as IAudioCommand[])
}

/**
 * Example 7: Merging live and recorded data
 */
export async function example7_MergeLiveAndRecorded() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // First, load some "recorded" data
  const recordedCommands: AudioCommand[] = []
  for (let i = 0; i < 3; i++) {
    const note = 60 + i * 2

    const noteOn = new AudioCommand()
    noteOn.subtype = NOTE_ON
    noteOn.number = note
    noteOn.startAt = i * 500
    noteOn.time = i * 500
    recordedCommands.push(noteOn)

    const noteOff = new AudioCommand()
    noteOff.subtype = NOTE_OFF
    noteOff.number = note
    noteOff.startAt = (i + 1) * 500
    noteOff.time = (i + 1) * 500
    recordedCommands.push(noteOff)
  }

  await visualiser.loadCommands(recordedCommands as IAudioCommand[])

  // Simulate live input on top
  setTimeout(() => {
    visualiser.noteOn(65, 0.9)
  }, 100)

  setTimeout(() => {
    visualiser.noteOff(65)
  }, 600)
}

/**
 * Example 8: Export and reimport data
 */
export async function example8_ExportAndReimport() {
  const visualiser = new SongVisualiser()
  document.body.appendChild(visualiser)

  // Create initial data
  const commands: AudioCommand[] = []
  const noteOn = new AudioCommand()
  noteOn.subtype = NOTE_ON
  noteOn.number = 72
  noteOn.startAt = 0
  noteOn.time = 0
  commands.push(noteOn)

  const noteOff = new AudioCommand()
  noteOff.subtype = NOTE_OFF
  noteOff.number = 72
  noteOff.startAt = 1000
  noteOff.time = 1000
  commands.push(noteOff)

  await visualiser.loadCommands(commands as IAudioCommand[])

  // Export as JSON
  const json = visualiser.exportAsJSON()
  console.log("Exported data:", json)

  // Could be reimported elsewhere
  localStorage.setItem("visualiserData", json)
}
