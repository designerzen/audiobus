import { PERCUSSION_HOLD_THRESHOLD_TICKS, PERCUSSION_REPEAT_TICKS } from './percussion-quantise.ts'

export const getPercussionRepeatTicks = (part: string): number =>
	PERCUSSION_REPEAT_TICKS[part as keyof typeof PERCUSSION_REPEAT_TICKS] ?? 24

export interface PercussionRepeat<T> {
	inputId: string
	heldTicks: number
	options: T
}

export class PercussionHoldRepeater<T = Record<string, never>> {
	private readonly heldInputs = new Map<
		string,
		{ part: string; options: T; pressedAtTick: number }
	>()
	private tick = 0

	constructor(
		private readonly options: {
			onRepeat?: (part: string, repeat: PercussionRepeat<T>) => void
			holdThresholdTicks?: number
		} = {},
	) {
		const threshold = options.holdThresholdTicks ?? PERCUSSION_HOLD_THRESHOLD_TICKS
		if (!Number.isInteger(threshold) || threshold < 0)
			throw new RangeError('Hold threshold must be a non-negative integer')
	}

	get size(): number {
		return this.heldInputs.size
	}

	press(inputId: string, part: string, options: T): boolean {
		if (!inputId || !part || this.heldInputs.has(inputId)) return false
		this.heldInputs.set(inputId, { part, options, pressedAtTick: this.tick })
		return true
	}

	release(inputId: string): boolean {
		return this.heldInputs.delete(inputId)
	}

	releasePrefix(prefix: string): number {
		let released = 0
		for (const inputId of this.heldInputs.keys()) {
			if (inputId.startsWith(prefix) && this.heldInputs.delete(inputId)) released++
		}
		return released
	}

	clear(): void {
		this.heldInputs.clear()
	}

	advance(): Set<string> {
		this.tick++
		const repeatedParts = new Set<string>()
		const threshold = this.options.holdThresholdTicks ?? PERCUSSION_HOLD_THRESHOLD_TICKS
		for (const [inputId, held] of this.heldInputs) {
			const heldTicks = this.tick - held.pressedAtTick
			if (
				heldTicks >= threshold &&
				(heldTicks - threshold) % getPercussionRepeatTicks(held.part) === 0 &&
				!repeatedParts.has(held.part)
			) {
				repeatedParts.add(held.part)
				this.options.onRepeat?.(held.part, { options: held.options, heldTicks, inputId })
			}
		}
		return repeatedParts
	}
}