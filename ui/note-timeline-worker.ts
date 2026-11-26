import { NOTE_ON, NOTE_OFF } from "../commands/commands.ts"
import { EVENT_RESIZE } from "../events/event-constants.ts"
import { NoteTimeline } from "./note-timeline"

const timeline = new NoteTimeline()
let canvas: OffscreenCanvas
let context: OffscreenCanvasRenderingContext2D
let origin: number | undefined
let offset = 0
let scale = 100
let topNote = 84
let follow = true
/** Cut in and end point, in seconds on the timeline, which trim the saved recording. */
let cutIn: number | undefined
let cutOut: number | undefined
const rowHeight = 14
const gutter = 48
const ruler = 24
const names = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"]
const palette = {
	background: "#151923",
	naturalRow: "#242b39",
	sharpRow: "#1b202c",
	grid: "#364052",
	label: "#c7d1e4",
	playhead: "#f5f7ff",
	cut: "#f2b84b"
}
const now = () =>
	origin === undefined ? 0 : (performance.timeOrigin + performance.now() - origin) / 1000
const width = () => Math.max(1, canvas.width - gutter)

function render() {
	const time = now()
	if (follow) {
		offset = Math.max(0, time - (width() / scale) * 0.9)
	}
	context.fillStyle = palette.background
	context.fillRect(0, 0, canvas.width, canvas.height)
	context.font = "11px sans-serif"
	for (let row = 0; row * rowHeight < canvas.height - ruler; row++) {
		const note = Math.round(topNote) - row
		if (note < 0) {
			break
		}
		const y = ruler + row * rowHeight
		context.fillStyle = [1, 3, 6, 8, 10].includes(note % 12)
			? palette.sharpRow
			: palette.naturalRow
		context.fillRect(gutter, y, width(), rowHeight - 1)
		context.fillStyle = palette.label
		context.fillText(`${names[note % 12]}${Math.floor(note / 12) - 1}`, 6, y + 11)
	}
	const step = 2 ** Math.ceil(Math.log2(65 / scale))
	for (let t = Math.ceil(offset / step) * step; t <= offset + width() / scale; t += step) {
		const x = gutter + (t - offset) * scale
		context.fillStyle = palette.grid
		context.fillRect(x, ruler, 1, canvas.height - ruler)
		context.fillStyle = palette.label
		context.fillText(`${Number(t.toFixed(2))}s`, x + 4, 16)
	}
	context.save()
	context.beginPath()
	context.rect(gutter, ruler, width(), canvas.height - ruler)
	context.clip()
	for (const event of timeline.visibleNotes(offset, offset + width() / scale)) {
		const end = event.end ?? time
		if (end < offset || event.start > offset + width() / scale) {
			continue
		}
		const y = ruler + (Math.round(topNote) - event.note) * rowHeight
		if (y < ruler || y >= canvas.height) {
			continue
		}
		const x = gutter + (event.start - offset) * scale
		context.fillStyle = event.colour
		context.fillRect(x, y + 1, Math.max(2, (end - event.start) * scale), rowHeight - 2)
	}
	context.fillStyle = palette.playhead
	context.fillRect(gutter + (time - offset) * scale, ruler, 1, canvas.height - ruler)
	drawCuts(time)
	context.restore()
	if (!timeline.notes.length) {
		context.fillStyle = palette.label
		context.fillText("Play notes to build a timeline", gutter + 16, ruler + 30)
	}
	requestAnimationFrame(render)
}

/** Dims what the cuts leave out and marks each cut on the ruler. */
function drawCuts(time: number) {
	const x = (t: number) => gutter + (t - offset) * scale
	const height = canvas.height - ruler
	context.save()
	context.globalAlpha = 0.55
	context.fillStyle = palette.background
	if (cutIn !== undefined) {
		context.fillRect(gutter, ruler, Math.max(0, x(cutIn) - gutter), height)
	}
	if (cutOut !== undefined) {
		context.fillRect(x(cutOut), ruler, Math.max(0, x(time) - x(cutOut)), height)
	}
	context.restore()
	context.fillStyle = palette.cut
	for (const [label, t] of [
		["In", cutIn],
		["End", cutOut]
	] as const) {
		if (t !== undefined) {
			context.fillRect(x(t) - 1, ruler, 2, height)
			context.fillText(label, x(t) + 4, ruler + 12)
		}
	}
}

/** Tells the page where the cuts sit, as absolute times in milliseconds. */
function postCuts() {
	const absolute = (t: number | undefined) =>
		t === undefined || origin === undefined ? undefined : origin + t * 1000
	globalThis.postMessage({ type: "cuts", cutIn: absolute(cutIn), cutOut: absolute(cutOut) })
}

globalThis.onmessage = ({ data }) => {
	if (data.palette) {
		Object.assign(palette, data.palette)
		return
	}
	if (data.canvas) {
		canvas = data.canvas
		context = canvas.getContext("2d")!
		requestAnimationFrame(render)
		return
	}
	const time =
		data.time === undefined || origin === undefined ? now() : (data.time - origin) / 1000
	switch (data.type) {
		case NOTE_ON:
			if (origin === undefined && data.velocity !== 0) {
				origin = data.time
			}
			timeline.noteOn(data.note, time, data.colour, data.velocity)
			break
		case NOTE_OFF:
			timeline.noteOff(data.note, time)
			break
		case "allNotesOff":
			timeline.allNotesOff(time)
			break
		case "clear":
			timeline.clear()
			origin = undefined
			cutIn = cutOut = undefined
			postCuts()
			offset = 0
			follow = true
			break
		case EVENT_RESIZE:
			canvas.width = data.displayWidth
			canvas.height = data.displayHeight
			break
		case "pan":
			follow = false
			offset = Math.max(0, Math.min(now(), offset + data.x / scale))
			topNote = Math.max(
				Math.min(127, Math.ceil((canvas.height - ruler) / rowHeight) - 1),
				Math.min(127, topNote + data.y / rowHeight)
			)
			break
		case "zoom": {
			const anchor = Math.max(0, (data.anchor ?? 0.5) * canvas.width - gutter)
			const timeAtAnchor = offset + anchor / scale
			scale = Math.max(10, Math.min(1600, scale * data.factor))
			offset = Math.max(0, timeAtAnchor - anchor / scale)
			follow = false
			break
		}
		case "follow":
			follow = true
			break
		case "cut": {
			if (origin === undefined) {
				break
			}
			// Without a position the cut lands at the centre of the view.
			const x =
				data.position === undefined ? width() / 2 : data.position * canvas.width - gutter
			const at = Math.max(0, Math.min(now(), offset + x / scale))
			if (data.edge === "in") {
				cutIn = at
				if (cutOut !== undefined && cutOut <= at) {
					cutOut = undefined
				}
			} else {
				cutOut = at
				if (cutIn !== undefined && cutIn >= at) {
					cutIn = undefined
				}
			}
			postCuts()
			break
		}
		case "clearCuts":
			cutIn = cutOut = undefined
			postCuts()
			break
	}
}