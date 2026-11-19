import { Transformer } from "./abstract-transformer"
import type { FieldConfig } from "./interface-transformer"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import type { Timer } from "netronome"
import { NOTE_ON, NOTE_OFF } from "../../commands/commands"
import { EVENT_CHANGE, EVENT_CLICK, EVENT_LOAD, EVENT_ERROR } from "../../events/event-constants"
import { EnsembleSession, type EnsembleMode, type EnsembleSettings } from "../ensemble-session"
import { loadMidi, midiSong, type MidiSong } from "../midi-song"
import { notifyControls, notifyControlSchema } from "../component-ui"
import type { ControlValue } from "control-surface/types"

export const ID_ENSEMBLE = "Ensemble"
export interface PlayerAssignment {
	source: string
	channels: number[]
}
interface Config {
	midiFileUrl: string
	midiFileName: string
	mode: EnsembleMode
	players: PlayerAssignment[]
	autoJoin: boolean
	autoInputs: "off" | "keyboard" | "gamepads"
	activityBeats: number
	assist: boolean
	loop: boolean
	stepBeats: number
	quorum: number
	waitSeconds: number
	pauseBeats: number
}
const DEFAULTS: Config = {
	midiFileUrl: "",
	midiFileName: "",
	mode: "assisted",
	players: [],
	autoJoin: true,
	autoInputs: "off",
	activityBeats: 8,
	assist: true,
	loop: true,
	stepBeats: 4,
	quorum: 1,
	waitSeconds: 3,
	pauseBeats: 8
}

export class TransformerEnsemble extends Transformer<Config> {
	type = ID_ENSEMBLE
	readonly handlesMidiControls = true
	private session: EnsembleSession
	private song?: MidiSong
	private revision = 0
	private loading = false
	private error = ""
	private root?: HTMLElement
	private status?: HTMLElement
	private playersRoot?: HTMLElement
	private unsubscribe?: () => void
	private learning?: number
	private destroyed = false
	private library: { name: string; url: string }[] = []
	private libraryLoading?: Promise<void>
	get name() {
		return "Ensemble"
	}
	get description() {
		return "Perform one MIDI song together: each player holds or taps their key to bring their part in, always in time with everybody else."
	}
	get automaticParts(): { channel: number; label: string }[] | undefined {
		if (this.loading || this.error) {
			return undefined
		}
		return (
			this.song?.channels.map((channel) => {
				const tracks = this.song!.midi.tracks.filter(
					(track) => track.channel + 1 === channel && track.notes.length
				)
				const names = [
					...new Set(tracks.map((track) => track.name.trim() || track.instrument.name))
				]
				return { channel, label: `Channel ${channel} · ${names.join(" / ")}` }
			}) ?? []
		)
	}
	get fields(): FieldConfig[] {
		return [
			{ name: "uploadSong", label: "Choose any MIDI file", type: "button" },
			{
				name: "songLibrary",
				label: "Or choose a library song",
				type: "select",
				values: [
					{ name: "Choose a song…", value: "" },
					...(this.library ?? []).map((song) => ({
						name: song.name,
						value: song.url
					}))
				]
			},
			{ name: "midiFileUrl", label: "MIDI song URL", type: "text" },
			{
				name: "autoInputs",
				label: "Automatic channel controls",
				type: "select",
				values: [
					{ name: "Manual assignments", value: "off" },
					{ name: "One keyboard key per song channel", value: "keyboard" },
					{ name: "One gamepad per song channel", value: "gamepads" }
				],
				help: "Creates an Input and control-surface pad for every playable channel whenever a song is loaded."
			},
			{
				name: "enabled",
				label: "Enabled",
				type: "select",
				values: [
					{ name: "Off", value: 0 },
					{ name: "On", value: 1 }
				]
			},
			{
				name: "mode",
				label: "Performance mode",
				type: "select",
				values: [
					{ name: "Play along (hold or tap your part)", value: "assisted" },
					{ name: "Together step", value: "together" },
					{ name: "Group conductor", value: "conductor" }
				]
			},
			{
				name: "autoJoin",
				label: "New inputs join automatically",
				type: "select",
				values: [
					{ name: "Off", value: 0 },
					{ name: "On", value: 1 }
				]
			},
			{
				name: "assist",
				label: "Fill inactive parts / assist together steps",
				type: "select",
				values: [
					{ name: "Off", value: 0 },
					{ name: "On", value: 1 }
				],
				help: "On keeps the complete arrangement playing. Off allows gaps when a player is inactive."
			},
			{
				name: "activityBeats",
				label: "Beats a part keeps playing after a press or release",
				type: "number",
				min: 0.25,
				max: 128,
				step: 0.25
			},
			{
				name: "pauseBeats",
				label: "Pause after everyone stops for (beats, 0 never pauses)",
				type: "number",
				min: 0,
				max: 128,
				step: 1
			},
			{
				name: "stepBeats",
				label: "Beats per together step",
				type: "number",
				min: 0.25,
				max: 32,
				step: 0.25
			},
			{
				name: "quorum",
				label: "Players needed for together step",
				type: "number",
				min: 1,
				max: Number.MAX_SAFE_INTEGER
			},
			{
				name: "waitSeconds",
				label: "Together assistance delay (seconds)",
				type: "number",
				min: 0.1,
				max: 60,
				step: 0.1
			},
			{
				name: "loop",
				label: "Repeat song",
				type: "select",
				values: [
					{ name: "Off", value: 0 },
					{ name: "On", value: 1 }
				]
			}
		].map((field) => ({
			...field,
			default: (this.config?.[field.name] ??
				DEFAULTS[field.name as keyof Config]) as FieldConfig["default"]
		}))
	}
	constructor(config: Partial<Config> = {}) {
		super({
			...DEFAULTS,
			...config,
			players: structuredClone(config.players ?? [])
		})
		this.session = new EnsembleSession(this.settings())
		if (this.config.midiFileUrl) {
			void this.loadMIDIFile(this.config.midiFileUrl)
		}
	}
	private settings(): EnsembleSettings {
		return { ...this.config, players: this.config.players }
	}
	loadSongLibrary(): Promise<void> {
		this.libraryLoading ??= fetch(`${import.meta.env?.BASE_URL ?? "/"}midi/index.json`)
			.then(async (response) => {
				if (!response.ok) {
					return
				}
				const songs: { name: string; file: string }[] = await response.json()
				if (this.destroyed || !Array.isArray(songs)) {
					return
				}
				this.library = songs
					.filter(
						(song) => typeof song.name === "string" && typeof song.file === "string"
					)
					.map((song) => ({ name: song.name, url: `midi/${song.file}` }))
				notifyControlSchema(this)
			})
			.catch(() => {})
		return this.libraryLoading
	}
	override getControlValue(id: string): ControlValue | undefined {
		if (id === "songLibrary") {
			return this.library.some((song) => song.url === this.config.midiFileUrl)
				? this.config.midiFileUrl
				: ""
		}
		if (id === "midiFileUrl" && this.config.midiFileUrl.startsWith("data:")) {
			return ""
		}
		if (id === "uploadSong") {
			return 0
		}
		return super.getControlValue(id)
	}
	override setControlValue(id: string, value: ControlValue): void {
		if (id === "songLibrary") {
			const song = this.library.find((song) => song.url === value)
			if (song) {
				super.setConfig("midiFileName", song.name)
				this.setConfig("midiFileUrl", song.url)
			}
			return
		}
		if (id === "midiFileUrl") {
			super.setConfig("midiFileName", "")
		}
		if (id !== "uploadSong") {
			super.setControlValue(id, value)
			return
		}
		const input = document.createElement("input")
		input.type = "file"
		input.accept = ".mid,.midi"
		input.addEventListener(
			EVENT_CHANGE,
			() => {
				if (input.files?.[0]) {
					void this.loadMIDIUpload(input.files[0])
				}
			},
			{ once: true }
		)
		input.click()
	}
	async loadMIDIUpload(file: File): Promise<void> {
		const revision = ++this.revision
		try {
			const data = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader()
				reader.addEventListener(EVENT_LOAD, () => resolve(String(reader.result)))
				reader.addEventListener(EVENT_ERROR, () =>
					reject(new Error("Unable to read MIDI file"))
				)
				reader.readAsDataURL(file)
			})
			if (revision !== this.revision || this.destroyed) {
				return
			}
			super.setConfig("midiFileName", file.name)
			await this.loadMIDIFile(data)
		} catch (error) {
			if (revision === this.revision) {
				this.error = String(error)
				this.updateStatus()
			}
		}
	}
	get performanceState() {
		return this.session.state
	}
	private source(command: IAudioCommand): string {
		return command.inputId
			? JSON.stringify([command.inputId, command.from])
			: command.from || "Unknown"
	}
	private assignment(source = ""): PlayerAssignment {
		const channels = this.song?.channels ?? [1]
		return {
			source,
			channels: [channels[this.config.players.length % channels.length]]
		}
	}
	addPlayer(): void {
		this.setConfig("players", [...this.config.players, this.assignment()])
	}
	removePlayer(index: number): void {
		this.setConfig(
			"players",
			this.config.players.filter((_, i) => i !== index)
		)
	}
	override setConfig(key: string, value: unknown): void {
		if (["enabled", "loop", "assist", "autoJoin"].includes(key)) {
			value = Boolean(Number(value))
		}
		if (["activityBeats", "stepBeats", "quorum", "waitSeconds", "pauseBeats"].includes(key)) {
			const field = this.fields.find((f) => f.name === key)!
			const number = Number(value)
			value = Math.max(
				field.min!,
				Math.min(
					field.max!,
					Number.isFinite(number) && (number || field.min === 0)
						? number
						: Number(DEFAULTS[key as keyof Config])
				)
			)
			if (key === "quorum") {
				value = Math.floor(Number(value))
			}
		}
		if (key === "mode" && !["assisted", "together", "conductor"].includes(String(value))) {
			value = "assisted"
		}
		if (key === "autoInputs" && !["off", "keyboard", "gamepads"].includes(String(value))) {
			value = "off"
		}
		if (key === "players") {
			if (!Array.isArray(value)) {
				throw new Error("Invalid player assignments")
			}
			value = value.map((player: PlayerAssignment) => ({
				source: String(player.source ?? ""),
				channels: [...new Set(player.channels)].filter(
					(ch) => Number.isInteger(ch) && ch >= 1 && ch <= 16
				)
			}))
		}
		super.setConfig(key, value)
		if (!this.session) {
			return
		}
		if (key === "midiFileUrl") {
			void this.loadMIDIFile(String(value))
		} else if (key === "enabled") {
			this.session.reset()
		} else if (key in DEFAULTS) {
			this.session.configure(this.settings())
		}
	}
	async loadMIDIFile(url: string): Promise<void> {
		const revision = ++this.revision
		this.loading = true
		this.error = ""
		this.song = undefined
		this.session.setSong(undefined)
		this.updateStatus()
		try {
			const song = url ? midiSong(await loadMidi(url)) : undefined
			if (revision !== this.revision || this.destroyed) {
				return
			}
			this.song = song
			this.session.setSong(song)
			super.setConfig("midiFileUrl", url)
		} catch (error) {
			if (revision === this.revision) {
				this.error = error instanceof Error ? error.message : "Unable to load song"
			}
		} finally {
			if (revision === this.revision) {
				this.loading = false
				this.updateStatus()
				this.renderPlayers()
				notifyControls(this)
			}
		}
	}
	transform(commands: IAudioCommand[], timer: Timer): IAudioCommand[] {
		const now = Number.isFinite(timer?.now)
			? timer.now
			: Math.max(0, ...commands.map((c) => c.startAt))
		if (this.destroyed) {
			return []
		}
		if (!this.config.enabled) {
			return [...this.session.advance(now), ...commands]
		}
		const output: IAudioCommand[] = []
		for (const command of commands) {
			const pressed = command.type === NOTE_ON && command.velocity > 0
			const released =
				command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0)
			if (!(pressed || released) || !this.song || this.loading) {
				// Controller pitches and sustain cannot alter the song arrangement.
				continue
			}
			const source = this.source(command)
			let player = this.config.players.findIndex(
				(p) =>
					p.source === source ||
					(command.inputId && p.source === `input:${command.inputId}`)
			)
			if (released) {
				// A release only lets the part run out; it never cuts score notes.
				if (player >= 0) {
					output.push(...this.session.releasePress(player, now))
				}
				continue
			}
			if (this.learning !== undefined) {
				const index = this.learning
				this.learning = undefined
				const players = this.config.players.map((p, i) => ({
					...p,
					source: i === index ? source : p.source === source ? "" : p.source
				}))
				this.setConfig("players", players)
				player = index
			}
			if (player < 0 && this.config.autoJoin) {
				player = this.config.players.findIndex((p) => !p.source)
				if (player >= 0) {
					this.config.players[player] = {
						...this.config.players[player],
						source
					}
				} else {
					player = this.config.players.length
					this.config.players.push(this.assignment(source))
				}
				// Joining changes membership, never the shared playhead or held notes.
				super.setConfig("players", [...this.config.players])
				this.session.settings = this.settings()
				this.renderPlayers()
			}
			if (player >= 0) {
				output.push(...this.session.press(player, now))
			}
		}
		this.updateStatus()
		return output
	}
	tick(now: number, _timer: Timer): IAudioCommand[] {
		const output = this.destroyed ? [] : this.session.advance(now)
		this.updateStatus()
		return output
	}
	reset(): void {
		this.session?.reset()
		this.updateStatus()
	}
	stop(now: number): IAudioCommand[] {
		this.session.reset()
		return this.session.advance(now)
	}
	private partNames(channels: number[]): string {
		const parts = this.automaticParts ?? []
		return channels
			.map(
				(channel) =>
					parts.find((part) => part.channel === channel)?.label.split(" · ")[1] ??
					`Channel ${channel}`
			)
			.join(", ")
	}
	private statusText(): string {
		if (this.loading) {
			return "Loading song…"
		}
		if (this.error) {
			return this.error
		}
		if (!this.song) {
			return "Choose a song. Connect every player's Input to this single Ensemble Transformer, then connect your Outputs."
		}
		const state = this.session.state
		const title = `${this.config.midiFileName || "Song"} · bar ${state.bar}`
		if (state.ended) {
			return `${title} · Finished — restart to play again`
		}
		if (!state.running) {
			return `${title} · ${state.paused ? "Paused — press any part to carry on" : "Press any part to start the song"}`
		}
		const { live, upcoming } = this.session.parts()
		const waiting = upcoming.filter((channel) => !live.includes(channel))
		return [
			title,
			live.length ? `Playing: ${this.partNames(live)}` : "Nobody is playing",
			waiting.length ? `Next bar: ${this.partNames(waiting)}` : ""
		]
			.filter(Boolean)
			.join(" · ")
	}
	private updateStatus(): void {
		if (!this.status) {
			return
		}
		// Ticks arrive dozens of times a second; only touch the DOM when the text changes.
		const text = this.statusText()
		if (this.status.textContent !== text) {
			this.status.textContent = text
		}
	}
	private renderPlayers(): void {
		if (!this.playersRoot) {
			return
		}
		this.playersRoot.replaceChildren()
		this.config.players.forEach((player, index) => {
			const row = document.createElement("fieldset")
			const title = document.createElement("legend")
			title.textContent = `Player ${index + 1}`
			const source = document.createElement("input")
			source.value = player.source
			source.setAttribute("aria-label", `Player ${index + 1} input`)
			source.placeholder = "Press Learn, then use the input"
			const channels = document.createElement("input")
			channels.value = player.channels.join(", ")
			channels.setAttribute("aria-label", `Player ${index + 1} song channels`)
			const label = document.createElement("label")
			label.textContent = "Song channels (comma separated)"
			label.append(channels)
			const update = () =>
				this.setConfig(
					"players",
					this.config.players.map((p, i) =>
						i === index
							? {
									source: source.value.trim(),
									channels: channels.value.split(",").map(Number)
								}
							: p
					)
				)
			source.addEventListener(EVENT_CHANGE, update)
			channels.addEventListener(EVENT_CHANGE, update)
			const learn = document.createElement("button")
			learn.type = "button"
			learn.textContent = this.learning === index ? "Waiting for input…" : "Learn input"
			learn.addEventListener(EVENT_CLICK, () => {
				this.learning = this.learning === index ? undefined : index
				this.renderPlayers()
			})
			const remove = document.createElement("button")
			remove.type = "button"
			remove.textContent = "Remove player"
			remove.addEventListener(EVENT_CLICK, () => {
				this.learning = undefined
				this.removePlayer(index)
			})
			row.append(title, source, learn, label, remove)
			this.playersRoot!.append(row)
		})
	}
	override async createGui(): Promise<HTMLElement> {
		if (this.root) {
			return this.root
		}
		await this.loadSongLibrary()
		const root = document.createElement("div")
		root.className = "transformer-controls ensemble-controls"
		root.style.display = "grid"
		root.style.gap = "0.5rem"
		const guidance = document.createElement("p")
		guidance.textContent =
			"Use one Ensemble for all players. The first press starts the song at its first bar; after that the song keeps time for everyone. Hold your key, or tap it every few beats, to keep your part playing. The song pauses when everybody stops and carries on from that bar. Inputs join on their first press; use Learn to assign them manually. Turn on assistance to hear quieter backing for parts nobody is playing."
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.playersRoot = document.createElement("div")
		const add = document.createElement("button")
		add.type = "button"
		add.textContent = "Add player"
		add.addEventListener(EVENT_CLICK, () => this.addPlayer())
		const restart = document.createElement("button")
		restart.type = "button"
		restart.textContent = "Restart song"
		restart.addEventListener(EVENT_CLICK, () => this.reset())
		root.append(guidance, this.status, await super.createGui(), this.playersRoot, add, restart)
		this.root = root
		this.unsubscribe = this.subscribeControls(() => {
			this.renderPlayers()
			this.updateStatus()
		})
		this.renderPlayers()
		this.updateStatus()
		return root
	}
	override destroyGui(): void {
		this.unsubscribe?.()
		this.unsubscribe = undefined
		this.root = this.playersRoot = this.status = undefined
		super.destroyGui()
	}
	override destroy(): void {
		this.destroyed = true
		this.revision++
		this.session.reset()
		super.destroy()
	}
}