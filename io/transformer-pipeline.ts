import type { ITransformer } from "./transformers/interface-transformer.ts"
import type { IAudioCommand } from "../audio-command-interface.ts"
import type { Timer } from "netronome"
import { NOTE_ON, NOTE_OFF } from "../commands"
import { cloneAudioCommand } from "../audio-command-factory"
export type TransformerTrace = (transformer: ITransformer, input: number, output: number) => void

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
			// Some legacy effects mutate their inputs. Upstream effects retain
			// these commands to match releases, so give legacy stages their own copy.
			notes.push(cloneAudioCommand(command))
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
	timer: Timer,
	trace?: TransformerTrace
): IAudioCommand[] {
	return transformers.reduce<IAudioCommand[]>((commands, transformer) => {
		const output = [
			...applyTransformer(transformer, commands, timer),
			...(transformer.tick?.(now, timer) ?? [])
		]
		if (commands.length || output.length) {
			trace?.(transformer, commands.length, output.length)
		}
		return output
	}, [])
}

export function transformMidiControls(
	transformers: ITransformer[],
	commands: IAudioCommand[],
	timer: Timer
): IAudioCommand[] {
	// A controller event can also flush a clock-driven effect's pending notes.
	// Those notes still need every downstream stage; applyTransformer already
	// protects the controller itself from legacy note-only effects.
	return transformers.reduce(
		(value, transformer) => applyTransformer(transformer, value, timer),
		commands
	)
}