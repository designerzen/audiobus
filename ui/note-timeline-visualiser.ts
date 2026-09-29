import TIMELINE_WORKER from './note-timeline-worker.ts?worker'
import { AbstractResizeable } from './abstract-resizeable-canvas'
import { convertNoteNumberToColour } from '../conversion/note-to-colour'

export default class NoteTimelineVisualiser extends AbstractResizeable {
    private interactions = new AbortController()
    private observer: ResizeObserver

    constructor(canvas: HTMLCanvasElement) {
        super(canvas, TIMELINE_WORKER)
        const signal = this.interactions.signal
        canvas.setAttribute('aria-describedby', 'note-timeline-hint')
        const pan = (x: number, y: number) => this.worker.postMessage({ type: 'pan', x, y })
        const zoom = (factor: number, anchor = .5) => this.worker.postMessage({ type: 'zoom', factor, anchor })
        canvas.parentElement!.querySelectorAll<HTMLButtonElement>('[data-timeline-action]').forEach(button => {
            button.addEventListener('click', () => {
                switch (button.dataset.timelineAction) {
                    case 'zoom-in': zoom(1.25); break
                    case 'zoom-out': zoom(.8); break
                    case 'follow': this.worker.postMessage({ type: 'follow' }); break
                }
            }, { signal })
        })
        canvas.addEventListener('wheel', event => {
            event.preventDefault()
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1
            if (event.ctrlKey || event.metaKey) {
                const rect = canvas.getBoundingClientRect()
                zoom(Math.exp(-event.deltaY * unit * .002), (event.clientX - rect.left) / rect.width)
            } else {
                pan((event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit, event.shiftKey ? 0 : -event.deltaY * unit)
            }
        }, { signal, passive: false })
        let pointer: number | undefined
        let x = 0
        let y = 0
        canvas.addEventListener('pointerdown', event => {
            if (event.button !== 0 || pointer !== undefined) return
            pointer = event.pointerId
            x = event.clientX
            y = event.clientY
            canvas.setPointerCapture(pointer)
            canvas.focus({ preventScroll: true })
        }, { signal })
        canvas.addEventListener('pointermove', event => {
            if (pointer !== event.pointerId) return
            pan(x - event.clientX, event.clientY - y)
            x = event.clientX
            y = event.clientY
        }, { signal })
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            canvas.addEventListener(type, () => { pointer = undefined }, { signal })
        }
        canvas.addEventListener('keydown', event => {
            const movements: Record<string, [number, number]> = { ArrowLeft: [-100, 0], ArrowRight: [100, 0], ArrowUp: [0, 42], ArrowDown: [0, -42] }
            if (event.key in movements) pan(...movements[event.key])
            else if (['+', '=', '-'].includes(event.key)) zoom(event.key === '-' ? .8 : 1.25)
            else if (event.key === 'Home') this.worker.postMessage({ type: 'follow' })
            else return
            event.preventDefault()
        }, { signal })
        this.observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect
            if (width && height) this.worker.postMessage({ type: 'resize', displayWidth: Math.round(width), displayHeight: Math.round(height) })
        })
        this.observer.observe(canvas)
    }

    noteOn(note: number, velocity = 1, colour = convertNoteNumberToColour(note)) {
        this.worker.postMessage({ type: 'noteOn', note, velocity, colour, time: performance.timeOrigin + performance.now() })
    }

    noteOff(note: number) {
        this.worker.postMessage({ type: 'noteOff', note, time: performance.timeOrigin + performance.now() })
    }

    allNotesOff() {
        this.worker.postMessage({ type: 'allNotesOff', time: performance.timeOrigin + performance.now() })
    }

    clear() { this.worker.postMessage({ type: 'clear' }) }

    destroy() {
        this.interactions.abort()
        this.observer.disconnect()
        this.worker.terminate()
    }
}
