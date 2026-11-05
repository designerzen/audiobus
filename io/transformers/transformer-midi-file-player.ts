import { TRANSFORMER_CATEGORY_TIMING } from "./transformer-categories.ts"
import { Transformer } from "./abstract-transformer.ts"
import AudioCommand from "../../audio-command.ts"
import * as Commands from "../../commands"
import { Midi } from "@tonejs/midi"
import { EVENT_CHANGE, EVENT_CLICK, EVENT_LOAD, EVENT_ERROR } from "../../event-constants"

import type { Timer } from "netronome"
import type { ITransformer, FieldConfig } from "./interface-transformer.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const ID_MIDI_FILE_PLAYER = "MIDI-File-Player"

interface Config {
	playbackMode: "file" | "step"
	trackIndex: number
	loop: boolean
	midiFileUrl: string
	midiFileName?: string
	enabled: boolean
	// Whether to align the loaded MIDI file to incoming note timing
	alignToIncoming: boolean
	// Time offset to apply to the MIDI file (in seconds)
	timeOffset: number
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
	private fileControls?: HTMLElement
	private syncFiles?: () => void
	private unsubscribeFiles?: () => void
	private loadError = ""

	override getControlValue(id: string) {
		// Uploaded bytes live in the saved configuration, not in the editable URL box.
		if (id === "midiFileUrl" && this.config.midiFileUrl.startsWith("data:")) {
			return ""
		}
		return super.getControlValue(id)
	}

	override async createGui(): Promise<HTMLElement> {
		const gui = await super.createGui()
		if (this.fileControls) {
			return gui
		}
		const controls = document.createElement("div")
		controls.className = "component-control"
		const label = document.createElement("label")
		label.textContent = "Local MIDI songs"
		const select = document.createElement("select")
		const songsByFile = new Map<string, { trackIndex?: number; route?: string }>()
		select.setAttribute("aria-label", "Local MIDI songs")
		const addSong = (name: string, value: string) => {
			const option = document.createElement("option")
			option.textContent = name
			option.value = value
			select.add(option)
		}
		addSong("Choose a local MIDI song…", "")
		label.append(select)
		const upload = document.createElement("button")
		upload.type = "button"
		upload.textContent = "Upload MIDI file"
		const input = document.createElement("input")
		input.type = "file"
		input.accept = ".mid,.midi,audio/midi,audio/x-midi"
		input.hidden = true
		input.setAttribute("aria-label", "Upload MIDI file")
		const status = document.createElement("span")
		status.setAttribute("role", "status")
		const songLink = document.createElement("a")
		songLink.textContent = "Open song preset"
		songLink.hidden = true
		select.addEventListener(EVENT_CHANGE, () => {
			if (select.value) {
				this.setConfig("midiFileUrl", select.value)
				this.setConfig("trackIndex", songsByFile.get(select.value)?.trackIndex ?? -1)
			}
		})
		upload.addEventListener(EVENT_CLICK, () => input.click())
		input.addEventListener(EVENT_CHANGE, () => {
			const file = input.files?.[0]
			if (file) {
				void this.loadMIDIUpload(file).catch((error: Error) => {
					status.textContent = error.message
				})
			}
			input.value = ""
		})
		this.syncFiles = () => {
			select.value = this.config.midiFileUrl
			const route = songsByFile.get(select.value)?.route
			songLink.hidden = !route
			if (route) {
				songLink.href = `${import.meta.env.BASE_URL}${route}/`
			}
			status.textContent = this.isLoading
				? "Loading MIDI file…"
				: this.loadError ||
					(this.midiData
						? `Loaded: ${this.config.midiFileName || select.selectedOptions[0]?.textContent || this.config.midiFileUrl}`
						: "Choose a song or upload a MIDI file.")
		}
		this.unsubscribeFiles = this.subscribeControls(this.syncFiles)
		controls.append(label, upload, input, status, songLink)
		gui.prepend(controls)
		this.fileControls = controls
		this.syncFiles()
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
			this.syncFiles?.()
		} catch {
			select.disabled = true
			select.options[0].textContent = "Local song library unavailable"
		}
		return gui
	}

	override destroyGui(): void {
		this.unsubscribeFiles?.()
		this.unsubscribeFiles = undefined
		this.syncFiles = undefined
		this.fileControls = undefined
		super.destroyGui()
	}

	async loadMIDIUpload(file: File): Promise<void> {
		if (!/\.(mid|midi)$/i.test(file.name)) {
			throw new Error("Choose a .mid or .midi file.")
		}
		const revision = ++this.loadRevision
		this.isLoading = true
		this.loadError = ""
		this.syncFiles?.()
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
				this.syncFiles?.()
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
		return "Replace notes with a MIDI file, or advance its melody one note per key press"
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
				label: "Melody track (-1 = automatic, otherwise zero-based)",
				help: "Automatic chooses a named melody, vocal or lead track, then the first non-drum track with notes.",
				type: "number",
				min: -1,
				max: 255,
				step: 1,
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
		this.syncFiles?.()

		try {
			if (!url) {
				this.midiData = null
				this.midiCommands = []
				this.melody = []
				return
			}
			// Fetch the MIDI file from the URL
			// Public asset paths are relative to the application, including on nested preset pages.
			const resolved = /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(url)
				? url
				: `${import.meta.env.BASE_URL}${url}`
			const response = await fetch(resolved)
			if (!response.ok) {
				throw new Error(`Failed to fetch MIDI file: ${response.statusText}`)
			}

			const arrayBuffer = await response.arrayBuffer()
			if (revision !== this.loadRevision) {
				return
			}

			// Parse MIDI using @tonejs/midi library
			this.midiData = new Midi(arrayBuffer)
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
				this.syncFiles?.()
			}
		}
	}

	/**
	 * Extract NOTE_ON and NOTE_OFF commands from the loaded MIDI data
	 */
	private extractMIDICommands(): void {
		this.midiCommands = []

		if (!this.midiData || !this.midiData.tracks || this.midiData.tracks.length === 0) {
			return
		}

		// Process all tracks and extract note events
		for (const track of this.midiData.tracks) {
			if (!track.notes || track.notes.length === 0) {
				continue
			}

			for (const note of track.notes) {
				// Create NOTE_ON command
				const noteOn = new AudioCommand()
				noteOn.type = Commands.NOTE_ON
				noteOn.subtype = "Note on"
				noteOn.number = note.midi
				// @tonejs/midi uses 0-1 for velocity, convert to 0-127
				noteOn.velocity = Math.round((note.velocity || 0.5) * 127)
				noteOn.startAt = note.time
				noteOn.time = note.time
				this.midiCommands.push(noteOn)

				// Create NOTE_OFF command
				const noteOff = new AudioCommand()
				noteOff.type = Commands.NOTE_OFF
				noteOff.subtype = "Note off"
				noteOff.number = note.midi
				noteOff.velocity = 0
				noteOff.startAt = note.time + note.duration
				noteOff.time = note.time + note.duration
				this.midiCommands.push(noteOff)
			}
		}

		// Sort commands by start time
		this.midiCommands.sort((a, b) => a.startAt - b.startAt)
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
			const newCmd = new AudioCommand()

			// Copy MIDI command properties
			newCmd.type = midiCmd.type
			newCmd.subtype = midiCmd.subtype
			newCmd.number = midiCmd.number
			newCmd.velocity = midiCmd.velocity
			newCmd.value = midiCmd.value
			newCmd.pitchBend = midiCmd.pitchBend
			newCmd.time = midiCmd.time
			newCmd.timeCode = midiCmd.timeCode
			newCmd.text = midiCmd.text

			// Schedule relative to the first incoming NOTE_ON
			newCmd.startAt = midiStartTime + midiCmd.startAt
			newCmd.endAt = midiCmd.endAt

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