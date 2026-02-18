/**
 * Song Visualiser Worker
 * Handles canvas rendering for song timeline visualization
 */

import { NOTE_OFF, NOTE_ON } from "../commands.ts"

interface NoteBarData {
  startTime: number
  endTime: number
  noteNumber: number
  velocity: number
  colour?: string
}

interface VisualisationOptions {
  pixelsPerSecond: number
  noteHeight: number
  barHeight?: number
  startNote: number
  endNote: number
  showLabels: boolean
  darkMode: boolean
  layoutMode: "stacked" | "timeline"
}

let canvas: OffscreenCanvas | null = null
let context: OffscreenCanvasRenderingContext2D | null = null

let notesOn = new Map<number, { time: number; velocity: number; colour?: string }>()
let noteBars: NoteBarData[] = []

let displayWidth = 0
let displayHeight = 0

const PADDING = 4

let options: VisualisationOptions = {
  pixelsPerSecond: 100,
  noteHeight: 8,
  barHeight: 1,
  startNote: 0,
  endNote: 127,
  showLabels: true,
  darkMode: false,
  layoutMode: "timeline"
}

let renderScheduled = false

/**
 * Draw the complete visualization
 */
function render() {
  if (!context || !canvas) return

  const width = canvas.width
  const height = canvas.height

  // Clear canvas
  context.fillStyle = options.darkMode ? "#1e1e1e" : "#ffffff"
  context.fillRect(0, 0, width, height)

  // Draw note bars based on layout mode
  if (options.layoutMode === "timeline") {
    drawNoteBarsTimeline(width, height)
  } else {
    drawNoteBarsStacked(width, height)
  }

  renderScheduled = false
}

/**
 * Stacked layout: bars stacked vertically, sorted by start time
 */
function drawNoteBarsStacked(width: number, height: number) {
  if (!context || noteBars.length === 0) return

  // Find time range of actual data
  const minTime = Math.min(...noteBars.map((bar) => bar.startTime), 0)
  const maxEndTime = Math.max(...noteBars.map((bar) => bar.endTime), 1)
  const timeRange = maxEndTime - minTime || 1

  const MARGIN_LEFT = 50
  const MARGIN_BOTTOM = 40

  // Draw background grid
  drawStackedGrid(width, height, minTime, timeRange, MARGIN_LEFT, MARGIN_BOTTOM)

  const barHeight = options.barHeight || 1

  for (let i = 0; i < noteBars.length; i++) {
    const bar = noteBars[i]
    const duration = bar.endTime - bar.startTime || 0.1
    
    // Scale to canvas width based on actual data range
    const x = MARGIN_LEFT + ((bar.startTime - minTime) / timeRange) * (width - MARGIN_LEFT - 10)
    const barWidth = Math.max(2, (duration / timeRange) * (width - MARGIN_LEFT - 10))

    // Stack bars vertically
    const y = i * (barHeight + PADDING) + PADDING

    // Draw bar fill
    context.fillStyle = bar.colour || getColourForNote(bar.noteNumber)
    context.globalAlpha = 0.7 + bar.velocity * 0.3
    context.fillRect(x, y, barWidth, barHeight)
  }

  // Draw axis tickers
  drawStackedAxisTicks(MARGIN_LEFT, height - MARGIN_BOTTOM, width - MARGIN_LEFT - 10, minTime, timeRange)

  context.globalAlpha = 1
}

/**
 * Timeline layout: notes arranged by pitch on y-axis, time on x-axis
 */
function drawNoteBarsTimeline(width: number, height: number) {
  if (!context || noteBars.length === 0) return

  // Find time range of actual data
  const minTime = Math.min(...noteBars.map((bar) => bar.startTime), 0)
  const maxEndTime = Math.max(...noteBars.map((bar) => bar.endTime), 1)
  const timeRange = maxEndTime - minTime || 1

  const noteRange = options.endNote - options.startNote || 1
  
  const MARGIN_LEFT = 80
  const MARGIN_BOTTOM = 40
  const plotWidth = width - MARGIN_LEFT - 10
  const plotHeight = height - MARGIN_BOTTOM

  // Draw background grid and axes
  drawTimelineGrid(width, height, noteRange, minTime, timeRange, MARGIN_LEFT, MARGIN_BOTTOM)
  
  const outlineePath = new Path2D()

  for (const bar of noteBars) {
    const duration = bar.endTime - bar.startTime || 0.1
    
    // X: time-based position (left to right)
    const x = MARGIN_LEFT + ((bar.startTime - minTime) / timeRange) * plotWidth
    const barWidth = Math.max(1, (duration / timeRange) * plotWidth)

    // Y: note-based position (pitch on vertical axis)
    const noteIndex = bar.noteNumber - options.startNote
    const noteHeight = (options.noteHeight || 8)
    const y = MARGIN_BOTTOM + noteIndex * noteHeight

    // Draw bar fill (no gaps between notes)
    context.fillStyle = bar.colour || getColourForNote(bar.noteNumber)
    context.globalAlpha = 0.7 + bar.velocity * 0.3
    context.fillRect(x, y, barWidth, noteHeight)
  }

  // Draw subtle separators instead of outlines to avoid visual gaps
  context.strokeStyle = options.darkMode ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"
  context.lineWidth = 0.5
  context.globalAlpha = 0.5
  
  for (const bar of noteBars) {
    const duration = bar.endTime - bar.startTime || 0.1
    const x = MARGIN_LEFT + ((bar.startTime - minTime) / timeRange) * plotWidth
    const barWidth = Math.max(1, (duration / timeRange) * plotWidth)
    const noteIndex = bar.noteNumber - options.startNote
    const noteHeight = (options.noteHeight || 8)
    const y = MARGIN_BOTTOM + noteIndex * noteHeight

    // Draw bottom border only
    context.beginPath()
    context.moveTo(x, y + noteHeight - 0.5)
    context.lineTo(x + barWidth, y + noteHeight - 0.5)
    context.stroke()
  }

  context.globalAlpha = 1
}

/**
 * Draw background grid and axes for timeline layout
 */
function drawTimelineGrid(
  width: number,
  height: number,
  noteRange: number,
  minTime: number,
  timeRange: number,
  marginLeft: number,
  marginBottom: number
) {
  if (!context) return

  const plotWidth = width - marginLeft - 10
  const plotHeight = height - marginBottom
  const noteHeight = options.noteHeight || 8

  // Draw background grid
  context.strokeStyle = options.darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
  context.lineWidth = 0.5

  // Horizontal grid lines (notes)
  for (let i = 0; i <= noteRange; i++) {
    const y = marginBottom + i * noteHeight
    context.beginPath()
    context.moveTo(marginLeft, y)
    context.lineTo(marginLeft + plotWidth, y)
    context.stroke()
  }

  // Vertical grid lines (time)
  const timeStep = getTimeStep(timeRange)
  for (let time = minTime; time <= minTime + timeRange; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, plotHeight)
    context.stroke()
  }

  // Draw axes
  context.strokeStyle = options.darkMode ? "#666" : "#999"
  context.lineWidth = 1.5

  // Left axis (Y)
  context.beginPath()
  context.moveTo(marginLeft, 0)
  context.lineTo(marginLeft, plotHeight)
  context.stroke()

  // Bottom axis (X)
  context.beginPath()
  context.moveTo(marginLeft, plotHeight)
  context.lineTo(marginLeft + plotWidth, plotHeight)
  context.stroke()

  // Draw axis labels
  context.fillStyle = options.darkMode ? "#ccc" : "#333"
  context.font = "12px sans-serif"
  context.textAlign = "center"

  // Y-axis label (Notes)
  context.save()
  context.translate(15, plotHeight / 2)
  context.rotate(-Math.PI / 2)
  context.fillText("Note (Pitch)", 0, 0)
  context.restore()

  // X-axis label (Time)
  context.textAlign = "center"
  context.fillText("Time (s)", marginLeft + plotWidth / 2, height - 5)

  // Draw tick marks and labels
  drawTimelineAxisTicks(marginLeft, plotHeight, plotWidth, noteRange, minTime, timeRange, marginBottom, noteHeight)
}

/**
 * Draw background grid for stacked layout
 */
function drawStackedGrid(
  width: number,
  height: number,
  minTime: number,
  timeRange: number,
  marginLeft: number,
  marginBottom: number
) {
  if (!context) return

  const plotWidth = width - marginLeft - 10

  // Draw background grid
  context.strokeStyle = options.darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
  context.lineWidth = 0.5

  // Vertical grid lines (time)
  const timeStep = getTimeStep(timeRange)
  for (let time = minTime; time <= minTime + timeRange; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, height - marginBottom)
    context.stroke()
  }

  // Draw axes
  context.strokeStyle = options.darkMode ? "#666" : "#999"
  context.lineWidth = 1.5

  // Left axis (Y)
  context.beginPath()
  context.moveTo(marginLeft, 0)
  context.lineTo(marginLeft, height - marginBottom)
  context.stroke()

  // Bottom axis (X)
  context.beginPath()
  context.moveTo(marginLeft, height - marginBottom)
  context.lineTo(marginLeft + plotWidth, height - marginBottom)
  context.stroke()

  // Draw axis labels
  context.fillStyle = options.darkMode ? "#ccc" : "#333"
  context.font = "12px sans-serif"
  context.textAlign = "center"

  // Y-axis label (Events)
  context.save()
  context.translate(15, (height - marginBottom) / 2)
  context.rotate(-Math.PI / 2)
  context.fillText("Note Events", 0, 0)
  context.restore()

  // X-axis label (Time)
  context.textAlign = "center"
  context.fillText("Time (ms)", marginLeft + plotWidth / 2, height - 5)

  // Draw tick marks and labels
  drawStackedAxisTicks(marginLeft, height - marginBottom, plotWidth, minTime, timeRange)
}

/**
 * Draw tick marks and labels for timeline layout Y-axis
 */
function drawTimelineAxisTicks(
  marginLeft: number,
  plotHeight: number,
  plotWidth: number,
  noteRange: number,
  minTime: number,
  timeRange: number,
  marginBottom: number,
  noteHeight: number
) {
  if (!context) return

  context.fillStyle = options.darkMode ? "#999" : "#666"
  context.font = "11px monospace"
  context.textAlign = "right"

  // Y-axis ticks (notes) - show every other note to avoid crowding
  const labelStep = Math.max(1, Math.ceil(noteRange / 12))
  for (let i = 0; i <= noteRange; i += labelStep) {
    const y = marginBottom + i * noteHeight
    const noteNum = options.startNote + i

    // Tick mark
    context.beginPath()
    context.moveTo(marginLeft - 5, y)
    context.lineTo(marginLeft, y)
    context.strokeStyle = options.darkMode ? "#666" : "#999"
    context.lineWidth = 0.5
    context.stroke()

    // Note label
    context.fillText(`${noteNum}`, marginLeft - 10, y + 4)
  }

  // X-axis ticks (time)
  const timeStep = getTimeStep(timeRange)
  const maxTime = minTime + timeRange

  context.textAlign = "center"
  for (let time = minTime; time <= maxTime; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth

    // Tick mark
    context.beginPath()
    context.moveTo(x, plotHeight)
    context.lineTo(x, plotHeight + 5)
    context.strokeStyle = options.darkMode ? "#666" : "#999"
    context.lineWidth = 0.5
    context.stroke()

    // Time label (in seconds)
    const timeInSeconds = time / 1000
    context.fillText(`${timeInSeconds.toFixed(1)}s`, x, plotHeight + marginBottom - 5)
  }
}

/**
 * Draw tick marks and labels for stacked layout X-axis
 */
function drawStackedAxisTicks(
  marginLeft: number,
  plotHeight: number,
  plotWidth: number,
  minTime: number,
  timeRange: number
) {
  if (!context) return

  context.fillStyle = options.darkMode ? "#999" : "#666"
  context.font = "11px monospace"
  context.textAlign = "center"

  // X-axis ticks (time)
  const timeStep = getTimeStep(timeRange)
  const maxTime = minTime + timeRange

  for (let time = minTime; time <= maxTime; time += timeStep) {
    const x = marginLeft + ((time - minTime) / timeRange) * plotWidth

    // Tick mark
    context.beginPath()
    context.moveTo(x, plotHeight)
    context.lineTo(x, plotHeight + 5)
    context.strokeStyle = options.darkMode ? "#666" : "#999"
    context.lineWidth = 0.5
    context.stroke()

    // Time label (in seconds)
    const timeInSeconds = time / 1000
    context.fillText(`${timeInSeconds.toFixed(1)}s`, x, plotHeight + 20)
  }
}

/**
 * Calculate appropriate time step for grid and ticks
 */
function getTimeStep(timeRange: number): number {
  // Aim for roughly 5-10 ticks
  const targetSteps = 7
  const roughStep = timeRange / targetSteps

  // Round to nearest nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const normalized = roughStep / magnitude

  let step: number
  if (normalized < 1.5) step = 1
  else if (normalized < 3) step = 2
  else if (normalized < 7) step = 5
  else step = 10

  return step * magnitude
}

function getColourForNote(noteNum: number): string {
  const hue = ((noteNum % 12) / 12) * 360
  return `hsl(${hue}, 70%, 50%)`
}

function scheduleRender() {
  if (!renderScheduled) {
    renderScheduled = true
    requestAnimationFrame(() => render())
  }
}

/**
 * Process note on/off pairs into note bars
 */
function processCommands() {
  const processedNotes = new Map<number, { noteOn: { time: number; velocity: number; colour?: string }; noteOff?: number }>()

  // Build map of noteOn/noteOff pairs
  for (const bar of noteBars) {
    if (!processedNotes.has(bar.noteNumber)) {
      processedNotes.set(bar.noteNumber, {
        noteOn: {
          time: bar.startTime,
          velocity: bar.velocity,
          colour: bar.colour
        },
        noteOff: bar.endTime
      })
    }
  }

  scheduleRender()
}

onmessage = (event: MessageEvent) => {
  const { type, data } = event.data

  switch (type) {
    case "init":
      // Initialize with offscreen canvas
      canvas = data.canvas
      context = canvas?.getContext("2d") as any
      displayWidth = canvas?.width || 0
      displayHeight = canvas?.height || 0
      scheduleRender()
      break

    case "noteOn": {
      const { note, velocity, colour } = data
      notesOn.set(note, { time: Date.now(), velocity, colour })
      break
    }

    case "noteOff": {
      const { note } = data
      const noteOnData = notesOn.get(note)
      if (noteOnData) {
        noteBars.push({
          startTime: noteOnData.time,
          endTime: Date.now(),
          noteNumber: note,
          velocity: noteOnData.velocity,
          colour: noteOnData.colour
        })
        notesOn.delete(note)
        scheduleRender()
      }
      break
    }

    case "loadCommands": {
      const { commands } = data
      noteBars = commands
      notesOn.clear()
      scheduleRender()
      break
    }

    case "setOptions": {
      options = { ...options, ...data.options }
      scheduleRender()
      break
    }

    case "resize": {
      const { displayWidth: w, displayHeight: h } = data
      displayWidth = w
      displayHeight = h
      if (canvas) {
        canvas.width = w
        canvas.height = h
      }
      scheduleRender()
      break
    }

    case "clear": {
      noteBars = []
      notesOn.clear()
      if (context && canvas) {
        context.fillStyle = options.darkMode ? "#1e1e1e" : "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
      }
      break
    }

    case "getNoteBars": {
      postMessage({ type: "noteBarsData", data: noteBars })
      break
    }
  }
}


