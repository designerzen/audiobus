import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PITCH_BEND, PROGRAM_CHANGE } from "../commands/commands"
import type { IAudioCommand } from "../commands/audio-command-interface"
import type { MidiSong, SongEvent } from "./midi-song"
import type { EnsembleSettings } from "./ensemble-session"

export type EnsemblePartRole = "auto" | "notes" | "groove"
export interface EnsembleGrooveRegion {
	fromBar: number
	toBar?: number
	kind: "loop" | "break" | "fill"
}
export interface EnsembleDelayDistribution {
	count: number
	p50: number
	p95: number
	max: number
}
export interface EnsembleTelemetry {
	acceptedPresses: number
	earlyQueued: number
	immediateLate: number
	recoveries: number
	playedOnsets: number
	skippedOnsets: number
	technicalDelayMs: EnsembleDelayDistribution
	musicalWaitBeats: EnsembleDelayDistribution
}
export interface EnsemblePartFeedback {
	phase: "ready" | "queued" | "sounding" | "rest" | "looping" | "stopping" | "complete"
	message: string
	/** Monotonic gesture serial lets the UI confirm acceptance without triggering audio. */
	accepted: number
	beat: number
	beatsUntil: number
	bar: number
	/** Continuous 0..1 visuo-motor approach trajectory over the 4 beats before an entry. */
	approach: number
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
	velocity?: number
}
interface Voice {
	command: IAudioCommand
	start: number
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
	private companions = new Map<number, number[]>()
	private humanChannels = new Set<number>()
	private cursor = 0
	private position = 0
	private first = 0
	private speed = 1
	private tapHistory = new Map<number, { onsetBeat: number; now: number }>()
	private playerRates = new Map<number, { rate: number; now: number; weight: number }>()
	private lagHistory = new Map<number, { lag: number; count: number }>()
	private acceptedPresses = 0
	private earlyQueued = 0
	private immediateLate = 0
	private recoveries = 0
	private playedOnsets = 0
	private skippedOnsets = 0
	private technicalDelaysMs: number[] = []
	private musicalWaitsBeats: number[] = []
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
	private distribution(samples: number[]): EnsembleDelayDistribution {
		if (!samples.length) return { count: 0, p50: 0, p95: 0, max: 0 }
		const sorted = [...samples].sort((a, b) => a - b)
		const pick = (q: number) =>
			sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * q))]
		return {
			count: sorted.length,
			p50: pick(0.5),
			p95: pick(0.95),
			max: sorted[sorted.length - 1]
		}
	}
	telemetry(): EnsembleTelemetry {
		return {
			acceptedPresses: this.acceptedPresses,
			earlyQueued: this.earlyQueued,
			immediateLate: this.immediateLate,
			recoveries: this.recoveries,
			playedOnsets: this.playedOnsets,
			skippedOnsets: this.skippedOnsets,
			technicalDelayMs: this.distribution(this.technicalDelaysMs),
			musicalWaitBeats: this.distribution(this.musicalWaitsBeats)
		}
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
			speed: this.speed,
			lastNow: this.lastNow
		}
	}
	parts() {
		const live = [
			...new Set([
				...[...this.grooves]
					.filter(([, g]) => this.song && g.from <= this.beat(this.position))
					.map(([channel]) => channel),
				...[...this.voices]
					.filter(
						([key, v]) =>
							!key.startsWith("backing:") &&
							(v.command.audioTime ?? 0) <= (this.lastNow ?? 0)
					)
					.map(([, v]) => v.command.channel)
			])
		]
		const assisted = [
			...new Set(
				[...this.voices]
					.filter(
						([key, v]) =>
							key.startsWith("backing:") &&
							(v.command.audioTime ?? 0) <= (this.lastNow ?? 0) &&
							!live.includes(v.command.channel)
					)
					.map(([, v]) => v.command.channel)
			)
		]
		const beat = this.song ? this.beat(this.position) : 0
		const end = this.song ? this.bar(beat).end : 0
		const upcoming = (this.song?.channels ?? []).filter((channel) =>
			this.onsets.get(channel)?.some((onset) => onset.beat >= beat && onset.beat < end)
		)
		return { live, upcoming, assisted }
	}
	partFeedback(channel: number): EnsemblePartFeedback {
		const beat = this.song ? this.beat(this.position) : 0
		const groove = this.grooves.get(channel)
		const request = this.requests.get(channel)
		const voice = [...this.voices].find(
			([key, v]) =>
				!key.startsWith("backing:") && v.command.channel === channel && v.end > beat
		)?.[1]
		const compVoice = [...this.voices].find(
			([key, v]) => key.startsWith("comp:") && v.command.channel === channel && v.end > beat
		)?.[1]
		const backingVoice = [...this.voices].find(
			([key, v]) =>
				key.startsWith("backing:") && v.command.channel === channel && v.end > beat
		)?.[1]
		const next = this.onsets.get(channel)?.[this.cursors.get(channel) ?? 0]
		const queuedVoice = voice && (voice.command.audioTime ?? 0) > (this.lastNow ?? 0)
		const target =
			groove?.stop ??
			groove?.from ??
			request?.beat ??
			(queuedVoice
				? this.beat(
						this.position +
							(voice.command.audioTime! - (this.lastNow ?? 0)) * this.speed
					)
				: next?.beat) ??
			beat
		const beatsUntil = Math.max(0, target - beat)
		const bar = this.song ? this.bars.indexOf(this.bar(target)) + 1 : 0
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
					? `Accepted · queued for bar ${bar} · loop starts in ${Math.ceil(beatsUntil)} beats`
					: phase === "stopping"
						? `Stopping at bar ${bar} · in ${Math.ceil(beatsUntil)} beats`
						: "Looping · tap to accent"
		} else if (this.role(channel) === "groove") {
			message = "Tap to start a groove"
		} else if (compVoice && beatsUntil > 0) {
			phase = "sounding"
			message = `Comping · next entry in ${Math.ceil(beatsUntil)} beats`
		} else if (request || (voice && (voice.command.audioTime ?? 0) > (this.lastNow ?? 0))) {
			phase = "queued"
			message = "Accepted · note queued"
			if (beatsUntil > 0) message += ` · in ${Math.ceil(beatsUntil)} beats`
		} else if (voice) {
			phase = "sounding"
			message =
				compVoice && !next ? "Comping · part complete" : "Playing · tap for the next note"
		} else if (!next) {
			phase = "complete"
			message = "Part complete"
		} else if (beatsUntil > 1) {
			phase = "rest"
			message = `Rest · next entry in ${Math.ceil(beatsUntil)} beats`
		} else if (backingVoice) {
			message = "Assist backing · tap for the next note"
		}
		return {
			phase,
			message,
			accepted: this.accepted.get(channel) ?? 0,
			beat,
			beatsUntil,
			bar,
			approach:
				phase === "sounding" || phase === "looping"
					? 1
					: phase === "complete"
						? 0
						: Math.max(0, Math.min(1, 1 - beatsUntil / 4))
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
		this.buildCompanions()
		this.first = Math.min(...[...this.onsets.values()].map((groups) => groups[0].beat))
		if (!Number.isFinite(this.first)) this.first = 0
	}
	companionChannels(channel: number): number[] {
		return this.companions.get(channel) ?? []
	}
	/** Identify unison or octave-doubled companion parts (e.g. Flute + Piccolo, Trumpet + Brass). */
	private buildCompanions(): void {
		this.companions.clear()
		const pitched = [...this.onsets.entries()].filter(([ch]) => ch !== 10)
		for (const [channelA, groupsA] of pitched) {
			if (!groupsA.length) continue
			const matches: number[] = []
			for (const [channelB, groupsB] of pitched) {
				if (channelA === channelB || !groupsB.length) continue
				let coincident = 0
				let harmonic = 0
				let cursorB = 0
				for (const onsetB of groupsB) {
					const timeB = this.seconds(onsetB.beat)
					while (
						cursorB + 1 < groupsA.length &&
						Math.abs(this.seconds(groupsA[cursorB + 1].beat) - timeB) <=
							Math.abs(this.seconds(groupsA[cursorB].beat) - timeB)
					) {
						cursorB++
					}
					const nearestA = groupsA[cursorB]
					if (Math.abs(this.seconds(nearestA.beat) - timeB) <= 0.035) {
						coincident++
						const pcsA = new Set(nearestA.notes.map((n) => n.command.number % 12))
						if (onsetB.notes.some((n) => pcsA.has(n.command.number % 12))) {
							harmonic++
						}
					}
				}
				if (
					coincident / groupsB.length >= 0.5 &&
					harmonic / Math.max(1, coincident) >= 0.6
				) {
					matches.push(channelB)
				}
			}
			if (matches.length) this.companions.set(channelA, matches)
		}
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
			const maxBeatFraction = this.chordWindowMs <= 20 ? 1 / 32 : 1 / 8
			const window = last
				? Math.min(
						this.chordWindowMs / 1000,
						this.seconds(last.beat + maxBeatFraction) - this.seconds(last.beat)
					)
				: 0
			const eventEnd = this.seconds(this.ends.get(event.voice!) ?? beat)
			const staggeredChord =
				last &&
				channel !== 10 &&
				event.at - this.seconds(last.beat) <= window + 1e-7 &&
				!last.notes.some((n) => n.command.number === event.command.number) &&
				eventEnd - event.at > window * 2 &&
				last.notes.every((n) => {
					const noteEnd = this.seconds(this.ends.get(n.voice!) ?? last.beat)
					return (
						noteEnd - n.at > window * 2 &&
						Math.min(noteEnd, eventEnd) - event.at > window * 2
					)
				})
			if (last && (Math.abs(last.beat - beat) < 1e-7 || staggeredChord))
				last.notes.push(event)
			else groups.push({ beat, notes: [event] })
			this.onsets.set(channel, groups)
		}
	}
	private regionForBar(index: number, kind: "loop" | "break" | "fill") {
		const barNumber = index + 1
		return (this.settings().grooveRegions ?? []).find(
			(r) => r.kind === kind && barNumber >= r.fromBar && barNumber <= (r.toBar ?? r.fromBar)
		)
	}
	/** Repeat established 1/2/4-bar percussion cycles through gaps, rather than latching a fill. */
	private buildFallbacks(): void {
		this.fallback.clear()
		if (!this.song) return
		const signature = (bar: Bar) =>
			JSON.stringify(
				(bar.patterns.get(10) ?? []).map((o) => [
					Math.round((o.beat - bar.beat) * 96),
					o.notes.map((n) => n.command.number).sort((a, b) => a - b)
				])
			)
		const counts = new Map<string, number>()
		this.bars.forEach((bar, index) => {
			if (bar.patterns.has(10) && !this.regionForBar(index, "fill")) {
				const sig = signature(bar)
				counts.set(sig, (counts.get(sig) ?? 0) + 1)
			}
		})
		let section = 0
		let stable: { from: number; length: number } | undefined
		let latest: Bar | undefined
		this.bars.forEach((bar, index) => {
			const marker = this.song!.midi.header.meta.some(
				(m) =>
					(m.type === "marker" || m.type === "cuePoint") &&
					m.ticks / this.song!.midi.header.ppq > (this.bars[index - 1]?.beat ?? -1) &&
					m.ticks / this.song!.midi.header.ppq <= bar.beat
			)
			const isBreak = Boolean(this.regionForBar(index, "break"))
			if (marker || isBreak) {
				section = index
				stable = undefined
				latest = undefined
			}
			if (isBreak) return
			const authoredLoop = this.regionForBar(index, "loop")
			if (authoredLoop) {
				const from = Math.max(0, authoredLoop.fromBar - 1)
				const to = Math.min(
					this.bars.length - 1,
					(authoredLoop.toBar ?? authoredLoop.fromBar) - 1
				)
				if (this.bars.slice(from, to + 1).some((b) => b.patterns.has(10))) {
					stable = { from, length: Math.max(1, to - from + 1) }
				}
			}
			if (!bar.patterns.has(10)) {
				const source = stable
					? this.bars[stable.from + ((index - stable.from) % stable.length)]
					: latest
				if (source && source.patterns.has(10)) this.fallback.set(bar, source)
				return
			}
			if (!this.regionForBar(index, "fill")) {
				if (
					!latest ||
					(counts.get(signature(bar)) ?? 0) >= (counts.get(signature(latest)) ?? 0)
				) {
					latest = bar
				}
			}
			for (const length of [1, 2, 4]) {
				const from = index - length + 1
				if (from - length < section) continue
				const cycle = this.bars.slice(from, index + 1)
				if (
					cycle.every(
						(b, offset) =>
							b.patterns.has(10) && !this.regionForBar(from + offset, "fill")
					) &&
					cycle.every((b, offset) => {
						const previous = this.bars[from - length + offset]
						return (
							previous.patterns.has(10) &&
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
	/** Prefer a recent authored section or phrase-after-rest entry, otherwise the current bar. Never rewind a cursor. */
	private recoveryIndex(channel: number, index: number, beat: number): number {
		const groups = this.onsets.get(channel) ?? []
		const marker = [...this.song!.midi.header.meta]
			.filter(
				(m) =>
					(m.type === "marker" || m.type === "cuePoint") &&
					m.ticks / this.song!.midi.header.ppq <= beat
			)
			.sort((a, b) => b.ticks - a.ticks)[0]
		const threshold = this.settings().recoveryBars ?? 2
		const currentBarIndex = this.bars.indexOf(this.bar(beat))
		let landmark = this.bar(beat).beat
		if (
			marker &&
			currentBarIndex -
				this.bars.indexOf(this.bar(marker.ticks / this.song!.midi.header.ppq)) <
				threshold
		) {
			landmark = marker.ticks / this.song!.midi.header.ppq
		} else {
			for (let i = groups.length - 1; i > Math.max(0, index); i--) {
				const onset = groups[i]
				if (onset.beat > beat + 1e-7) continue
				if (currentBarIndex - this.bars.indexOf(this.bar(onset.beat)) >= threshold) break
				const prev = groups[i - 1]
				const prevEnd = Math.max(
					prev.beat,
					...prev.notes.map((n) => this.ends.get(n.voice!) ?? prev.beat)
				)
				if (onset.beat - prevEnd >= 4 - 1e-7) {
					landmark = onset.beat
					break
				}
			}
		}
		return groups.findIndex((g, i) => i >= index && g.beat >= landmark - 1e-7)
	}
	rejoinPart(channel: number): void {
		if (!this.song || this.role(channel) !== "notes") return
		const groups = this.onsets.get(channel) ?? []
		const current = this.cursors.get(channel) ?? 0
		const index = this.recoveryIndex(channel, current, this.beat(this.position))
		// This changes what the next gesture requests; it never sounds skipped material.
		if (!this.requests.has(channel)) {
			const target = index < 0 ? groups.length : index
			if (target > current) {
				this.recoveries++
				this.skippedOnsets += target - current
			}
			this.cursors.set(channel, target)
		}
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
		this.humanChannels.clear()
		this.tapHistory.clear()
		this.playerRates.clear()
		this.lagHistory.clear()
		this.acceptedPresses =
			this.earlyQueued =
			this.immediateLate =
			this.recoveries =
			this.playedOnsets =
			this.skippedOnsets =
				0
		this.technicalDelaysMs = []
		this.musicalWaitsBeats = []
		this.speed = 1
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
		if (this.song) this.buildFallbacks()
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
	/** Synthesize an in-harmony, register-matched accompaniment onset during a long rest or after completion. */
	private compOnset(channel: number, beat: number, untilBeat = Infinity): Onset | undefined {
		const groups = this.onsets.get(channel) ?? []
		const template = groups[0]?.notes[0]
		if (!template) return undefined
		const bar = this.bar(beat)
		if (channel === 10) {
			const drumSource = bar.patterns.has(10) ? bar : (this.fallback.get(bar) ?? bar)
			const pattern = drumSource.patterns.get(10) ?? groups
			const nearest =
				pattern.reduce((best, o) =>
					Math.abs(bar.beat + (o.beat - drumSource.beat) - beat) <
					Math.abs(bar.beat + (best.beat - drumSource.beat) - beat)
						? o
						: best
				) ?? groups[0]
			return { beat, notes: nearest.notes }
		}
		const allPitches = groups
			.flatMap((g) => g.notes.map((n) => n.command.number))
			.sort((a, b) => a - b)
		const registerPitch = allPitches[Math.floor(allPitches.length / 2)] ?? 60
		const typicalPolyphony = Math.max(
			1,
			Math.min(
				4,
				Math.round(
					groups.slice(0, 16).reduce((sum, g) => sum + g.notes.length, 0) /
						Math.max(1, Math.min(16, groups.length))
				)
			)
		)
		let activeNotes: SongEvent[] = []
		let bestDistance = Infinity
		for (const [ch, onsets] of bar.patterns) {
			if (ch === 10) continue
			for (const o of onsets) {
				const distance = Math.abs(o.beat - beat)
				if (distance < bestDistance) {
					bestDistance = distance
					activeNotes = o.notes
				}
			}
		}
		if (!activeNotes.length) {
			const nearestOwn = groups.reduce((best, o) =>
				Math.abs(o.beat - beat) < Math.abs(best.beat - beat) ? o : best
			)
			activeNotes = nearestOwn.notes
		}
		const durationBeats = Math.min(0.5, Math.max(0.15, untilBeat - beat - 0.05))
		const at = this.seconds(beat)
		const selected = [...new Set(activeNotes.map((n) => n.command.number % 12))]
			.slice(0, typicalPolyphony)
			.map((pc, index) => {
				let midiPitch = registerPitch - ((registerPitch - pc + 120) % 12)
				if (midiPitch - registerPitch > 6) midiPitch -= 12
				if (registerPitch - midiPitch > 6) midiPitch += 12
				midiPitch = Math.max(24, Math.min(96, midiPitch))
				const voice = `comp:${channel}:${this.serial}:${index}`
				this.ends.set(voice, beat + durationBeats)
				return {
					at,
					track: template.track,
					voice,
					command: Object.assign(new AudioCommand(), template.command, {
						type: NOTE_ON,
						channel,
						number: midiPitch,
						velocity: Math.max(
							24,
							Math.min(100, Math.round((template.command.velocity || 90) * 0.75))
						),
						startAt: at,
						time: at,
						audioTime: at
					})
				} satisfies SongEvent
			})
		return selected.length ? { beat, notes: selected } : undefined
	}
	press(player: number, now: number, velocity?: number): IAudioCommand[] {
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
		const immediateComp: IAudioCommand[] = []
		for (const channel of assigned.channels) {
			const tookOverFromAssist =
				Boolean(this.settings().assist) &&
				!this.humanChannels.has(channel) &&
				beat > this.first + 1e-7 &&
				!this.cursors.has(channel)
			this.humanChannels.add(channel)
			this.accepted.set(channel, ++this.serial)
			this.acceptedPresses++
			if (this.role(channel) === "groove") {
				const groove = this.grooves.get(channel)
				if (groove) {
					groove.accent = Math.ceil(beat - 1e-7)
					groove.stop = undefined
				} else {
					const bar = this.bar(beat)
					const legato = Boolean(this.settings().legatoGroove)
					const from =
						legato ||
						Math.abs(beat - bar.beat) < 1e-7 ||
						Math.abs(beat - this.first) < 1e-7
							? beat
							: bar.end
					this.grooves.set(channel, { from, through: from - 1e-7 })
					if (legato && beat > bar.beat + 1e-7) {
						const source =
							!bar.patterns.has(channel) && channel === 10
								? (this.fallback.get(bar) ?? bar)
								: bar
						const hasImmediate = (source.patterns.get(channel) ?? []).some((o) => {
							const target = bar.beat + o.beat - source.beat
							return target >= beat - 1e-7 && target <= beat + 0.25
						})
						if (!hasImmediate) {
							const comp = this.compOnset(channel, beat, bar.end)
							if (comp) {
								immediateComp.push(
									...this.sound(
										comp,
										beat,
										now,
										beat,
										`comp:${channel}:${beat}`,
										false,
										false,
										velocity
									)
								)
							}
						}
					}
				}
				continue
			}
			const existingRequest = this.requests.get(channel)
			if (existingRequest) {
				// During a multi-beat rest, keep the real entrance queued while voicing an immediate in-harmony comp note.
				if (existingRequest.beat - beat > 2 + 1e-7) {
					const comp = this.compOnset(channel, beat, existingRequest.beat)
					if (comp) {
						this.playedOnsets++
						immediateComp.push(
							...this.sound(
								comp,
								beat,
								now,
								beat,
								`comp:${channel}:${beat}`,
								false,
								false,
								velocity
							)
						)
					}
				}
				continue // at most one early score request, never a queued phrase
			}
			const groups = this.onsets.get(channel) ?? []
			let index = this.cursors.get(channel) ?? 0
			if (tookOverFromAssist && index === 0) {
				const liveIndex = groups.findIndex((g) => g.beat >= beat - 0.5)
				index = liveIndex < 0 ? groups.length : liveIndex
			}
			let onset = groups[index]
			let recovered = false
			this.rejoining.delete(channel)
			if (onset) {
				const barLag =
					this.bars.indexOf(this.bar(beat)) - this.bars.indexOf(this.bar(onset.beat))
				const beatLag = beat - onset.beat
				const previousLag = this.lagHistory.get(channel)
				const sustainedLag =
					beatLag >= 4 - 1e-7 &&
					previousLag !== undefined &&
					beatLag >= previousLag.lag - 0.25
						? previousLag.count + 1
						: beatLag >= 4 - 1e-7
							? 1
							: 0
				this.lagHistory.set(channel, { lag: Math.max(0, beatLag), count: sustainedLag })
				if (barLag >= (this.settings().recoveryBars ?? 2) || sustainedLag >= 2) {
					const nextIndex =
						sustainedLag >= 2 && barLag < (this.settings().recoveryBars ?? 2)
							? groups.findIndex((g, i) => i >= index && g.beat >= beat - 0.5)
							: this.recoveryIndex(channel, index, beat)
					const targetIndex = nextIndex < 0 ? groups.length : nextIndex
					if (targetIndex > index) {
						this.recoveries++
						this.skippedOnsets += targetIndex - index
						recovered = true
						this.lagHistory.delete(channel)
					}
					index = nextIndex
					onset = groups[index]
					this.rejoining.add(channel)
				}
			}
			if (!onset) {
				this.cursors.set(channel, groups.length)
				const comp = this.compOnset(channel, beat)
				if (comp) {
					this.playedOnsets++
					immediateComp.push(
						...this.sound(
							comp,
							beat,
							now,
							beat,
							`comp:${channel}:${beat}`,
							false,
							false,
							velocity
						)
					)
				}
				continue
			}
			const maxAnticipation = this.settings().anticipationBeats ?? 8
			if (onset.beat - beat > maxAnticipation + 1e-7) {
				// Tapping far ahead of a distant entrance voices an immediate comping note without locking a distant future trigger.
				const comp = this.compOnset(channel, beat, onset.beat)
				if (comp) {
					this.playedOnsets++
					immediateComp.push(
						...this.sound(
							comp,
							beat,
							now,
							beat,
							`comp:${channel}:${beat}`,
							false,
							false,
							velocity
						)
					)
				}
				continue
			}
			const previousTap = this.tapHistory.get(player)
			if (!recovered && previousTap) {
				const deltaBeats = onset.beat - previousTap.onsetBeat
				const deltaScore = this.seconds(onset.beat) - this.seconds(previousTap.onsetBeat)
				const deltaWall = now - previousTap.now
				if (deltaBeats > 1e-7 && deltaBeats <= 4 && deltaWall >= 0.08 && deltaWall <= 4) {
					const rawRate = Math.max(0.75, Math.min(1.25, deltaScore / deltaWall))
					const onsetBar = this.bar(onset.beat)
					const onDownbeat = Math.abs(onset.beat - onsetBar.beat) < 0.05
					const onBeatGrid = Math.abs(onset.beat - Math.round(onset.beat)) < 0.05
					const weight = onDownbeat
						? 1
						: onBeatGrid || onset.notes.length > 1
							? 0.8
							: 0.35
					const prevRate = this.playerRates.get(player)?.rate ?? rawRate
					const blended =
						weight >= 0.8 ? rawRate : prevRate + weight * (rawRate - prevRate)
					this.playerRates.set(player, { rate: blended, now, weight })
				}
			}
			this.tapHistory.set(player, { onsetBeat: onset.beat, now })
			this.cursors.set(channel, index + 1)
			// Early notes retain score timing. Late gestures sound immediately; they never unlock later notes.
			const requestBeat = Math.max(beat, onset.beat)
			if (onset.beat > beat + 1e-7) {
				this.earlyQueued++
				this.musicalWaitsBeats.push(onset.beat - beat)
			} else {
				this.immediateLate++
			}
			this.requests.set(channel, { onset, beat: requestBeat, velocity })
			if (this.settings().pairCompanionParts) {
				for (const companion of this.companions.get(channel) ?? []) {
					if (
						this.humanChannels.has(companion) ||
						assigned.channels.includes(companion) ||
						this.requests.has(companion)
					)
						continue
					const compGroups = this.onsets.get(companion) ?? []
					const compCursor = this.cursors.get(companion) ?? 0
					const matchIndex = compGroups.findIndex(
						(g, i) =>
							i >= compCursor &&
							Math.abs(this.seconds(g.beat) - this.seconds(onset.beat)) <= 0.04
					)
					if (matchIndex >= 0) {
						this.cursors.set(companion, matchIndex + 1)
						this.requests.set(companion, {
							onset: compGroups[matchIndex],
							beat: Math.max(beat, compGroups[matchIndex].beat),
							velocity
						})
					}
				}
			}
		}
		return [...output, ...immediateComp, ...this.advance(now)]
	}
	releasePress(player: number, now: number): IAudioCommand[] {
		const assigned = this.settings().players[player]
		this.held.delete(assigned?.source || `player:${player}`)
		if (this.song && this.running && assigned && this.settings().holdArticulation) {
			const position = this.beat(this.position)
			for (const [key, voice] of this.voices) {
				if (
					!key.startsWith("note:") ||
					voice.releaseSent ||
					!assigned.channels.includes(voice.command.channel)
				)
					continue
				voice.end = Math.min(voice.end, Math.max(position, voice.start + 0.25))
			}
		}
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
		correctLate = true,
		inputVelocity?: number
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
		const influence = Math.max(0, Math.min(1, this.settings().velocityInfluence ?? 0))
		const maxScoreVelocity = Math.max(1, ...onset.notes.map((n) => n.command.velocity || 100))
		for (const event of onset.notes) {
			const originalBeat = this.beat(event.at)
			const noteBeat = beat + originalBeat - onset.beat
			const at = Math.max(
				now,
				now + (this.seconds(noteBeat) - this.seconds(position)) / this.speed
			)
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
			if (influence > 0 && inputVelocity !== undefined && inputVelocity > 0) {
				const ratio = command.velocity / maxScoreVelocity
				const shaped = Math.round(inputVelocity * ratio)
				command.velocity = Math.max(
					1,
					Math.min(
						127,
						Math.round(command.velocity * (1 - influence) + shaped * influence)
					)
				)
			}
			if (accent) command.velocity = Math.min(127, Math.round(command.velocity * 1.2))
			const end =
				noteBeat + Math.max(0.02, (this.ends.get(event.voice!)! - originalBeat) * scale)
			this.voices.set(`${id}:${event.voice}`, { command, start: noteBeat, end })
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
		const rawElapsed = now - (this.lastNow ?? now)
		const elapsed = rawElapsed >= 0 && rawElapsed <= 1 ? rawElapsed : 0
		this.lastNow = now
		const adapt = Math.max(0, Math.min(1, this.settings().tempoAdaptation ?? 0))
		if (adapt > 0) {
			const lead = this.settings().leadPlayer
			const active = [...this.playerRates]
				.filter(([, entry]) => now - entry.now <= 3)
				.sort((a, b) => a[1].rate - b[1].rate)
			const leadEntry = lead !== undefined ? this.playerRates.get(lead) : undefined
			let groupRate = 1
			if (leadEntry && now - leadEntry.now <= 3) {
				groupRate = leadEntry.rate
			} else if (active.length) {
				const mid = Math.floor(active.length / 2)
				groupRate =
					active.length % 2
						? active[mid][1].rate
						: (active[mid - 1][1].rate + active[mid][1].rate) / 2
			}
			const targetSpeed = Math.max(0.75, Math.min(1.25, 1 + adapt * (groupRate - 1)))
			this.speed += (targetSpeed - this.speed) * (1 - Math.exp(-Math.max(0.02, elapsed) * 2))
		} else {
			this.speed = 1
		}
		this.position += elapsed * this.speed
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
			this.tapHistory.clear()
			this.lastActivity = this.beat(this.position)
			for (const groove of this.grooves.values()) {
				groove.from = this.bar(this.first).beat
				groove.through = groove.from - 1e-7
				groove.stop = undefined
			}
		}
		const position = this.beat(this.position)
		const horizon = this.beat(
			Math.min(duration, this.position + (this.settings().lookahead ?? 0) * this.speed)
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
					!this.humanChannels.has(event.command.channel) &&
					!this.requests.has(event.command.channel) &&
					!this.grooves.has(event.command.channel) &&
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
			output.push(
				this.command(event, Math.max(now, now + (event.at - this.position) / this.speed))
			)
			this.touched.add(event.command.channel)
		}
		for (const [channel, request] of this.requests) {
			if (request.beat > horizon + 1e-7) continue
			const scheduled = this.sound(
				request.onset,
				Math.max(position, request.beat),
				now,
				position,
				`note:${channel}:${request.onset.beat}`,
				false,
				true,
				request.velocity
			)
			if (scheduled.length) {
				this.playedOnsets++
				if (request.beat <= position + 1e-7) {
					const firstAttack = scheduled.find((c) => c.type === NOTE_ON)
					if (firstAttack) {
						this.technicalDelaysMs.push(
							Math.max(0, ((firstAttack.audioTime ?? now) - now) * 1000)
						)
					}
				}
			}
			output.push(...scheduled)
			this.requests.delete(channel)
		}
		for (const [channel, groove] of this.grooves) {
			for (let barIndex = 0; barIndex < this.bars.length; barIndex++) {
				const bar = this.bars[barIndex]
				if (bar.end <= groove.through || bar.beat > horizon || bar.end <= groove.from)
					continue
				if (this.regionForBar(barIndex, "break")) continue
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
				now + (this.seconds(voice.end) - this.position) / this.speed
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
		const activePlayerVoices = [...this.voices.keys()].some((k) => !k.startsWith("backing:"))
		if (
			pause > 0 &&
			!this.grooves.size &&
			!this.requests.size &&
			!activePlayerVoices &&
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