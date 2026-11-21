import { afterEach, expect, it } from "vitest"
import {
	EVENT_MIDI_SUPPRESSED,
	MidiEchoGuard,
	midiEchoGuard,
	usesMidiEchoGuard
} from "../midi-echo-guard"
import { MidiOutputRouting } from "../../io/outputs/midi-output-routing"

afterEach(() => midiEchoGuard.clear())

const clock = (guard: MidiEchoGuard) => {
	const time = { now: 0 }
	guard.now = () => time.now
	return time
}

it("never sends a device the notes it played, on any channel, but sends them to other devices", () => {
	const guard = new MidiEchoGuard()
	const time = clock(guard)
	const reasons: string[] = []
	guard.addEventListener(EVENT_MIDI_SUPPRESSED, (event) =>
		reasons.push((event as CustomEvent).detail.reason)
	)
	expect(guard.acceptInput(["in-1", "Keys"], [0x90, 60, 100])).toBe(true)
	expect(guard.allowOutput(["Keys", "out-1"], [0x93, 60, 20])).toBe(false)
	expect(guard.allowOutput(["Synth", "out-2"], [0x90, 60, 100])).toBe(true)
	expect(guard.allowOutput(["KEYS "], [0x90, 61, 100])).toBe(true)
	// A note-on with no velocity is the same note-off
	guard.acceptInput(["Keys"], [0x80, 60, 0])
	expect(guard.allowOutput(["Keys"], [0x90, 60, 0])).toBe(false)
	time.now = 151
	expect(guard.allowOutput(["Keys"], [0x90, 60, 100])).toBe(true)
	expect(reasons).toEqual(["echo", "echo"])
})

it("ignores a device returning what was just sent to it", () => {
	const guard = new MidiEchoGuard()
	const time = clock(guard)
	expect(guard.allowOutput(["Synth Out", "out-1"], [0x90, 60, 100])).toBe(true)
	expect(guard.acceptInput(["in-7", "Other Keys"], [0x90, 60, 100])).toBe(true)
	expect(guard.acceptInput(["in-1", "SYNTH OUT "], [0x93, 60, 20])).toBe(false)
	time.now = 151
	expect(guard.acceptInput(["Synth Out"], [0x90, 60, 100])).toBe(true)
})

it("limits identical messages to a device inside the window, panics most of all, and never clock", () => {
	const guard = new MidiEchoGuard()
	const time = clock(guard)
	const sent = (data: number[], times: number) =>
		Array.from({ length: times }, () => guard.allowOutput(["Synth"], data)).filter(Boolean)
			.length
	expect(sent([0x90, 60, 100], 30)).toBe(24)
	expect(sent([0xb0, 123, 0], 5)).toBe(2)
	expect(sent([0xf8], 100)).toBe(100)
	expect(guard.allowOutput(["Other"], [0x90, 60, 100])).toBe(true)
	time.now = 251
	expect(guard.allowOutput(["Synth"], [0x90, 60, 100])).toBe(true)
})

it("matches UMP packets by their MIDI meaning", () => {
	const guard = new MidiEchoGuard()
	clock(guard)
	expect(guard.acceptInputPacket(["Keys"], [0x40903c00, 0x80000000])).toBe(true)
	expect(guard.allowOutputPacket(["Keys"], [0x20923c40])).toBe(false)
	expect(guard.allowOutput(["Keys"], [0x80, 60, 0])).toBe(true)
})

it("routes repeated notes, keeps a device's own notes from it, and can be turned off", async () => {
	const device = { id: "out-1", name: "Maker Synth", portName: "Synth" }
	const sent: number[][] = []
	const route = (options: Record<string, any>) =>
		new MidiOutputRouting(
			{ selectedDevice: "out-1", ...options },
			() => [device],
			(_id, data) => {
				sent.push(data)
			}
		)
	const guarded = route({})
	await guarded.noteOn(60, 100)
	await guarded.noteOn(60, 90)
	midiEchoGuard.acceptInput(["Synth"], [0x90, 62, 100])
	await guarded.noteOn(62, 100)
	expect(sent).toEqual([
		[0x90, 60, 100],
		[0x90, 60, 90]
	])

	sent.length = 0
	await route({ echoGuard: false }).noteOn(62, 100)
	expect(sent).toEqual([[0x90, 62, 100]])
})

it("guards unless the options turn it off", () => {
	expect(usesMidiEchoGuard({})).toBe(true)
	expect(usesMidiEchoGuard(undefined)).toBe(true)
	expect(usesMidiEchoGuard({ echoGuard: false })).toBe(false)
})