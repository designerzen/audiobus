export interface TimelineNote {
    note: number
    colour: string
    start: number
    end: number | null
}

export class NoteTimeline {
    notes: TimelineNote[] = []
    active = new Map<number, TimelineNote[]>()

    noteOn(note: number, time: number, colour: string, velocity = 1) {
        if (velocity === 0) return this.noteOff(note, time)
        if (!Number.isInteger(note) || note < 0 || note > 127) return
        const event = { note, colour, start: time, end: null }
        this.notes.push(event)
        const pending = this.active.get(note) ?? []
        pending.push(event)
        this.active.set(note, pending)
    }

    noteOff(note: number, time: number) {
        const pending = this.active.get(note)
        const event = pending?.shift()
        if (event) event.end = Math.max(event.start, time)
        if (!pending?.length) this.active.delete(note)
    }

    allNotesOff(time: number) {
        for (const pending of this.active.values()) {
            for (const event of pending) event.end = Math.max(event.start, time)
        }
        this.active.clear()
    }
}
