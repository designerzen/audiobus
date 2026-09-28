import { NoteTimeline } from './note-timeline'

const timeline = new NoteTimeline()
let canvas: OffscreenCanvas
let context: OffscreenCanvasRenderingContext2D
let origin: number | undefined
let offset = 0
let scale = 100
let topNote = 84
let follow = true
const rowHeight = 14
const gutter = 48
const ruler = 24
const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const now = () => origin === undefined ? 0 : (performance.timeOrigin + performance.now() - origin) / 1000
const width = () => Math.max(1, canvas.width - gutter)

function render() {
    const time = now()
    if (follow) offset = Math.max(0, time - width() / scale * .9)
    context.fillStyle = '#151923'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.font = '11px sans-serif'
    for (let row = 0; row * rowHeight < canvas.height - ruler; row++) {
        const note = Math.round(topNote) - row
        if (note < 0) break
        const y = ruler + row * rowHeight
        context.fillStyle = [1, 3, 6, 8, 10].includes(note % 12) ? '#1b202c' : '#242b39'
        context.fillRect(gutter, y, width(), rowHeight - 1)
        context.fillStyle = '#b8c2d6'
        context.fillText(`${names[note % 12]}${Math.floor(note / 12) - 1}`, 6, y + 11)
    }
    const step = 2 ** Math.ceil(Math.log2(65 / scale))
    for (let t = Math.ceil(offset / step) * step; t <= offset + width() / scale; t += step) {
        const x = gutter + (t - offset) * scale
        context.fillStyle = '#364052'
        context.fillRect(x, ruler, 1, canvas.height - ruler)
        context.fillStyle = '#c7d1e4'
        context.fillText(`${Number(t.toFixed(2))}s`, x + 4, 16)
    }
    context.save()
    context.beginPath()
    context.rect(gutter, ruler, width(), canvas.height - ruler)
    context.clip()
    for (const event of timeline.notes) {
        const end = event.end ?? time
        if (end < offset || event.start > offset + width() / scale) continue
        const y = ruler + (Math.round(topNote) - event.note) * rowHeight
        if (y < ruler || y >= canvas.height) continue
        const x = gutter + (event.start - offset) * scale
        context.fillStyle = event.colour
        context.fillRect(x, y + 1, Math.max(2, (end - event.start) * scale), rowHeight - 2)
    }
    context.fillStyle = '#f5f7ff'
    context.fillRect(gutter + (time - offset) * scale, ruler, 1, canvas.height - ruler)
    context.restore()
    if (!timeline.notes.length) {
        context.fillStyle = '#d1d9e8'
        context.fillText('Play notes to build a timeline', gutter + 16, ruler + 30)
    }
    requestAnimationFrame(render)
}

globalThis.onmessage = ({ data }) => {
    if (data.canvas) {
        canvas = data.canvas
        context = canvas.getContext('2d')!
        requestAnimationFrame(render)
        return
    }
    const time = data.time === undefined || origin === undefined ? now() : (data.time - origin) / 1000
    switch (data.type) {
        case 'noteOn':
            if (origin === undefined && data.velocity !== 0) origin = data.time
            timeline.noteOn(data.note, time, data.colour, data.velocity)
            break
        case 'noteOff': timeline.noteOff(data.note, time); break
        case 'allNotesOff': timeline.allNotesOff(time); break
        case 'resize':
            canvas.width = data.displayWidth
            canvas.height = data.displayHeight
            break
        case 'pan':
            follow = false
            offset = Math.max(0, Math.min(now(), offset + data.x / scale))
            topNote = Math.max(Math.min(127, Math.ceil((canvas.height - ruler) / rowHeight) - 1), Math.min(127, topNote + data.y / rowHeight))
            break
        case 'zoom': {
            const anchor = Math.max(0, (data.anchor ?? .5) * canvas.width - gutter)
            const timeAtAnchor = offset + anchor / scale
            scale = Math.max(10, Math.min(1600, scale * data.factor))
            offset = Math.max(0, timeAtAnchor - anchor / scale)
            follow = false
            break
        }
        case 'follow': follow = true; break
    }
}
