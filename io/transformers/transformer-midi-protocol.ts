import type { IAudioCommand } from "../../commands/audio-command-interface.ts"
import type { Timer } from "netronome"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer, type TransformerConfig } from "./abstract-transformer.ts"
import { copyCommand } from "./performance-transformer.ts"
import {
	CONTROL_CHANGE,
	PER_NOTE_CONTROLLER,
	PER_NOTE_PITCH_BEND,
	PROGRAM_CHANGE
} from "../../commands/commands"
import { commandToMidi } from "../../midi/midi-command-conversion.ts"
import {
	commandToMidi1Ump,
	commandToMidi2Ump,
	scaleCentered,
	withUmp
} from "../../midi/ump-codec.ts"

export const ID_MIDI_PROTOCOL = "MIDI-Protocol"
export const MIDI2_MESSAGE = "midi2Message"
const PER_NOTE = [PER_NOTE_PITCH_BEND, PER_NOTE_CONTROLLER]
// MIDI 2 status nibbles for registered and assignable (non-registered) parameters.
const RPN = 2
const NRPN = 3
const NULL_PARAMETER = 127

interface Config extends TransformerConfig {
	protocol: "midi2" | "midi1"
}
interface ChannelState {
	parameter?: { kind: number; bank: number; index: number }
	data?: number
	bank: [number?, number?]
}

/**
 * Choose the protocol UMP destinations receive. MIDI 2 upgrades channel voice messages to
 * 32-bit packets, turning RPN/NRPN controller sequences and bank selects into single MIDI 2
 * messages; MIDI 1 does the reverse and drops per-note messages it cannot express.
 */
export class TransformerMidiProtocol extends Transformer<Config> implements ITransformer {
	type = ID_MIDI_PROTOCOL
	protected category = "MIDI"
	readonly handlesMidiControls = true
	private channels = new Map<string, ChannelState>()

	get name(): string {
		return "MIDI Protocol"
	}

	get description(): string {
		return "Convert channel messages between MIDI 1 and MIDI 2 for UMP destinations."
	}

	get fields() {
		return [
			{
				name: "enabled",
				type: "select",
				values: [
					{ name: "On", value: 1 },
					{ name: "Off", value: 0 }
				]
			},
			{
				name: "protocol",
				label: "Protocol",
				type: "select",
				help: "MIDI 2 suits UMP destinations only: byte MIDI outputs cannot send its RPN or per-note messages. Use Add MPE to keep per-note expression for MIDI 1 synths.",
				values: [
					{ name: "MIDI 2", value: "midi2" },
					{ name: "MIDI 1", value: "midi1" }
				],
				default: "midi2"
			}
		]
	}

	constructor(config: Partial<Config> = {}) {
		super({ protocol: "midi2", ...config })
	}

	override setConfig(key: string, value: unknown): void {
		super.setConfig(key, value)
		if (key === "protocol") {
			this.channels?.clear()
		}
	}

	transform(commands: IAudioCommand[], _timer?: Timer): IAudioCommand[] {
		if (!this.config.enabled) {
			return commands
		}
		return commands.flatMap((command) =>
			this.config.protocol === "midi1" ? this.toMidi1(command) : this.toMidi2(command)
		)
	}

	private state(command: IAudioCommand): ChannelState {
		const key = `${command.from ?? ""}:${command.midiGroup ?? 0}:${command.channel}`
		let state = this.channels.get(key)
		if (!state) {
			state = { bank: [] }
			this.channels.set(key, state)
		}
		return state
	}

	private header(command: IAudioCommand, status: number): number {
		return (
			(0x40000000 |
				((command.midiGroup ?? 0) << 24) |
				(status << 20) |
				((Math.max(1, Math.min(16, command.channel || 1)) - 1) << 16)) >>>
			0
		)
	}

	/** Collect MIDI 1 controller sequences that MIDI 2 expresses as single messages. */
	private toMidi2(command: IAudioCommand): IAudioCommand[] {
		if (!command.ump && command.type === CONTROL_CHANGE && command.channel > 0) {
			const state = this.state(command)
			const value = command.value & 127
			switch (command.number) {
				case 101:
				case 100:
				case 99:
				case 98: {
					const kind = command.number >= 100 ? RPN : NRPN
					const previous =
						state.parameter?.kind === kind
							? state.parameter
							: { kind, bank: NULL_PARAMETER, index: NULL_PARAMETER }
					state.parameter =
						command.number % 2
							? { ...previous, bank: value }
							: { ...previous, index: value }
					state.data = undefined
					return []
				}
				case 6:
				case 38: {
					const parameter = state.parameter
					if (
						!parameter ||
						(parameter.bank === NULL_PARAMETER && parameter.index === NULL_PARAMETER)
					) {
						break
					}
					// Data entry MSB sets the value; a following LSB refines it.
					state.data =
						command.number === 6 ? value << 7 : ((state.data ?? 0) & 0x3f80) | value
					const words = [
						(this.header(command, parameter.kind) |
							(parameter.bank << 8) |
							parameter.index) >>>
							0,
						scaleCentered(state.data, 14)
					]
					return [
						withUmp(
							copyCommand(command, {
								type: MIDI2_MESSAGE,
								subtype: MIDI2_MESSAGE,
								number: parameter.index,
								value: state.data
							}),
							words
						)
					]
				}
				case 0:
					state.bank[0] = value
					return []
				case 32:
					state.bank[1] = value
					return []
			}
		}
		if (!command.ump && command.type === PROGRAM_CHANGE && command.channel > 0) {
			const [msb, lsb] = this.state(command).bank
			if (msb !== undefined || lsb !== undefined) {
				const program = Math.max(
					0,
					Math.min(127, Math.round(command.value ?? command.number))
				)
				const words = [
					(this.header(command, 12) | 1) >>> 0,
					((program << 24) | ((msb ?? 0) << 8) | (lsb ?? 0)) >>> 0
				]
				return [withUmp(command, words)]
			}
		}
		const words = commandToMidi2Ump(command)
		return [words ? withUmp(command, words) : command]
	}

	/** Spell MIDI 2 parameter and banked program messages as MIDI 1 controller sequences. */
	private toMidi1(command: IAudioCommand): IAudioCommand[] {
		const words = command.ump
		if (words && words[0] >>> 28 === 4) {
			const kind = (words[0] >>> 20) & 15
			const controls = (pairs: number[][]) =>
				pairs.map(([number, value]) => {
					const control = copyCommand(command, {
						type: CONTROL_CHANGE,
						subtype: CONTROL_CHANGE,
						number,
						value,
						velocity: 0
					})
					return withUmp(control, commandToMidi1Ump(control)!)
				})
			if (kind === RPN || kind === NRPN) {
				const data = words[1] >>> 18
				const [bank, index] = kind === RPN ? [101, 100] : [99, 98]
				return controls([
					[bank, (words[0] >>> 8) & 127],
					[index, words[0] & 127],
					[6, data >> 7],
					[38, data & 127]
				])
			}
			if (kind === 12 && words[0] & 1) {
				const program = copyCommand(command, { value: (words[1] >>> 24) & 127 })
				return [
					...controls([
						[0, (words[1] >>> 8) & 127],
						[32, words[1] & 127]
					]),
					withUmp(program, commandToMidi1Ump(program)!)
				]
			}
		}
		const packet = commandToMidi1Ump(command)
		if (packet) {
			return [withUmp(command, packet)]
		}
		// MIDI 2-only channel messages have no MIDI 1 form; system messages pass unchanged.
		const midi2Only =
			PER_NOTE.includes(command.type) ||
			(!!command.ump && command.channel > 0 && !commandToMidi(command))
		return midi2Only ? [] : [command]
	}

	override reset(): void {
		super.reset()
		this.channels.clear()
	}
}