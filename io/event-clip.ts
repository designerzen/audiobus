import AudioCommand from "../audio-command"
import type { IAudioCommand } from "../audio-command-interface"
import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON, PITCH_BEND, PROGRAM_CHANGE } from "../commands"

export const MAX_CLIP_EVENTS = 20000
export const MAX_CLIP_DURATION = 3600
export interface EventClip {
	version: 1
	duration: number
	commands: IAudioCommand[]
}
const TYPES = new Set([NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PITCH_BEND, PROGRAM_CHANGE])

export function musicalCommand(fields: Partial<IAudioCommand>): IAudioCommand {
	return Object.assign(new AudioCommand(), fields) as unknown as IAudioCommand
}

/** The clip format deliberately stores musical data, never object graphs or runtime resources. */
export function clipCommand(command: IAudioCommand, startAt = command.startAt): IAudioCommand {
	return musicalCommand({
		type: command.type,
		number: command.number,
		channel: command.channel,
		velocity: command.velocity,
		value: command.value ?? 0,
		pitchBend: command.pitchBend ?? 0,
		startAt,
		time: startAt,
		from: command.from ?? ""
	})
}

export function parseEventClip(value: unknown): EventClip {
	if (!value || typeof value !== "object") {
		throw new Error("Invalid event loop file")
	}
	const clip = value as EventClip
	if (
		clip.version !== 1 ||
		!Number.isFinite(clip.duration) ||
		clip.duration <= 0 ||
		clip.duration > MAX_CLIP_DURATION ||
		!Array.isArray(clip.commands) ||
		clip.commands.length > MAX_CLIP_EVENTS
	) {
		throw new Error("Invalid or oversized event loop")
	}
	const commands = clip.commands
		.map((command) => {
			if (
				!command ||
				!TYPES.has(command.type) ||
				!Number.isFinite(command.startAt) ||
				command.startAt < 0 ||
				command.startAt > clip.duration ||
				!Number.isInteger(command.number) ||
				command.number < 0 ||
				command.number > 127 ||
				!Number.isInteger(command.channel) ||
				command.channel < 1 ||
				command.channel > 16 ||
				!Number.isFinite(command.velocity) ||
				command.velocity < 0 ||
				command.velocity > 127 ||
				(command.value !== undefined &&
					(!Number.isFinite(command.value) ||
						command.value < 0 ||
						command.value > 16383)) ||
				(command.pitchBend !== undefined && !Number.isFinite(command.pitchBend))
			) {
				throw new Error("Invalid event loop command")
			}
			return clipCommand(command)
		})
		.sort((a, b) => a.startAt - b.startAt)
	return { version: 1, duration: clip.duration, commands }
}

export function supportsClipCommand(command: IAudioCommand): boolean {
	return TYPES.has(command.type)
}