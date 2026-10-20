import type { IAudioOutput } from '../io/outputs/output-interface.ts'
import type {
	CancelPercussion,
	IPercussionOutput,
	IPercussionScheduler,
	PercussionHit,
} from './percussion-types.ts'
import { GENERAL_MIDI_PERCUSSION_NOTES } from './percussion-note-map.ts'

const LONG_PERCUSSION_VOICES = new Set([
	'triangleOpen',
	'crash',
	'crash2',
	'ride',
	'ride2',
	'rideBell',
	'splash',
	'china',
	'jingleBell',
	'starChime',
	'windChime',
	'whistleLong',
	'surdoOpen',
])

/** Adapts an audiobus note output; channel selection remains with that output. */
export class PercussionAudioOutput implements IPercussionOutput {
	private readonly pending = new Set<CancelPercussion>()

	constructor(
		private readonly output: Pick<IAudioOutput, 'noteOn' | 'noteOff' | 'allNotesOff'>,
		private readonly scheduler: IPercussionScheduler,
		private readonly notes: Readonly<Record<string, number>> = GENERAL_MIDI_PERCUSSION_NOTES,
		private readonly duration?: number,
	) {
		if (duration !== undefined && (!Number.isFinite(duration) || duration <= 0))
			throw new RangeError('Note duration must be positive')
	}

	trigger(hit: Readonly<PercussionHit>): void {
		const part = hit.part === 'hat' ? (hit.open ? 'hatOpen' : 'hatClosed') : hit.part
		const note = this.notes[part]
		if (
			!Number.isInteger(note) ||
			note < 0 ||
			note > 127 ||
			!Number.isFinite(hit.velocity) ||
			hit.velocity <= 0
		)
			return
		const velocity = Math.max(1, Math.round(Math.min(1, hit.velocity) * 127))
		this.schedule(hit.triggerAt, () => {
			if (part === 'hatClosed' && this.notes.hatOpen !== undefined)
				this.output.noteOff(this.notes.hatOpen)
			void this.output.noteOn(note, velocity)
		})
		const duration =
			this.duration ??
			(LONG_PERCUSSION_VOICES.has(part) ? 0.65 : part === 'hatOpen' ? 0.22 : 0.06)
		this.schedule(hit.triggerAt + duration * (hit.lengthScale ?? 1), () =>
			this.output.noteOff(note),
		)
	}

	allNotesOff(): void {
		for (const cancel of this.pending) cancel()
		this.pending.clear()
		this.output.allNotesOff()
	}

	private schedule(triggerAt: number, callback: () => void): void {
		let completed = false
		let cancel: CancelPercussion | undefined
		cancel = this.scheduler.schedule(triggerAt, () => {
			completed = true
			if (cancel) this.pending.delete(cancel)
			callback()
		})
		if (!completed) this.pending.add(cancel)
	}
}