/** All times and offsets are seconds in the injected audio clock's domain. */
export interface IPercussionClock {
	readonly currentTime: number
}

export type CancelPercussion = () => boolean

export interface IPercussionScheduler {
	schedule(triggerAt: number, callback: () => void): CancelPercussion
}

/** Velocity is normalised to 0–1 at the IO boundary. */
export interface PercussionHit {
	part: string
	velocity: number
	triggerAt: number
	open?: boolean
	lengthScale?: number
	tuningNote?: number
}

export interface IPercussionOutput {
	/** Schedule against the shared audio clock, including future subdivisions. */
	trigger(hit: Readonly<PercussionHit>): void
	/** Silence active voices and cancel pending hits owned by this output. */
	allNotesOff(): void
}

export interface PercussionPress {
	inputId: string
	part: string
	velocity?: number
	inputAudioTime?: number
	triggerAt?: number
	open?: boolean
}

export interface IPercussionInput {
	subscribe(handlers: {
		press: (press: PercussionPress) => void
		release: (inputId: string) => void
	}): () => void
}

export interface PercussionTiming {
	tickAudioTime: number
	divisionsElapsed: number
	tickDuration: number
}

export interface PercussionQuantiseOptions {
	ticksPerGrid?: number
	scheduleAhead?: number
}

export interface IPercussionQuantiser {
	update(timing: PercussionTiming): void
	getTriggerAt(input: { inputAudioTime?: number; now: number }): number | null
}

export type DrumCoreLane = 'kick' | 'snare' | 'hat' | 'clap'
export type DrumSubdivisionStyle = 'auto' | 'triplet' | 'sextuplet' | 'rapid'
export type DrumPerformancePreset =
	| 'auto'
	| 'steady'
	| 'crescendo'
	| 'bridge'
	| 'snare-roll'
	| 'breakdown'
	| 'drop'

export interface DrumIntent {
	energy: number
	density: number
	tension: number
	fillChance: number
	rollChance: number
	chaos: number
	muteKick: boolean
	muteSnare: boolean
	muteHat: boolean
	muteClap: boolean
}

export type DrumGroove = Record<DrumCoreLane, readonly number[]> & {
	[lane: string]: readonly number[] | DrumGrooveTiming | DrumGroovePerformance | undefined
	performance?: DrumGroovePerformance
	timing?: DrumGrooveTiming
}

export interface DrumGrooveTiming {
	style: DrumSubdivisionStyle
	every?: number
	phase?: number
}

/** Pattern velocities retain Photosynth's 0–255 range. */
export interface DrumSubHit {
	lane: string
	offset: number
	velocity: number
	division: number
	lengthScale?: number
}

export interface DrumParts {
	[lane: string]: number | boolean | DrumSubHit[]
	kick: number
	snare: number
	hat: number
	clap: number
	hatOpen: boolean
	events: DrumSubHit[]
}

export interface DrumStepContext {
	bpm?: number
	triggerAt?: number
	stepDuration?: number
}

export interface DrumPerformanceInput {
	noteVelocity?: number
	velocity?: number
	pitchBend?: number
	bend?: number
}

export interface DrumArrangerOptions {
	seed?: string | number
	groove?: string | DrumGroove
	phraseBars?: number
	stepsPerBar?: number
	bpm?: number
	intent?: Partial<DrumIntent>
	rapidPercussion?: boolean
	performanceControl?: boolean
	performancePreset?: DrumPerformancePreset
	percussionColours?: boolean
}

export interface IDrumArranger {
	next(context?: DrumStepContext): DrumParts
	getStep(): number
	getStepsPerBar(): number
	getBPM(): number
}

export interface PercussionEnvelope {
	length: number
	attack: number
	decay: number
	release?: number
}

export interface DrumGroovePerformance {
	velocityFloor: number
	energyVelocity: number
	tensionVelocity: number
}
