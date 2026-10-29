import type { ITransformer } from "./transformers/interface-transformer.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"
import type { Timer } from "netronome"
import { NOTE_ON, NOTE_OFF } from "../commands"

export function applyTransformer(
	transformer: ITransformer,
	commands: IAudioCommand[],
	timer: Timer
): IAudioCommand[] {
	if (!commands.length) {
		return []
	}
	if (transformer.handlesMidiControls) {
		return transformer.transform(commands, timer)
	}
	// Legacy pitch effects interpret every command as a note. Keep controller and
	// system messages out of those effects, including CCs generated upstream.
	const result: IAudioCommand[] = []
	let notes: IAudioCommand[] = []
	for (const command of commands) {
		if (command.type === NOTE_ON || command.type === NOTE_OFF) {
			notes.push(command)
		} else {
			if (notes.length) {
				result.push(...transformer.transform(notes, timer))
			}
			notes = []
			result.push(command)
		}
	}
	if (notes.length) {
		result.push(...transformer.transform(notes, timer))
	}
	return result
}

export function advanceTransformers(
	transformers: ITransformer[],
	now: number,
	timer: Timer
): IAudioCommand[] {
	return transformers.reduce<IAudioCommand[]>(
		(commands, transformer) => [
			...applyTransformer(transformer, commands, timer),
			...(transformer.tick?.(now, timer) ?? [])
		],
		[]
	)
}

export function transformMidiControls(
	transformers: ITransformer[],
	commands: IAudioCommand[],
	timer: Timer
): IAudioCommand[] {
	return transformers.reduce(
		(value, transformer) =>
			transformer.handlesMidiControls ? transformer.transform(value, timer) : value,
		commands
	)
}