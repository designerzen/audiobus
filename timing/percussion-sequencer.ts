import { PercussionHoldRepeater } from './percussion-hold-repeater.ts'
import { PercussionQuantiser, getPercussionTriggerTime } from './percussion-quantise.ts'
import type {
	IDrumArranger,
	IPercussionClock,
	IPercussionInput,
	IPercussionOutput,
	IPercussionQuantiser,
	PercussionHit,
	PercussionPress,
	PercussionTiming,
} from './percussion-types.ts'

/** Orchestrates interchangeable inputs and outputs without owning the master clock. */
export class PercussionSequencer {
	private readonly inputs = new Map<IPercussionInput, () => void>()
	private readonly holds: PercussionHoldRepeater<PercussionPress>
	private readonly quantiser: IPercussionQuantiser
	private quantise: boolean
	private inputSequence = 0

	constructor(
		private readonly clock: IPercussionClock,
		private output: IPercussionOutput,
		private readonly options: {
			arranger?: IDrumArranger
			quantiser?: IPercussionQuantiser
			quantise?: boolean
			holdThresholdTicks?: number
		} = {},
	) {
		this.quantiser = options.quantiser ?? new PercussionQuantiser()
		this.quantise = options.quantise ?? false
		this.holds = new PercussionHoldRepeater({
			holdThresholdTicks: options.holdThresholdTicks,
			onRepeat: (_part, repeat) =>
				this.trigger({
					...repeat.options,
					triggerAt: undefined,
					inputAudioTime: this.clock.currentTime,
				}),
		})
	}

	setQuantise(enabled: boolean): void {
		this.quantise = enabled
	}

	setOutput(output: IPercussionOutput): void {
		this.output.allNotesOff()
		this.output = output
	}

	attach(input: IPercussionInput): () => void {
		this.inputs.get(input)?.()
		const prefix = `${this.inputSequence++}:`
		const held = new Set<string>()
		const unsubscribe = input.subscribe({
			press: (press) => {
				const heldId = prefix + press.inputId
				if (this.holds.press(heldId, press.part, { ...press })) {
					held.add(heldId)
					this.trigger(press)
				}
			},
			release: (inputId) => {
				held.delete(prefix + inputId)
				this.holds.release(prefix + inputId)
			},
		})
		let attached = true
		const detach = () => {
			if (!attached) return
			attached = false
			unsubscribe()
			for (const inputId of held) this.holds.release(inputId)
			this.inputs.delete(input)
		}
		this.inputs.set(input, detach)
		return detach
	}

	trigger(press: PercussionPress): void {
		const now = this.clock.currentTime
		const triggerAt = getPercussionTriggerTime({
			...press,
			now,
			quantise: this.quantise,
			quantiser: this.quantiser,
		})
		this.output.trigger({
			part: press.part,
			velocity: this.velocity(press.velocity ?? 1),
			triggerAt,
			open: press.open,
		})
	}

	/** Call once per source clock tick (Photosynth uses 24 ticks per quarter). */
	advance(timing: PercussionTiming): void {
		this.quantiser.update(timing)
		this.holds.advance()
	}

	/** One arranger step per call; stepsPerBar defines the caller's subdivision. */
	next(
		triggerAt = this.clock.currentTime,
		bpm?: number,
		stepDuration?: number,
	): readonly PercussionHit[] {
		const parts = this.options.arranger?.next({ triggerAt, bpm, stepDuration })
		if (!parts) return []
		const hits: PercussionHit[] = []
		for (const [part, velocity] of Object.entries(parts)) {
			if (typeof velocity !== 'number' || velocity <= 0) continue
			hits.push({
				part,
				velocity: this.velocity(velocity / 255),
				triggerAt,
				open: part === 'hat' && parts.hatOpen,
			})
		}
		for (const event of parts.events) {
			hits.push({
				part: event.lane,
				velocity: this.velocity(event.velocity / 255),
				triggerAt: triggerAt + event.offset,
				lengthScale: event.lengthScale,
			})
		}
		for (const hit of hits) this.output.trigger(hit)
		return hits
	}

	stop(): void {
		this.holds.clear()
		this.output.allNotesOff()
	}

	destroy(): void {
		for (const detach of this.inputs.values()) detach()
		this.stop()
	}

	private velocity(value: number): number {
		return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
	}
}