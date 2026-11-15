import {
	PerformanceTransformer,
	routeKey,
	type Control,
	type Voice
} from "./performance-transformer.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"

export interface LoopNote {
	voice: Voice
	pitch: number
	velocity?: number
}
export interface LoopStep {
	notes: LoopNote[]
	/** Seconds until the next step */
	wait: number
	/** Seconds each note of this step sounds for, or Infinity to hold it until its key is released */
	length: number
	/** True on the last step of a phrase that plays only once */
	done?: boolean
}
interface Loop {
	held: Voice[]
	step: number
	done: boolean
	/** Keys released before a once-only phrase had finished */
	lifted: Set<Voice>
}

export const COLLECT_CONTROL: Control = {
	name: "collect",
	label: "Collection window (ms)",
	values: [0, 10, 20, 25, 40, 60, 100],
	min: 0,
	max: 200
}

/** Every pitch of the chord low to high, repeated one octave higher for each extra octave. */
export const spreadOctaves = (chord: Voice[], octaves: number): LoopNote[] =>
	Array.from({ length: Math.max(1, Math.round(octaves)) }, (_, octave) =>
		chord.map((voice) => ({ voice, pitch: voice.input.number + octave * 12 }))
	)
		.flat()
		.sort((a, b) => a.pitch - b.pitch)
		// Keys an octave apart reach the same pitch, which is only played once.
		.filter((note, index, notes) => note.pitch <= 127 && note.pitch !== notes[index - 1]?.pitch)

/**
 * Plays a phrase built from the held chord, either repeating it for as long as any of its keys
 * stay down or, when a step reports itself as the last, once through to the end.
 */
export abstract class ChordLoopTransformer extends PerformanceTransformer {
	private loops = new Map<string, Loop>()

	/** The notes to sound on this step of the phrase, from the keys held low to high. */
	protected abstract step(chord: Voice[], index: number): LoopStep
	/** Whether a phrase that plays once carries on to its end after its keys are released. */
	protected get completes(): boolean {
		return false
	}

	protected noteOn(voice: Voice): IAudioCommand[] {
		const key = routeKey(voice.input)
		let loop = this.loops.get(key)
		// A phrase kept alive only by keys that are already up gives way to the next chord.
		const cut =
			loop?.held.length && loop.held.every((held) => loop!.lifted.has(held))
				? this.finish(key, loop)
				: []
		if (!loop || loop.done) {
			loop = { held: [], step: 0, done: false, lifted: new Set() }
			const started = loop
			this.loops.set(key, loop)
			this.schedule(
				this.now + Number(this.options.collect) / 1000,
				() => this.run(key, started),
				undefined,
				key
			)
		}
		loop.held.push(voice)
		return cut
	}
	protected override noteOff(voice: Voice, command: IAudioCommand): IAudioCommand[] {
		const key = routeKey(voice.input)
		const loop = this.loops.get(key)
		if (this.completes && loop && !loop.done && loop.held.includes(voice)) {
			// The key counts as held until the phrase ends, which is when it is really released.
			voice.released = false
			loop.lifted.add(voice)
			return []
		}
		// The next chord starts its phrase afresh instead of joining this one mid-way.
		if (loop?.held.every((held) => held.released)) {
			this.loops.delete(key)
		}
		return super.noteOff(voice, command)
	}
	private run(key: string, loop: Loop): IAudioCommand[] {
		if (this.loops.get(key) !== loop) {
			return []
		}
		loop.held = loop.held
			.filter((voice) => !voice.released)
			.sort((a, b) => a.input.number - b.input.number)
		if (!loop.held.length) {
			this.loops.delete(key)
			return []
		}
		const { notes, wait, length, done } = this.step(loop.held, loop.step++)
		const result = notes.flatMap(({ voice, pitch, velocity }) => {
			// A note still sounding from an earlier step is stopped before it is played again.
			const ringing = voice.targets.find((target) => target.number === pitch)
			const stopped = ringing ? [this.end(voice, ringing)] : []
			const target = this.start(voice, pitch, this.now, velocity)
			if (Number.isFinite(length)) {
				this.schedule(
					this.now + length,
					() => (voice.targets.includes(target) ? [this.end(voice, target)] : []),
					voice
				)
			}
			return [...stopped, target]
		})
		// A step can never be shorter than a millisecond, whatever the settings say.
		const next = this.now + Math.max(0.001, wait)
		if (done) {
			this.schedule(next, () => this.finish(key, loop))
		} else {
			this.schedule(next, () => this.run(key, loop), undefined, key)
		}
		return result
	}
	private finish(key: string, loop: Loop): IAudioCommand[] {
		loop.done = true
		const result = [...loop.lifted].flatMap((voice) => (voice.released ? [] : this.release(voice)))
		loop.lifted.clear()
		if (this.loops.get(key) === loop && loop.held.every((held) => held.released)) {
			this.loops.delete(key)
		}
		return result
	}
	protected clearState() {
		this.loops?.clear()
	}
	protected clearRoute(route: string) {
		this.loops.delete(route)
		return []
	}
}