import type {
	DrumArrangerOptions,
	DrumIntent,
	DrumGroove,
	DrumParts,
	DrumStepContext,
	DrumPerformanceInput,
	DrumPerformancePreset,
	DrumSubHit,
	DrumSubdivisionStyle,
	PercussionEnvelope,
	IDrumArranger,
} from './percussion-types.ts'
import {
	kickSequences,
	snareSequences,
	hatSequences,
	drumRollSequence,
	DRUM_GROOVES,
	AUXILIARY_DRUM_LANES,
} from './drum-patterns.ts'
const CORE_LANES = ['kick', 'snare', 'hat', 'clap']
const DEFAULT_INTENT: DrumIntent = {
	energy: 0.5,
	density: 0.5,
	tension: 0.35,
	fillChance: 0.35,
	rollChance: 0.25,
	chaos: 0.15,
	muteKick: false,
	muteSnare: false,
	muteHat: false,
	muteClap: false,
}
export const DRUM_PERFORMANCE_PRESETS = Object.freeze({
	steady: Object.freeze({ id: 'steady', title: 'Steady' }),
	crescendo: Object.freeze({ id: 'crescendo', title: 'Crescendo' }),
	bridge: Object.freeze({ id: 'bridge', title: 'Bridge' }),
	'snare-roll': Object.freeze({ id: 'snare-roll', title: 'Snare Roll' }),
	breakdown: Object.freeze({ id: 'breakdown', title: 'Breakdown' }),
	drop: Object.freeze({ id: 'drop', title: 'Drop' }),
})
const PERFORMANCE_PRESET_IDS = new Set(['auto', ...Object.keys(DRUM_PERFORMANCE_PRESETS)])
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))
const clampVelocity = (value: number) => Math.round(Math.min(255, Math.max(0, value)))
const wrap = (index: number, length: number) => ((index % length) + length) % length
// Additional hits scheduled inside the current beat. Keeping these as offsets
// avoids increasing the master clock rate and gives tuplets an exact grid.
export const createDrumSubHits = ({
	inFill,
	inRoll,
	stepInPhrase,
	bpm,
	intent,
	style = 'auto',
	random = Math.random,
	stepDuration,
}: {
	inFill: boolean
	inRoll: boolean
	stepInPhrase: number
	bpm: number
	intent: Pick<DrumIntent, 'density' | 'energy' | 'tension'>
	style?: DrumSubdivisionStyle
	random?: () => number
	stepDuration?: number
}): DrumSubHit[] => {
	if ((!inFill && !inRoll) || !Number.isFinite(bpm) || bpm <= 0) {
		return []
	}
	const beat = stepDuration ?? 60 / bpm
	const events: DrumSubHit[] = []
	const add = (lane: string, division: number, positions: number[], strength: number) =>
		positions.forEach((position) => {
			const accent = position === positions.length - 1 ? 1 : 0.82 + random() * 0.12
			events.push({
				lane,
				offset: (beat * position) / division,
				velocity: clampVelocity(strength * accent),
				division,
			})
		})
	if (inFill) {
		// Alternate straight rapid bursts with true triplets/sextuplets so fills
		// do not collapse into the same machine-gun rhythm every phrase.
		const tripletFill =
			style === 'triplet' ||
			style === 'sextuplet' ||
			(style === 'auto' && stepInPhrase % 2 === 0)
		const density = intent.density + intent.energy + intent.tension
		if (tripletFill) {
			const hatDivision = style === 'triplet' ? 3 : 6
			add(
				'hat',
				hatDivision,
				Array.from({ length: hatDivision - 1 }, (_, index) => index + 1),
				105 + intent.energy * 100,
			)
		} else {
			const division = style === 'rapid' || density > 1.75 ? 8 : 4
			add(
				'hat',
				division,
				Array.from({ length: division - 1 }, (_, index) => index + 1),
				100 + intent.energy * 105,
			)
		}
	} else if (inRoll) {
		add('hat', 3, [1, 2], 95 + intent.energy * 105)
	}
	// Equal-power density compensation prevents tuplets from becoming several
	// times louder simply because more voices occur inside one beat.
	const densityGain = Math.min(0.6, 1 / Math.sqrt(Math.max(1, events.length)))
	return events
		.map((event) => ({
			...event,
			velocity: clampVelocity(event.velocity * densityGain),
			lengthScale:
				event.lane === 'hat'
					? Math.min(0.55, 1.8 / event.division)
					: Math.min(0.65, 2.4 / event.division),
		}))
		.sort((a, b) => a.offset - b.offset)
}
export const applyDrumSubHitEnvelope = (
	options: PercussionEnvelope,
	event: DrumSubHit,
	output?: Partial<PercussionEnvelope>,
): PercussionEnvelope => {
	const minimumLength = event.lane === 'hat' ? 0.025 : 0.04
	const length = Math.max(minimumLength, options.length * (event.lengthScale ?? 1))
	const scaled: PercussionEnvelope = Object.assign(output ?? {}, options)
	scaled.length = length
	scaled.attack = Math.min(options.attack, length * 0.15)
	scaled.decay = Math.min(options.decay, length * 0.3)
	if (Number.isFinite(options.release)) {
		scaled.release = Math.min(options.release!, length * 0.35)
	} else if (output) {
		delete scaled.release
	}
	return scaled
}
const hashSeed = (value: unknown) => {
	const text = String(value ?? 'photosynth-drums')
	let hash = 2166136261
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return hash >>> 0
}
// deterministic randomness
const createRandom = (seed: unknown) => {
	let state = hashSeed(seed)
	return () => {
		state += 0x6d2b79f5
		let value = state
		value = Math.imul(value ^ (value >>> 15), value | 1)
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296
	}
}
const sequenceDensity = (sequence: readonly number[]) => {
	const hits = sequence.filter((value) => value > 0).length
	return hits / sequence.length
}
const sequenceEnergy = (sequence: readonly number[]) => {
	const total = sequence.reduce((sum, value) => sum + value, 0)
	return total / (sequence.length * 255)
}
const createCells = (lane: string, sequences: readonly (readonly number[])[]) =>
	sequences.map((sequence, index) => ({
		id: `${lane}-${index}`,
		index,
		lane,
		sequence,
		density: sequenceDensity(sequence),
		energy: sequenceEnergy(sequence),
		length: sequence.length,
	}))
const chooseWeighted = <T>(
	items: readonly T[],
	score: (item: T) => number,
	random: () => number,
): T => {
	let total = 0
	const weighted = items.map((item) => {
		const weight = Math.max(0.001, score(item))
		total += weight
		return { item, weight }
	})
	let cursor = random() * total
	for (const entry of weighted) {
		cursor -= entry.weight
		if (cursor <= 0) {
			return entry.item
		}
	}
	return weighted[weighted.length - 1].item
}
const TEMPO_PROFILES = Object.freeze({
	unknown: Object.freeze({
		name: 'unknown',
		density: 0.5,
		fillChance: 0.9,
		rollChance: 0.8,
		stability: 0.9,
	}),
	slow: Object.freeze({
		name: 'slow',
		density: 0.7,
		fillChance: 1.2,
		rollChance: 1.1,
		stability: 0.75,
	}),
	medium: Object.freeze({
		name: 'medium',
		density: 0.55,
		fillChance: 1,
		rollChance: 0.9,
		stability: 0.9,
	}),
	fast: Object.freeze({
		name: 'fast',
		density: 0.42,
		fillChance: 0.75,
		rollChance: 0.65,
		stability: 1.05,
	}),
	veryFast: Object.freeze({
		name: 'very-fast',
		density: 0.32,
		fillChance: 0.55,
		rollChance: 0.45,
		stability: 1.2,
	}),
})
const getTempoProfile = (bpm: number) => {
	if (!Number.isFinite(bpm) || bpm <= 0) {
		return TEMPO_PROFILES.unknown
	}
	if (bpm < 72) {
		return TEMPO_PROFILES.slow
	}
	if (bpm < 118) {
		return TEMPO_PROFILES.medium
	}
	if (bpm < 154) {
		return TEMPO_PROFILES.fast
	}
	return TEMPO_PROFILES.veryFast
}
const createFill = (
	lane: string,
	stepInPhrase: number,
	phraseLength: number,
	tempoProfile: TempoProfile,
	intent: DrumIntent,
) => {
	const remaining = phraseLength - stepInPhrase
	const fillWindow = tempoProfile.name === 'very-fast' ? 4 : 8
	if (remaining > fillWindow) {
		return 0
	}
	const fillStep = fillWindow - remaining
	const ramp = (fillStep + 1) / fillWindow
	const energy = clamp(0.45 + intent.energy * 0.55)
	switch (lane) {
		case 'snare':
		case 'clap':
			return fillStep % 2 === 0 || ramp > 0.75
				? clampVelocity((120 + ramp * 135) * energy)
				: 0
		case 'hat':
			return clampVelocity((80 + ramp * 150) * energy)
		case 'kick':
			return remaining <= 3 && fillStep % 2 === 0 ? clampVelocity(150 + ramp * 90) : 0
		default:
			return 0
	}
}
const shouldKeepMutedHit = (lane: string, step: number, velocity: number, intent: DrumIntent) => {
	if (velocity <= 0) {
		return false
	}
	if (lane === 'kick' && intent.muteKick) {
		return step % 4 === 0 && velocity > 220 && intent.energy > 0.65
	}
	if ((lane === 'snare' || lane === 'clap') && (intent.muteSnare || intent.muteClap)) {
		return false
	}
	if (lane === 'hat' && intent.muteHat) {
		return step % 8 === 0 && intent.tension > 0.65
	}
	return true
}
type TempoProfile = ReturnType<typeof getTempoProfile>
type DrumCell = ReturnType<typeof createCells>[number]
interface ArrangerState {
	step: number
	bar: number
	phraseBars: number
	stepsPerBar: number
	bpm: number
	lastTriggerAt: number
	intent: DrumIntent
	current: Record<string, DrumCell>
	recentFills: number[]
	fillUntilStep: number
	rollUntilStep: number
	lastFillPhrase: number
	phrase: number
	rapidPercussion: boolean
	performanceControl: boolean
	performancePreset: DrumPerformancePreset
	performanceTechnique: DrumPerformancePreset
	techniqueStartedAtStep: number
	lastActivity: number
	activityReserve: number
	lastPersonUpdateAt: number | null
	lastParts: Partial<DrumParts>
}
export class DrumArranger implements IDrumArranger {
	private readonly random: () => number
	private readonly selectedGroove: DrumGroove | undefined
	private readonly auxiliaryLanes: readonly string[]
	private readonly activeLanes: readonly string[]
	private readonly exposedActiveLanes: readonly string[]
	private readonly beatSequenceCache: Map<number, Partial<DrumParts>[]>
	private readonly cells: Record<string, DrumCell[]>
	private readonly state: ArrangerState
	constructor(private readonly options: DrumArrangerOptions = {}) {
		if (
			![options.phraseBars ?? 8, options.stepsPerBar ?? 4].every(
				(value) => Number.isInteger(value) && value > 0,
			)
		)
			throw new RangeError('Phrase and bar lengths must be positive integers')
		this.random = createRandom(this.options.seed)
		this.selectedGroove =
			typeof this.options.groove === 'string'
				? DRUM_GROOVES[this.options.groove]
				: this.options.groove
		this.auxiliaryLanes = this.selectedGroove
			? AUXILIARY_DRUM_LANES.filter((lane) => Array.isArray(this.selectedGroove?.[lane]))
			: []
		this.activeLanes = [...CORE_LANES, ...this.auxiliaryLanes]
		this.exposedActiveLanes = Object.freeze([...this.activeLanes, 'cowbell'])
		this.beatSequenceCache = new Map()
		this.cells = {
			kick: createCells(
				'kick',
				this.selectedGroove ? [this.selectedGroove.kick] : kickSequences,
			),
			snare: createCells(
				'snare',
				this.selectedGroove ? [this.selectedGroove.snare] : snareSequences,
			),
			hat: createCells('hat', this.selectedGroove ? [this.selectedGroove.hat] : hatSequences),
			clap: createCells(
				'clap',
				this.selectedGroove ? [this.selectedGroove.clap] : snareSequences,
			),
		}
		for (const lane of this.auxiliaryLanes) {
			this.cells[lane] = createCells(lane, [this.selectedGroove![lane] as readonly number[]])
		}
		this.state = {
			step: -1,
			bar: 0,
			phraseBars: this.options.phraseBars ?? 8,
			stepsPerBar: this.options.stepsPerBar ?? 4,
			bpm: this.options.bpm ?? 0,
			lastTriggerAt: 0,
			intent: { ...DEFAULT_INTENT, ...(this.options.intent ?? {}) },
			current: {},
			recentFills: [],
			fillUntilStep: -1,
			rollUntilStep: -1,
			lastFillPhrase: -8,
			phrase: -1,
			rapidPercussion: this.options.rapidPercussion === true,
			performanceControl: this.options.performanceControl !== false,
			performancePreset: PERFORMANCE_PRESET_IDS.has(this.options.performancePreset ?? 'auto')
				? (this.options.performancePreset ?? 'auto')
				: 'auto',
			performanceTechnique:
				this.options.performancePreset && this.options.performancePreset !== 'auto'
					? this.options.performancePreset
					: 'steady',
			techniqueStartedAtStep: 0,
			lastActivity: clamp(this.options.intent?.energy ?? DEFAULT_INTENT.energy),
			activityReserve: 0,
			lastPersonUpdateAt: null,
			lastParts: {},
		}
	}
	private phraseLength() {
		return this.state.phraseBars * this.state.stepsPerBar
	}
	private currentTempoProfile() {
		return getTempoProfile(this.state.bpm)
	}
	private selectCell(lane: string, tempo: TempoProfile) {
		const intent = this.state.intent
		const targetDensity = clamp(intent.density * 0.65 + tempo.density * 0.35)
		const targetEnergy = clamp(intent.energy * 0.75 + targetDensity * 0.25)
		const previous = this.state.current[lane]
		return chooseWeighted(
			this.cells[lane],
			(cell) => {
				const densityDistance = Math.abs(cell.density - targetDensity)
				const energyDistance = Math.abs(cell.energy - targetEnergy)
				const repeatPenalty = previous && previous.id === cell.id ? 0.3 : 1
				const busyFastPenalty = tempo.name === 'very-fast' && cell.density > 0.6 ? 0.35 : 1
				const sparseSlowPenalty = tempo.name === 'slow' && cell.density < 0.18 ? 0.6 : 1
				return (
					(1.4 - densityDistance - energyDistance * 0.7) *
					repeatPenalty *
					busyFastPenalty *
					sparseSlowPenalty
				)
			},
			this.random,
		)
	}
	private choosePhrase() {
		this.state.phrase++
		const tempo = this.currentTempoProfile()
		this.activeLanes.forEach(
			(lane) => (this.state.current[lane] = this.selectCell(lane, tempo)),
		)
		const phraseDistance = this.state.phrase - this.state.lastFillPhrase
		const phraseAccent =
			this.state.phrase % 4 === 3 ? 1.4 : this.state.phrase % 2 === 1 ? 1 : 0.55
		const fillChance = clamp(
			0.08 * phraseAccent * tempo.fillChance +
				this.state.intent.fillChance * 0.18 +
				this.state.intent.tension * 0.08,
		)
		const rollChance = clamp(0.04 * tempo.rollChance + this.state.intent.rollChance * 0.12)
		const canFill = phraseDistance > 1
		if (canFill && this.random() < fillChance) {
			this.state.fillUntilStep = this.state.step + this.phraseLength()
			this.state.lastFillPhrase = this.state.phrase
			this.state.recentFills.push(this.state.phrase)
			this.state.recentFills = this.state.recentFills.slice(-8)
		} else if (canFill && this.random() < rollChance) {
			this.state.rollUntilStep = this.state.step + this.phraseLength()
			this.state.lastFillPhrase = this.state.phrase
		}
	}
	private maybeEstimateTempo(triggerAt?: number) {
		if (triggerAt === undefined || !Number.isFinite(triggerAt) || triggerAt <= 0) {
			return
		}
		if (this.state.lastTriggerAt > 0) {
			const delta = triggerAt - this.state.lastTriggerAt
			if (delta > 0.08 && delta < 3) {
				const bpm = 60 / delta
				this.state.bpm = this.state.bpm > 0 ? this.state.bpm * 0.82 + bpm * 0.18 : bpm
			}
		}
		this.state.lastTriggerAt = triggerAt
	}
	private transformVelocity(
		lane: string,
		velocity: number,
		stepInPhrase: number,
		tempo: TempoProfile,
		phraseLengthValue: number,
	) {
		const intent = this.state.intent
		const cell = this.state.current[lane]
		const phraseEndWindow =
			phraseLengthValue - stepInPhrase <= (tempo.name === 'very-fast' ? 4 : 8)
		const inFill = this.state.step < this.state.fillUntilStep && phraseEndWindow
		const inRoll = this.state.step < this.state.rollUntilStep && phraseEndWindow
		if (!shouldKeepMutedHit(lane, this.state.step, velocity, intent)) {
			return 0
		}
		let output = velocity
		if (inFill) {
			output = Math.max(
				output,
				createFill(lane, stepInPhrase, phraseLengthValue, tempo, intent),
			)
		}
		if (inRoll && (lane === 'hat' || lane === 'snare')) {
			const roll = drumRollSequence[wrap(stepInPhrase, drumRollSequence.length)] ?? 0
			output = Math.max(output, roll * (lane === 'hat' ? 0.9 : 0.75))
		}
		const isStrongStep = this.state.step % 4 === 0
		const ghostChance = tempo.name === 'very-fast' ? 0.02 : 0.04 + intent.chaos * 0.08
		if (output <= 0 && !inFill && this.random() < ghostChance) {
			if (lane === 'hat' && cell.density < tempo.density + 0.25) {
				output = 35 + this.random() * 70
			}
			if ((lane === 'snare' || lane === 'clap') && !isStrongStep && intent.energy > 0.35) {
				output = 25 + this.random() * 55
			}
			if (
				lane === 'kick' &&
				!isStrongStep &&
				intent.energy > 0.75 &&
				tempo.name !== 'very-fast'
			) {
				output = 65 + this.random() * 75
			}
		}
		if (output > 0) {
			const human = 0.9 + this.random() * 0.16
			const accent = isStrongStep ? 1.06 : 1
			output = output * human * accent
		}
		return clampVelocity(output)
	}
	private setPerformanceTechnique(technique: DrumPerformancePreset) {
		if (
			technique === 'auto' ||
			!DRUM_PERFORMANCE_PRESETS[technique] ||
			this.state.performanceTechnique === technique
		) {
			return this.state.performanceTechnique
		}
		this.state.performanceTechnique = technique
		this.state.techniqueStartedAtStep = Math.max(0, this.state.step + 1)
		return technique
	}
	private applyPerformanceTechnique(parts: DrumParts) {
		if (!this.state.performanceControl) {
			return parts
		}
		const technique = this.state.performanceTechnique
		const stepInBar = wrap(this.state.step, this.state.stepsPerBar)
		const techniqueProgress = clamp(
			(this.state.step - this.state.techniqueStartedAtStep) /
				Math.max(1, this.state.stepsPerBar - 1),
		)
		const scalePart = (lane: string, multiplier: number) => {
			if (typeof parts[lane] === 'number' && (parts[lane] as number) > 0) {
				parts[lane] = clampVelocity((parts[lane] as number) * multiplier)
			}
		}
		const scaleAll = (multiplier: number) =>
			Object.keys(parts).forEach((lane) => scalePart(lane, multiplier))
		const accent = (lane: string, velocity: number) => {
			parts[lane] = Math.max(
				(parts[lane] as number | undefined) ?? 0,
				clampVelocity(velocity),
			)
		}
		// Every groove follows the performer dynamically before a technique adds
		// its own arrangement. Disabling Performance bypasses this entire layer.
		scaleAll(0.5 + this.state.intent.energy * 0.5)
		switch (technique) {
			case 'crescendo':
				scaleAll(0.45 + techniqueProgress * 0.75)
				if (stepInBar >= this.state.stepsPerBar - 3) {
					accent(
						['tomFloorLow', 'tomFloorHigh', 'tomMidHigh'][
							stepInBar - (this.state.stepsPerBar - 3)
						],
						105 + techniqueProgress * 100,
					)
				}
				break
			case 'bridge':
				scalePart('hat', 0.55)
				if (stepInBar % Math.max(1, Math.floor(this.state.stepsPerBar / 4)) === 0) {
					accent('ride', 105 + this.state.intent.energy * 75)
				}
				if (stepInBar >= this.state.stepsPerBar - 3) {
					accent(
						['tomFloorLow', 'tomFloorHigh', 'tomMidHigh'][
							stepInBar - (this.state.stepsPerBar - 3)
						],
						130 + this.state.intent.tension * 80,
					)
				}
				break
			case 'snare-roll':
				scalePart('kick', 0.82)
				scalePart('hat', 0.68)
				scalePart('clap', 0.6)
				if (!this.state.intent.muteSnare) {
					accent('snare', 80 + techniqueProgress * 175)
				}
				break
			case 'breakdown': {
				const halfBar = Math.max(1, Math.floor(this.state.stepsPerBar / 2))
				const quarterBar = Math.max(1, Math.floor(this.state.stepsPerBar / 4))
				for (const lane of Object.keys(parts)) {
					if (typeof parts[lane] !== 'number') continue
					const keep =
						lane === 'kick'
							? stepInBar % halfBar === 0
							: lane === 'snare' || lane === 'clap'
								? stepInBar === quarterBar || stepInBar === quarterBar * 3
								: lane === 'hat'
									? stepInBar % quarterBar === 0
									: false
					parts[lane] = keep ? clampVelocity((parts[lane] as number) * 0.72) : 0
				}
				break
			}
			case 'drop':
				if (this.state.step === this.state.techniqueStartedAtStep) {
					accent('kick', 255)
					accent('snare', 230)
					accent('hat', 205)
					accent('crash', 255)
				}
				break
		}
		return parts
	}
	next(context: DrumStepContext = {}): DrumParts {
		if (Number.isFinite(context.bpm) && context.bpm! > 0) {
			this.state.bpm = context.bpm!
		} else this.maybeEstimateTempo(context.triggerAt)
		this.state.step++
		const phraseLengthValue = this.phraseLength()
		const stepInPhrase = wrap(this.state.step, phraseLengthValue)
		if (stepInPhrase === 0 || this.activeLanes.some((lane) => !this.state.current[lane])) {
			this.choosePhrase()
		}
		this.state.bar = Math.floor(this.state.step / this.state.stepsPerBar)
		const tempo = this.currentTempoProfile()
		const parts: DrumParts = { kick: 0, snare: 0, hat: 0, clap: 0, events: [], hatOpen: false }
		for (const lane of this.activeLanes) {
			const cell = this.state.current[lane]
			const velocity = cell?.sequence?.[wrap(this.state.step, cell.length)] ?? 0
			parts[lane] = this.transformVelocity(
				lane,
				velocity,
				stepInPhrase,
				tempo,
				phraseLengthValue,
			)
		}
		// Closed hats choke the shared voice; an occasional offbeat open hat is
		// allowed to ring only until the following closed hit.
		parts.hatOpen =
			parts.hat > 0 &&
			this.state.step % 4 === 3 &&
			this.random() < 0.12 + this.state.intent.tension * 0.28
		// Cowbell is sparse phrase colour. It appears more as energy/tension rise,
		// avoiding the relentless four-on-the-floor cowbell cliché.
		const cowbellStep = this.state.step % 8 === 5 || this.state.step % 16 === 11
		const cowbellChance =
			0.025 + this.state.intent.energy * 0.08 + this.state.intent.tension * 0.1
		parts.cowbell =
			cowbellStep && this.random() < cowbellChance
				? clampVelocity(90 + this.state.intent.energy * 105 + this.random() * 35)
				: 0
		// Phrase orchestration keeps the wider GM kit audible even when the
		// selected groove only defines kick/snare/hat lanes. Explicit groove
		// lanes always win; these accents fill only otherwise-silent voices.
		if (this.options.percussionColours !== false) {
			const stepInBar = wrap(this.state.step, this.state.stepsPerBar)
			const barInPhrase = Math.floor(stepInPhrase / this.state.stepsPerBar)
			const addColour = (lane: string, velocity: number) => {
				if (!parts[lane] && !this.selectedGroove?.[lane])
					parts[lane] = clampVelocity(velocity)
			}
			if (stepInPhrase === 0) {
				addColour(
					this.state.phrase % 2 === 0 ? 'crash' : 'crash2',
					150 + this.state.intent.energy * 70,
				)
			}
			// A short ride passage in the latter half of alternate phrases makes
			// the ride a recognisable arrangement change, rather than this.random fizz.
			const ridePassage =
				this.state.phrase % 2 === 1 && barInPhrase >= Math.floor(this.state.phraseBars / 2)
			if (ridePassage && stepInBar % 4 === 0) {
				addColour(
					this.state.phrase % 4 === 1 ? 'ride' : 'ride2',
					76 + this.state.intent.energy * 48,
				)
			}
			if (ridePassage && stepInBar === Math.max(1, this.state.stepsPerBar - 4)) {
				addColour('rideBell', 92 + this.state.intent.tension * 55)
			}
			// Rotate dry backbeat colours so rimshots, claves and snaps appear in
			// every normal session without all three cluttering the same bar.
			const backbeat =
				stepInBar === Math.max(1, Math.floor(this.state.stepsPerBar / 4)) ||
				stepInBar === Math.max(1, Math.floor((this.state.stepsPerBar * 3) / 4))
			if (backbeat) {
				const dryColours = ['rimshot', 'claves', 'fingerSnap', 'snareElectric']
				addColour(
					dryColours[wrap(this.state.bar, dryColours.length)],
					82 + this.state.intent.energy * 58,
				)
			}
			if (stepInBar === Math.max(1, Math.floor((this.state.stepsPerBar * 3) / 8))) {
				addColour('hatPedal', 58 + this.state.intent.density * 42)
			}
			// GM tom articulations form a compact phrase-end fill. The two novelty
			// colours are deliberately much rarer than the time-keeping voices.
			const stepsRemaining = phraseLengthValue - stepInPhrase
			if (stepsRemaining === 3) addColour('tomFloorLow', 105 + this.state.intent.energy * 55)
			if (stepsRemaining === 2) addColour('tomFloorHigh', 112 + this.state.intent.energy * 55)
			if (stepsRemaining === 1) addColour('tomMidHigh', 120 + this.state.intent.energy * 60)
			if (this.state.phrase % 4 === 3 && stepsRemaining === 2) addColour('vibraslap', 92)
			if (this.state.phrase % 4 === 3 && stepsRemaining === 1) addColour('jingleBell', 84)
		}
		this.applyPerformanceTechnique(parts)
		const phraseEndWindow =
			phraseLengthValue - stepInPhrase <= (tempo.name === 'very-fast' ? 4 : 8)
		const presetTiming = this.selectedGroove?.timing
		const presetSubdivisionStep =
			presetTiming &&
			wrap(this.state.step - (presetTiming.phase ?? 0), presetTiming.every ?? 4) === 0
		parts.events = this.state.rapidPercussion
			? createDrumSubHits({
					inFill:
						presetSubdivisionStep ||
						(this.state.step < this.state.fillUntilStep && phraseEndWindow),
					inRoll: this.state.step < this.state.rollUntilStep && phraseEndWindow,
					stepInPhrase,
					bpm: this.state.bpm,
					intent: this.state.intent,
					style: presetSubdivisionStep ? presetTiming.style : 'auto',
					random: this.random,
					stepDuration: context.stepDuration,
				})
			: []
		this.state.lastParts = parts
		this.beatSequenceCache.clear()
		return parts
	}
	getBeatSequence(count = this.state.stepsPerBar) {
		const beatCount = Math.max(1, Math.floor(count))
		const cached = this.beatSequenceCache.get(beatCount)
		if (cached) return cached
		const firstStep = Math.floor(Math.max(0, this.state.step) / beatCount) * beatCount
		const sequence = Array.from({ length: beatCount }, (_, index) => {
			const step = firstStep + index
			const beat = Object.fromEntries(
				this.activeLanes.map((lane) => {
					const cell = this.state.current[lane]
					const velocity = cell?.sequence?.[wrap(step, cell.length)] ?? 0
					return [
						lane,
						shouldKeepMutedHit(lane, step, velocity, this.state.intent) ? velocity : 0,
					]
				}),
			)
			return step === this.state.step ? { ...beat, ...this.state.lastParts } : beat
		})
		this.beatSequenceCache.set(beatCount, sequence)
		return sequence
	}
	getStep() {
		return this.state.step
	}
	getStepsPerBar() {
		return this.state.stepsPerBar
	}
	getActiveLanes() {
		return this.exposedActiveLanes
	}
	getBPM() {
		return this.state.bpm
	}
	getIntent() {
		return { ...this.state.intent }
	}
	getPerformancePreset() {
		return this.state.performancePreset
	}
	getPerformanceTechnique() {
		return this.state.performanceTechnique
	}
	setRapidPercussion(enabled: boolean) {
		this.state.rapidPercussion = enabled === true
		this.beatSequenceCache.clear()
	}
	setPerformanceControl(enabled: boolean) {
		this.state.performanceControl = enabled !== false
		this.state.activityReserve = 0
		this.state.lastPersonUpdateAt = null
		this.beatSequenceCache.clear()
	}
	setPerformancePreset(preset: DrumPerformancePreset) {
		this.state.performancePreset = PERFORMANCE_PRESET_IDS.has(preset) ? preset : 'auto'
		const technique = this.setPerformanceTechnique(
			this.state.performancePreset === 'auto' ? 'steady' : this.state.performancePreset,
		)
		this.beatSequenceCache.clear()
		return technique
	}
	setTempo(bpm: number) {
		if (Number.isFinite(bpm) && bpm > 0) {
			this.state.bpm = bpm
		}
	}
	setMutedParts(mutes: Partial<Record<'kick' | 'snare' | 'hat' | 'clap', boolean>> = {}) {
		this.state.intent.muteKick = !!mutes.kick
		this.state.intent.muteSnare = !!mutes.snare
		this.state.intent.muteHat = !!mutes.hat
		this.state.intent.muteClap = !!mutes.clap
		this.beatSequenceCache.clear()
	}
	updatePerson(person: DrumPerformanceInput = {}, updateAt = performance.now() / 1000) {
		if (!this.state.performanceControl) {
			return
		}
		const velocity = Number.isFinite(person.noteVelocity)
			? person.noteVelocity
			: person.velocity
		const inputActivity = Number.isFinite(velocity) ? clamp(velocity!) : this.state.lastActivity
		const elapsed =
			this.state.lastPersonUpdateAt === null
				? 0
				: Math.max(0, updateAt - this.state.lastPersonUpdateAt)
		this.state.lastPersonUpdateAt = updateAt
		// Only sustained energetic playing earns a tail. Use elapsed seconds
		// so its duration is independent of tempo and input update frequency.
		const reserveTarget = clamp((inputActivity - 0.45) / 0.55)
		const releaseSeconds = this.state.activityReserve * 3
		const activity =
			this.state.activityReserve > 0.02
				? Math.max(
						inputActivity,
						this.state.intent.energy * Math.exp(-elapsed / releaseSeconds),
					)
				: inputActivity
		const reserveSeconds = reserveTarget > this.state.activityReserve ? 2 : 4
		this.state.activityReserve +=
			(reserveTarget - this.state.activityReserve) * (1 - Math.exp(-elapsed / reserveSeconds))
		const tension = clamp(Math.abs(person.pitchBend ?? person.bend ?? 0))
		const previousActivity = this.state.intent.energy
		this.state.intent = {
			...this.state.intent,
			energy: clamp(activity),
			density: clamp(0.25 + activity * 0.65),
			tension,
			fillChance: clamp(0.15 + activity * 0.6),
			rollChance: clamp(0.08 + activity * 0.45),
		}
		if (this.state.performancePreset === 'auto') {
			const techniqueAge = this.state.step - this.state.techniqueStartedAtStep
			if (activity <= 0.18) {
				this.setPerformanceTechnique('breakdown')
			} else if (previousActivity <= 0.3 && activity >= 0.72) {
				this.setPerformanceTechnique('drop')
			} else if (tension >= 0.72 && activity >= 0.5) {
				this.setPerformanceTechnique('snare-roll')
			} else if (tension >= 0.36) {
				this.setPerformanceTechnique('bridge')
			} else if (
				activity > previousActivity + 0.06 ||
				(this.state.performanceTechnique === 'crescendo' &&
					techniqueAge < this.state.stepsPerBar)
			) {
				this.setPerformanceTechnique('crescendo')
			} else {
				this.setPerformanceTechnique('steady')
			}
		}
		this.state.lastActivity = inputActivity
		this.beatSequenceCache.clear()
	}
	setIntent(intent: Partial<DrumIntent>) {
		this.state.intent = { ...this.state.intent, ...intent }
		this.beatSequenceCache.clear()
	}
	requestFill(amount = 1) {
		if (amount > 0) {
			this.state.fillUntilStep = this.state.step + this.phraseLength()
		}
	}
}
export const createDrumArranger = (options: DrumArrangerOptions = {}): DrumArranger =>
	new DrumArranger(options)