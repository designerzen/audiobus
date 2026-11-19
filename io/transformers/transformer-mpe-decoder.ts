import {
	PerformanceTransformer,
	copyCommand,
	numbers,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"
import {
	CONTROL_CHANGE,
	NOTE_OFF,
	PER_NOTE_CONTROLLER,
	PER_NOTE_PITCH_BEND,
	PITCH_BEND
} from "../../commands/commands"
import { CHANNEL_PRESSURE, POLYPHONIC_PRESSURE } from "../../midi/midi-command-conversion.ts"
import { perNoteToUmp, withUmp } from "../../midi/ump-codec.ts"
import {
	MPE_DEFAULT_MASTER_BEND_RANGE,
	MPE_DEFAULT_MEMBER_BEND_RANGE,
	RPN_MPE_CONFIGURATION,
	RPN_PITCH_BEND_SENSITIVITY,
	bendToSemitones,
	isRegisteredPerNoteController,
	mpeZone,
	semitonesToBend,
	type MpeZone
} from "../../midi/mpe.ts"

export const ID_MPE_DECODER = "MPE-Decoder"
const RPN_CONTROLLERS = [6, 38, 100, 101]

interface ChannelState {
	bend: number
	pressure?: number
	controllers: Map<number, number>
}

const source = (command: IAudioCommand) => command.from ?? ""
const channelKey = (from: string, channel: number) => `${from}:${channel}`

/**
 * Remove MPE: gather member channel notes onto one channel, as MIDI 2 per-note
 * expression or as MIDI 1 with polyphonic aftertouch. Zones, bend ranges and
 * expression are tracked separately for each source.
 */
export class TransformerMpeDecoder extends PerformanceTransformer {
	type = ID_MPE_DECODER
	category = "Routing"
	// Zone sizes announced by MPE Configuration Messages, for automatic zones.
	private announced = new Map<string, { lower: number; upper: number }>()
	// Bend ranges announced for each zone, keyed by source and master channel.
	private ranges = new Map<string, { master?: number; member?: number }>()
	private parameters = new Map<string, [number, number]>()
	private channels = new Map<string, ChannelState>()
	get name() {
		return "Remove MPE"
	}
	get description() {
		return "Decode MPE member channels onto one channel as MIDI 2 per-note expression or MIDI 1."
	}
	get instructions() {
		return "Place after an MPE controller. MIDI 2 output keeps per-note bend and timbre for MIDI 2 destinations; MIDI 1 output turns pressure into polyphonic aftertouch and can follow the latest note's bend."
	}
	constructor(config: Settings = {}) {
		super(
			{
				zone: "auto",
				output: "midi2",
				channel: 1,
				expression: "latest",
				memberBendRange: MPE_DEFAULT_MEMBER_BEND_RANGE,
				masterBendRange: MPE_DEFAULT_MASTER_BEND_RANGE,
				outputBendRange: MPE_DEFAULT_MASTER_BEND_RANGE
			},
			[
				{
					name: "zone",
					label: "Zone",
					values: ["auto", "lower", "upper"],
					help: "Auto follows MPE Configuration Messages and starts as a 15 channel lower zone."
				},
				{
					name: "output",
					label: "Output",
					values: [
						{ name: "MIDI 2 per-note", value: "midi2" },
						{ name: "MIDI 1", value: "midi1" }
					]
				},
				{
					name: "channel",
					label: "Output channel",
					values: numbers(1, 16),
					min: 1,
					max: 16
				},
				{
					name: "expression",
					label: "MIDI 1 bend & timbre",
					values: ["latest", "drop"],
					help: "MIDI 1 has no per-note bend: follow the latest held note, or keep only master bend."
				},
				{
					name: "memberBendRange",
					label: "Note bend range",
					values: numbers(1, 96),
					min: 1,
					max: 96,
					help: "Semitones for full member channel bend, until the controller announces its own. MIDI 2 per-note bend is sent in this range."
				},
				{
					name: "masterBendRange",
					label: "Master bend range",
					values: numbers(1, 24),
					min: 1,
					max: 24
				},
				{
					name: "outputBendRange",
					label: "Output bend range",
					values: numbers(1, 96),
					min: 1,
					max: 96,
					help: "Semitones for full output channel bend."
				}
			],
			config
		)
	}
	private zones(from: string): MpeZone[] {
		const zone = this.options.zone
		if (zone === "lower" || zone === "upper") {
			return [mpeZone(zone, 15)]
		}
		const announced = this.announced.get(from) ?? { lower: 15, upper: 0 }
		return [mpeZone("lower", announced.lower), mpeZone("upper", announced.upper)].filter(
			(zone) => zone.members.length
		)
	}
	private zoneOf(from: string, channel: number) {
		return this.zones(from).find(
			(zone) => zone.master === channel || zone.members.includes(channel)
		)
	}
	private state(from: string, channel: number): ChannelState {
		const key = channelKey(from, channel)
		let state = this.channels.get(key)
		if (!state) {
			state = { bend: 0, controllers: new Map() }
			this.channels.set(key, state)
		}
		return state
	}
	/** Bend sensitivity applies zone-wide: one range for the master, one for all members. */
	private range(from: string, channel: number, zone: MpeZone) {
		const ranges = this.ranges.get(channelKey(from, zone.master))
		return zone.master === channel
			? (ranges?.master ?? Number(this.options.masterBendRange))
			: (ranges?.member ?? Number(this.options.memberBendRange))
	}
	private get output() {
		return Number(this.options.channel)
	}
	private send(template: IAudioCommand, changes: Partial<IAudioCommand>): IAudioCommand {
		const command = copyCommand(template, {
			channel: this.output,
			velocity: 0,
			startAt: this.now,
			...changes
		})
		command.subtype = command.type
		if (command.type === PER_NOTE_PITCH_BEND || command.type === PER_NOTE_CONTROLLER) {
			return withUmp(command, perNoteToUmp(command)!)
		}
		return command
	}
	private held(from: string, channel: number) {
		return [...this.voices].filter(
			(voice) => source(voice.input) === from && voice.input.channel === channel
		)
	}
	private latest(): Voice | undefined {
		return [...this.voices]
			.filter((voice) => this.zoneOf(source(voice.input), voice.input.channel))
			.at(-1)
	}
	/** Output channel bend for MIDI 1: master bend plus the latest note's member bend. */
	private channelBend(template: IAudioCommand): IAudioCommand {
		const latest = this.options.expression === "latest" ? this.latest() : undefined
		const from = source(latest?.input ?? template)
		const zone = this.zoneOf(from, latest?.input.channel ?? template.channel)
		const semitones =
			(zone ? (this.channels.get(channelKey(from, zone.master))?.bend ?? 0) : 0) +
			(latest ? (this.channels.get(channelKey(from, latest.input.channel))?.bend ?? 0) : 0)
		const value = semitonesToBend(semitones, Number(this.options.outputBendRange))
		return this.send(template, { type: PITCH_BEND, number: 0, value, pitchBend: value })
	}
	/** Expression for one note from its member channel's current state. */
	private expression(voice: Voice, state: ChannelState, keys: string[]): IAudioCommand[] {
		const note = voice.targets[0]?.number ?? voice.input.number
		const midi2 = this.options.output === "midi2"
		const result: IAudioCommand[] = []
		for (const key of keys) {
			if (key === "bend" && midi2) {
				const value = semitonesToBend(state.bend, Number(this.options.memberBendRange))
				result.push(
					this.send(voice.input, {
						type: PER_NOTE_PITCH_BEND,
						number: note,
						value,
						pitchBend: value
					})
				)
			} else if (key === "pressure" && state.pressure !== undefined) {
				result.push(
					this.send(voice.input, {
						type: POLYPHONIC_PRESSURE,
						number: note,
						value: state.pressure
					})
				)
			} else if (key.startsWith("cc")) {
				const controller = Number(key.slice(2))
				const value = state.controllers.get(controller) ?? 0
				if (midi2) {
					// Standard controllers such as CC 74 brightness have registered per-note forms.
					result.push(
						this.send(voice.input, {
							type: PER_NOTE_CONTROLLER,
							number: note,
							controller,
							registered: isRegisteredPerNoteController(controller),
							value
						})
					)
				} else if (this.options.expression === "latest" && voice === this.latest()) {
					result.push(
						this.send(voice.input, { type: CONTROL_CHANGE, number: controller, value })
					)
				}
			}
		}
		return result
	}
	protected noteOn(voice: Voice) {
		const from = source(voice.input)
		const zone = this.zoneOf(from, voice.input.channel)
		if (!zone) {
			return [this.start(voice)]
		}
		const on = this.start(voice)
		on.channel = this.output
		const state = this.state(from, voice.input.channel)
		const keys = [
			"pressure",
			...[...state.controllers.keys()].map((controller) => `cc${controller}`)
		]
		// Member expression usually arrives just before its note; shape the note before it starts.
		if (this.options.output === "midi2") {
			return [...this.expression(voice, state, ["bend", ...keys]), on]
		}
		const controls = this.expression(voice, state, keys)
		return [
			this.channelBend(voice.input),
			...controls.filter((command) => command.type === CONTROL_CHANGE),
			on,
			...controls.filter((command) => command.type !== CONTROL_CHANGE)
		]
	}
	protected noteOff(voice: Voice, command: IAudioCommand) {
		const latest = this.latest() === voice
		// Keep the player's release velocity on the note it ends.
		const result = super
			.noteOff(voice, command)
			.map((off) =>
				off.type === NOTE_OFF
					? Object.assign(off, { velocity: command.velocity ?? 0 })
					: off
			)
		if (
			latest &&
			this.options.output === "midi1" &&
			this.zoneOf(source(voice.input), voice.input.channel)
		) {
			result.push(this.channelBend(voice.input))
		}
		return result
	}
	/** An MPE Configuration Message resets its zones: end their notes and expression. */
	private configure(from: string, master: number, members: number): IAudioCommand[] {
		const result = [...this.voices]
			.filter(
				(voice) => source(voice.input) === from && this.zoneOf(from, voice.input.channel)
			)
			.flatMap((voice) => this.release(voice))
		const announced = { ...(this.announced.get(from) ?? { lower: 15, upper: 0 }) }
		const [zone, other] =
			master === 1 ? (["lower", "upper"] as const) : (["upper", "lower"] as const)
		announced[zone] = members
		// Only an active zone claims channels from the other.
		if (members > 0) {
			announced[other] = Math.min(announced[other], 14 - members)
		}
		this.announced.set(from, announced)
		this.ranges.delete(channelKey(from, master))
		for (const key of this.channels.keys()) {
			if (key.startsWith(`${from}:`)) {
				this.channels.delete(key)
			}
		}
		return result
	}
	/** Registered parameters configure zones and bend ranges, so they are consumed. */
	private parameter(command: IAudioCommand): IAudioCommand[] {
		const from = source(command)
		const channel = command.channel
		const key = channelKey(from, channel)
		const [msb, lsb] = this.parameters.get(key) ?? [127, 127]
		if (command.number === 101 || command.number === 100) {
			this.parameters.set(
				key,
				command.number === 101 ? [command.value, lsb] : [msb, command.value]
			)
		} else if (command.number === 6 && msb === 0) {
			if (lsb === RPN_MPE_CONFIGURATION && (channel === 1 || channel === 16)) {
				return this.configure(from, channel, Math.max(0, Math.min(15, command.value)))
			}
			const zone = this.zoneOf(from, channel)
			if (lsb === RPN_PITCH_BEND_SENSITIVITY && zone) {
				const ranges = this.ranges.get(channelKey(from, zone.master)) ?? {}
				ranges[channel === zone.master ? "master" : "member"] = command.value
				this.ranges.set(channelKey(from, zone.master), ranges)
			}
		}
		return []
	}
	protected other(command: IAudioCommand): IAudioCommand[] {
		const from = source(command)
		const channel = command.channel
		const zone = this.zoneOf(from, channel)
		// Channels 1 and 16 can announce a zone that does not exist yet.
		const announcer = this.options.zone === "auto" && (channel === 1 || channel === 16)
		if (
			(zone || announcer) &&
			command.type === CONTROL_CHANGE &&
			RPN_CONTROLLERS.includes(command.number)
		) {
			return this.parameter(command)
		}
		if (!zone) {
			return [command]
		}
		const state = this.state(from, channel)
		const midi1 = this.options.output === "midi1"
		if (command.type === PITCH_BEND) {
			state.bend = bendToSemitones(command.value, this.range(from, channel, zone))
			if (channel === zone.master) {
				return midi1
					? [this.channelBend(command)]
					: [
							this.send(command, {
								type: PITCH_BEND,
								number: 0,
								value: semitonesToBend(
									state.bend,
									Number(this.options.outputBendRange)
								)
							})
						]
			}
			if (midi1) {
				const latest = this.latest()
				return latest && source(latest.input) === from && latest.input.channel === channel
					? [this.channelBend(command)]
					: []
			}
			return this.held(from, channel).flatMap((voice) =>
				this.expression(voice, state, ["bend"])
			)
		}
		if (channel !== zone.master) {
			if (command.type === CHANNEL_PRESSURE) {
				state.pressure = command.value
				return this.held(from, channel).flatMap((voice) =>
					this.expression(voice, state, ["pressure"])
				)
			}
			if (command.type === CONTROL_CHANGE) {
				state.controllers.set(command.number, command.value)
				return this.held(from, channel).flatMap((voice) =>
					this.expression(voice, state, [`cc${command.number}`])
				)
			}
		}
		return [copyCommand(command, { channel: this.output })]
	}
	protected panicControls(command: IAudioCommand) {
		return this.zoneOf(source(command), command.channel)
			? [copyCommand(command, { channel: this.output })]
			: [command]
	}
	// Announced zones and bend ranges describe the controller, so they outlive transport resets.
	protected clearState() {
		this.channels?.clear()
	}
}