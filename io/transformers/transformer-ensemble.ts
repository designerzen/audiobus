import { Transformer } from "./abstract-transformer"
import type { FieldConfig } from "./interface-transformer"
import type { IAudioCommand } from "../../audio-command-interface"
import type { Timer } from "netronome"
import { NOTE_ON } from "../../commands"
import { EVENT_CHANGE, EVENT_CLICK, EVENT_LOAD, EVENT_ERROR } from "../../event-constants"
import { EnsembleSession, type EnsembleMode, type EnsembleSettings } from "../ensemble-session"
import { loadMidi, midiSong, type MidiSong } from "../midi-song"
import { notifyControls } from "../component-ui"
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
	waitSeconds: 3
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
	get name() {
		return "Ensemble"
	}
	get description() {
		return "Perform one MIDI song together: assign inputs to parts and keep every player at the same song position."
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
			{ name: "uploadSong", label: "Upload MIDI song", type: "button" },
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
					{ name: "Assisted ensemble", value: "assisted" },
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
				label: "Beats unlocked per press",
				type: "number",
				min: 0.25,
				max: 128,
				step: 0.25
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
		super({ ...DEFAULTS, ...config, players: structuredClone(config.players ?? []) })
		this.session = new EnsembleSession(this.settings())
		if (this.config.midiFileUrl) {
			void this.loadMIDIFile(this.config.midiFileUrl)
		}
	}
	private settings(): EnsembleSettings {
		return { ...this.config, players: this.config.players }
	}
	override getControlValue(id: string): ControlValue | undefined {
		if (id === "midiFileUrl" && this.config.midiFileUrl.startsWith("data:")) {
			return ""
		}
		if (id === "uploadSong") {
			return 0
		}
		return super.getControlValue(id)
	}
	override setControlValue(id: string, value: ControlValue): void {
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
		return { source, channels: [channels[this.config.players.length % channels.length]] }
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
		if (["activityBeats", "stepBeats", "quorum", "waitSeconds"].includes(key)) {
			const field = this.fields.find((f) => f.name === key)!
			value = Math.max(
				field.min!,
				Math.min(field.max!, Number(value) || Number(DEFAULTS[key as keyof Config]))
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
			if (command.type !== NOTE_ON || command.velocity === 0) {
				// Controller pitches, sustain and releases cannot alter the song arrangement.
				continue
			}
			if (!this.song || this.loading) {
				continue
			}
			const source = this.source(command)
			let player = this.config.players.findIndex(
				(p) =>
					p.source === source ||
					(command.inputId && p.source === `input:${command.inputId}`)
			)
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
					this.config.players[player] = { ...this.config.players[player], source }
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
	private updateStatus(): void {
		if (!this.status) {
			return
		}
		const state = this.session.state
		this.status.textContent = this.loading
			? "Loading song…"
			: this.error ||
				(this.song
					? `${this.config.midiFileName || "Song"} · channels ${this.song.channels.join(", ")} · ${state.position.toFixed(1)}s · ${state.ended ? "Finished — restart to play again" : state.running ? "Playing together" : "Press any assigned input to start"}`
					: "Choose a song. Connect every player's Input to this single Ensemble Transformer, then connect your Outputs.")
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
		const root = document.createElement("div")
		root.className = "transformer-controls ensemble-controls"
		root.style.display = "grid"
		root.style.gap = "0.5rem"
		const guidance = document.createElement("p")
		guidance.textContent =
			"Use one Ensemble for all players. Inputs join on their first press; use Learn to assign them manually. Each player can own several song channels, and players can share channels. Enable assistance to keep the whole song playing, or disable it for press-controlled parts."
		const library = document.createElement("select")
		library.setAttribute("aria-label", "Ensemble song library")
		const placeholder = document.createElement("option")
		placeholder.value = ""
		placeholder.textContent = "Choose a library song…"
		library.append(placeholder)
		library.addEventListener(EVENT_CHANGE, () => {
			if (!library.value) {
				return
			}
			super.setConfig("midiFileName", library.selectedOptions[0].textContent ?? "")
			this.setConfig("midiFileUrl", library.value)
		})
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
		root.append(
			guidance,
			library,
			this.status,
			await super.createGui(),
			this.playersRoot,
			add,
			restart
		)
		this.root = root
		this.unsubscribe = this.subscribeControls(() => {
			this.renderPlayers()
			this.updateStatus()
		})
		this.renderPlayers()
		this.updateStatus()
		void fetch(`${import.meta.env.BASE_URL}midi/index.json`)
			.then(async (response) => {
				if (!response.ok) {
					return
				}
				const songs: { name: string; file: string }[] = await response.json()
				if (this.root !== root) {
					return
				}
				for (const song of songs) {
					const option = document.createElement("option")
					option.value = `midi/${song.file}`
					option.textContent = song.name
					library.append(option)
				}
			})
			.catch(() => {})
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