import * as Commands from "../../commands"

export const KEYBOARD_MODES = {
	combined: [
		"Notes and shortcuts",
		"Play chromatic notes from Q (MIDI 41). Enter toggles playback, Space taps tempo, Delete/Escape stops, and arrows change tempo or bend pitch."
	],
	notes: [
		"Notes only",
		"Play chromatic notes from Q (MIDI 41), releasing each note when its key is released. Transport and tempo shortcuts are disabled."
	],
	shortcuts: [
		"Shortcuts only",
		"Enter toggles playback, Space taps tempo, Delete/Escape stops, left/right bend pitch, and up/down change tempo."
	],
	custom: [
		"Custom bindings",
		"Select or learn a key, then choose its command and value. Note bindings release automatically on key-up. Each key has one binding; learning replaces duplicates. Escape cancels learning."
	]
} as const

export const KEYBOARD_COMMANDS = [
	Commands.NOTE_ON,
	Commands.PLAYBACK_TOGGLE,
	Commands.PLAYBACK_START,
	Commands.PLAYBACK_STOP,
	Commands.TEMPO_TAP,
	Commands.TEMPO_INCREASE,
	Commands.TEMPO_DECREASE,
	Commands.TEMPO_RESET,
	Commands.PITCH_BEND,
	Commands.VOLUME_INCREASE,
	Commands.VOLUME_DECREASE,
	Commands.VOLUME_MUTE,
	Commands.PROGRAM_CHANGE,
	Commands.CONTROL_CHANGE
] as const

export interface KeyboardBinding {
	key: string
	command: string
	value: number
}
export interface KeyboardConfiguration {
	mode: keyof typeof KEYBOARD_MODES
	bindings: KeyboardBinding[]
}

export function keyboardConfiguration(
	data: Partial<KeyboardConfiguration> = {}
): KeyboardConfiguration {
	const bindings = new Map<string, KeyboardBinding>()
	if (Array.isArray(data.bindings)) {
		for (const binding of data.bindings) {
			if (
				!binding ||
				typeof binding.key !== "string" ||
				!binding.key ||
				!KEYBOARD_COMMANDS.includes(
					binding.command as (typeof KEYBOARD_COMMANDS)[number]
				) ||
				!Number.isFinite(binding.value)
			) {
				continue
			}
			if (
				[Commands.NOTE_ON, Commands.PROGRAM_CHANGE, Commands.CONTROL_CHANGE].includes(
					binding.command
				) &&
				(!Number.isInteger(binding.value) || binding.value < 0 || binding.value > 127)
			) {
				continue
			}
			if (binding.command === Commands.PITCH_BEND && Math.abs(binding.value) > 1) {
				continue
			}
			const key = binding.key.length === 1 ? binding.key.toLowerCase() : binding.key
			bindings.set(key, { key, command: binding.command, value: binding.value })
		}
	}
	return {
		mode: Object.hasOwn(KEYBOARD_MODES, data.mode ?? "") ? data.mode! : "combined",
		bindings: [...bindings.values()]
	}
}