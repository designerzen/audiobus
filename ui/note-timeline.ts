export interface TimelineNote {
    note: number
    colour: string
    start: number
    end: number | null
}

interface NoteBlock {
    notes: TimelineNote[]
    first: number
    end: number
    active: number
}

export class NoteTimeline {
    notes: TimelineNote[] = []
    active = new Map<number, TimelineNote[]>()
    private blocks: NoteBlock[] = []
    private noteBlocks = new WeakMap<TimelineNote, NoteBlock>();

    // Skip whole blocks of expired notes while retaining history for panning.
    *visibleNotes(start: number, end: number): IterableIterator<TimelineNote> {
        for (const block of this.blocks) {
            if (block.first > end || (block.active === 0 && block.end < start)) continue
            for (const note of block.notes) {
                if (note.start <= end && (note.end === null || note.end >= start)) yield note
            }
        }
    }

    clear(): void {
        this.notes.length = 0
        this.active.clear()
        this.blocks = []
        this.noteBlocks = new WeakMap()
    }

    noteOn(note: number, time: number, colour: string, velocity = 1) {
        if (velocity === 0) return this.noteOff(note, time)
        if (!Number.isInteger(note) || note < 0 || note > 127) return
        const event = { note, colour, start: time, end: null }
        this.notes.push(event)
        let block = this.blocks[this.blocks.length - 1]
        if (!block || block.notes.length === 256) {
            block = { notes: [], first: time, end: time, active: 0 }
            this.blocks.push(block)
        }
        block.notes.push(event)
        block.first = Math.min(block.first, time)
        block.active++
        this.noteBlocks.set(event, block)
        const pending = this.active.get(note) ?? []
        pending.push(event)
        this.active.set(note, pending)
    }

    noteOff(note: number, time: number) {
        const pending = this.active.get(note)
        const event = pending?.shift()
        if (event) this.finish(event, time)
        if (!pending?.length) this.active.delete(note)
    }

    allNotesOff(time: number) {
        for (const pending of this.active.values()) {
            for (const event of pending) this.finish(event, time)
        }
        this.active.clear()
    }

    private finish(event: TimelineNote, time: number): void {
        event.end = Math.max(event.start, time)
        const block = this.noteBlocks.get(event)!
        block.end = Math.max(block.end, event.end)
        block.active--
    }
}
