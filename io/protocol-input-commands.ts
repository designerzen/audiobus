import {
	CommandRegistry,
	type CapabilityBundle,
	type CommandDescriptor,
	type Json,
	type Params,
	type Parameter,
	type PropertyDescriptor
} from "audiobus-protocol"

/**
 * Commands owned by one peer connection, layered over the shared application registry.
 * Local commands take precedence; application commands, properties and events pass through.
 */
export class LayeredRegistry extends CommandRegistry {
	constructor(private readonly base: () => CommandRegistry) {
		super()
	}
	private owns(id: string): boolean {
		return super.list().some((command) => command.id === id)
	}
	list(): CommandDescriptor[] {
		const own = super.list()
		const ids = new Set(own.map((command) => command.id))
		return [
			...own,
			...this.base()
				.list()
				.filter((command) => !ids.has(command.id))
		]
	}
	call(id: string, params?: unknown): Promise<Json> {
		return this.owns(id) ? super.call(id, params) : this.base().call(id, params)
	}
	listProperties(): PropertyDescriptor[] {
		return this.base().listProperties()
	}
	getProperty(id: string): Promise<Json> {
		return this.base().getProperty(id)
	}
	setProperty(id: string, value: unknown): Promise<Json> {
		return this.base().setProperty(id, value)
	}
	notifyProperty(id: string): Promise<Json> {
		return this.base().notifyProperty(id)
	}
	listBundles(): CapabilityBundle[] {
		const own = super.listBundles()
		const ids = new Set(own.map((bundle) => bundle.id))
		return [
			...own,
			...this.base()
				.listBundles()
				.filter((bundle) => !ids.has(bundle.id))
		]
	}
	readRetained(topic: string): { value: Json } | undefined {
		return super.readRetained(topic) ?? this.base().readRetained(topic)
	}
	observe(listener: (topic: string, data: Json) => void): () => void {
		const own = super.observe(listener),
			shared = this.base().observe(listener)
		return () => {
			own()
			shared()
		}
	}
}

export const MIDI_BUNDLE_ID = "org.audiobus.midi"
const integer = (minimum: number, maximum: number, description: string): Parameter => ({
	type: "integer",
	minimum,
	maximum,
	description
})
const CHANNEL = integer(1, 16, "MIDI channel, 1–16 (default 1)")
const NOTE = integer(0, 127, "MIDI note number, 0–127 (60 is middle C)")
const VALUE = (description: string) => integer(0, 127, description)

/**
 * Discoverable MIDI performance commands. Each produces one complete MIDI 1 message and passes it
 * to `send`, which routes it exactly like WebMidiLink MIDI from the same peer.
 */
export function registerMidiCommands(
	registry: CommandRegistry,
	send: (bytes: number[]) => void
): () => void {
	const status = (kind: number, params: Params) => kind | (((params.channel as number) ?? 1) - 1)
	const define = (
		id: string,
		title: string,
		description: string,
		properties: Record<string, Parameter>,
		required: string[],
		bytes: (params: Params) => number[]
	) =>
		registry.register({
			id,
			title,
			description,
			inputSchema: {
				type: "object",
				properties: { ...properties, channel: CHANNEL },
				required,
				additionalProperties: false
			},
			execute: (params) => {
				send(bytes(params))
				return null
			}
		})
	const removals = [
		define(
			"midi.noteOn",
			"Play a note",
			"Start a note; send midi.noteOff with the same note and channel to end it",
			{ note: NOTE, velocity: integer(1, 127, "Velocity, 1–127 (default 100)") },
			["note"],
			(p) => [status(0x90, p), p.note as number, (p.velocity as number) ?? 100]
		),
		define(
			"midi.noteOff",
			"Release a note",
			"End a note started with midi.noteOn",
			{ note: NOTE, velocity: VALUE("Release velocity, 0–127 (default 0)") },
			["note"],
			(p) => [status(0x80, p), p.note as number, (p.velocity as number) ?? 0]
		),
		define(
			"midi.polyAftertouch",
			"Set note pressure",
			"Polyphonic aftertouch for one held note",
			{ note: NOTE, pressure: VALUE("Pressure, 0–127") },
			["note", "pressure"],
			(p) => [status(0xa0, p), p.note as number, p.pressure as number]
		),
		define(
			"midi.channelAftertouch",
			"Set channel pressure",
			"Channel aftertouch for every note on the channel",
			{ pressure: VALUE("Pressure, 0–127") },
			["pressure"],
			(p) => [status(0xd0, p), p.pressure as number]
		),
		define(
			"midi.pitchBend",
			"Bend pitch",
			"Pitch bend; 0 is centred",
			{ value: integer(-8192, 8191, "Bend, −8192 to 8191 (0 is centre)") },
			["value"],
			(p) => {
				const value = (p.value as number) + 8192
				return [status(0xe0, p), value & 127, value >> 7]
			}
		),
		define(
			"midi.controlChange",
			"Change a controller",
			"Send a MIDI control change, such as 1 for modulation or 64 for sustain",
			{ controller: VALUE("Controller number, 0–127"), value: VALUE("Value, 0–127") },
			["controller", "value"],
			(p) => [status(0xb0, p), p.controller as number, p.value as number]
		),
		define(
			"midi.programChange",
			"Change program",
			"Select an instrument program",
			{ program: VALUE("Program number, 0–127") },
			["program"],
			(p) => [status(0xc0, p), p.program as number]
		),
		define(
			"midi.allNotesOff",
			"Release all notes",
			"Send All Notes Off on the channel",
			{},
			[],
			(p) => [status(0xb0, p), 123, 0]
		)
	]
	removals.push(
		registry.registerBundle({
			id: MIDI_BUNDLE_ID,
			version: 1,
			commands: [
				"midi.noteOn",
				"midi.noteOff",
				"midi.polyAftertouch",
				"midi.channelAftertouch",
				"midi.pitchBend",
				"midi.controlChange",
				"midi.programChange",
				"midi.allNotesOff"
			],
			properties: []
		})
	)
	return () => removals.reverse().forEach((remove) => remove())
}