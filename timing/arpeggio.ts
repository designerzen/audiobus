/**
 * Arpeggio sequencing and timing helpers: which notes an arpeggio or harp plays
 * for a chord, how often it steps for a tempo, and how long each note is gated.
 */
export const ARPEGGIO_FAST_BPM_THRESHOLD = 90
export const ARPEGGIO_GRID_QUARTER_NOTE = "quarter-note"
export const ARPEGGIO_GRID_HALF_NOTE = "half-note"
export const ARPEGGIO_GRID_BAR = "bar"
export const ARPEGGIO_GRID_CLOCK = "clock"
export const DEFAULT_CLOCK_DIVISIONS_PER_BAR = 24
export const ARPEGGIO_VARIATION = "arpeggio"
export const HARP_ARPEGGIO_VARIATION = "harp"
export const ARPEGGIO_RATE_AUTO = "auto"
export const ARPEGGIO_RATE_SLOW = "slow"
export const ARPEGGIO_RATE_MEDIUM = "medium"
export const ARPEGGIO_RATE_FAST = "fast"

export type ArpeggioGrid =
	| typeof ARPEGGIO_GRID_QUARTER_NOTE
	| typeof ARPEGGIO_GRID_HALF_NOTE
	| typeof ARPEGGIO_GRID_BAR
	| typeof ARPEGGIO_GRID_CLOCK
export type ArpeggioVariation = typeof ARPEGGIO_VARIATION | typeof HARP_ARPEGGIO_VARIATION
export type ArpeggioRate =
	| typeof ARPEGGIO_RATE_AUTO
	| typeof ARPEGGIO_RATE_SLOW
	| typeof ARPEGGIO_RATE_MEDIUM
	| typeof ARPEGGIO_RATE_FAST

export interface ArpeggioConfig {
	/** How many octaves the sequence climbs through */
	octaveSpan: number
	/** Clock ticks between steps, or 0 to step on the tempo grid instead */
	clockStep: number
}

export interface ArpeggioTimingOptions {
	grid?: string
	forceBar?: boolean
	isBar?: boolean
	isHalfNote?: boolean
	isQuarterNote?: boolean
	clockStep?: number
	tickDurationMs?: number
	divisionsElapsed?: number
	totalDivisions?: number
	gateRatio?: number
	minimumGateMs?: number
	maximumGateMs?: number
	minimumRestMs?: number
}

export interface ArpeggioTiming {
	grid: ArpeggioGrid
	intervalMs: number
	gateMs: number
	shouldTrigger: boolean
}

const ARPEGGIO_GRIDS = new Set<string>([
	ARPEGGIO_GRID_QUARTER_NOTE,
	ARPEGGIO_GRID_HALF_NOTE,
	ARPEGGIO_GRID_BAR,
	ARPEGGIO_GRID_CLOCK
])

const ARPEGGIO_RATE_LABELS: Readonly<Record<string, string>> = Object.freeze({
	[ARPEGGIO_RATE_AUTO]: "Auto",
	[ARPEGGIO_RATE_SLOW]: "Slow",
	[ARPEGGIO_RATE_MEDIUM]: "Medium",
	[ARPEGGIO_RATE_FAST]: "Fast"
})

const ARPEGGIO_VARIATIONS: Readonly<Record<ArpeggioVariation, Readonly<ArpeggioConfig>>> =
	Object.freeze({
		[ARPEGGIO_VARIATION]: Object.freeze({ octaveSpan: 1, clockStep: 0 }),
		[HARP_ARPEGGIO_VARIATION]: Object.freeze({ octaveSpan: 4, clockStep: 4 })
	})

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const normaliseArpeggioGrid = (grid: unknown) =>
	typeof grid === "string" && ARPEGGIO_GRIDS.has(grid) ? (grid as ArpeggioGrid) : null

export const normaliseArpeggioRate = (rate: unknown): ArpeggioRate =>
	typeof rate === "string" && ARPEGGIO_RATE_LABELS[rate]
		? (rate as ArpeggioRate)
		: ARPEGGIO_RATE_AUTO
export const getArpeggioRateLabel = (rate: unknown) =>
	ARPEGGIO_RATE_LABELS[normaliseArpeggioRate(rate)]
export const isArpeggioPlayMode = (playMode: unknown) =>
	playMode === ARPEGGIO_VARIATION || playMode === HARP_ARPEGGIO_VARIATION
export const hasPresentArpeggioPlayer = (
	people: ReadonlyArray<{ alive?: boolean; playMode?: unknown } | null | undefined> = []
) => people.some((person) => person?.alive && isArpeggioPlayMode(person?.playMode))

/** Timing options for a named rate. Harp steps on the clock, plain arpeggio on the tempo grid. */
export const getArpeggioTimingOptionsForRate = (
	rate: unknown,
	playMode: string = ARPEGGIO_VARIATION
): ArpeggioTimingOptions => {
	const harp = playMode === HARP_ARPEGGIO_VARIATION
	switch (normaliseArpeggioRate(rate)) {
		case ARPEGGIO_RATE_SLOW:
			return harp ? { clockStep: 8 } : { grid: ARPEGGIO_GRID_BAR }
		case ARPEGGIO_RATE_MEDIUM:
			return harp ? { clockStep: 4 } : { grid: ARPEGGIO_GRID_HALF_NOTE }
		case ARPEGGIO_RATE_FAST:
			return harp ? { clockStep: 2 } : { grid: ARPEGGIO_GRID_QUARTER_NOTE }
		default:
			return {}
	}
}

export const getArpeggioGridForBPM = (bpm: unknown, forceBar = false): ArpeggioGrid => {
	const numericBPM = Number(bpm)
	if (forceBar) {
		return ARPEGGIO_GRID_BAR
	}
	return Number.isFinite(numericBPM) && numericBPM > ARPEGGIO_FAST_BPM_THRESHOLD
		? ARPEGGIO_GRID_HALF_NOTE
		: ARPEGGIO_GRID_QUARTER_NOTE
}

export const getArpeggioTriggerIntervalMs = (
	bpm: unknown,
	grid: string = getArpeggioGridForBPM(bpm)
) => {
	const numericBPM = Number(bpm)
	const safeBPM =
		Number.isFinite(numericBPM) && numericBPM > 0 ? numericBPM : ARPEGGIO_FAST_BPM_THRESHOLD
	const quarterNoteMs = 60000 / safeBPM
	return grid === ARPEGGIO_GRID_BAR
		? quarterNoteMs * 4
		: grid === ARPEGGIO_GRID_HALF_NOTE
			? quarterNoteMs * 2
			: quarterNoteMs
}

export const getArpeggioGateMs = (
	bpm: unknown,
	{
		grid = getArpeggioGridForBPM(bpm),
		gateRatio = 0.65,
		minimumGateMs = 80,
		maximumGateMs = 900,
		minimumRestMs = 80
	}: ArpeggioTimingOptions = {}
) => {
	const intervalMs = getArpeggioTriggerIntervalMs(bpm, grid)
	const upperGateMs = Math.max(minimumGateMs, Math.min(maximumGateMs, intervalMs - minimumRestMs))
	return Math.round(clamp(intervalMs * gateRatio, minimumGateMs, upperGateMs))
}

export const getArpeggioTiming = (
	bpm: unknown,
	options: ArpeggioTimingOptions = {}
): ArpeggioTiming => {
	const clockStep = Number(options.clockStep)
	if (Number.isInteger(clockStep) && clockStep > 0) {
		const numericTickDurationMs = Number(options.tickDurationMs)
		const divisionsElapsed = Number(options.divisionsElapsed)
		const totalDivisions =
			Number.isFinite(Number(options.totalDivisions)) && Number(options.totalDivisions) > 0
				? Number(options.totalDivisions)
				: DEFAULT_CLOCK_DIVISIONS_PER_BAR
		const fallbackBarMs = getArpeggioTriggerIntervalMs(bpm, ARPEGGIO_GRID_HALF_NOTE) * 2
		const tickDurationMs =
			Number.isFinite(numericTickDurationMs) && numericTickDurationMs > 0
				? numericTickDurationMs
				: fallbackBarMs / totalDivisions
		const intervalMs = tickDurationMs * clockStep
		const minimumRestMs = Math.min(12, intervalMs * 0.18)
		return {
			grid: ARPEGGIO_GRID_CLOCK,
			intervalMs,
			gateMs: Math.max(8, Math.round(intervalMs - minimumRestMs)),
			shouldTrigger: Number.isInteger(divisionsElapsed) && divisionsElapsed % clockStep === 0
		}
	}

	const grid = normaliseArpeggioGrid(options.grid) ?? getArpeggioGridForBPM(bpm, options.forceBar)
	const intervalMs = getArpeggioTriggerIntervalMs(bpm, grid)
	const gateMs = getArpeggioGateMs(bpm, { ...options, grid })
	return {
		grid,
		intervalMs,
		gateMs,
		shouldTrigger:
			grid === ARPEGGIO_GRID_BAR
				? Boolean(options.isBar)
				: grid === ARPEGGIO_GRID_HALF_NOTE
					? Boolean(options.isHalfNote)
					: Boolean(options.isQuarterNote)
	}
}

/** What Arpeggio.configure accepts: false/"chord" disables, a variation name, or a variation with overrides. */
export type ArpeggioSettings = false | string | (Partial<ArpeggioConfig> & { variation?: string })

export class Arpeggio {
	enabled = false
	variation: ArpeggioVariation = ARPEGGIO_VARIATION
	config: Readonly<ArpeggioConfig> = ARPEGGIO_VARIATIONS[ARPEGGIO_VARIATION]

	configure(value: ArpeggioSettings | null | undefined = false): Readonly<ArpeggioConfig> {
		if (!value || value === "chord") {
			this.enabled = false
			return this.config
		}

		const requested =
			typeof value === "string" ? value : (value.variation ?? ARPEGGIO_VARIATION)
		this.variation = Object.hasOwn(ARPEGGIO_VARIATIONS, requested)
			? (requested as ArpeggioVariation)
			: ARPEGGIO_VARIATION
		const baseConfig = ARPEGGIO_VARIATIONS[this.variation]
		this.config =
			typeof value === "object"
				? Object.freeze({
						octaveSpan:
							Number.isInteger(value.octaveSpan) && (value.octaveSpan as number) > 0
								? (value.octaveSpan as number)
								: baseConfig.octaveSpan,
						clockStep:
							Number.isInteger(value.clockStep) && (value.clockStep as number) >= 0
								? (value.clockStep as number)
								: baseConfig.clockStep
					})
				: baseConfig
		this.enabled = true
		return this.config
	}

	/** The chord repeated up through octaveSpan octaves, dropping notes above 127. */
	getSequence<T extends { noteNumber: number }>(chordArray: readonly T[] = []): T[] {
		const sequence: T[] = []
		for (let octave = 0; octave < this.config.octaveSpan; ++octave) {
			const octaveOffset = octave * 12
			chordArray.forEach((chord) => {
				const noteNumber = chord?.noteNumber + octaveOffset
				if (Number.isFinite(noteNumber) && noteNumber <= 127) {
					sequence.push({ ...chord, noteNumber })
				}
			})
		}
		return sequence
	}

	getTiming(bpm: unknown, options: ArpeggioTimingOptions = {}): ArpeggioTiming {
		return getArpeggioTiming(bpm, { clockStep: this.config.clockStep, ...options })
	}
}