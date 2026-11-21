import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PITCH_BEND, PROGRAM_CHANGE } from "../commands/commands"
import type { IAudioCommand } from "../commands/audio-command-interface"
import type { MidiSong, SongEvent } from "./midi-song"
import type { EnsembleSettings } from "./ensemble-session"

export type EnsemblePartRole = "auto" | "notes" | "groove"
export interface EnsemblePartFeedback {
	phase: "ready" | "queued" | "sounding" | "rest" | "looping" | "stopping" | "complete"
	message: string
	/** Monotonic gesture serial lets the UI confirm acceptance without triggering audio. */
	accepted: number
	beat: number
	beatsUntil: number
	bar: number
}
interface Onset {
	beat: number
	notes: SongEvent[]
}
interface Bar {
	beat: number
	end: number
	patterns: Map<number, Onset[]>
}
interface Groove {
	from: number
	through: number
	stop?: number
	accent?: number
}
interface Request {
	onset: Onset
	beat: number
}
interface Voice {
	command: IAudioCommand
	end: number
	releaseSent?: boolean
}

/**
 * One gesture requests one score onset (Métapiano / MidifilePerformer, FARM 2021).
 * Local score cursors remain distinct from the shared beat/phase (Ableton Link).
 * Recovery uses musical landmarks, inspired by Antescofo's target synchronization;
 * the recovery window and bounded duration correction are application heuristics.
 * https://sigplan.github.io/OpenTOC/farm21.html
 * https://ableton.github.io/link/
 * https://support.ircam.fr/docs/Antescofo/manuals/Reference/time_synchro/
 */
export class EnsemblePerformance {
	private song?: MidiSong
	private onsets = new Map<number, Onset[]>()
	private ends = new Map<string, number>()
	private bars: Bar[] = []
	private cursors = new Map<number, number>()
	private requests = new Map<number, Request>()
	private grooves = new Map<number, Groove>()
	private voices = new Map<string, Voice>()
	private programs = new Map<number, number>()
	private touched = new Set<number>()
	private cleanup: IAudioCommand[] = []
	private held = new Set<string>()
	private rejoining = new Set<number>()
	private accepted = new Map<number, number>()
	private serial = 0
	private chordWindowMs = 20
	private fallback = new Map<Bar, Bar>()
	private cursor = 0
	private position = 0
	private first = 0
	private lastNow?: number
	private lastActivity = 0
	private running = false
	private paused = false
	private ended = false
	constructor(private settings: () => EnsembleSettings) {}
	private beat(seconds: number): number {
		return this.song!.midi.header.secondsToTicks(seconds) / this.song!.midi.header.ppq
	}
	private seconds(beat: number): number {
		return this.song!.midi.header.ticksToSeconds(beat * this.song!.midi.header.ppq)
	}
	private bar(beat: number): Bar {
		return this.bars.find((bar) => beat < bar.end - 1e-7) ?? this.bars[this.bars.length - 1]
	}
	role(channel: number): "notes" | "groove" {
		const role = this.settings().partRoles?.[channel]
		return role === "notes" || role === "groove" ? role : channel === 10 ? "groove" : "notes"
	}
	get state() {
		return {
			running: this.running,
			paused: this.paused,
			ended: this.ended,
			position: this.position,
			bar: this.song ? this.bars.indexOf(this.bar(this.beat(this.position))) + 1 : 0,
			speed: 1,
			lastNow: this.lastNow
		}
	}
	parts() {
		const live = [
			...new Set([
				...[...this.grooves]
					.filter(([, g]) => this.song && g.from <= this.beat(this.position))
					.map(([channel]) => channel),
				...[...this.voices.values()]
					.filter((v) => (v.command.audioTime ?? 0) <= (this.lastNow ?? 0))
					.map((v) => v.command.channel)
			])
		]
		const beat = this.song ? this.beat(this.position) : 0
		const end = this.song ? this.bar(beat).end : 0
		const upcoming = (this.song?.channels ?? []).filter((channel) =>
			this.onsets.get(channel)?.some((onset) => onset.beat >= beat && onset.beat < end)
		)
		return { live, upcoming }
	}
	partFeedback(channel: number): EnsemblePartFeedback {
		const beat = this.song ? this.beat(this.position) : 0
		const groove = this.grooves.get(channel)
		const request = this.requests.get(channel)
		const voice = [...this.voices.values()].find(
			(v) => v.command.channel === channel && v.end > beat
		)
		const next = this.onsets.get(channel)?.[this.cursors.get(channel) ?? 0]
		const queuedVoice = voice && (voice.command.audioTime ?? 0) > (this.lastNow ?? 0)
		const target =
			groove?.stop ??
			groove?.from ??
			request?.beat ??
			(queuedVoice
				? this.beat(this.position + voice.command.audioTime! - (this.lastNow ?? 0))
				: next?.beat) ??
			beat
		const beatsUntil = Math.max(0, target - beat)
		let phase: EnsemblePartFeedback["phase"] = "ready"
		let message = "Tap for the next note"
		if (groove) {
			phase =
				groove.stop !== undefined
					? "stopping"
					: groove.from > beat + 1e-7
						? "queued"
						: "looping"
			message =
				phase === "queued"
					? `Accepted · loop starts in ${Math.ceil(beatsUntil)} beats`
					: phase === "stopping"
						? `Stopping in ${Math.ceil(beatsUntil)} beats`
						: "Looping · tap to accent"
		} else if (this.role(channel) === "groove") {
			message = "Tap to start a groove"
		} else if (request || (voice && (voice.command.audioTime ?? 0) > (this.lastNow ?? 0))) {
			phase = "queued"
			message = "Accepted · note queued"
			if (beatsUntil > 0) message += ` · in ${Math.ceil(beatsUntil)} beats`
		} else if (voice) {
			phase = "sounding"
			message = "Playing · tap for the next note"
		} else if (!next) {
			phase = "complete"
			message = "Part complete"
		} else if (beatsUntil > 1) {
			phase = "rest"
			message = `Rest · next entry in ${Math.ceil(beatsUntil)} beats`
		}
		return {
			phase,
			message,
			accepted: this.accepted.get(channel) ?? 0,
			beat,
			beatsUntil,
			bar: this.song ? this.bars.indexOf(this.bar(target)) + 1 : 0
		}
	}
	partState(channel: number): string {
		if (this.role(channel) === "groove") {
			const groove = this.grooves.get(channel)
			return !groove
				? "Tap to loop"
				: groove.stop !== undefined
					? `Stopping at bar ${this.bars.indexOf(this.bar(groove.stop)) + 1}`
					: groove.from > this.beat(this.position) + 1e-7
						? "Loop queued for next bar"
						: "Looping · tap to accent"
		}
		const onset =
			this.requests.get(channel)?.onset ??
			this.onsets.get(channel)?.[this.cursors.get(channel) ?? 0]
		if (!onset) return "Part complete"
		return `${this.rejoining.has(channel) ? "Rejoining · " : ""}${this.requests.has(channel) ? "Queued" : "Next"}: ${onset.notes.map((n) => `${["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][n.command.number % 12]}${Math.floor(n.command.number / 12) - 1}`).join(" + ")} · bar ${this.bars.indexOf(this.bar(onset.beat)) + 1}`
	}
	setSong(song?: MidiSong): void {
		this.reset()
		this.song = song
		this.onsets.clear()
		this.ends.clear()
		this.bars = []
		if (!song) return
		const header = song.midi.header
		for (const event of song.events) {
			if (event.command.type === NOTE_OFF && event.voice)
				this.ends.set(event.voice, this.beat(event.at))
		}
		this.groupNotes()
		const duration = this.beat(song.duration)
		for (let beat = 0; beat <= duration + 1e-7; ) {
			const tick = beat * header.ppq
			const signature = [...header.timeSignatures]
				.reverse()
				.find((s) => s.ticks <= tick + 1e-7)
			const [count, unit] = signature?.timeSignature ?? [4, 4]
			const next = header.timeSignatures.find((s) => s.ticks > tick + 1e-7)
			const end = Math.min(
				beat + (count * 4) / unit,
				next ? next.ticks / header.ppq : Infinity
			)
			const patterns = new Map<number, Onset[]>()
			for (const [channel, groups] of this.onsets) {
				const pattern = groups.filter((g) => g.beat >= beat - 1e-7 && g.beat < end - 1e-7)
				if (pattern.length) patterns.set(channel, pattern)
			}
			this.bars.push({ beat, end, patterns })
			beat = end
		}
		this.buildFallbacks()
		this.first = Math.min(...[...this.onsets.values()].map((groups) => groups[0].beat))
		if (!Number.isFinite(this.first)) this.first = 0
	}
	/** Fixed-origin clusters preserve expressive chord offsets without chaining an arpeggio. */
	private groupNotes(): void {
		this.chordWindowMs = Math.max(0, Math.min(50, this.settings().chordWindowMs ?? 20))
		this.onsets.clear()
		for (const event of this.song!.events) {
			if (event.command.type !== NOTE_ON) continue
			const channel = event.command.channel
			const groups = this.onsets.get(channel) ?? []
			const beat = this.beat(event.at)
			const last = groups[groups.length - 1]
			const window = last
				? Math.min(
						this.chordWindowMs / 1000,
						this.seconds(last.beat + 1 / 32) - this.seconds(last.beat)
					)
				: 0
			const staggeredChord =
				last &&
				channel !== 10 &&
				event.at - this.seconds(last.beat) <= window + 1e-7 &&
				!last.notes.some((n) => n.command.number === event.command.number) &&
				this.seconds(this.ends.get(event.voice!) ?? beat) - event.at > window * 2 &&
				last.notes.every(
					(n) => this.seconds(this.ends.get(n.voice!) ?? last.beat) - n.at > window * 2
				)
			if (last && (Math.abs(last.beat - beat) < 1e-7 || staggeredChord))
				last.notes.push(event)
			else groups.push({ beat, notes: [event] })
			this.onsets.set(channel, groups)
		}
	}
	/** Repeat established 1/2/4-bar percussion cycles through gaps, rather than latching a fill. */
	private buildFallbacks(): void {
		this.fallback.clear()
		const signature = (bar: Bar) =>
			JSON.stringify(
				(bar.patterns.get(10) ?? []).map((o) => [
					Math.round((o.beat - bar.beat) * 96),
					o.notes.map((n) => n.command.number).sort((a, b) => a - b)
				])
			)
		let section = 0
		let stable: { from: number; length: number } | undefined
		let latest: Bar | undefined
		this.bars.forEach((bar, index) => {
			const marker = this.song!.midi.header.meta.some(
				(m) =>
					m.type === "marker" &&
					m.ticks / this.song!.midi.header.ppq > (this.bars[index - 1]?.beat ?? -1) &&
					m.ticks / this.song!.midi.header.ppq <= bar.beat
			)
			if (marker) {
				section = index
				stable = undefined
				latest = undefined
			}
			if (!bar.patterns.has(10)) {
				const source = stable
					? this.bars[stable.from + ((index - stable.from) % stable.length)]
					: latest
				if (source) this.fallback.set(bar, source)
			} else latest = bar
			for (const length of [1, 2, 4]) {
				const from = index - length + 1
				if (from - length < section) continue
				const cycle = this.bars.slice(from, index + 1)
				if (
					cycle.some((b) => b.patterns.has(10)) &&
					cycle.every((b, offset) => {
						const previous = this.bars[from - length + offset]
						return (
							Math.abs(b.end - b.beat - (previous.end - previous.beat)) < 1e-7 &&
							signature(b) === signature(previous)
						)
					})
				) {
					stable = { from, length }
					break
				}
			}
		})
	}
	/** Prefer the current authored section entry, otherwise the current bar. Never rewind a cursor. */
	private recoveryIndex(channel: number, index: number, beat: number): number {
		const marker = [...this.song!.midi.header.meta]
			.filter((m) => m.type === "marker" && m.ticks / this.song!.midi.header.ppq <= beat)
			.sort((a, b) => b.ticks - a.ticks)[0]
		const threshold = this.settings().recoveryBars ?? 2
		const landmark =
			marker &&
			this.bars.indexOf(this.bar(beat)) -
				this.bars.indexOf(this.bar(marker.ticks / this.song!.midi.header.ppq)) <
				threshold
				? marker.ticks / this.song!.midi.header.ppq
				: this.bar(beat).beat
		return (this.onsets.get(channel) ?? []).findIndex(
			(g, i) => i >= index && g.beat >= landmark - 1e-7
		)
	}
	rejoinPart(channel: number): void {
		if (!this.song || this.role(channel) !== "notes") return
		const groups = this.onsets.get(channel) ?? []
		const index = this.recoveryIndex(
			channel,
			this.cursors.get(channel) ?? 0,
			this.beat(this.position)
		)
		// This changes what the next gesture requests; it never sounds skipped material.
		if (!this.requests.has(channel))
			this.cursors.set(channel, index < 0 ? groups.length : index)
		this.rejoining.add(channel)
	}
	private command(event: SongEvent, at: number): IAudioCommand {
		return Object.assign(new AudioCommand(), event.command, {
			startAt: at,
			time: at,
			audioTime: at
		})
	}
	private release(now: number): IAudioCommand[] {
		const output = [...this.voices.values()].map(({ command }) =>
			Object.assign(new AudioCommand(), command, {
				type: NOTE_OFF,
				velocity: 0,
				startAt: now,
				time: now,
				audioTime: Math.max(now, command.audioTime ?? now)
			})
		)
		for (const channel of this.touched) {
			for (const values of [
				{ type: CONTROL_CHANGE, number: 64, value: 0 },
				{ type: PITCH_BEND, value: 8192 }
			]) {
				output.push(
					Object.assign(new AudioCommand(), values, {
						channel,
						startAt: now,
						time: now,
						audioTime: now
					})
				)
			}
		}
		this.voices.clear()
		this.touched.clear()
		return output
	}
	reset(): void {
		this.cleanup.push(...this.release(this.lastNow ?? 0))
		this.cursors.clear()
		this.requests.clear()
		this.grooves.clear()
		this.programs.clear()
		this.held.clear()
		this.rejoining.clear()
		this.accepted.clear()
		this.cursor = this.position = this.lastActivity = 0
		this.lastNow = undefined
		this.running = this.paused = this.ended = false
	}
	/** Membership edits preserve surviving channels and stop removed or reclassified parts. */
	configure(): void {
		if (this.song && this.chordWindowMs !== (this.settings().chordWindowMs ?? 20)) {
			const next = new Map(
				[...this.onsets].map(([channel, groups]) => [
					channel,
					groups[this.cursors.get(channel) ?? 0]?.beat ?? Infinity
				])
			)
			this.groupNotes()
			const scoreOnsets = new Map(
				[...this.onsets].map(([channel, groups]) => [channel, [...groups]])
			)
			for (const [channel, beat] of next) {
				const groups = this.onsets.get(channel) ?? []
				let index = groups.findIndex((g) =>
					g.notes.some((n) => this.beat(n.at) >= beat - 1e-7)
				)
				// A wider window can merge an unplayed tone into an already played chord.
				// Keep those remaining tones as a partial onset, rather than losing or replaying them.
				if (index >= 0 && groups[index].beat < beat - 1e-7) {
					const notes = groups[index].notes.filter((n) => this.beat(n.at) >= beat - 1e-7)
					groups.splice(++index, 0, { beat: this.beat(notes[0].at), notes })
				}
				this.cursors.set(channel, index < 0 ? groups.length : index)
			}
			for (const bar of this.bars) {
				bar.patterns.clear()
				for (const [channel, groups] of scoreOnsets) {
					const pattern = groups.filter(
						(g) => g.beat >= bar.beat - 1e-7 && g.beat < bar.end - 1e-7
					)
					if (pattern.length) bar.patterns.set(channel, pattern)
				}
			}
			this.buildFallbacks()
		}
		const assigned = new Set(this.settings().players.flatMap((p) => p.channels))
		for (const channel of this.grooves.keys()) {
			if (!assigned.has(channel) || this.role(channel) !== "groove")
				this.grooves.delete(channel)
		}
		for (const channel of this.requests.keys()) {
			if (!assigned.has(channel) || this.role(channel) !== "notes")
				this.requests.delete(channel)
		}
		const sources = new Set(this.settings().players.map((p, i) => p.source || `player:${i}`))
		for (const source of this.held) if (!sources.has(source)) this.held.delete(source)
	}
	press(player: number, now: number): IAudioCommand[] {
		const output = this.advance(now)
		const assigned = this.settings().players[player]
		if (
			!this.song ||
			!assigned ||
			this.ended ||
			!Number.isFinite(now) ||
			this.held.has(assigned.source || `player:${player}`)
		)
			return output
		this.held.add(assigned.source || `player:${player}`)
		if (!this.running) {
			if (!this.paused) this.position = this.seconds(this.first)
			this.lastNow = now
			this.running = true
			this.paused = false
		}
		const beat = this.beat(this.position)
		this.lastActivity = beat
		for (const channel of assigned.channels) {
			this.accepted.set(channel, ++this.serial)
			if (this.role(channel) === "groove") {
				const groove = this.grooves.get(channel)
				if (groove) {
					groove.accent = Math.ceil(beat - 1e-7)
					groove.stop = undefined
				} else {
					const bar = this.bar(beat)
					const from = Math.abs(beat - bar.beat) < 1e-7 ? beat : bar.end
					this.grooves.set(channel, { from, through: from - 1e-7 })
				}
				continue
			}
			if (this.requests.has(channel)) continue // at most one early request, never a queued phrase
			const groups = this.onsets.get(channel) ?? []
			let index = this.cursors.get(channel) ?? 0
			let onset = groups[index]
			this.rejoining.delete(channel)
			if (
				onset &&
				this.bars.indexOf(this.bar(beat)) - this.bars.indexOf(this.bar(onset.beat)) >=
					(this.settings().recoveryBars ?? 2)
			) {
				index = this.recoveryIndex(channel, index, beat)
				onset = groups[index]
				this.rejoining.add(channel)
			}
			if (!onset) {
				this.cursors.set(channel, groups.length)
				continue
			}
			this.cursors.set(channel, index + 1)
			// Early notes retain score timing. Late gestures sound immediately; they never unlock later notes.
			this.requests.set(channel, { onset, beat: Math.max(beat, onset.beat) })
		}
		return [...output, ...this.advance(now)]
	}
	releasePress(player: number, now: number): IAudioCommand[] {
		this.held.delete(this.settings().players[player]?.source || `player:${player}`)
		return this.advance(now)
	}
	stopGroove(channel: number): void {
		const groove = this.grooves.get(channel)
		if (groove && this.song) {
			// Commands already delivered to an output cannot be cancelled. Choose the
			// earliest boundary outside the scheduling horizon, rather than leaking an attack.
			groove.stop = this.bar(Math.max(this.beat(this.position), groove.through)).end
		}
	}
	private sound(
		onset: Onset,
		beat: number,
		now: number,
		position: number,
		id: string,
		accent = false,
		correctLate = true
	): IAudioCommand[] {
		const output: IAudioCommand[] = []
		// MIDI 1 releases address a pitch, not an individual voice. If a release is
		// already scheduled, place the new attack after it; otherwise release the old
		// articulation before retriggering so its eventual release cannot cut this one.
		for (const voice of this.voices.values()) {
			if (
				voice.releaseSent &&
				onset.notes.some(
					(n) =>
						n.command.channel === voice.command.channel &&
						n.command.number === voice.command.number
				)
			) {
				beat = Math.max(beat, voice.end)
			}
		}
		// Mild compression of late note lengths aims toward a future landmark without dropping onsets.
		const scale = Math.max(0.75, 1 - (correctLate ? Math.max(0, beat - onset.beat) : 0) * 0.05)
		for (const event of onset.notes) {
			const originalBeat = this.beat(event.at)
			const noteBeat = beat + originalBeat - onset.beat
			const at = Math.max(now, now + this.seconds(noteBeat) - this.seconds(position))
			const command = this.command(event, at)
			for (const [key, voice] of this.voices) {
				if (
					voice.command.channel !== command.channel ||
					voice.command.number !== command.number
				)
					continue
				if (!voice.releaseSent)
					output.push(
						Object.assign(new AudioCommand(), voice.command, {
							type: NOTE_OFF,
							velocity: 0,
							startAt: Math.min(now, at),
							time: Math.min(now, at),
							audioTime: at
						})
					)
				this.voices.delete(key)
			}
			if (accent) command.velocity = Math.min(127, Math.round(command.velocity * 1.2))
			const end =
				noteBeat + Math.max(0.02, (this.ends.get(event.voice!)! - originalBeat) * scale)
			this.voices.set(`${id}:${event.voice}`, { command, end })
			this.touched.add(command.channel)
			output.push(command)
		}
		return output
	}
	advance(now: number): IAudioCommand[] {
		if (!Number.isFinite(now)) return []
		const output: IAudioCommand[] = this.cleanup.splice(0).map((c) =>
			Object.assign(c, {
				startAt: now,
				time: now,
				audioTime: Math.max(now, c.audioTime ?? now)
			})
		)
		if (!this.song || !this.running) return output
		const elapsed = now - (this.lastNow ?? now)
		this.lastNow = now
		this.position += elapsed >= 0 && elapsed <= 1 ? elapsed : 0
		const duration = this.seconds(this.bar(this.beat(this.song.duration) - 1e-7).end)
		if (this.position >= duration) {
			output.push(...this.release(now))
			if (!this.settings().loop) {
				this.position = duration
				this.running = false
				this.ended = true
				return output
			}
			this.position = this.seconds(this.bar(this.first).beat) + (this.position - duration)
			this.cursor = 0
			this.cursors.clear()
			this.requests.clear()
			this.rejoining.clear()
			this.lastActivity = this.beat(this.position)
			for (const groove of this.grooves.values()) {
				groove.from = this.bar(this.first).beat
				groove.through = groove.from - 1e-7
				groove.stop = undefined
			}
		}
		const position = this.beat(this.position)
		const horizon = this.beat(
			Math.min(duration, this.position + (this.settings().lookahead ?? 0))
		)
		const assigned = new Set(this.settings().players.flatMap((p) => p.channels))
		// Channel setup follows the shared arrangement. Assigned note attacks belong exclusively to gestures.
		while (
			this.cursor < this.song.events.length &&
			this.song.events[this.cursor].at <= this.seconds(horizon)
		) {
			const event = this.song.events[this.cursor++]
			if (event.voice) {
				if (
					event.command.type === NOTE_ON &&
					this.settings().assist &&
					!assigned.has(event.command.channel) &&
					event.at >= this.position - 0.25
				) {
					const onset = { beat: this.beat(event.at), notes: [event] }
					const notes = this.sound(
						onset,
						onset.beat,
						now,
						position,
						`backing:${event.voice}`
					)
					notes.forEach((c) => (c.velocity = Math.max(1, Math.round(c.velocity * 0.55))))
					output.push(...notes)
				}
				continue
			}
			if (event.command.type === PROGRAM_CHANGE) {
				if (this.programs.get(event.command.channel) === event.command.value) continue
				this.programs.set(event.command.channel, event.command.value)
			}
			output.push(this.command(event, Math.max(now, now + event.at - this.position)))
			this.touched.add(event.command.channel)
		}
		for (const [channel, request] of this.requests) {
			if (request.beat > horizon + 1e-7) continue
			output.push(
				...this.sound(
					request.onset,
					Math.max(position, request.beat),
					now,
					position,
					`note:${channel}:${request.onset.beat}`
				)
			)
			this.requests.delete(channel)
		}
		for (const [channel, groove] of this.grooves) {
			for (const bar of this.bars) {
				if (bar.end <= groove.through || bar.beat > horizon || bar.end <= groove.from)
					continue
				let source = bar
				// Percussion can safely repeat through gaps. Pitched grooves follow the score, including rests.
				if (!source.patterns.has(channel) && channel === 10) {
					source = this.fallback.get(bar) ?? bar
				}
				for (const onset of source.patterns.get(channel) ?? []) {
					const beat = bar.beat + onset.beat - source.beat
					if (
						beat >= bar.end ||
						beat >= this.beat(duration) ||
						beat < groove.from ||
						beat <= groove.through ||
						beat > horizon ||
						beat >= (groove.stop ?? Infinity)
					)
						continue
					if (this.seconds(position) - this.seconds(beat) > 0.25) continue
					// Groove durations are copied, not compressed by the distance from their source bar.
					output.push(
						...this.sound(
							onset,
							beat,
							now,
							position,
							`groove:${channel}:${beat}`,
							groove.accent === Math.floor(beat),
							false
						)
					)
				}
			}
			groove.through = Math.max(groove.through, horizon)
			if (groove.stop !== undefined && position >= groove.stop) this.grooves.delete(channel)
		}
		for (const [id, voice] of this.voices) {
			if (voice.end > horizon || voice.releaseSent) {
				if (voice.end <= position) this.voices.delete(id)
				continue
			}
			const at = Math.max(
				voice.command.audioTime ?? now,
				now + this.seconds(voice.end) - this.position
			)
			output.push(
				Object.assign(new AudioCommand(), voice.command, {
					type: NOTE_OFF,
					velocity: 0,
					startAt: Math.min(now, at),
					time: Math.min(now, at),
					audioTime: at
				})
			)
			voice.releaseSent = true
			if (voice.end <= position) this.voices.delete(id)
		}
		const pause = this.settings().pauseBeats ?? 0
		if (
			pause > 0 &&
			!this.grooves.size &&
			!this.requests.size &&
			!this.voices.size &&
			position - this.lastActivity >= pause
		) {
			output.push(...this.release(now))
			this.running = false
			this.paused = true
		}
		const priority = (c: IAudioCommand) =>
			c.type === NOTE_ON ? 2 : c.type === NOTE_OFF ? 1 : 0
		return output.sort((a, b) => a.audioTime! - b.audioTime! || priority(a) - priority(b))
	}
}