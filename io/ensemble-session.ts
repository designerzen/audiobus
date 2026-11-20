import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PITCH_BEND, PROGRAM_CHANGE } from "../commands/commands"
import type { IAudioCommand } from "../commands/audio-command-interface"
import type { MidiSong, SongEvent } from "./midi-song"

export type EnsembleMode = "assisted" | "together" | "conductor"
export interface EnsemblePlayer {
	source: string
	channels: number[]
}
export interface EnsembleSettings {
	mode: EnsembleMode
	players: EnsemblePlayer[]
	activityBeats: number
	assist: boolean
	loop: boolean
	stepBeats: number
	quorum: number
	waitSeconds: number
	/** Beats of silence from every player before the song pauses; 0 never pauses. */
	pauseBeats?: number
	/**
	 * Seconds of song sent ahead of the clock, each command naming its exact audioTime.
	 * Outputs that schedule then play in time however unevenly the clock ticks.
	 */
	lookahead?: number
}

/** Clock gaps longer than this are a stopped transport or suspended tab, not elapsed music. */
const MAX_GAP = 1
/** Attacks later than this after a stall are skipped rather than played as a burst. */
const LATE_LIMIT = 0.25
/** A press this soon after a note's onset still plays that note. */
const CATCH_WINDOW = 0.15

/** One authoritative local performance, independent of DOM, devices and room transport. */
export class EnsembleSession {
	private song?: MidiSong
	private ends = new Map<string, number>()
	private start = 0
	private cursor = 0
	private position = 0
	private lastNow?: number
	private started = false
	private running = false
	private paused = false
	private ended = false
	private held = new Set<number>()
	private activeUntil = new Map<number, number>()
	private sounding = new Map<string, IAudioCommand>()
	private programs = new Map<number, number>()
	private cleanup: IAudioCommand[] = []
	private votes = new Set<number>()
	private limit = 0
	private waitingSince?: number
	private lastPress = new Map<number, number>()
	private rates = new Map<number, number>()
	private speed = 1
	private stepBeat = 0
	private touchedChannels = new Set<number>()
	constructor(public settings: EnsembleSettings) {}

	get state() {
		return {
			running: this.running,
			paused: this.paused,
			ended: this.ended,
			position: this.position,
			bar: this.song ? this.barAt(this.position) + 1 : 0,
			speed: this.speed,
			lastNow: this.lastNow
		}
	}
	/** Channels currently playing for a player, and channels with notes in the next bar. */
	parts(): { live: number[]; upcoming: number[] } {
		if (!this.song) {
			return { live: [], upcoming: [] }
		}
		const live = this.song.channels.filter((channel) =>
			this.channelLive(channel, this.position)
		)
		const horizon = this.secondsAtBeat(this.beatAt(this.position) + this.beatsPerBar())
		const upcoming = new Set<number>()
		for (let i = this.cursor; i < this.song.events.length; i++) {
			const event = this.song.events[i]
			if (event.at > horizon) {
				break
			}
			if (event.command.type === NOTE_ON) {
				upcoming.add(event.command.channel)
			}
		}
		return { live, upcoming: [...upcoming].sort((a, b) => a - b) }
	}
	setSong(song?: MidiSong): void {
		this.reset()
		this.song = song
		this.ends.clear()
		this.start = 0
		if (!song) {
			return
		}
		let first = Infinity
		for (const event of song.events) {
			if (event.command.type === NOTE_ON) {
				first = Math.min(first, event.at)
			} else if (event.command.type === NOTE_OFF && event.voice) {
				this.ends.set(event.voice, event.at)
			}
		}
		// Leading silence makes a first press feel broken; begin on the bar of the first note.
		this.start = Number.isFinite(first) ? this.barStart(first) : 0
	}
	configure(settings: EnsembleSettings): void {
		if (settings.mode !== this.settings.mode) {
			this.reset()
		} else {
			// Membership edits and re-learning an input must not rewind everybody else.
			const previous = this.settings.players
			const oldIndex = (player: EnsemblePlayer) =>
				previous.findIndex((p) => p.source && p.source === player.source)
			const remap = (values: Map<number, number>) => {
				const next = new Map<number, number>()
				settings.players.forEach((player, index) => {
					const value = values.get(oldIndex(player))
					if (value !== undefined) {
						next.set(index, value)
					}
				})
				return next
			}
			const remapSet = (values: Set<number>) =>
				new Set(
					settings.players.flatMap((player, index) =>
						values.has(oldIndex(player)) ? [index] : []
					)
				)
			this.activeUntil = remap(this.activeUntil)
			this.lastPress = remap(this.lastPress)
			this.rates = remap(this.rates)
			this.votes = remapSet(this.votes)
			this.held = remapSet(this.held)
		}
		this.settings = settings
	}
	private secondsAtBeat(beat: number): number {
		return this.song!.midi.header.ticksToSeconds(beat * this.song!.midi.header.ppq)
	}
	private beatAt(seconds: number): number {
		return this.song!.midi.header.secondsToTicks(seconds) / this.song!.midi.header.ppq
	}
	private signature(ticks: number) {
		const header = this.song!.midi.header
		const signature = [...header.timeSignatures].reverse().find((s) => s.ticks <= ticks)
		const [beats, unit] = signature?.timeSignature ?? [4, 4]
		return {
			ticks: signature?.ticks ?? 0,
			length: (header.ppq * 4 * beats) / unit
		}
	}
	private beatsPerBar(): number {
		const ticks = this.song!.midi.header.secondsToTicks(this.position)
		return this.signature(ticks).length / this.song!.midi.header.ppq
	}
	private barAt(seconds: number): number {
		return Math.floor(
			this.song!.midi.header.ticksToMeasures(this.song!.midi.header.secondsToTicks(seconds))
		)
	}
	private barStart(seconds: number): number {
		const header = this.song!.midi.header
		const ticks = header.secondsToTicks(seconds)
		const signature = this.signature(ticks)
		const bars = Math.floor((ticks - signature.ticks) / signature.length + 1e-6)
		return header.ticksToSeconds(signature.ticks + bars * signature.length)
	}
	private isLive(player: number, at: number): boolean {
		return this.held.has(player) || (this.activeUntil.get(player) ?? -Infinity) >= at
	}
	private channelLive(channel: number, at: number): boolean {
		return this.settings.players.some(
			(player, index) => player.channels.includes(channel) && this.isLive(index, at)
		)
	}
	private release(now: number): IAudioCommand[] {
		const output: IAudioCommand[] = [...this.sounding.values()].map((note) =>
			Object.assign(new AudioCommand(), note, {
				type: NOTE_OFF,
				velocity: 0,
				startAt: now,
				time: now,
				// A note sent ahead must not be released before it starts.
				audioTime: Math.max(now, note.audioTime ?? now)
			})
		)
		for (const channel of this.touchedChannels) {
			output.push(
				Object.assign(new AudioCommand(), {
					type: CONTROL_CHANGE,
					number: 64,
					value: 0,
					channel,
					startAt: now,
					time: now
				})
			)
			output.push(
				Object.assign(new AudioCommand(), {
					type: PITCH_BEND,
					value: 8192,
					channel,
					startAt: now,
					time: now
				})
			)
		}
		this.sounding.clear()
		this.touchedChannels.clear()
		return output
	}
	reset(): void {
		this.cleanup.push(...this.release(this.lastNow ?? 0))
		this.cursor = this.position = this.limit = this.stepBeat = 0
		this.lastNow = this.waitingSince = undefined
		this.started = this.running = this.paused = this.ended = false
		this.speed = 1
		this.votes.clear()
		this.held.clear()
		this.activeUntil.clear()
		this.lastPress.clear()
		this.rates.clear()
		this.programs.clear()
	}
	/** Move the playhead without sounding the skipped notes, restoring channel controls. */
	private seek(at: number, now: number): IAudioCommand[] {
		const song = this.song!
		const state = new Map<string, SongEvent>()
		let index = 0
		for (; index < song.events.length && song.events[index].at < at; index++) {
			const event = song.events[index]
			if (!event.voice) {
				state.set(
					`${event.command.channel}:${event.command.type}:${event.command.number}`,
					event
				)
			}
		}
		this.cursor = index
		this.position = at
		return [...state.values()].flatMap((event) => this.emit(event, now))
	}
	private activity(player: number): void {
		const until = this.secondsAtBeat(this.beatAt(this.position) + this.settings.activityBeats)
		this.activeUntil.set(player, Math.max(until, this.activeUntil.get(player) ?? -Infinity))
	}
	/** The clock time a song moment plays at, measured from the heard position. */
	private playAt(at: number, now: number, position = this.position): number {
		return now + (at - position) / this.speed
	}
	/** Sound a newly live part's notes that are already under way, so presses feel immediate. */
	private catchUp(channels: number[], now: number): IAudioCommand[] {
		const output: IAudioCommand[] = []
		const events = this.song!.events
		for (let i = this.cursor - 1; i >= 0; i--) {
			const event = events[i]
			if (event.at < this.position - 16) {
				break
			}
			if (
				event.command.type !== NOTE_ON ||
				!channels.includes(event.command.channel) ||
				this.sounding.has(event.voice!)
			) {
				continue
			}
			const end = this.ends.get(event.voice!) ?? event.at
			if (
				end > this.position + 0.05 ||
				(this.position - event.at <= CATCH_WINDOW && end > this.position)
			) {
				// Notes already sent ahead were skipped while the part was silent; keep their time.
				output.push(...this.emit(event, now, Math.max(now, this.playAt(event.at, now))))
			}
		}
		return output
	}

	/** Holding or tapping keeps a player's parts playing at the shared song position. */
	press(player: number, now: number): IAudioCommand[] {
		const output = this.advance(now)
		const assigned = this.settings.players[player]
		if (!this.song || this.ended || !assigned) {
			return output
		}
		if (!this.started) {
			output.push(...this.seek(this.start, now))
			this.started = true
			this.stepBeat = this.beatAt(this.start)
			this.limit = this.start
		}
		if (!this.running) {
			this.lastNow = now
		}
		this.running = true
		this.paused = false
		const silent = assigned.channels.filter(
			(channel) => !this.channelLive(channel, this.position)
		)
		this.held.add(player)
		this.activity(player)
		const last = this.lastPress.get(player)
		// One sample per player prevents rapid button chords from dominating group tempo.
		if (last === undefined || now - last >= 0.15) {
			if (last !== undefined && now - last <= 3) {
				const beatDuration =
					this.secondsAtBeat(this.beatAt(this.position) + 1) - this.position
				this.rates.set(player, Math.max(0.75, Math.min(1.25, beatDuration / (now - last))))
			}
			this.lastPress.set(player, now)
		}
		if (this.settings.mode === "together") {
			if (this.position >= this.limit) {
				this.votes.add(player)
				this.waitingSince ??= now
				if (
					this.votes.size >= Math.min(this.settings.quorum, this.settings.players.length)
				) {
					this.unlock()
				}
			}
		} else {
			output.push(...this.catchUp(silent, now))
		}
		// Include time-zero setup only after activity has been registered.
		return [...output, ...this.advance(now)]
	}
	/** Letting go keeps the part playing for its activity window, so taps and holds both work. */
	releasePress(player: number, now: number): IAudioCommand[] {
		const output = this.advance(now)
		if (this.held.delete(player) && this.running) {
			this.activity(player)
		}
		return output
	}
	private unlock(): void {
		this.stepBeat += this.settings.stepBeats
		this.limit = this.secondsAtBeat(this.stepBeat)
		this.votes.clear()
		this.waitingSince = undefined
	}
	private allowed(event: SongEvent): boolean {
		if (this.settings.mode === "together" || this.settings.assist) {
			return true
		}
		return this.channelLive(event.command.channel, event.at)
	}
	/** @param playAt clock time the event sounds; later than now when sent ahead */
	private emit(event: SongEvent, now: number, playAt = now): IAudioCommand[] {
		// Sent on this tick, played at playAt by outputs that schedule.
		const at = Math.min(now, playAt)
		const command = Object.assign(new AudioCommand(), event.command, {
			startAt: at,
			time: at,
			audioTime: playAt
		})
		if (command.type === NOTE_ON) {
			if (!this.allowed(event)) {
				return []
			}
			if (
				this.settings.assist &&
				this.settings.mode !== "together" &&
				!this.channelLive(command.channel, event.at)
			) {
				// Assistance supplies a quieter backing part; player activity brings it forward.
				command.velocity = Math.max(1, Math.round(command.velocity * 0.55))
			}
			this.sounding.set(event.voice!, command)
		} else if (command.type === NOTE_OFF) {
			if (!this.sounding.delete(event.voice!)) {
				return []
			}
		} else if (command.type === PROGRAM_CHANGE) {
			// Loops and seeks repeat setup; resending an unchanged program can reset a voice.
			if (this.programs.get(command.channel) === command.value) {
				return []
			}
			this.programs.set(command.channel, command.value)
		}
		this.touchedChannels.add(command.channel)
		return [command]
	}
	/** Pause after everyone stops, ready to resume from the bar where the music stopped. */
	private idle(now: number): IAudioCommand[] {
		const beats = this.settings.pauseBeats ?? 0
		if (this.settings.mode !== "assisted" || beats <= 0 || this.held.size) {
			return []
		}
		const lastActive = Math.max(-Infinity, ...this.activeUntil.values())
		if (!Number.isFinite(lastActive)) {
			return []
		}
		if (this.position < this.secondsAtBeat(this.beatAt(lastActive) + beats)) {
			return []
		}
		this.running = false
		this.paused = true
		this.activeUntil.clear()
		const output = this.release(now)
		output.push(
			...this.seek(
				Math.max(this.start, this.barStart(Math.min(lastActive, this.position))),
				now
			)
		)
		return output
	}
	advance(now: number): IAudioCommand[] {
		if (!Number.isFinite(now)) {
			return []
		}
		const output = this.cleanup
			.splice(0)
			.map((c) => Object.assign(c, { startAt: now, time: now }))
		if (!this.song || !this.running) {
			return output
		}
		let elapsed = now - (this.lastNow ?? now)
		// A stopped clock or suspended host resumes where it was instead of jumping ahead.
		if (elapsed < 0 || elapsed > MAX_GAP) {
			elapsed = 0
		}
		this.lastNow = now
		if (this.settings.mode === "conductor") {
			const rates = [...this.rates]
				.filter(([p]) => now - (this.lastPress.get(p) ?? -Infinity) <= 3)
				.map(([, rate]) => rate)
				.sort((a, b) => a - b)
			const middle = Math.floor(rates.length / 2)
			const target = rates.length
				? rates.length % 2
					? rates[middle]
					: (rates[middle - 1] + rates[middle]) / 2
				: 1
			this.speed += (target - this.speed) * (1 - Math.exp(-elapsed * 0.5))
		}
		if (this.settings.mode === "together" && this.position >= this.limit) {
			this.waitingSince ??= now
			if (this.settings.assist && now - this.waitingSince >= this.settings.waitSeconds) {
				this.unlock()
				elapsed = 0
			} else {
				return output
			}
		}
		let target = this.position + elapsed * this.speed
		if (this.settings.mode === "together") {
			target = Math.min(target, this.limit)
		}
		const duration = this.song.duration
		if (duration <= this.start) {
			return output
		}
		while (true) {
			// Events up to the horizon are sent now; the heard position trails at target.
			const horizon = Math.min(
				target + (this.settings.lookahead ?? 0) * this.speed,
				duration,
				this.settings.mode === "together" ? this.limit : Infinity
			)
			while (
				this.cursor < this.song.events.length &&
				this.song.events[this.cursor].at <= horizon &&
				!(
					this.settings.mode === "together" &&
					this.song.events[this.cursor].at >= this.limit
				)
			) {
				const event = this.song.events[this.cursor++]
				const late = Math.max(0, target - event.at) / this.speed
				// After a stall, skip stale attacks; their releases are skipped with them.
				if (event.command.type === NOTE_ON && late > LATE_LIMIT) {
					continue
				}
				output.push(...this.emit(event, now, this.playAt(event.at, now, target)))
			}
			if (target < duration) {
				break
			}
			output.push(...this.release(now - (target - duration) / this.speed))
			if (!this.settings.loop) {
				this.running = false
				this.ended = true
				target = duration
				break
			}
			const length = duration - this.start
			const overflow = target - duration
			output.push(...this.seek(this.start, now))
			target = this.start + overflow
			this.stepBeat = this.beatAt(this.start)
			this.limit = this.settings.mode === "together" ? this.start : this.limit
			for (const [player, until] of this.activeUntil) {
				this.activeUntil.set(player, until - length)
			}
			if (this.settings.mode === "together") {
				target = this.start
				break
			}
		}
		this.position = target
		if (this.settings.mode === "together" && target >= this.limit && this.running) {
			output.push(...this.release(now))
			this.waitingSince ??= now
		}
		if (this.running) {
			output.push(...this.idle(now))
		}
		return output.sort((a, b) => a.startAt - b.startAt)
	}
}