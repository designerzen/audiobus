import { describe, expect, it, vi } from 'vitest'
import { DrumArranger, applyDrumSubHitEnvelope, createDrumSubHits } from './drum-arranger.ts'
import { createCompositeDrumGroove, DRUM_GROOVES } from './drum-patterns.ts'
import { PercussionQuantiser } from './percussion-quantise.ts'
import { PercussionHoldRepeater } from './percussion-hold-repeater.ts'
import { PercussionScheduler } from './percussion-scheduler.ts'
import { PercussionSequencer } from './percussion-sequencer.ts'
import { PercussionAudioOutput } from './percussion-audio-output.ts'
import type { IPercussionInput, PercussionHit } from './percussion-types.ts'

describe('Photosynth percussion routines', () => {
	it('adapts audiobus outputs with MIDI velocities, hat choking, and cancellation', () => {
		const callbacks: (() => void)[] = []
		const clock = { currentTime: 10 }
		const scheduler = new PercussionScheduler(clock, {
			setTimer: (callback) => {
				callbacks.push(callback)
				return callbacks.length
			},
			clearTimer: vi.fn(),
		})
		const notes = { noteOn: vi.fn(), noteOff: vi.fn(), allNotesOff: vi.fn() }
		const output = new PercussionAudioOutput(notes, scheduler)
		output.trigger({ part: 'hat', velocity: 1, triggerAt: 11 })
		expect(notes.noteOn).not.toHaveBeenCalled()
		callbacks[0]()
		expect(notes.noteOff).toHaveBeenCalledWith(46)
		expect(notes.noteOn).toHaveBeenCalledWith(42, 127)
		output.allNotesOff()
		callbacks[1]()
		expect(notes.noteOff).toHaveBeenCalledTimes(1)
		expect(notes.allNotesOff).toHaveBeenCalledTimes(1)
	})

	it('isolates identical input IDs from different devices', () => {
		const handlers: Parameters<IPercussionInput['subscribe']>[0][] = []
		const makeInput = (): IPercussionInput => ({
			subscribe: (value) => {
				handlers.push(value)
				return () => {}
			},
		})
		const trigger = vi.fn()
		const sequencer = new PercussionSequencer(
			{ currentTime: 10 },
			{ trigger, allNotesOff: vi.fn() },
			{ holdThresholdTicks: 1 },
		)
		const detach = sequencer.attach(makeInput())
		sequencer.attach(makeInput())
		handlers[0].press({ inputId: 'a', part: 'kick' })
		handlers[1].press({ inputId: 'a', part: 'hat' })
		expect(trigger).toHaveBeenCalledTimes(2)
		detach()
		sequencer.advance({ tickAudioTime: 10, divisionsElapsed: 0, tickDuration: 0.02 })
		expect(trigger).toHaveBeenCalledTimes(3)
		expect(trigger.mock.lastCall![0].part).toBe('hat')
		sequencer.destroy()
	})
	it('retains seeded variation and exact sextuplet offsets', () => {
		const first = new DrumArranger({ seed: 'parity', bpm: 120 })
		const second = new DrumArranger({ seed: 'parity', bpm: 120 })
		for (let step = 0; step < 256; step++) expect(first.next()).toEqual(second.next())
		const events = createDrumSubHits({
			inFill: true,
			inRoll: false,
			stepInPhrase: 2,
			bpm: 120,
			intent: { energy: 0.9, density: 0.9, tension: 0.8 },
			random: () => 0.5,
		})
		expect(events).toHaveLength(5)
		expect(events[0].offset).toBeCloseTo(0.5 / 6)
		expect(events[4].offset).toBeCloseTo((0.5 * 5) / 6)
		expect(Math.max(...events.map((event) => event.velocity))).toBeLessThan(100)
		expect(
			applyDrumSubHitEnvelope({ length: 0.4, attack: 0.01, decay: 0.2 }, events[0]).length,
		).toBeLessThan(0.15)
	})

	it('retains aligned groove lanes and combines different cycle lengths', () => {
		for (const groove of Object.values(DRUM_GROOVES)) {
			for (const sequence of Object.values(groove)) {
				if (!Array.isArray(sequence)) continue
				expect(sequence).toHaveLength(groove.kick.length)
				expect(sequence.every((velocity) => velocity >= 0 && velocity <= 255)).toBe(true)
			}
		}
		const combined = createCompositeDrumGroove([
			{ kick: [200, 0, 0, 0], snare: [0, 0, 0, 0], hat: [80, 0, 0, 0], clap: [0, 0, 0, 0] },
			{ kick: [150, 0, 90], snare: [0, 220, 0], hat: [120, 0, 0], clap: [0, 0, 0] },
		])!
		expect(combined.kick).toHaveLength(12)
		expect(combined.kick.slice(0, 4)).toEqual([200, 0, 90, 150])
		expect(combined.hat[0]).toBe(120)
	})

	it('keeps rapid subdivisions opt-in and performance inertia time based', () => {
		const arranger = new DrumArranger({ groove: 'garage-triplets', bpm: 120 })
		arranger.next()
		arranger.next()
		expect(arranger.next().events).toEqual([])
		const rapid = new DrumArranger({
			groove: 'garage-triplets',
			bpm: 120,
			rapidPercussion: true,
		})
		rapid.next()
		rapid.next()
		expect(rapid.next().events).toHaveLength(2)
		for (let time = 0; time < 6; time += 0.1) arranger.updatePerson({ velocity: 1 }, time)
		arranger.updatePerson({ velocity: 0 }, 6)
		expect(arranger.getIntent().energy).toBeGreaterThan(0.9)
		arranger.updatePerson({ velocity: 0 }, 30)
		expect(arranger.getIntent().energy).toBeLessThan(0.1)
	})

	it('quantises in audio seconds and copies timing snapshots', () => {
		const quantiser = new PercussionQuantiser()
		expect(quantiser.getTriggerAt({ now: 10 })).toBeNull()
		const timing = { tickAudioTime: 10, divisionsElapsed: 1, tickDuration: 0.02 }
		quantiser.update(timing)
		timing.tickAudioTime = 100
		expect(quantiser.getTriggerAt({ now: 10.01 })).toBeCloseTo(10.04)
		expect(quantiser.getTriggerAt({ now: 10.039 })).toBeCloseTo(10.1)
		quantiser.update({ ...timing, tickDuration: 0 })
		expect(quantiser.getTriggerAt({ now: 10 })).toBeNull()
	})

	it('deduplicates held voices and releases groups of inputs', () => {
		const onRepeat = vi.fn()
		const repeater = new PercussionHoldRepeater({ onRepeat })
		expect(repeater.press('keys:a', 'hat', {})).toBe(true)
		expect(repeater.press('keys:a', 'hat', {})).toBe(false)
		repeater.press('pads:a', 'hat', {})
		for (let tick = 0; tick < 95; tick++) repeater.advance()
		expect(onRepeat).not.toHaveBeenCalled()
		expect([...repeater.advance()]).toEqual(['hat'])
		expect(onRepeat).toHaveBeenCalledTimes(1)
		expect(repeater.releasePrefix('keys:')).toBe(1)
		repeater.clear()
		expect(repeater.size).toBe(0)
	})

	it('cancels timers once and suppresses callbacks after cancellation', () => {
		const callbacks: (() => void)[] = []
		const setTimer = vi.fn((callback: () => void) => {
			callbacks.push(callback)
			return callbacks.length
		})
		const clearTimer = vi.fn()
		const scheduler = new PercussionScheduler({ currentTime: 10 }, { setTimer, clearTimer })
		const callback = vi.fn()
		const cancel = scheduler.schedule(10.125, callback)
		expect(setTimer).toHaveBeenCalledWith(expect.any(Function), 125)
		expect(cancel()).toBe(true)
		expect(cancel()).toBe(false)
		callbacks[0]()
		expect(callback).not.toHaveBeenCalled()
		scheduler.schedule(11, callback)
		scheduler.clear()
		callbacks[1]()
		expect(callback).not.toHaveBeenCalled()
		scheduler.schedule(9, callback)
		expect(callback).toHaveBeenCalledTimes(1)
	})

	it('swaps outputs, detaches held inputs, and normalises arranged hits', () => {
		const clock = { currentTime: 10 }
		const trigger = vi.fn<(hit: Readonly<PercussionHit>) => void>()
		const output = { trigger, allNotesOff: vi.fn() }
		const arranger = new DrumArranger({
			groove: 'garage-triplets',
			rapidPercussion: true,
			bpm: 120,
		})
		const sequencer = new PercussionSequencer(clock, output, {
			arranger,
			holdThresholdTicks: 1,
		})
		let handlers: Parameters<IPercussionInput['subscribe']>[0]
		const unsubscribe = vi.fn()
		const input: IPercussionInput = {
			subscribe: (value) => {
				handlers = value
				return unsubscribe
			},
		}
		const detach = sequencer.attach(input)
		handlers!.press({ inputId: 'pad:a', part: 'hat', velocity: 0.6 })
		expect(trigger.mock.calls[0][0]).toMatchObject({ velocity: 0.6, triggerAt: 10.01 })
		detach()
		detach()
		sequencer.advance({ tickAudioTime: 10, divisionsElapsed: 0, tickDuration: 0.02 })
		expect(trigger).toHaveBeenCalledTimes(1)
		expect(unsubscribe).toHaveBeenCalledTimes(1)
		const nextOutput = { trigger: vi.fn(), allNotesOff: vi.fn() }
		sequencer.setOutput(nextOutput)
		expect(output.allNotesOff).toHaveBeenCalledTimes(1)
		sequencer.next(11, 120)
		sequencer.next(11.5, 120)
		const hits = sequencer.next(12, 120)
		expect(hits.some((hit) => hit.triggerAt > 12)).toBe(true)
		expect(hits.every((hit) => hit.velocity >= 0 && hit.velocity <= 1)).toBe(true)
		sequencer.destroy()
		expect(nextOutput.allNotesOff).toHaveBeenCalledTimes(1)
	})
})