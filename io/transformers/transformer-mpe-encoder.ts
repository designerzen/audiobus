import {
	PerformanceTransformer,
	copyCommand,
	noteKey,
	numbers,
	routeKey,
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
import {
	MPE_DEFAULT_MASTER_BEND_RANGE,
	MPE_DEFAULT_MEMBER_BEND_RANGE,
	bendToSemitones,
	isRegisteredPerNoteController,
	mpeConfigurationControls,
	mpeControllerDefault,
	mpeZone,
	semitonesToBend,
	type MpeZoneName
} from "../../midi/mpe.ts"

export const ID_MPE_ENCODER = "MPE-Encoder"
const ZONE_SETTINGS = ["zone", "members", "memberBendRange", "masterBendRange", "configure"]

interface Expression {
	bend?: number
	pressure?: number
	controllers: Map<number, number>
}

/**
 * Add MPE: give every note its own member channel and move per-note expression onto it.
 * Accepts MIDI 2 per-note pitch bend and controllers, and polyphonic pressure.
 */
export class TransformerMpeEncoder extends PerformanceTransformer {
	type = ID_MPE_ENCODER
	category = "Routing"
	private nextChannel = 0
	private configured = false
	private expressions = new Map<Voice, Expression>()
	// Expression that arrived before its note, as MIDI 2 allows.
	private pending = new Map<string, Expression>()
	private routeBends = new Map<string, number>()
	// Controllers each member channel has carried, so a reused channel can be reset.
	private channelControllers = new Map<number, Set<number>>()
	get name() {
		return "Add MPE"
	}
	get description() {
		return "Encode notes as MPE: one member channel per note, with per-note bend, pressure and timbre."
	}
	get instructions() {
		return "Place before a MIDI output connected to an MPE synth. MIDI 2 per-note pitch bend and controllers, and polyphonic aftertouch, become member channel pitch bend, CCs and channel pressure."
	}
	constructor(config: Settings = {}) {
		super(
			{
				zone: "lower",
				members: 15,
				memberBendRange: MPE_DEFAULT_MEMBER_BEND_RANGE,
				masterBendRange: MPE_DEFAULT_MASTER_BEND_RANGE,
				channelBend: "master",
				assignable: "cc",
				mode: "round-robin",
				configure: "send"
			},
			[
				{ name: "zone", label: "Zone", values: ["lower", "upper"] },
				{
					name: "members",
					label: "Member channels",
					values: numbers(1, 15),
					min: 1,
					max: 15
				},
				{
					name: "memberBendRange",
					label: "Note bend range",
					values: numbers(1, 96),
					min: 1,
					max: 96,
					help: "Semitones for full per-note pitch bend. MPE expects 48."
				},
				{
					name: "masterBendRange",
					label: "Master bend range",
					values: numbers(1, 24),
					min: 1,
					max: 24,
					help: "Semitones for full channel pitch bend from the source and master channel."
				},
				{
					name: "channelBend",
					label: "Channel pitch bend",
					values: ["master", "notes", "drop"],
					help: "Master sends it zone-wide on the master channel; notes adds it to each held note's bend."
				},
				{
					name: "assignable",
					label: "Assignable per-note controllers",
					values: ["cc", "drop"],
					help: "Registered per-note controllers such as brightness map to their standard CC. Assignable ones have no standard meaning: send them as the CC with the same number, or drop them."
				},
				{ name: "mode", label: "Allocation", values: ["round-robin", "lowest-free"] },
				{
					name: "configure",
					label: "Configuration messages",
					values: ["send", "off"],
					help: "Send the MPE Configuration Message and pitch bend ranges before the first note."
				}
			],
			config
		)
	}
	override setConfig(key: string, value: unknown): void {
		super.setConfig(key, value)
		if (ZONE_SETTINGS.includes(key)) {
			this.configured = false
		}
	}
	private zone() {
		return mpeZone(this.options.zone as MpeZoneName, Number(this.options.members))
	}
	private control(
		template: IAudioCommand,
		type: string,
		channel: number,
		number: number,
		value: number
	): IAudioCommand {
		return copyCommand(template, {
			type,
			subtype: type,
			channel,
			number,
			value,
			velocity: 0,
			pitchBend: type === PITCH_BEND ? value : template.pitchBend,
			startAt: this.now
		})
	}
	private configuration(template: IAudioCommand): IAudioCommand[] {
		if (this.configured || this.options.configure !== "send") {
			return []
		}
		this.configured = true
		return mpeConfigurationControls(
			this.zone(),
			Number(this.options.memberBendRange),
			Number(this.options.masterBendRange)
		).map(({ channel, controller, value }) =>
			this.control(template, CONTROL_CHANGE, channel, controller, value)
		)
	}
	private channelOf(voice: Voice) {
		return voice.targets[0]?.channel
	}
	private bend(voice: Voice): IAudioCommand[] {
		const channel = this.channelOf(voice)
		if (channel === undefined) {
			return []
		}
		const semitones =
			(this.routeBends.get(routeKey(voice.input)) ?? 0) +
			(this.expressions.get(voice)?.bend ?? 0)
		return [
			this.control(
				voice.input,
				PITCH_BEND,
				channel,
				0,
				semitonesToBend(semitones, Number(this.options.memberBendRange))
			)
		]
	}
	/** Expression records for the notes a per-note message addresses, held or still to come. */
	private targets(command: IAudioCommand): [Voice | undefined, Expression][] {
		const key = noteKey(command)
		const voices = [...this.voices].filter((voice) => noteKey(voice.input) === key)
		if (voices.length) {
			return voices.map((voice) => [voice, this.expressions.get(voice)!])
		}
		const pending = this.pending.get(key) ?? { controllers: new Map() }
		this.pending.set(key, pending)
		return [[undefined, pending]]
	}
	/** The member channel controller a per-note controller becomes, if any. */
	private controllerFor(command: IAudioCommand) {
		const controller = command.controller ?? 0
		if (command.registered) {
			return isRegisteredPerNoteController(controller) ? controller : undefined
		}
		return this.options.assignable === "cc" ? controller : undefined
	}
	protected noteOn(voice: Voice) {
		const zone = this.zone()
		const result = this.configuration(voice.input)
		const active = [...this.voices].filter(
			(candidate) => candidate !== voice && this.channelOf(candidate) !== undefined
		)
		const busy = new Set(active.map((candidate) => this.channelOf(candidate)))
		const start = this.nextChannel % zone.members.length
		const ordered =
			this.options.mode === "lowest-free"
				? zone.members
				: [...zone.members.slice(start), ...zone.members.slice(0, start)]
		let channel = ordered.find((channel) => !busy.has(channel))
		if (channel === undefined) {
			// Steal the oldest note still sounding in this zone.
			const oldest = active.find((candidate) =>
				zone.members.includes(this.channelOf(candidate)!)
			)
			if (!oldest) {
				return result
			}
			channel = this.channelOf(oldest)!
			this.expressions.delete(oldest)
			result.push(...this.release(oldest))
		}
		this.nextChannel = zone.members.indexOf(channel) + 1
		const key = noteKey(voice.input)
		const expression: Expression = this.pending.get(key) ?? { controllers: new Map() }
		this.pending.delete(key)
		this.expressions.set(voice, expression)
		const on = this.start(voice)
		on.channel = channel
		// Set the note's expression before it starts, replacing any a reused channel still holds.
		const controllers = this.channelControllers.get(channel) ?? new Set<number>()
		for (const controller of expression.controllers.keys()) {
			controllers.add(controller)
		}
		this.channelControllers.set(channel, controllers)
		result.push(
			...this.bend(voice),
			...[...controllers].map((controller) =>
				this.control(
					voice.input,
					CONTROL_CHANGE,
					channel,
					controller,
					expression.controllers.get(controller) ?? mpeControllerDefault(controller)
				)
			),
			this.control(voice.input, CHANNEL_PRESSURE, channel, 0, expression.pressure ?? 0),
			on
		)
		return result
	}
	protected noteOff(voice: Voice, command: IAudioCommand) {
		this.expressions.delete(voice)
		// Keep the player's release velocity on the note it ends.
		return super
			.noteOff(voice, command)
			.map((off) =>
				off.type === NOTE_OFF
					? Object.assign(off, { velocity: command.velocity ?? 0 })
					: off
			)
	}
	protected other(command: IAudioCommand): IAudioCommand[] {
		const master = this.zone().master
		switch (command.type) {
			case POLYPHONIC_PRESSURE:
				return this.targets(command).flatMap(([voice, expression]) => {
					expression.pressure = command.value
					return voice
						? [
								this.control(
									command,
									CHANNEL_PRESSURE,
									this.channelOf(voice)!,
									0,
									command.value
								)
							]
						: []
				})
			case PER_NOTE_PITCH_BEND:
				return this.targets(command).flatMap(([voice, expression]) => {
					expression.bend = bendToSemitones(
						command.value,
						Number(this.options.memberBendRange)
					)
					return voice ? this.bend(voice) : []
				})
			case PER_NOTE_CONTROLLER: {
				const controller = this.controllerFor(command)
				if (controller === undefined) {
					return []
				}
				return this.targets(command).flatMap(([voice, expression]) => {
					expression.controllers.set(controller, command.value)
					const channel = voice && this.channelOf(voice)
					if (channel === undefined) {
						return []
					}
					this.channelControllers.get(channel)?.add(controller)
					return [
						this.control(command, CONTROL_CHANGE, channel, controller, command.value)
					]
				})
			}
			case PITCH_BEND:
				if (this.options.channelBend === "drop") {
					return []
				}
				if (this.options.channelBend === "notes") {
					const route = routeKey(command)
					this.routeBends.set(
						route,
						bendToSemitones(command.value, Number(this.options.masterBendRange))
					)
					return [...this.voices]
						.filter((voice) => routeKey(voice.input) === route)
						.flatMap((voice) => this.bend(voice))
				}
		}
		// Remaining channel messages apply to the whole zone through its master channel.
		return command.channel > 0 ? [copyCommand(command, { channel: master })] : [command]
	}
	protected panicControls(command: IAudioCommand) {
		const zone = this.zone()
		return [zone.master, ...zone.members].map((channel) => copyCommand(command, { channel }))
	}
	protected clearState() {
		this.nextChannel = 0
		this.configured = false
		this.expressions?.clear()
		this.pending?.clear()
		this.routeBends?.clear()
		this.channelControllers?.clear()
	}
	protected clearRoute(route: string) {
		this.routeBends.delete(route)
		for (const key of this.pending.keys()) {
			if (key.startsWith(`${route}:`)) {
				this.pending.delete(key)
			}
		}
		return []
	}
}