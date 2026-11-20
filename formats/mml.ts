import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF } from "../commands/commands"

const MAX_EXPANDED = 1000000

/** Bounded SiON-style bracket repeats. Other MML dialects may use brackets for chords. */
function expandRepeats(text: string): string {
	let position = 0
	const block = (depth: number): string => {
		if (depth > 16) {
			throw new Error("MML repeat nesting exceeds 16 levels")
		}
		let result = ""
		while (position < text.length && text[position] !== "]") {
			if (text[position] === "[") {
				position++
				const inner = block(depth + 1)
				if (text[position++] !== "]") {
					throw new Error("Unclosed MML repeat")
				}
				const countText = /^\s*(\d+)/.exec(text.slice(position))
				const count = countText ? Number(countText[1]) : 2
				if (!Number.isInteger(count) || count < 1 || count > 256) {
					throw new Error("MML repeat count must be 1–256")
				}
				if (countText) {
					position += countText[0].length
				}
				if (result.length + inner.length * count > MAX_EXPANDED) {
					throw new Error("Expanded MML exceeds the size limit")
				}
				result += inner.repeat(count)
			} else {
				result += text[position++]
			}
			if (result.length > MAX_EXPANDED) {
				throw new Error("Expanded MML exceeds the size limit")
			}
		}
		return result
	}
	const result = block(0)
	if (position !== text.length) {
		throw new Error("Unexpected MML repeat terminator")
	}
	return result
}

/** Core MML: t/o/l/v/q, @ and @v, notes, rests, n, octave shifts, ties,
 * semicolon-separated parallel parts, and SiON-style [repeat]count blocks.
 * Synth definitions, macros and dialect-specific effects are rejected.
 */
export function parseMML(text: string, source = "MML") {
	if (text.length > MAX_EXPANDED) {
		throw new Error("MML exceeds the one million character limit")
	}
	text = text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\r\n]*/g, " ")
	if (text.includes("/*")) {
		throw new Error("Unclosed MML comment")
	}
	text = expandRepeats(text).toLowerCase()
	const parts = text.split(";").filter((part) => part.trim())
	if (parts.length > 16) {
		throw new Error("MML imports support at most 16 parallel parts")
	}
	const commands: AudioCommand[] = []
	let noteCount = 0
	for (const [partIndex, part] of parts.entries()) {
		let position = 0,
			tempo = 120,
			octave = 4,
			defaultLength = 4,
			velocity = 100,
			gate = 8,
			patch = 0,
			cursor = 0,
			tie = false
		let previous: { on: AudioCommand; off: AudioCommand } | undefined
		const integer = (min: number, max: number, optional = false): number | undefined => {
			const match = /^-?\d+/.exec(part.slice(position))
			if (!match) {
				if (optional) {
					return undefined
				}
				throw new Error(`MML expected a number at position ${position + 1}`)
			}
			position += match[0].length
			const value = Number(match[0])
			if (!Number.isInteger(value) || value < min || value > max) {
				throw new Error(`MML value must be ${min}–${max}`)
			}
			return value
		}
		while (position < part.length) {
			const token = part[position++]
			if (/\s/.test(token)) {
				continue
			}
			if (token === "t") {
				tempo = integer(1, 1000)!
				continue
			}
			if (token === "o") {
				octave = integer(-1, 9)!
				continue
			}
			if (token === "l") {
				defaultLength = integer(1, 1024)!
				continue
			}
			if (token === "v") {
				velocity = Math.round((integer(0, 15)! * 127) / 15)
				continue
			}
			if (token === "q") {
				gate = integer(0, 8)!
				continue
			}
			if (token === "@") {
				if (part[position] === "v") {
					position++
					velocity = integer(0, 127)!
				} else {
					patch = integer(0, 127)!
				}
				continue
			}
			if (token === ">" || token === "<") {
				octave += token === ">" ? 1 : -1
				continue
			}
			if (token === "&") {
				if (!previous || tie) {
					throw new Error("MML tie must follow a note")
				}
				tie = true
				continue
			}
			if (!/[a-grn]/.test(token)) {
				throw new Error(`Unsupported core MML command '${token}' at position ${position}`)
			}
			let number =
				token === "n"
					? integer(0, 127)!
					: ({ c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 } as Record<string, number>)[
							token
						] +
						(octave + 1) * 12
			if (/[a-g]/.test(token) && ["+", "#", "-"].includes(part[position])) {
				number += part[position++] === "-" ? -1 : 1
			}
			const denominator =
				token === "n" ? defaultLength : (integer(1, 1024, true) ?? defaultLength)
			let beats = 4 / denominator,
				addition = beats / 2,
				dots = 0
			while (part[position] === ".") {
				if (++dots > 8) {
					throw new Error("Too many MML duration dots")
				}
				position++
				beats += addition
				addition /= 2
			}
			const duration = (beats * 60) / tempo
			if (cursor + duration > 1800 || noteCount >= 100000) {
				throw new Error("MML exceeds the 30 minute or 100,000 note limit")
			}
			if (token === "r" || velocity === 0 || gate === 0) {
				if (tie) {
					throw new Error("MML ties cannot end in a rest or silent note")
				}
				previous = undefined
			} else {
				if (number < 0 || number > 127) {
					throw new Error("MML pitch is outside MIDI range")
				}
				const endAt = cursor + (duration * gate) / 8
				if (tie) {
					if (previous!.on.number !== number || previous!.on.patch !== patch) {
						throw new Error("MML ties must join the same pitch and instrument")
					}
					previous!.on.endAt = endAt
					previous!.off.startAt = endAt
				} else {
					const values = {
						number,
						channel: partIndex + 1,
						patch,
						from: `${source}:part-${partIndex + 1}`
					}
					const on = Object.assign(new AudioCommand(), values, {
						type: NOTE_ON,
						velocity,
						startAt: cursor,
						endAt
					})
					const off = Object.assign(new AudioCommand(), values, {
						type: NOTE_OFF,
						velocity: 0,
						startAt: endAt
					})
					commands.push(on, off)
					previous = { on, off }
					noteCount++
				}
			}
			tie = false
			cursor += duration
		}
		if (tie) {
			throw new Error("Unfinished MML tie")
		}
	}
	if (!noteCount) {
		throw new Error("MML contains no importable notes")
	}
	commands.sort(
		(a, b) => a.startAt - b.startAt || (a.type === NOTE_OFF ? -1 : b.type === NOTE_OFF ? 1 : 0)
	)
	return { commands, noteCount }
}