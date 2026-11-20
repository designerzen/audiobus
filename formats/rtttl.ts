import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"

export const RTTTL_DURATIONS = [1, 2, 4, 8, 16, 32] as const

/** Classic RTTTL notes (octaves 4–7), pauses, dots and inline d/o/b changes. */
export function parseRTTTL(text: string, source = "RTTTL") {
	const sections = text.trim().split(":")
	if (sections.length !== 3 || !sections[0].trim()) {
		throw new Error("Expected RTTTL name:defaults:notes")
	}
	let denominator = 4,
		octave = 6,
		tempo = 63,
		cursor = 0,
		noteCount = 0
	const commands: AudioCommand[] = []
	const control = (token: string, defaults = false): boolean => {
		const match = (defaults ? /^([dob])=?([0-9]+)$/i : /^([dob])=([0-9]+)$/i).exec(token)
		if (!match) {
			return false
		}
		const value = Number(match[2])
		switch (match[1].toLowerCase()) {
			case "d":
				if (!RTTTL_DURATIONS.some((d) => d === value)) {
					throw new Error("Invalid RTTTL duration")
				}
				denominator = value
				break
			case "o":
				if (value < 4 || value > 7) {
					throw new Error("RTTTL octave must be 4–7")
				}
				octave = value
				break
			case "b":
				if (value < 1 || value > 900) {
					throw new Error("RTTTL tempo must be 1–900 BPM")
				}
				tempo = value
				break
		}
		return true
	}
	for (const token of sections[1].replace(/\s/g, "").split(",").filter(Boolean)) {
		if (!control(token, true)) {
			throw new Error(`Unsupported RTTTL default: ${token}`)
		}
	}
	for (const raw of sections[2].split(",")) {
		const token = raw.replace(/\s/g, "").toLowerCase()
		if (!token) {
			throw new Error("Empty RTTTL note")
		}
		if (control(token)) {
			continue
		}
		const match = /^(\d+)?([a-gp])(#)?(\.)?([4-7])?(\.)?$/.exec(token)
		if (!match || (match[4] && match[6]) || (match[2] === "p" && (match[3] || match[5]))) {
			throw new Error(`Invalid RTTTL note: ${token}`)
		}
		const length = match[1] ? Number(match[1]) : denominator
		if (!RTTTL_DURATIONS.some((d) => d === length)) {
			throw new Error("Invalid RTTTL duration")
		}
		const duration = (240 / tempo / length) * (match[4] || match[6] ? 1.5 : 1)
		if (cursor + duration > 1800 || noteCount >= 100000) {
			throw new Error("RTTTL exceeds the 30 minute or 100,000 note limit")
		}
		if (match[2] !== "p") {
			const pitch = ({ c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 } as Record<string, number>)[
				match[2]
			]
			const number = (Number(match[5] ?? octave) + 1) * 12 + pitch + (match[3] ? 1 : 0)
			if (number > 107) {
				throw new Error("RTTTL pitch is outside octaves 4–7")
			}
			const common = { number, channel: 1, patch: 0, from: source }
			commands.push(
				Object.assign(new AudioCommand(), common, {
					type: NOTE_ON,
					velocity: 100,
					startAt: cursor,
					endAt: cursor + duration
				}),
				Object.assign(new AudioCommand(), common, {
					type: NOTE_OFF,
					velocity: 0,
					startAt: cursor + duration
				})
			)
			noteCount++
		}
		cursor += duration
	}
	if (!noteCount) {
		throw new Error("RTTTL contains no importable notes")
	}
	return { commands, noteCount }
}