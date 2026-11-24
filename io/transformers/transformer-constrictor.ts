import type { Timer } from "netronome"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"
import { TRANSFORMER_CATEGORY_TUNING } from "./transformer-categories.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"
import { NOTE_OFF, NOTE_ON } from "../../commands/commands"
import { copyCommand } from "./performance-transformer.ts"

export const ID_CONSTRICTOR = "Constrictor"

function foldNoteToRange(note: number, low: number, high: number): number {
	const min = Math.max(0, Math.min(127, Math.min(low, high)))
	const max = Math.max(min, Math.min(127, Math.max(low, high)))
	let folded = Math.round(note)
	while (folded < min && folded + 12 <= max) {
		folded += 12
	}
	while (folded > max && folded - 12 >= min) {
		folded -= 12
	}
	return Math.max(min, Math.min(max, folded))
}

export class TransformerConstrictor extends Transformer<Record<string, number>> implements ITransformer {
	type = ID_CONSTRICTOR
	category = TRANSFORMER_CATEGORY_TUNING
	#active = new Map<string, number[]>()

	constructor(config: Record<string, number> = {}) {
		super({ enabled: 1, "lowest octave": 3, "highest octave": 8, ...config })
	}

	get name(): string {
		return "Constrictor"
	}

	get description(): string {
		return "Constrict the range of notes that can be played and fold all that fall outside by octaves."
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
				name: "lowest octave",
				type: "select",
				values: [
					{ name: "0", value: 0 },
					{ name: "1", value: 1 },
					{ name: "2", value: 2 },
					{ name: "3", value: 3 },
					{ name: "4", value: 4 },
					{ name: "5", value: 5 },
					{ name: "6", value: 6 },
					{ name: "7", value: 7 },
					{ name: "8", value: 8 },
					{ name: "9", value: 9 },
					{ name: "10", value: 10 }
				],
				default: 3
			},
			{
				name: "highest octave",
				type: "select",
				values: [
					{ name: "0", value: 0 },
					{ name: "1", value: 1 },
					{ name: "2", value: 2 },
					{ name: "3", value: 3 },
					{ name: "4", value: 4 },
					{ name: "5", value: 5 },
					{ name: "6", value: 6 },
					{ name: "7", value: 7 },
					{ name: "8", value: 8 },
					{ name: "9", value: 9 },
					{ name: "10", value: 10 }
				],
				default: 8
			}
		]
	}

	override reset(): void {
		this.#active.clear()
		super.reset()
	}

	transform(commands: IAudioCommand[], _timer: Timer): IAudioCommand[] {
		if (!Number(this.config.enabled ?? 1)) {
			return commands
		}
		const lowOctave = Number(this.config["lowest octave"] ?? 3)
		const highOctave = Number(this.config["highest octave"] ?? 8)
		const low = Math.min(lowOctave, highOctave) * 12
		const high = Math.min(127, (Math.max(lowOctave, highOctave) + 1) * 12 - 1)

		return commands.map((command) => {
			const isNoteOn = command.type === NOTE_ON && (command.velocity ?? 0) > 0
			const isNoteOff =
				command.type === NOTE_OFF || (command.type === NOTE_ON && (command.velocity ?? 0) === 0)
			if (!isNoteOn && !isNoteOff) {
				return command
			}
			const key = `${command.from ?? ""}:${command.channel ?? 1}:${command.number}`
			if (isNoteOn) {
				const folded = foldNoteToRange(command.number, low, high)
				const queue = this.#active.get(key) ?? []
				queue.push(folded)
				this.#active.set(key, queue)
				return folded === command.number ? command : copyCommand(command, { number: folded })
			}
			const queue = this.#active.get(key)
			const folded = queue?.shift()
			if (!queue?.length) {
				this.#active.delete(key)
			}
			if (folded === undefined || folded === command.number) {
				return command
			}
			return copyCommand(command, { number: folded })
		})
	}
}