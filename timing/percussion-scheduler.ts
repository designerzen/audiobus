import type {
	CancelPercussion,
	IPercussionClock,
	IPercussionScheduler,
} from './percussion-types.ts'

export interface IPercussionTimers {
	setTimer(callback: () => void, delayMilliseconds: number): unknown
	clearTimer(timer: unknown): void
}

const DEFAULT_TIMERS: IPercussionTimers = {
	setTimer: (callback, delay) => globalThis.setTimeout(callback, delay),
	clearTimer: (timer) => globalThis.clearTimeout(timer as ReturnType<typeof setTimeout>),
}

/** For outputs without native audio-time scheduling; cancellation is idempotent. */
export class PercussionScheduler implements IPercussionScheduler {
	private readonly pending = new Set<CancelPercussion>()

	constructor(
		private readonly clock: IPercussionClock,
		private readonly timers: IPercussionTimers = DEFAULT_TIMERS,
	) {}

	schedule(triggerAt: number, callback: () => void): CancelPercussion {
		const delay = (triggerAt - this.clock.currentTime) * 1000
		if (!Number.isFinite(delay) || delay <= 0) {
			callback()
			return () => false
		}
		let pending = true
		const cancel = () => {
			if (!pending) return false
			pending = false
			this.pending.delete(cancel)
			this.timers.clearTimer(timer)
			return true
		}
		const timer = this.timers.setTimer(() => {
			if (!pending) return
			pending = false
			this.pending.delete(cancel)
			callback()
		}, delay)
		this.pending.add(cancel)
		return cancel
	}

	clear(): void {
		for (const cancel of this.pending) cancel()
	}
}