import type { AudioClockTick } from './audio-clock-tick.ts'
import type { DrumGroove, PercussionHit } from './percussion-types.ts'

export interface DrumBreakSettings {
	energy: number
	density: number
	tension: number
	fillChance: number
	chaos: number
	activityResponse: number
	rapidPercussion: boolean
	tuningNote: number
	muteKick: boolean
	muteSnare: boolean
	muteHat: boolean
	muteClap: boolean
}

/** The transport selects each pattern position; note events never advance or restart it. */
export class DrumBreakPlayer {
	private lastStep: number | undefined
	private activity = 0
	private pendingNotes = 0
	private fillRequested = false

	recordActivity(velocity: number): void {
		if (Number.isFinite(velocity) && velocity > 0)
			this.pendingNotes = Math.min(4, this.pendingNotes + 1)
	}

	requestFill(): void {
		this.fillRequested = true
	}

	reset(): void {
		this.lastStep = undefined
		this.activity = 0
		this.pendingNotes = 0
		this.fillRequested = false
	}

	render(
		tick: Readonly<AudioClockTick>,
		groove: DrumGroove,
		settings: Readonly<DrumBreakSettings>,
	): PercussionHit[] {
		if (
			!Number.isSafeInteger(tick.step) ||
			tick.step < 0 ||
			!Number.isFinite(tick.triggerAt) ||
			!Number.isFinite(tick.stepDuration) ||
			tick.stepDuration <= 0 ||
			tick.step === this.lastStep
		)
			return []
		if (this.lastStep !== undefined && tick.step < this.lastStep) this.reset()
		const elapsed = Math.max(1, tick.step - (this.lastStep ?? tick.step)) * tick.stepDuration
		this.activity = Math.min(
			1,
			this.activity * Math.exp(-elapsed / 2) + this.pendingNotes * 0.075,
		)
		this.pendingNotes = 0
		this.lastStep = tick.step
		const hits: PercussionHit[] = []
		const muted = (part: string) =>
			(part === 'kick' && settings.muteKick) ||
			(part === 'snare' && settings.muteSnare) ||
			(part === 'hat' && settings.muteHat) ||
			(part === 'clap' && settings.muteClap)
		for (const [part, sequence] of Object.entries(groove)) {
			if (
				!Array.isArray(sequence) ||
				!sequence.length ||
				muted(part) ||
				settings.density <= 0
			)
				continue
			const position = tick.step % sequence.length
			const velocity = sequence[position]
			if (velocity <= 0) continue
			// Sparse settings remove the same quiet notes on every loop, preserving accents.
			if (
				settings.density < 0.5 &&
				velocity < 180 &&
				(position % 8) / 8 >= settings.density * 2
			)
				continue
			hits.push({
				part,
				velocity: (velocity / 255) * (0.5 + settings.energy * 0.5),
				triggerAt: tick.triggerAt,
				tuningNote: settings.tuningNote,
			})
		}
		const busy = Math.max(0, this.activity - 0.5) * 2 * settings.activityResponse
		const bar = Math.floor(tick.step / 16)
		const variationBar = ((bar * 37) % 100) / 100 < settings.fillChance * busy
		if (tick.step % 16 >= 12 && (this.fillRequested || variationBar) && settings.density > 0) {
			const part = settings.tension > 0.5 && tick.step % 2 === 1 ? 'snare' : 'hat'
			if (!muted(part)) {
				const division = settings.rapidPercussion ? 3 : 2
				for (let position = 1; position < division; position++) {
					hits.push({
						part,
						velocity: Math.min(
							0.2,
							0.08 + settings.energy * 0.08 + settings.chaos * 0.04,
						),
						triggerAt: tick.triggerAt + (tick.stepDuration * position) / division,
						lengthScale: 0.4,
						tuningNote: settings.tuningNote,
					})
				}
			}
		}
		if (tick.step % 16 === 15) this.fillRequested = false
		return hits
	}
}