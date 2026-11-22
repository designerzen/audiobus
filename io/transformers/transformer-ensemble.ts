import { Transformer } from "./abstract-transformer"
import type { FieldConfig } from "./interface-transformer"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import type { Timer } from "netronome"
import { NOTE_ON, NOTE_OFF } from "../../commands/commands"
import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_INPUT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_LOAD,
	EVENT_ERROR,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_UP
} from "../../events/event-constants"
import { EnsembleSession, type EnsembleMode, type EnsembleSettings } from "../ensemble-session"
import type {
	EnsembleGrooveRegion,
	EnsemblePartRole,
	EnsembleTelemetry
} from "../ensemble-performance"
import { loadMidi, midiSong, type MidiSong } from "../midi-song"
import { notifyControls, notifyControlSchema } from "../component-ui"
import type { ControlValue } from "control-surface/types"

export const ID_ENSEMBLE = "Ensemble"
export const ENSEMBLE_KEYS = "asdfghjklqwertyui".split("")
const TIMING_FIELDS: Record<EnsembleMode, string[]> = {
	perform: ["recoveryBars", "chordWindowMs", "pauseBeats"],
	assisted: ["activityBeats", "pauseBeats"],
	together: ["stepBeats", "quorum", "waitSeconds"],
	conductor: ["activityBeats"]
}
const TIMING_IDS = [...new Set(Object.values(TIMING_FIELDS).flat())]
/** Song sent ahead of the clock; longer than the slowest measured gap between ticks (~90ms). */
const LOOKAHEAD = 0.15
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
	partRoles: Record<number, EnsemblePartRole>
	grooveRegions: EnsembleGrooveRegion[]
	legatoGroove: boolean
	anticipationBeats: number
	pairCompanionParts: boolean
	recoveryBars: number
	chordWindowMs: number
	tempoAdaptation: number
	leadPlayer?: number
	holdArticulation: boolean
	velocityInfluence: number
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
	mode: "perform",
	partRoles: {},
	grooveRegions: [],
	legatoGroove: true,
	anticipationBeats: 8,
	pairCompanionParts: false,
	recoveryBars: 2,
	chordWindowMs: 20,
	tempoAdaptation: 0,
	leadPlayer: undefined,
	holdArticulation: false,
	velocityInfluence: 0,
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
	private meter?: HTMLElement
	private playersRoot?: HTMLElement
	private addPlayerButton?: HTMLButtonElement
	private timingControls = new Map<string, { control: HTMLElement; output: HTMLOutputElement }>()
	private unsubscribe?: () => void
	private learning?: number
	private destroyed = false
	private pendingCommands: IAudioCommand[] = []
	private feedbackListeners = new Set<() => void>()
	private library: { name: string; url: string }[] = []
	private libraryLoading?: Promise<void>
	get name() {
		return "Ensemble"
	}
	get description() {
		return "Play a song together: tap each note or chord, while rhythmic parts loop on the shared beat."
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
			{ name: "uploadSong", label: "Upload MIDI file", group: "Song", type: "button" },
			{
				name: "songLibrary",
				label: "Library song",
				group: "Song",
				type: "select",
				values: [
					{ name: "Choose a song…", value: "" },
					...(this.library ?? []).map((song) => ({
						name: song.name,
						value: song.url
					}))
				]
			},
			{ name: "midiFileUrl", label: "Song URL", group: "Song", type: "text" },
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
				label: "Mode",
				group: "Players",
				type: "select",
				values: [
					{ name: "Notes and grooves", value: "perform" },
					{ name: "Together step", value: "together" },
					{ name: "Group conductor", value: "conductor" }
				],
				help: "Notes and grooves: each tap plays one note or chord; drums loop until stopped. Together step: wait for players. Group conductor: tapping sets tempo."
			},
			{
				name: "autoInputs",
				label: "Player controls",
				group: "Players",
				type: "select",
				values: [
					{ name: "Assign manually", value: "off" },
					{ name: "A keyboard key per part", value: "keyboard" },
					{ name: "A gamepad per part", value: "gamepads" }
				],
				help: "Creates an Input and control-surface pad for every playable channel whenever a song is loaded."
			},
			{
				name: "autoJoin",
				label: "New inputs join automatically",
				group: "Players",
				type: "select",
				values: [
					{ name: "Off", value: 0 },
					{ name: "On", value: 1 }
				]
			},
			{
				name: "assist",
				label: "Fill silent parts",
				group: "Players",
				type: "select",
				values: [
					{ name: "Off", value: 0 },
					{ name: "On", value: 1 }
				],
				help: "In Notes and grooves, only unassigned parts receive quiet backing; assigned notes always need a tap. Other modes can fill silent parts or advance waiting steps."
			},
			{
				name: "loop",
				label: "Repeat song",
				group: "Players",
				type: "select",
				values: [
					{ name: "Off", value: 0 },
					{ name: "On", value: 1 }
				]
			},
			{
				name: "chordWindowMs",
				label: "Chord grouping (ms)",
				group: "Timing",
				type: "number",
				min: 0,
				max: 50,
				step: 1,
				help: "Treat slightly staggered chord tones as one tap, preserving their timing. 0 requires exact simultaneity; fast and repeated notes remain separate."
			},
			{
				name: "recoveryBars",
				label: "Rejoin when behind (bars)",
				group: "Timing",
				type: "number",
				min: 1,
				max: 16,
				step: 1,
				help: "Keep missed notes until this many bars behind, then rejoin a nearby section entry or the current bar on the next tap."
			},
			{
				name: "activityBeats",
				label: "Part keeps playing for (beats)",
				group: "Timing",
				type: "number",
				min: 0.25,
				max: 128,
				step: 0.25,
				help: "How long a part carries on after a press or release."
			},
			{
				name: "pauseBeats",
				label: "Pause after silence (beats)",
				group: "Timing",
				type: "number",
				min: 0,
				max: 128,
				step: 1,
				help: "The song pauses once everybody has stopped for this long. 0 never pauses."
			},
			{
				name: "stepBeats",
				label: "Step length (beats)",
				group: "Timing",
				type: "number",
				min: 0.25,
				max: 32,
				step: 0.25
			},
			{
				name: "quorum",
				label: "Players per step",
				group: "Timing",
				type: "number",
				min: 1,
				max: 16,
				help: "How many players must press before the next together step plays."
			},
			{
				name: "waitSeconds",
				label: "Assist a step after (seconds)",
				group: "Timing",
				type: "number",
				min: 0.1,
				max: 60,
				step: 0.1,
				help: "With Fill silent parts on, a waiting step plays by itself after this delay."
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
			// Upgrade saved Play along links, whose activity gate caused phrase playback.
			mode: config.mode === "assisted" ? "perform" : (config.mode ?? "perform"),
			partRoles: { ...config.partRoles },
			players: structuredClone(config.players ?? [])
		})
		this.session = new EnsembleSession(this.settings())
		if (this.config.midiFileUrl) {
			void this.loadMIDIFile(this.config.midiFileUrl)
		}
	}
	private settings(): EnsembleSettings {
		return { ...this.config, players: this.config.players, lookahead: LOOKAHEAD }
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
	get telemetry(): EnsembleTelemetry {
		return this.session.telemetry()
	}
	partFeedback(channel: number) {
		return this.session.partFeedback(channel)
	}
	partState(channel: number): string {
		return this.config.mode === "perform" ? this.session.partState(channel) : ""
	}
	subscribeFeedback(listener: () => void): () => void {
		this.feedbackListeners.add(listener)
		return () => this.feedbackListeners.delete(listener)
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
		if (
			[
				"enabled",
				"loop",
				"assist",
				"autoJoin",
				"holdArticulation",
				"legatoGroove",
				"pairCompanionParts"
			].includes(key)
		) {
			value = Boolean(Number(value) || value === true)
		}
		if (key === "anticipationBeats") {
			const number = Number(value)
			value = Number.isFinite(number) && number >= 0 ? Math.min(64, number) : 8
		}
		if (["tempoAdaptation", "velocityInfluence"].includes(key)) {
			const number = Number(value)
			value = Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0
		}
		if (key === "leadPlayer") {
			const number = Number(value)
			value = Number.isInteger(number) && number >= 0 ? number : undefined
		}
		if (key === "grooveRegions") {
			value = Array.isArray(value)
				? value
						.filter(
							(r) =>
								r &&
								Number.isInteger(Number(r.fromBar)) &&
								Number(r.fromBar) >= 1 &&
								["loop", "break", "fill"].includes(String(r.kind))
						)
						.map((r) => ({
							fromBar: Number(r.fromBar),
							...(Number.isInteger(Number(r.toBar)) &&
							Number(r.toBar) >= Number(r.fromBar)
								? { toBar: Number(r.toBar) }
								: {}),
							kind: r.kind as EnsembleGrooveRegion["kind"]
						}))
				: []
		}
		if (
			[
				"activityBeats",
				"stepBeats",
				"quorum",
				"waitSeconds",
				"pauseBeats",
				"recoveryBars",
				"chordWindowMs"
			].includes(key)
		) {
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
			if (key === "quorum" || key === "recoveryBars") {
				value = Math.floor(Number(value))
			}
		}
		if (key === "mode" && value === "assisted") value = "perform"
		if (
			key === "mode" &&
			!["perform", "assisted", "together", "conductor"].includes(String(value))
		) {
			value = "perform"
		}
		if (key === "autoInputs" && !["off", "keyboard", "gamepads"].includes(String(value))) {
			value = "off"
		}
		if (key === "partRoles") {
			value = Object.fromEntries(
				Object.entries(value && typeof value === "object" ? value : {}).filter(
					([channel, role]) =>
						Number.isInteger(Number(channel)) &&
						Number(channel) >= 1 &&
						Number(channel) <= 16 &&
						["auto", "notes", "groove"].includes(String(role))
				)
			)
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
		Object.assign(this.config, { [key]: value })
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
		notifyControls(this)
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
			this.pendingCommands.length = 0
			return [...this.session.advance(now), ...commands]
		}
		const output: IAudioCommand[] = this.pendingCommands.splice(0)
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
				output.push(...this.session.press(player, now, command.velocity))
			}
		}
		this.updateStatus()
		return output
	}
	tick(now: number, _timer: Timer): IAudioCommand[] {
		const output = this.destroyed
			? []
			: [...this.pendingCommands.splice(0), ...this.session.advance(now)]
		this.updateStatus()
		return output
	}
	reset(): void {
		this.pendingCommands.length = 0
		this.session?.reset()
		this.updateStatus()
	}
	stop(now: number): IAudioCommand[] {
		this.pendingCommands.length = 0
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
		const { live, upcoming, assisted = [] } = this.session.parts()
		const waiting = upcoming.filter(
			(channel) => !live.includes(channel) && !assisted.includes(channel)
		)
		return [
			title,
			live.length ? `Playing: ${this.partNames(live)}` : "Nobody is playing",
			assisted.length ? `Backing: ${this.partNames(assisted)}` : "",
			waiting.length ? `Coming up: ${this.partNames(waiting)}` : ""
		]
			.filter(Boolean)
			.join(" · ")
	}
	private triggerChannel(channel: number, pressed: boolean): void {
		if (!this.song || this.loading || this.destroyed || !this.config.enabled) {
			return
		}
		const player = this.config.players.findIndex((p) => p.channels.includes(channel))
		if (player < 0) {
			return
		}
		const now = this.session.state.lastNow ?? 0
		if (pressed) {
			this.pendingCommands.push(...this.session.press(player, now, 110))
		} else {
			this.pendingCommands.push(...this.session.releasePress(player, now))
		}
		this.updateStatus()
	}
	private partStatuses = new Map<number, HTMLElement[]>()
	private partCues = new Map<number, HTMLElement[]>()
	private updateStatus(): void {
		for (const [channel, nodes] of this.partCues) {
			const feedback = this.session.partFeedback(channel)
			for (const node of nodes) {
				if (node.textContent !== feedback.message) node.textContent = feedback.message
				if (node.dataset.phase !== feedback.phase) node.dataset.phase = feedback.phase
				const tile = node.closest<HTMLElement>(".ensemble-part")
				if (tile) {
					if (tile.dataset.phase !== feedback.phase) tile.dataset.phase = feedback.phase
					const role = this.session.partRole(channel)
					if (tile.dataset.role !== role) tile.dataset.role = role
				}
				if (node.dataset.accepted !== String(feedback.accepted)) {
					node.dataset.accepted = String(feedback.accepted)
					if (
						feedback.accepted &&
						typeof node.animate === "function" &&
						!(
							typeof matchMedia === "function" &&
							matchMedia("(prefers-reduced-motion: reduce)").matches
						)
					) {
						node.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150 })
					}
				}
				// Quantize the visual pulse to eight steps per beat, avoiding full-rate DOM writes.
				const pulse = this.session.state.running ? Math.floor((feedback.beat % 1) * 8) : -1
				if (node.dataset.pulse !== String(pulse)) {
					node.dataset.pulse = String(pulse)
					if (tile) tile.dataset.pulse = String(pulse)
				}
				const approachPercent = String(Math.round((feedback.approach ?? 0) * 100))
				if (node.dataset.approach !== approachPercent) {
					node.dataset.approach = approachPercent
					node.style.setProperty(
						"--ensemble-approach",
						(feedback.approach ?? 0).toFixed(2)
					)
					tile?.style.setProperty(
						"--ensemble-approach",
						(feedback.approach ?? 0).toFixed(2)
					)
				}
			}
		}
		for (const [channel, nodes] of this.partStatuses) {
			const text = this.config.mode === "perform" ? this.session.partState(channel) : ""
			for (const node of nodes) if (node.textContent !== text) node.textContent = text
		}
		for (const listener of this.feedbackListeners) {
			listener()
		}
		if (this.meter) {
			const state = this.session.state
			const progress =
				this.song && this.song.duration > 0
					? Math.max(0, Math.min(1, state.position / this.song.duration))
					: 0
			const beatInBar =
				state.running && this.song
					? ((Math.floor(this.session.partFeedback(this.song.channels[0] ?? 1).beat) %
							4) +
							4) %
						4
					: -1
			this.meter.dataset.running = String(state.running)
			this.meter.dataset.beat = String(beatInBar)
			this.meter.style.setProperty("--ensemble-progress", progress.toFixed(3))
		}
		if (!this.status) {
			return
		}
		// Ticks arrive dozens of times a second; only touch the DOM when the text changes.
		const text = this.statusText()
		if (this.status.textContent !== text) {
			this.status.textContent = text
			this.status.classList.toggle("is-error", Boolean(this.error))
		}
	}
	private sourceName(source: string): string {
		if (source.startsWith("input:")) {
			return source.slice("input:".length)
		}
		try {
			const [id, from] = JSON.parse(source)
			return String(from || id)
		} catch {
			return source
		}
	}
	/** Shows only the timing settings the current mode uses, with their values beside them. */
	private syncPanel(): void {
		const visible = TIMING_FIELDS[this.config.mode]
		for (const [id, { control, output }] of this.timingControls) {
			control.hidden = !visible.includes(id)
			if (document.activeElement !== control.querySelector("input")) {
				output.textContent = String(this.config[id])
			}
		}
	}
	private partControls(channel: number): HTMLElement {
		const root = document.createElement("span")
		root.className = "ensemble-part-behaviour"
		const select = document.createElement("select")
		select.setAttribute("aria-label", `Channel ${channel} behaviour`)
		for (const [value, label] of [
			["auto", `Auto (${channel === 10 ? "groove" : "notes"})`],
			["notes", "Notes: tap each onset"],
			["groove", "Groove: tap to loop"]
		]) {
			const option = document.createElement("option")
			option.value = value
			option.textContent = label
			select.append(option)
		}
		select.value = this.config.partRoles[channel] ?? "auto"
		select.addEventListener(EVENT_CHANGE, () =>
			this.setConfig("partRoles", { ...this.config.partRoles, [channel]: select.value })
		)
		const stop = document.createElement("button")
		stop.type = "button"
		stop.textContent = "Stop groove"
		stop.setAttribute("aria-label", `Stop channel ${channel} groove at next bar`)
		stop.hidden = this.session.partRole(channel) !== "groove"
		stop.addEventListener(EVENT_CLICK, () => {
			this.session.stopGroove(channel)
			this.updateStatus()
		})
		const rejoin = document.createElement("button")
		rejoin.type = "button"
		rejoin.textContent = "Rejoin song"
		rejoin.setAttribute("aria-label", `Rejoin channel ${channel} at the current section`)
		rejoin.hidden = this.session.partRole(channel) !== "notes"
		rejoin.addEventListener(EVENT_CLICK, () => {
			this.session.rejoinPart(channel)
			this.updateStatus()
		})
		const cue = document.createElement("span")
		cue.className = "ensemble-part-cue"
		cue.setAttribute("aria-label", `Channel ${channel} playing guide`)
		this.partCues.set(channel, [...(this.partCues.get(channel) ?? []), cue])
		const status = document.createElement("small")
		status.className = "ensemble-part-status"
		this.partStatuses.set(channel, [...(this.partStatuses.get(channel) ?? []), status])
		root.append(select, stop, rejoin, cue, status)
		root.hidden = this.config.mode !== "perform"
		return root
	}
	private renderPlayers(): void {
		if (!this.playersRoot) {
			return
		}
		const item = (className: string, ...children: (Node | string)[]) => {
			const li = document.createElement("li")
			li.className = className
			li.append(...children)
			return li
		}
		const automatic = this.config.autoInputs !== "off"
		this.playersRoot.replaceChildren()
		this.partStatuses.clear()
		this.partCues.clear()
		if (this.addPlayerButton) {
			this.addPlayerButton.hidden = automatic
		}
		if (automatic) {
			// Generated Inputs own these assignments, so they are listed rather than edited.
			const parts = this.automaticParts ?? []
			if (!parts.length) {
				this.playersRoot.append(
					item("ensemble-empty", "Load a song to create a control for each part.")
				)
			}
			parts.forEach((part, index) => {
				const trigger = document.createElement("kbd")
				trigger.textContent =
					this.config.autoInputs === "keyboard"
						? (ENSEMBLE_KEYS[index]?.toUpperCase() ?? "–")
						: `Pad ${index + 1}`
				trigger.tabIndex = 0
				trigger.setAttribute("role", "button")
				trigger.setAttribute(
					"aria-label",
					`Play ${this.partNames([part.channel])} (Channel ${part.channel})`
				)
				trigger.title = "Click or press to play this part"
				trigger.addEventListener(EVENT_POINTER_DOWN, (event) => {
					event.preventDefault()
					trigger.setPointerCapture?.(event.pointerId)
					this.triggerChannel(part.channel, true)
				})
				for (const type of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL]) {
					trigger.addEventListener(type, () => this.triggerChannel(part.channel, false))
				}
				trigger.addEventListener(EVENT_KEY_DOWN, (event) => {
					if (!event.repeat && (event.key === " " || event.key === "Enter")) {
						event.preventDefault()
						this.triggerChannel(part.channel, true)
					}
				})
				trigger.addEventListener(EVENT_KEY_UP, (event) => {
					if (event.key === " " || event.key === "Enter") {
						event.preventDefault()
						this.triggerChannel(part.channel, false)
					}
				})
				const name = document.createElement("span")
				name.className = "ensemble-part-name"
				name.textContent = this.partNames([part.channel])
				const channel = document.createElement("small")
				channel.className = "ensemble-part-channel"
				channel.textContent = `Ch ${part.channel}`
				this.playersRoot!.append(
					item("ensemble-part", trigger, name, channel, this.partControls(part.channel))
				)
			})
			this.updateStatus()
			return
		}
		if (!this.config.players.length) {
			this.playersRoot.append(
				item("ensemble-empty", "Add a player, or press any connected input to join.")
			)
		}
		const channels = [
			...new Set([
				...(this.song?.channels ?? []),
				...this.config.players.flatMap((player) => player.channels)
			])
		].sort((a, b) => a - b)
		this.config.players.forEach((player, index) => {
			const title = document.createElement("strong")
			title.textContent = `Player ${index + 1}`
			const source = document.createElement("span")
			source.className = "ensemble-player-source"
			source.textContent = player.source ? this.sourceName(player.source) : "No input yet"
			source.title = player.source
			const learn = document.createElement("button")
			learn.type = "button"
			learn.textContent = this.learning === index ? "Press an input…" : "Learn"
			learn.setAttribute("aria-pressed", String(this.learning === index))
			learn.setAttribute("aria-label", `Learn player ${index + 1} input`)
			learn.addEventListener(EVENT_CLICK, () => {
				this.learning = this.learning === index ? undefined : index
				this.renderPlayers()
			})
			const remove = document.createElement("button")
			remove.type = "button"
			remove.className = "ensemble-player-remove"
			remove.textContent = "×"
			remove.setAttribute("aria-label", `Remove player ${index + 1}`)
			remove.addEventListener(EVENT_CLICK, () => {
				this.learning = undefined
				this.removePlayer(index)
			})
			const head = document.createElement("div")
			head.className = "ensemble-player-head"
			head.append(title, source, learn, remove)
			const parts = document.createElement("div")
			parts.className = "ensemble-player-parts"
			parts.setAttribute("role", "group")
			parts.setAttribute("aria-label", `Player ${index + 1} parts`)
			for (const channel of channels) {
				const box = document.createElement("input")
				box.type = "checkbox"
				box.value = String(channel)
				box.checked = player.channels.includes(channel)
				box.addEventListener(EVENT_CHANGE, () =>
					this.setConfig(
						"players",
						this.config.players.map((p, i) =>
							i === index
								? {
										...p,
										channels: [
											...parts.querySelectorAll<HTMLInputElement>(
												"input:checked"
											)
										].map((input) => Number(input.value))
									}
								: p
						)
					)
				)
				const label = document.createElement("label")
				label.title = `Channel ${channel}`
				label.append(box, `${channel} · ${this.partNames([channel])}`)
				const controls = this.partControls(channel)
				controls.hidden = this.config.mode !== "perform" || !box.checked
				parts.append(label, controls)
			}
			if (!channels.length) {
				parts.textContent = "Load a song to choose parts."
			}
			this.playersRoot!.append(item("ensemble-player", head, parts))
		})
		this.updateStatus()
	}
	override async createGui(): Promise<HTMLElement> {
		if (this.root) {
			return this.root
		}
		await this.loadSongLibrary()
		const element = <K extends keyof HTMLElementTagNameMap>(
			tag: K,
			className = "",
			text = ""
		) => {
			const node = document.createElement(tag)
			node.className = className
			node.textContent = text
			return node
		}
		const root = element("div", "ensemble-controls")

		// Live status first: it is what players need while performing.
		const header = element("div", "ensemble-header")
		this.status = element("p", "ensemble-status")
		this.status.setAttribute("role", "status")
		const restart = element("button", "", "Restart")
		restart.type = "button"
		restart.addEventListener(EVENT_CLICK, () => this.reset())
		this.meter = element("div", "ensemble-meter")
		this.meter.setAttribute("aria-hidden", "true")
		for (let beat = 0; beat < 4; beat++) {
			const dot = element("span", "ensemble-beat-dot")
			dot.dataset.slot = String(beat)
			this.meter.append(dot)
		}
		header.append(this.status, restart, this.meter)

		// Generated settings keep their MIDI-learn bindings; the players list joins their group.
		const controls = await super.createGui()
		const group = (name: string) =>
			[...controls.querySelectorAll<HTMLFieldSetElement>(":scope > fieldset")].find(
				(fieldset) => fieldset.querySelector(":scope > legend")?.textContent === name
			)
		this.playersRoot = element("ul", "ensemble-players")
		this.addPlayerButton = element("button", "ensemble-add-player", "Add player")
		this.addPlayerButton.type = "button"
		this.addPlayerButton.addEventListener(EVENT_CLICK, () => this.addPlayer())
		;(group("Players") ?? controls).append(this.playersRoot, this.addPlayerButton)

		// Timing is rarely changed mid-performance, so it starts collapsed.
		const timing = group("Timing")
		if (timing) {
			const details = element("details", "ensemble-timing")
			timing.before(details)
			timing.querySelector(":scope > legend")?.remove()
			details.append(element("summary", "", "Timing"), timing)
			for (const id of TIMING_IDS) {
				const input = timing.querySelector<HTMLInputElement>(
					`[data-midi-control$='${JSON.stringify(id)}]']`
				)
				const control = input?.closest<HTMLElement>(".component-control")
				if (!input || !control) {
					continue
				}
				const output = element("output")
				control.firstElementChild?.append(output)
				input.addEventListener(EVENT_INPUT, () => (output.textContent = input.value))
				this.timingControls.set(id, { control, output })
			}
		}

		const help = element("details", "ensemble-help")
		const steps = element("ol")
		for (const step of [
			"Connect every player's Input to this one Ensemble.",
			"The first press starts the song; it then keeps time for everyone.",
			"Notes: tap once for each note or chord. Holding never plays a phrase.",
			"Grooves: tap to start a bar-aligned loop; tap again to accent. Use Stop groove to finish at a bar boundary.",
			"Missed notes stay in order. After the recovery window, your next tap rejoins a section or bar. Rejoin song skips ahead without playing notes.",
			"Accepted means your tap is queued. Follow the countdown for long rests; Playing means your note has started.",
			"With no groove running, the song pauses after inactivity. A new tap resumes it."
		]) {
			steps.append(element("li", "", step))
		}
		help.append(element("summary", "", "How it works"), steps)

		root.append(header, controls, help)
		this.root = root
		this.unsubscribe = this.subscribeControls(() => {
			this.renderPlayers()
			this.syncPanel()
			this.updateStatus()
		})
		this.renderPlayers()
		this.syncPanel()
		this.updateStatus()
		return root
	}
	override destroyGui(): void {
		this.unsubscribe?.()
		this.unsubscribe = undefined
		this.root = this.playersRoot = this.status = this.meter = this.addPlayerButton = undefined
		this.timingControls.clear()
		this.partStatuses.clear()
		this.partCues.clear()
		super.destroyGui()
	}
	override destroy(): void {
		this.destroyed = true
		this.revision++
		this.session.reset()
		super.destroy()
	}
}