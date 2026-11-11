import { notifyControlSchema } from "../component-ui"
import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { Transformer } from "./abstract-transformer.ts"
import AudioCommand from "../../commands/audio-command.ts"
import * as Commands from "../../commands/commands"
import { Midi } from "@tonejs/midi"
import { loadMidi, midiSong } from "../midi-song"
import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_LOAD,
	EVENT_ERROR,
	EVENT_KEY_DOWN,
	EVENT_DRAG_OVER,
	EVENT_DRAG_LEAVE,
	EVENT_DROP
} from "../../events/event-constants"

import type { Timer } from "netronome"
import type { ITransformer, FieldConfig } from "./interface-transformer.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"

export const ID_MIDI_FILE_PLAYER = "MIDI-File-Player"

interface Config {
	playbackMode: "file" | "step"
	trackIndex: number
	loop: boolean
	midiFileUrl: string
	midiFileName?: string
	// BitMidi search shown when the GUI opens, such as from a /play/{artist}/{title} link
	searchQuery?: string
	enabled: boolean
	// Whether to align the loaded MIDI file to incoming note timing
	alignToIncoming: boolean
	// Time offset to apply to the MIDI file (in seconds)
	timeOffset: number
}

export const BITMIDI_ORIGIN = "https://bitmidi.com"

export interface BitMidiResult {
	name: string
	downloadUrl: string
	url: string
}

export interface BitMidiSearch {
	results: BitMidiResult[]
	total: number
	pageTotal: number
}

const fetchBitMidi = async (query: string, page: number): Promise<BitMidiSearch> => {
	const response = await fetch(
		`${BITMIDI_ORIGIN}/api/midi/search?q=${encodeURIComponent(query)}&page=${page}`
	)
	if (!response.ok) {
		throw new Error("BitMidi search unavailable")
	}
	const { result } = await response.json()
	return {
		results: result.results.map(({ name, downloadUrl, url }: BitMidiResult) => ({
			name,
			downloadUrl: new URL(downloadUrl, BITMIDI_ORIGIN).href,
			url: new URL(url, BITMIDI_ORIGIN).href
		})),
		total: result.total,
		pageTotal: result.pageTotal
	}
}

/**
 * Search BitMidi titles. BitMidi matches any query word, so misspelt queries
 * with no matches retry using each word's opening letters to find similar titles.
 */
export async function searchBitMidi(query: string, page = 0): Promise<BitMidiSearch> {
	const words = query.trim().split(/\s+/).filter(Boolean)
	const found = await fetchBitMidi(words.join(" "), page)
	const similar = words.map((word) => word.slice(0, 4)).join(" ")
	return found.total || similar === words.join(" ") ? found : fetchBitMidi(similar, page)
}

const DEFAULT_OPTIONS: Config = {
	playbackMode: "file",
	trackIndex: -1,
	loop: true,
	midiFileUrl: "",
	enabled: true,
	alignToIncoming: true,
	timeOffset: 0
}

/**
 * MIDI File Player Transformer
 *
 * Loads a MIDI file and replaces incoming NOTE_ON/NOTE_OFF commands
 * with the notes from the MIDI file. Plays the MIDI file in place of
 * the provided commands.
 *
 * When a NOTE_ON is received, it triggers playback of the loaded MIDI file.
 * The file's timing is maintained relative to the first incoming command.
 * Step mode advances the selected melody track per key press and maps each
 * key release back to its assigned melody pitch, wrapping when looping is on.
 */
export class TransformerMIDIFilePlayer extends Transformer<Config> implements ITransformer {
	type = ID_MIDI_FILE_PLAYER

	private midiData: Midi | null = null
	private midiCommands: IAudioCommand[] = []
	private isLoading = false
	private loadRevision = 0
	private cursor = 0
	private melody: { midi: number; velocity: number }[] = []
	private heldNotes = new Map<string, IAudioCommand>()
	private gui?: HTMLElement
	private sync?: () => void
	private unsubscribe?: () => void
	private loadError = ""

	override getControlValue(id: string) {
		// Uploaded bytes live in the saved configuration, not in the editable URL box.
		if (id === "midiFileUrl" && this.config.midiFileUrl.startsWith("data:")) {
			return ""
		}
		return super.getControlValue(id)
	}

	/**
	 * One source mode is shown at a time (library, BitMidi search or upload),
	 * followed by the loaded song and the three playback settings.
	 */
	override async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
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
		const option = (text: string, value: string) => {
			const node = element("option", "", text)
			node.value = value
			return node
		}
		const field = (text: string, control: HTMLElement) => {
			const label = element("label", "midi-file-player-field")
			label.append(element("span", "", text), control)
			return label
		}
		const gui = element("div", "transformer-controls midi-file-player")

		// Library
		const library = element("div", "midi-file-player-panel")
		const select = element("select")
		const songsByFile = new Map<string, { trackIndex?: number; route?: string }>()
		select.setAttribute("aria-label", "Local MIDI songs")
		const addSong = (name: string, value: string) => select.add(option(name, value))
		addSong("Choose a song…", "")
		const songLink = element("a", "midi-file-player-link", "Open song preset")
		songLink.hidden = true
		select.addEventListener(EVENT_CHANGE, () => {
			if (select.value) {
				this.setConfig("midiFileUrl", select.value)
				this.setConfig("trackIndex", songsByFile.get(select.value)?.trackIndex ?? -1)
			}
		})
		library.append(select, songLink)

		// Upload
		const upload = element("div", "midi-file-player-panel")
		const drop = element("button", "midi-file-player-drop", "Upload MIDI file")
		drop.type = "button"
		const input = element("input")
		input.type = "file"
		input.accept = ".mid,.midi,audio/midi,audio/x-midi"
		input.hidden = true
		input.setAttribute("aria-label", "Upload MIDI file")
		const loadFile = (file?: File) => {
			if (file) {
				void this.loadMIDIUpload(file).catch((error: Error) => {
					this.loadError = error.message
					this.sync?.()
				})
			}
		}
		drop.addEventListener(EVENT_CLICK, () => input.click())
		drop.addEventListener(EVENT_DRAG_OVER, (event) => {
			event.preventDefault()
			drop.classList.add("is-dragging")
		})
		drop.addEventListener(EVENT_DRAG_LEAVE, () => drop.classList.remove("is-dragging"))
		drop.addEventListener(EVENT_DROP, (event) => {
			event.preventDefault()
			drop.classList.remove("is-dragging")
			loadFile((event as DragEvent).dataTransfer?.files[0])
		})
		input.addEventListener(EVENT_CHANGE, () => {
			loadFile(input.files?.[0])
			input.value = ""
		})
		upload.append(drop, input, element("small", "", "or drop a .mid file here"))

		// Source modes
		const panels = { library, search: this.createBitMidiSearch(), upload }
		type Mode = keyof typeof panels
		const tabs = element("div", "midi-file-player-modes")
		tabs.setAttribute("role", "tablist")
		tabs.setAttribute("aria-label", "MIDI source")
		const tabButtons = new Map<Mode, HTMLButtonElement>()
		const showMode = (mode: Mode) => {
			for (const [key, tab] of tabButtons) {
				tab.setAttribute("aria-selected", String(key === mode))
				panels[key].hidden = key !== mode
			}
		}
		for (const [mode, text] of [
			["library", "Library"],
			["search", "Search"],
			["upload", "Upload"]
		] as [Mode, string][]) {
			const tab = element("button", "", text)
			tab.type = "button"
			tab.setAttribute("role", "tab")
			tab.addEventListener(EVENT_CLICK, () => showMode(mode))
			tabButtons.set(mode, tab)
			tabs.append(tab)
		}
		const url = this.config.midiFileUrl
		showMode(
			this.config.searchQuery || /^https?:/.test(url)
				? "search"
				: url.startsWith("data:")
					? "upload"
					: "library"
		)

		// Loaded song
		const status = element("p", "midi-file-player-status")
		status.setAttribute("role", "status")

		// Settings
		const playback = element("select")
		playback.setAttribute("aria-label", "Playback")
		playback.add(option("Whole file", "file"))
		playback.add(option("One note per key", "step"))
		playback.addEventListener(EVENT_CHANGE, () =>
			this.setControlValue("playbackMode", playback.value)
		)
		const track = element("select")
		track.setAttribute("aria-label", "Melody track")
		track.title =
			"Auto chooses a named melody, vocal or lead track, then the first non-drum track with notes."
		track.addEventListener(EVENT_CHANGE, () =>
			this.setControlValue("trackIndex", Number(track.value))
		)
		const loop = element("input")
		loop.type = "checkbox"
		loop.addEventListener(EVENT_CHANGE, () =>
			this.setControlValue("loop", loop.checked ? 1 : 0)
		)
		const repeat = element("label", "midi-file-player-check")
		repeat.append(loop, element("span", "", "Repeat"))
		const settings = element("div", "midi-file-player-settings")
		settings.append(field("Playback", playback), field("Track", track), repeat)

		this.sync = () => {
			select.value = songsByFile.has(this.config.midiFileUrl) ? this.config.midiFileUrl : ""
			const route = songsByFile.get(select.value)?.route
			songLink.hidden = !route
			if (route) {
				songLink.href = `${import.meta.env.BASE_URL}${route}/`
			}
			status.classList.toggle("is-error", !!this.loadError)
			status.textContent = this.isLoading
				? "Loading MIDI file…"
				: this.loadError ||
					(this.midiData
						? `Loaded: ${this.config.midiFileName || select.selectedOptions[0]?.textContent || this.config.midiFileUrl}`
						: "No song loaded")
			playback.value = this.config.playbackMode
			track.replaceChildren(option("Auto", "-1"))
			for (const [index, { name, notes }] of (this.midiData?.tracks ?? []).entries()) {
				if (notes.length) {
					track.add(
						option(`${index + 1} · ${name || `Track ${index + 1}`}`, String(index))
					)
				}
			}
			track.value = String(this.config.trackIndex)
			track.disabled = !this.midiData
			loop.checked = !!Number(this.config.loop)
		}
		this.unsubscribe = this.subscribeControls(this.sync)
		gui.append(tabs, ...Object.values(panels), status, settings)
		this.gui = gui
		this.sync()
		try {
			const response = await fetch(`${import.meta.env.BASE_URL}midi/index.json`)
			if (!response.ok) {
				throw new Error("Song library unavailable")
			}
			const songs: { name: string; file: string; trackIndex?: number; route?: string }[] =
				await response.json()
			for (const song of songs) {
				songsByFile.set(`midi/${song.file}`, song)
				addSong(song.name, `midi/${song.file}`)
			}
			this.sync?.()
		} catch {
			select.disabled = true
			select.options[0].textContent = "Song library unavailable"
		}
		return gui
	}

	private createBitMidiSearch(): HTMLElement {
		const search = document.createElement("div")
		search.className = "midi-file-player-panel"
		const form = document.createElement("div")
		form.className = "midi-file-player-search"
		const query = document.createElement("input")
		query.type = "search"
		query.placeholder = "Artist or song…"
		query.setAttribute("aria-label", "Search BitMidi")
		const find = document.createElement("button")
		find.type = "button"
		find.textContent = "Search"
		form.append(query, find)
		const summary = document.createElement("small")
		summary.setAttribute("aria-live", "polite")
		const results = document.createElement("ul")
		results.className = "midi-file-player-results"
		results.setAttribute("aria-label", "BitMidi results")
		const more = document.createElement("button")
		more.type = "button"
		more.textContent = "More results"
		more.hidden = true
		const credit = document.createElement("a")
		credit.className = "midi-file-player-link"
		credit.href = BITMIDI_ORIGIN
		credit.target = "_blank"
		credit.rel = "noopener noreferrer"
		credit.textContent = "Songs from BitMidi"
		let term = ""
		let page = 0
		let revision = 0
		const show = async (next: number) => {
			const current = ++revision
			summary.textContent = "Searching…"
			more.hidden = true
			try {
				const found = await searchBitMidi(term, next)
				if (current !== revision) {
					return
				}
				page = next
				for (const song of found.results) {
					const item = document.createElement("li")
					const choose = document.createElement("button")
					choose.type = "button"
					choose.textContent = song.name.replace(/\.midi?$/i, "")
					choose.title = song.name
					choose.addEventListener(EVENT_CLICK, () => {
						results.querySelector("[aria-current]")?.removeAttribute("aria-current")
						choose.setAttribute("aria-current", "true")
						this.setConfig("trackIndex", -1)
						this.setConfig("midiFileUrl", song.downloadUrl)
						super.setConfig("midiFileName", song.name)
						this.sync?.()
					})
					item.append(choose)
					results.append(item)
				}
				summary.textContent = found.total
					? `${found.total} matches`
					: "No matching or similar BitMidi songs."
				more.hidden = page + 1 >= found.pageTotal
			} catch (error) {
				if (current === revision) {
					summary.textContent = (error as Error).message
				}
			}
		}
		const start = () => {
			term = query.value.trim()
			results.replaceChildren()
			if (term) {
				super.setConfig("searchQuery", term)
				void show(0)
			}
		}
		find.addEventListener(EVENT_CLICK, start)
		query.addEventListener(EVENT_KEY_DOWN, (event) => {
			if ((event as KeyboardEvent).key === "Enter") {
				event.preventDefault()
				start()
			}
		})
		more.addEventListener(EVENT_CLICK, () => void show(page + 1))
		search.append(form, summary, results, more, credit)
		if (this.config.searchQuery) {
			query.value = this.config.searchQuery
			start()
		}
		return search
	}

	override destroyGui(): void {
		this.unsubscribe?.()
		this.unsubscribe = undefined
		this.sync = undefined
		this.gui = undefined
		super.destroyGui()
	}

	async loadMIDIUpload(file: File): Promise<void> {
		if (!/\.(mid|midi)$/i.test(file.name)) {
			throw new Error("Choose a .mid or .midi file.")
		}
		const revision = ++this.loadRevision
		this.isLoading = true
		this.loadError = ""
		this.sync?.()
		const url = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.addEventListener(EVENT_LOAD, () => resolve(String(reader.result)))
			reader.addEventListener(EVENT_ERROR, () =>
				reject(new Error("Unable to read MIDI file."))
			)
			reader.readAsDataURL(file)
		}).catch((error: Error) => {
			if (revision === this.loadRevision) {
				this.isLoading = false
				this.loadError = error.message
				this.sync?.()
			}
			throw error
		})
		if (revision !== this.loadRevision) {
			return
		}
		this.setConfig("trackIndex", -1)
		super.setConfig("midiFileName", file.name)
		await this.loadMIDIFile(url)
	}

	get name(): string {
		return "MIDI File Player"
	}

	get description(): string {
		return "Replace notes with a MIDI file, or advance its melody one note per key press. Search songs from BitMidi (https://bitmidi.com)"
	}

	category = TRANSFORMER_CATEGORY_TIMING

	get fields(): FieldConfig[] {
		return [
			{
				name: "playbackMode",
				label: "Playback",
				type: "select",
				values: [
					{ name: "Whole file", value: "file" },
					{ name: "Next melody note per key press", value: "step" }
				],
				default: DEFAULT_OPTIONS.playbackMode
			},
			{
				name: "trackIndex",
				label: "Melody track",
				help: "Automatic chooses a named melody, vocal or lead track, then the first non-drum track with notes.",
				type: "select",
				values: [
					{ name: "Auto", value: -1 },
					...(this.midiData?.tracks ?? []).flatMap((track, index) =>
						track.notes.length
							? [
									{
										name: `${index + 1} · ${track.name || `Track ${index + 1}`}`,
										value: index
									}
								]
							: []
					)
				],
				default: DEFAULT_OPTIONS.trackIndex
			},
			{
				name: "loop",
				label: "Repeat melody",
				type: "select",
				values: [
					{ name: "Yes", value: 1 },
					{ name: "No", value: 0 }
				],
				default: 1
			},
			{
				name: "enabled",
				type: "select",
				enabled: true,
				values: [
					{ name: "On", value: 1 },
					{ name: "Off", value: 0 }
				],
				default: 1
			},
			{
				name: "midiFileUrl",
				type: "text",
				enabled: true,
				values: [],
				default: DEFAULT_OPTIONS.midiFileUrl
			},
			{
				name: "alignToIncoming",
				type: "select",
				enabled: true,
				values: [
					{ name: "Yes", value: 1 },
					{ name: "No", value: 0 }
				],
				default: 1
			},
			{
				name: "timeOffset",
				type: "slider",
				enabled: true,
				values: [],
				default: DEFAULT_OPTIONS.timeOffset
			}
		]
	}

	constructor(config: Partial<Config> = {}) {
		super({ ...DEFAULT_OPTIONS, ...config })

		// Load the MIDI file if URL is provided
		if (this.config.midiFileUrl) {
			this.loadMIDIFile(this.config.midiFileUrl)
		}
	}

	override setConfig(key: string, value: unknown): void {
		if (key === "midiFileUrl") {
			super.setConfig("midiFileName", "")
		}
		super.setConfig(key, value)
		if (key === "midiFileUrl") {
			void this.loadMIDIFile(String(value ?? ""))
		} else if (key === "trackIndex" && this.midiData) {
			this.selectMelody()
		} else if (key === "playbackMode" && this.heldNotes) {
			this.cursor = 0
		}
	}

	private selectMelody(): void {
		const tracks = this.midiData?.tracks ?? []
		const melodic = tracks.filter((track) => track.channel !== 9 && track.notes.length > 0)
		const track =
			this.config.trackIndex >= 0
				? tracks[this.config.trackIndex]
				: (melodic.find((track) => /melody|vocal|lead/i.test(track.name)) ?? melodic[0])
		this.melody = (track?.notes ?? [])
			.slice()
			.sort((a, b) => a.time - b.time)
			.map((note) => ({ midi: note.midi, velocity: Math.round(note.velocity * 127) }))
		this.cursor = 0
	}

	/** One press advances one note; its release belongs to the pitch assigned to that press. */
	private stepMelody(commands: IAudioCommand[]): IAudioCommand[] {
		const result: IAudioCommand[] = []
		for (const command of commands) {
			const key = JSON.stringify([command.from, command.channel, command.number])
			const release =
				command.type === Commands.NOTE_OFF ||
				(command.type === Commands.NOTE_ON && command.velocity === 0)
			if (command.type !== Commands.NOTE_ON && !release) {
				result.push(command)
				continue
			}
			const now = (command.startAt ?? command.time ?? 0) + this.config.timeOffset
			const held = this.heldNotes.get(key)
			if (held) {
				result.push(
					Object.assign(new AudioCommand(), {
						type: Commands.NOTE_OFF,
						number: held.number,
						channel: held.channel,
						from: held.from,
						velocity: 0,
						startAt: now,
						time: now
					})
				)
				this.heldNotes.delete(key)
			}
			if (!this.config.enabled) {
				if (!release || !held) {
					result.push(command)
				}
				continue
			}
			if (release || this.isLoading || !this.melody.length) {
				continue
			}
			if (this.cursor >= this.melody.length) {
				if (!this.config.loop) {
					continue
				}
				this.cursor = 0
			}
			const note = this.melody[this.cursor++]
			const output = Object.assign(new AudioCommand(), {
				type: Commands.NOTE_ON,
				number: note.midi,
				channel: command.channel || 1,
				velocity: command.velocity ?? note.velocity,
				from: command.from,
				startAt: now,
				time: now
			})
			this.heldNotes.set(key, Object.assign(new AudioCommand(), output))
			result.push(output)
		}
		return result
	}

	/**
	 * Load a MIDI file from the given URL
	 */
	async loadMIDIFile(url: string): Promise<void> {
		const revision = ++this.loadRevision
		this.isLoading = true
		this.loadError = ""
		this.sync?.()

		try {
			if (!url) {
				this.midiData = null
				this.midiCommands = []
				this.melody = []
				return
			}
			const midi = await loadMidi(url)
			if (revision !== this.loadRevision) {
				return
			}

			// Parse MIDI using @tonejs/midi library
			this.midiData = midi
			if (!this.midiData.tracks.some((track) => track.notes.length)) {
				throw new Error("MIDI file contains no playable notes")
			}

			// Extract NOTE_ON and NOTE_OFF commands from the loaded data
			this.extractMIDICommands()
			this.selectMelody()

			super.setConfig("midiFileUrl", url)
		} catch (error) {
			if (revision !== this.loadRevision) {
				return
			}
			console.error("Failed to load MIDI file:", error)
			this.loadError = "Unable to load MIDI file. Choose a valid MIDI file or another song."
			this.midiData = null
			this.midiCommands = []
			this.melody = []
		} finally {
			if (revision === this.loadRevision) {
				this.isLoading = false
				this.sync?.()
				notifyControlSchema(this)
			}
		}
	}

	/**
	 * Extract NOTE_ON and NOTE_OFF commands from the loaded MIDI data
	 */
	private extractMIDICommands(): void {
		this.midiCommands = this.midiData
			? midiSong(this.midiData).events.map((event) => event.command)
			: []
	}

	/**
	 * Transform incoming commands by replacing NOTE_ON/OFF with MIDI file notes
	 */
	transform(commands: IAudioCommand[], _timer: Timer): IAudioCommand[] {
		if (this.config.playbackMode === "step") {
			return this.stepMelody(commands)
		}
		const releases: IAudioCommand[] = []
		const remaining = commands.filter((command) => {
			const key = JSON.stringify([command.from, command.channel, command.number])
			const held = this.heldNotes.get(key)
			if (
				!held ||
				!(
					command.type === Commands.NOTE_OFF ||
					(command.type === Commands.NOTE_ON && command.velocity === 0)
				)
			) {
				return true
			}
			const now = (command.startAt ?? command.time ?? 0) + this.config.timeOffset
			releases.push(
				Object.assign(new AudioCommand(), {
					type: Commands.NOTE_OFF,
					number: held.number,
					channel: held.channel,
					from: held.from,
					velocity: 0,
					startAt: now,
					time: now
				})
			)
			this.heldNotes.delete(key)
			return false
		})
		return [...releases, ...this.playFile(remaining)].sort((a, b) => a.startAt - b.startAt)
	}

	private playFile(commands: IAudioCommand[]): IAudioCommand[] {
		if (!this.config.enabled || this.midiCommands.length === 0 || this.isLoading) {
			return commands
		}

		const transformed: IAudioCommand[] = []
		let midiStartTime = 0
		let hasNoteOn = false

		// First pass: identify where the MIDI file should start
		for (const command of commands) {
			if (command.type === Commands.NOTE_ON) {
				hasNoteOn = true
				midiStartTime = command.startAt || command.time || 0
				break
			}
		}

		// If no NOTE_ON found, just pass through
		if (!hasNoteOn) {
			return commands
		}

		// Add time offset
		midiStartTime += this.config.timeOffset

		// Generate MIDI commands from the loaded file
		for (const midiCmd of this.midiCommands) {
			const newCmd = Object.assign(new AudioCommand(), midiCmd, {
				startAt: midiStartTime + midiCmd.startAt,
				time: midiStartTime + midiCmd.startAt
			})

			transformed.push(newCmd)
		}

		// Pass through any non-NOTE_ON/OFF commands from the input
		for (const command of commands) {
			if (command.type !== Commands.NOTE_ON && command.type !== Commands.NOTE_OFF) {
				transformed.push(command)
			}
		}

		// Sort by startAt to maintain proper timing
		transformed.sort((a, b) => {
			const timeA = a.startAt || a.time || 0
			const timeB = b.startAt || b.time || 0
			return timeA - timeB
		})

		return transformed
	}

	/**
	 * Reset the transformer state
	 */
	reset(): void {
		this.cursor = 0
		this.heldNotes.clear()
	}

	/**
	 * Cleanup resources
	 */
	destroy(): void {
		this.loadRevision++
		this.reset()
		super.destroy()
		this.midiData = null
		this.midiCommands = []
		this.melody = []
	}
}