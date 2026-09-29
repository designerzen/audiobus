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
const active = new Map<number, { colour: string, count: number }>()

function drawNote(note: number, colour: string) {
    const index = note - firstNote
    if (index < 0 || index >= noteCount) return
    const size = (vertical ? canvas.width : canvas.height) / noteCount
    context.fillStyle = colour
    if (vertical) context.fillRect(index * size, canvas.height - noteDepth, size, noteDepth)
    else context.fillRect(0, index * size, noteDepth, size)
}

function render(time: number) {
    if (time - lastFrame >= 1000 / 60) {
        lastFrame = time
        mirrorContext.clearRect(0, 0, mirror.width, mirror.height)
        mirrorContext.drawImage(canvas, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(mirror, vertical ? 0 : gap, vertical ? -gap : 0)
        for (const [note, data] of active) drawNote(note, data.colour)
    }
    requestAnimationFrame(render)
}

globalThis.onmessage = ({ data }) => {
    if (data.canvas) {
        canvas = data.canvas
        context = canvas.getContext('2d')!
        vertical = data.vertical ?? false
        firstNote = data.notes?.[0]?.number ?? 0
        noteCount = data.notes?.length || 128
        mirror = new OffscreenCanvas(canvas.width, canvas.height)
        mirrorContext = mirror.getContext('2d')!
        requestAnimationFrame(render)
        return
    }
    switch (data.type) {
        case 'noteOn':
            if (data.velocity !== 0) {
                active.set(data.note, { colour: data.colour, count: (active.get(data.note)?.count ?? 0) + 1 })
                // Preserve notes that begin and end between animation frames.
                drawNote(data.note, data.colour)
                break
            }
            // MIDI note-on with zero velocity is a note-off.
        case 'noteOff': {
            const note = active.get(data.note)
            if (note && --note.count === 0) active.delete(data.note)
            break
        }
        case 'allNotesOff': active.clear(); break
        case 'resize':
            canvas.width = mirror.width = Math.max(1, Math.round(data.displayWidth))
            canvas.height = mirror.height = Math.max(1, Math.round(data.displayHeight))
            break
    }
}

export {}
