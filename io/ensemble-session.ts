import AudioCommand from "../commands/audio-command"
import { NOTE_ON, NOTE_OFF, CONTROL_CHANGE, PITCH_BEND } from "../commands/commands"
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
}

/** One authoritative local performance, independent of DOM, devices and room transport. */
export class EnsembleSession {
	private song?: MidiSong
	private cursor = 0
	private position = 0
	private lastNow?: number
	private running = false
	private ended = false
	private activeUntil = new Map<number, number>()
	private sounding = new Map<string, IAudioCommand>()
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
			ended: this.ended,
			position: this.position,
			speed: this.speed
		}
	}
	setSong(song?: MidiSong): void {
		this.reset()
		this.song = song
	}
	configure(settings: EnsembleSettings): void {
		if (settings.mode !== this.settings.mode) {
			this.reset()
		} else {
			// Membership edits and re-learning an input must not rewind everybody else.
			const previous = this.settings.players
			const remap = (values: Map<number, number>) => {
				const next = new Map<number, number>()
				settings.players.forEach((player, index) => {
					const oldIndex = previous.findIndex(
						(p) => p.source && p.source === player.source
					)
					const value = values.get(oldIndex)
					if (value !== undefined) {
						next.set(index, value)
					}
				})
				return next
			}
			this.activeUntil = remap(this.activeUntil)
			this.lastPress = remap(this.lastPress)
			this.rates = remap(this.rates)
			const votes = this.votes
			this.votes = new Set(
				settings.players.flatMap((player, index) => {
					const oldIndex = previous.findIndex(
						(p) => p.source && p.source === player.source
					)
					return votes.has(oldIndex) ? [index] : []
				})
			)
		}
		this.settings = settings
	}
	private secondsAtBeat(beat: number): number {
		return this.song!.midi.header.ticksToSeconds(beat * this.song!.midi.header.ppq)
	}
	private beatAt(seconds: number): number {
		return this.song!.midi.header.secondsToTicks(seconds) / this.song!.midi.header.ppq
	}
	private release(now: number): IAudioCommand[] {
		const output = [...this.sounding.values()].map((note) =>
			Object.assign(new AudioCommand(), note, {
				type: NOTE_OFF,
				velocity: 0,
				startAt: now,
				time: now
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
		this.running = this.ended = false
		this.speed = 1
		this.votes.clear()
		this.activeUntil.clear()
		this.lastPress.clear()
		this.rates.clear()
	}

	/** Presses are activity/advance requests. They never select pitches or private song cursors. */
	press(player: number, now: number): IAudioCommand[] {
		const output = this.advance(now)
		if (!this.song || this.ended || !this.settings.players[player]) {
			return output
		}
		this.lastNow ??= now
		this.running = true
		this.activeUntil.set(
			player,
			this.secondsAtBeat(this.beatAt(this.position) + this.settings.activityBeats)
		)
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
		if (this.settings.mode === "together" && this.position >= this.limit) {
			this.votes.add(player)
			this.waitingSince ??= now
			if (this.votes.size >= Math.min(this.settings.quorum, this.settings.players.length)) {
				this.unlock()
			}
		}
		// Include time-zero setup only after activity has been registered.
		return [...output, ...this.advance(now)]
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
		return this.settings.players.some(
			(player, index) =>
				player.channels.includes(event.command.channel) &&
				(this.activeUntil.get(index) ?? -1) >= event.at
		)
	}
	private emit(event: SongEvent, at: number): IAudioCommand[] {
		const command = Object.assign(new AudioCommand(), event.command, { startAt: at, time: at })
		if (command.type === NOTE_ON) {
			if (!this.allowed(event)) {
				return []
			}
			if (
				this.settings.assist &&
				this.settings.mode !== "together" &&
				!this.settings.players.some(
					(p, i) =>
						p.channels.includes(command.channel) &&
						(this.activeUntil.get(i) ?? -1) >= event.at
				)
			) {
				// Assistance supplies a quieter backing part; player activity brings it forward.
				command.velocity = Math.max(1, Math.round(command.velocity * 0.55))
			}
			this.sounding.set(event.voice!, command)
		} else if (command.type === NOTE_OFF) {
			if (!this.sounding.delete(event.voice!)) {
				return []
			}
		}
		this.touchedChannels.add(command.channel)
		return [command]
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
		let elapsed = Math.max(0, now - (this.lastNow ?? now))
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
		if (duration <= 0) {
			return output
		}
		// A suspended host rejoins the current passage rather than flooding outputs with missed notes.
		if (elapsed > 0.5) {
			output.push(...this.release(now))
			const wraps =
				this.settings.loop && this.settings.mode !== "together"
					? Math.floor(target / duration)
					: 0
			const bounded = wraps ? target % duration : Math.min(target, duration)
			if (wraps) {
				for (const [player, until] of this.activeUntil) {
					this.activeUntil.set(player, until - wraps * duration)
				}
			}
			this.cursor = this.song.events.findIndex((e) => e.at >= bounded)
			if (this.cursor < 0) {
				this.cursor = this.song.events.length
			}
			this.position = bounded
			target = bounded
			// Restore channel controls at the rejoin position before the next attack.
			const state = new Map<string, SongEvent>()
			for (const e of this.song.events) {
				if (e.at > bounded) {
					break
				}
				if (!e.voice) {
					state.set(`${e.command.channel}:${e.command.type}:${e.command.number}`, e)
				}
			}
			for (const event of state.values()) {
				output.push(...this.emit(event, now))
			}
		}
		while (true) {
			while (
				this.cursor < this.song.events.length &&
				this.song.events[this.cursor].at <= Math.min(target, duration) &&
				!(
					this.settings.mode === "together" &&
					target >= this.limit &&
					this.song.events[this.cursor].at >= this.limit
				)
			) {
				const event = this.song.events[this.cursor++]
				output.push(...this.emit(event, now - Math.max(0, target - event.at) / this.speed))
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
			target -= duration
			this.cursor = 0
			this.stepBeat = 0
			this.limit = this.settings.mode === "together" ? 0 : this.limit
			for (const [player, until] of this.activeUntil) {
				this.activeUntil.set(player, until - duration)
			}
			if (this.settings.mode === "together") {
				target = 0
				break
			}
		}
		this.position = target
		if (this.settings.mode === "together" && target >= this.limit && this.running) {
			output.push(...this.release(now))
			this.waitingSince ??= now
		}
		return output.sort((a, b) => a.startAt - b.startAt)
	}
}