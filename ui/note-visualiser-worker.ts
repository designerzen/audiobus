import { NOTE_ON, NOTE_OFF } from "../commands.ts"
import { EVENT_RESIZE } from "../event-constants.ts"
// The original background effect: smear coloured notes across a transparent canvas.
let canvas: OffscreenCanvas
let context: OffscreenCanvasRenderingContext2D
let mirror: OffscreenCanvas
let mirrorContext: OffscreenCanvasRenderingContext2D
let vertical = false
let firstNote = 0
let noteCount = 128
let lastFrame = 0
const noteDepth = 10
const gap = noteDepth - 1
const active = new Map<number, { colour: string; count: number }>()

function drawNote(note: number, colour: string) {
	const index = note - firstNote
	if (index < 0 || index >= noteCount) {
		return
	}
	const size = (vertical ? canvas.width : canvas.height) / noteCount
	context.fillStyle = colour
	if (vertical) {
		context.fillRect(index * size, canvas.height - noteDepth, size, noteDepth)
	} else {
		context.fillRect(0, index * size, noteDepth, size)
	}
}

function render(time: number) {
	const interval = 1000 / 60
	const elapsed = time - lastFrame
	// rAF timestamps fluctuate around 16.67 ms. Preserve the remainder so
	// slightly early frames do not turn a 60 Hz display into a 30 Hz canvas.
	if (elapsed >= interval - 0.5) {
		lastFrame += Math.max(1, Math.floor((elapsed + 0.5) / interval)) * interval
		mirrorContext.clearRect(0, 0, mirror.width, mirror.height)
		mirrorContext.drawImage(canvas, 0, 0)
		context.clearRect(0, 0, canvas.width, canvas.height)
		context.drawImage(mirror, vertical ? 0 : gap, vertical ? -gap : 0)
		for (const [note, data] of active) {
			drawNote(note, data.colour)
		}
	}
	requestAnimationFrame(render)
}

globalThis.onmessage = ({ data }) => {
	if (data.canvas) {
		canvas = data.canvas
		context = canvas.getContext("2d")!
		vertical = data.vertical ?? false
		firstNote = data.notes?.[0]?.number ?? 0
		noteCount = data.notes?.length || 128
		mirror = new OffscreenCanvas(canvas.width, canvas.height)
		mirrorContext = mirror.getContext("2d")!
		requestAnimationFrame(render)
		return
	}
	switch (data.type) {
		case NOTE_ON:
			if (data.velocity !== 0) {
				active.set(data.note, {
					colour: data.colour,
					count: (active.get(data.note)?.count ?? 0) + 1
				})
				// Preserve notes that begin and end between animation frames.
				drawNote(data.note, data.colour)
				break
			}
		// MIDI note-on with zero velocity is a note-off.
		case NOTE_OFF: {
			const note = active.get(data.note)
			if (note && --note.count === 0) {
				active.delete(data.note)
			}
			break
		}
		case "allNotesOff":
			active.clear()
			break
		case EVENT_RESIZE:
			canvas.width = mirror.width = Math.max(1, Math.round(data.displayWidth))
			canvas.height = mirror.height = Math.max(1, Math.round(data.displayHeight))
			break
	}
}