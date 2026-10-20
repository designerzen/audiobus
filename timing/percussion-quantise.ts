import type {
	IPercussionQuantiser,
	PercussionTiming,
	PercussionQuantiseOptions,
} from './percussion-types.ts'

export const PERCUSSION_QUANTISE_TICKS = 3
export const PERCUSSION_SCHEDULE_AHEAD_SECONDS = 0.005
export const PERCUSSION_IMMEDIATE_DELAY_SECONDS = 0.01
export const PERCUSSION_HOLD_THRESHOLD_TICKS = 96

export const PERCUSSION_REPEAT_TICKS = Object.freeze({
	kick: 48,
	'sub-kick': 24,
	snare: 24,
	clap: 24,
	cowbell: 12,
	clack: 12,
	rim: 12,
	'low-tom': 24,
	'mid-tom': 24,
	'high-tom': 24,
	hat: 3,
	shaker: 3,
	maracas: 3,
	cabasa: 3,
	'low-bongo': 24,
	'high-bongo': 24,
	'low-conga': 24,
	'high-conga': 24,
	'mute-conga': 3,
	'mute-triangle': 12,
	'open-triangle': 24,
	ride: 12,
	crash: 48,
	rimshot: 12,
	'cross-stick': 12,
	claves: 12,
	'woodblock-high': 12,
	'woodblock-low': 12,
	castanets: 3,
	splash: 24,
	china: 48,
	tambourine: 3,
	chekere: 3,
	'agogo-high': 12,
	'agogo-low': 12,
	'timbale-high': 24,
	'timbale-low': 24,
	'guiro-short': 24,
	'guiro-long': 24,
	'cuica-mute': 24,
	'cuica-open': 24,
	'whistle-short': 24,
	'whistle-long': 48,
	'surdo-mute': 24,
	'surdo-open': 48,
	quijada: 24,
	'star-chime': 48,
	'wind-chime': 48,
	'finger-snap': 12,
	syndrum: 24,
	'laser-tom': 24,
	'metal-hit': 24,
})

const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor

export const getNextPercussionGridTime = ({
	now,
	inputAudioTime = now,
	tickAudioTime,
	divisionsElapsed,
	tickDuration,
	ticksPerGrid = PERCUSSION_QUANTISE_TICKS,
	scheduleAhead = PERCUSSION_SCHEDULE_AHEAD_SECONDS,
}: PercussionTiming & PercussionQuantiseOptions & { now: number; inputAudioTime?: number }):
	| number
	| null => {
	if (
		!Number.isFinite(now) ||
		!Number.isFinite(inputAudioTime) ||
		!Number.isFinite(tickAudioTime) ||
		!Number.isFinite(divisionsElapsed) ||
		!Number.isFinite(tickDuration) ||
		tickDuration <= 0 ||
		!Number.isInteger(ticksPerGrid) ||
		ticksPerGrid < 1
	) {
		return null
	}

	const gridDuration = tickDuration * ticksPerGrid
	const divisionInGrid = modulo(divisionsElapsed, ticksPerGrid)
	const gridOrigin = tickAudioTime - divisionInGrid * tickDuration
	const gridsAfterOrigin = Math.max(0, Math.ceil((inputAudioTime - gridOrigin) / gridDuration))
	let triggerAt = gridOrigin + gridsAfterOrigin * gridDuration
	const earliestTriggerAt = now + Math.max(0, scheduleAhead)

	if (triggerAt < earliestTriggerAt) {
		const gridsUntilFuture = Math.ceil((earliestTriggerAt - triggerAt) / gridDuration)
		triggerAt += gridsUntilFuture * gridDuration
	}

	return triggerAt
}

export class PercussionQuantiser implements IPercussionQuantiser {
	private timing: PercussionTiming | null = null
	constructor(private readonly options: PercussionQuantiseOptions = {}) {}
	update(timing: PercussionTiming): void {
		this.timing = { ...timing }
	}
	reset(): void {
		this.timing = null
	}
	getTriggerAt(input: { inputAudioTime?: number; now: number }): number | null {
		return this.timing
			? getNextPercussionGridTime({ ...this.options, ...this.timing, ...input })
			: null
	}
}

export const createPercussionQuantiser = (
	options: PercussionQuantiseOptions = {},
): PercussionQuantiser => new PercussionQuantiser(options)

export const getPercussionTriggerTime = ({
	now,
	inputAudioTime = now,
	triggerAt,
	quantise,
	quantiser,
	immediateDelay = PERCUSSION_IMMEDIATE_DELAY_SECONDS,
}: {
	now: number
	inputAudioTime?: number
	triggerAt?: number
	quantise?: boolean
	quantiser?: IPercussionQuantiser
	immediateDelay?: number
}): number => {
	if (triggerAt !== undefined && Number.isFinite(triggerAt)) return triggerAt
	if (quantise) {
		const quantised = quantiser?.getTriggerAt({ inputAudioTime, now })
		if (quantised !== undefined && quantised !== null && Number.isFinite(quantised))
			return quantised
	}
	return now + immediateDelay
}