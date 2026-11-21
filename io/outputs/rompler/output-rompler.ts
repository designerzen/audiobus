import type { IAudioCommand } from "../../../commands/audio-command-interface"
import type { IAudioOutput } from "../output-interface"
import {
	NOTE_ON,
	NOTE_OFF,
	CONTROL_CHANGE,
	PITCH_BEND,
	PROGRAM_CHANGE,
	MIDI_STOP,
	PLAYBACK_STOP
} from "../../../commands/commands"
import { getAudioDestination } from "../../audio-destination"
import { bounded, changed } from "../../device-controls"
import { musicalCommand } from "../../event-clip"
import {
	HIGHEST_NOTE,
	LOWEST_NOTE,
	ROMPLER_HOST,
	ROMPLER_SPACINGS,
	isSustained,
	presetFamily,
	presetTitle,
	sampleGrid,
	sampleUrl
} from "./rompler-catalogue"
import { RomplerGui, type RomplerEntry, type RomplerView } from "./rompler-gui"
import {
	RomplerLoader,
	streamTask,
	toPCM,
	type RomplerProgress,
	type RomplerSample,
	type RomplerTask
} from "./rompler-loader"
import {
	STREAMED_SOURCE,
	sourceName,
	acquireSource,
	rememberFile,
	type SourceLease,
	type RomplerSource
} from "./rompler-source"
import { decodeDataUrl, findPreset, waveData, type SoundFontBank } from "./soundfont-file"

// A plain URL rather than a bundler-specific import, so Vite and Parcel both emit the worklet as its own file.
const processorURL = new URL("./rompler.worklet.js", import.meta.url).href

const registrations = new WeakMap<BaseAudioContext, Promise<void>>()

const nearestIn = (keys: number[], note: number): number => {
	let key = keys[0]
	for (const candidate of keys) {
		if (Math.abs(candidate - note) < Math.abs(key - note)) {
			key = candidate
		}
	}
	return key
}

const megabytes = (bytes: number) => (bytes / 1048576).toFixed(1)

/**
 * General MIDI soundfont player. Nothing downloads until the output is
 * connected or played; samples then stream in around the notes in use and
 * play the moment they land, with gaps pitched from the nearest sample.
 * It can instead play a whole soundfont file (.sf2, .sf3 or a MIDI.js
 * pack) from a URL or from disk, preparing only the selected preset's
 * samples, nearest to the notes in use first.
 */
export default class Rompler extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-Rompler-${crypto.randomUUID()}`
	readonly name = "Rompler"
	readonly description = "General MIDI soundfont instruments that stream in as you play"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly output: GainNode
	readonly options: {
		preset: number
		// Bank of the preset within a soundfont file; 128 holds drum kits
		bank: number
		// URL or stored file to play instead of streaming OpenGM24; empty to stream
		soundfont: string
		baseUrl: string
		spacing: number
		volume: number
		release: number
		pitchBendRange: number
	}
	private readonly context: AudioContext
	private readonly loader: RomplerLoader<any>
	private node?: AudioWorkletNode
	private starting?: Promise<AudioWorkletNode>
	private grid: number[] = []
	private stale = false
	private progress: RomplerProgress = { loaded: 0, failed: 0, total: 0 }
	private volumes = new Float32Array(16).fill(1)
	private expressions = new Float32Array(16).fill(1)
	private sustained = new Set<number>()
	private released = new Set<string>()
	private connected = true
	private destroyed = false
	private gui?: RomplerGui
	// Keys of the current preset that have arrived, so a panel opened later can show them
	private loadedNotes = new Set<number>()
	private sampledNotes: number[] = []
	private source: RomplerSource = STREAMED_SOURCE
	private sourceKey = ""
	private opening?: { key: string; lease: SourceLease }
	// Hold on the soundfont file being played, shared with other Romplers playing it
	private lease?: SourceLease
	private downloaded?: { received: number; total: number }
	private problem?: string
	// Waves from the current bank that the worklet already holds
	private sentWaves = new Set<number>()
	private freshSource = false
	// How the current source finds the jobs behind a key and hands over their results
	private demand: (note: number) => number[] = (note) => [this.nearest(note)]
	private deliver: (id: number, result: any) => void = () => {}

	constructor(options: Record<string, any> = {}) {
		super()
		if (!options.audioContext) {
			throw Error("Rompler requires an audio context")
		}
		this.context = options.audioContext
		this.options = {
			preset: Math.round(bounded(options.preset, 0, 0, 127)),
			bank: Math.round(bounded(options.bank, 0, 0, 16383)),
			soundfont: typeof options.soundfont === "string" ? options.soundfont : "",
			baseUrl:
				typeof options.baseUrl === "string" && options.baseUrl.endsWith("/")
					? options.baseUrl
					: ROMPLER_HOST,
			spacing: ROMPLER_SPACINGS.includes(options.spacing) ? options.spacing : 3,
			volume: bounded(options.volume, 0.8, 0, 2),
			release: bounded(options.release, 0.3, 0.005, 5),
			pitchBendRange: bounded(options.pitchBendRange, 2, 0, 24)
		}
		this.grid = sampleGrid(this.options.spacing)
		this.output = this.context.createGain()
		this.output.gain.value = this.options.volume
		this.output.connect(options.mixer ?? getAudioDestination(this.context))
		this.loader = new RomplerLoader(
			(id, result) => this.deliver(id, result),
			(progress) => {
				this.progress = progress
				this.renderStatus()
			}
		)
	}
	get isConnected(): boolean {
		return this.connected && !this.destroyed
	}
	get loading(): boolean {
		return !!this.node && !this.loader.complete
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}
	getNoteKey(command: IAudioCommand): string {
		return `${command.channel}:${command.number}`
	}
	private initialize(): Promise<AudioWorkletNode> {
		if (this.destroyed) {
			return Promise.reject(Error("Rompler has been destroyed"))
		}
		if (this.node) {
			return Promise.resolve(this.node)
		}
		return (this.starting ??= (async () => {
			if (!this.context.audioWorklet) {
				throw Error("The Rompler requires AudioWorklet support and a secure connection")
			}
			if (!registrations.has(this.context)) {
				const pending = this.context.audioWorklet.addModule(processorURL)
				registrations.set(this.context, pending)
				pending.catch(() => registrations.delete(this.context))
			}
			await registrations.get(this.context)
			if (this.destroyed) {
				throw Error("Rompler has been destroyed")
			}
			const node = new AudioWorkletNode(this.context, "harmoneasy-rompler", {
				numberOfInputs: 0,
				numberOfOutputs: 1,
				outputChannelCount: [2]
			})
			node.onprocessorerror = () => this.allNotesOff()
			node.connect(this.output)
			node.port.postMessage({ type: "release", value: this.options.release })
			this.node = node
			this.reload()
			return node
		})().finally(() => {
			this.starting = undefined
		}))
	}
	/** Swap presets without a silent gap: old samples play until the first new one arrives */
	private reload(): void {
		if (!this.node) {
			return
		}
		if (this.options.soundfont !== this.sourceKey) {
			if (this.opening?.key !== this.options.soundfont) {
				void this.open(this.options.soundfont)
			}
			return
		}
		this.loadedNotes.clear()
		const source = this.source
		if (source.kind === "bank") {
			this.reloadBank(source.bank)
			return
		}
		const { baseUrl, preset, spacing } = this.options
		let keys = this.grid
		if (source.kind === "pack") {
			const notes = [...source.pack.keys()]
			const spaced = notes.filter((note) => (note - 60) % spacing === 0)
			keys = spaced.length ? spaced : notes
		}
		this.stale = true
		this.sampledNotes = keys
		this.gui?.resetSamples(keys)
		this.demand = (note) => [nearestIn(keys, note)]
		this.deliver = (_, sample: RomplerSample) => {
			this.loadedNotes.add(sample.note)
			this.gui?.sampleLoaded(sample.note)
			if (this.stale) {
				this.stale = false
				this.sentWaves.clear()
				this.post({ type: "clear" })
			}
			this.node?.port.postMessage(
				{ type: "sample", ...sample },
				sample.channels.map((channel) => channel.buffer)
			)
		}
		const task: RomplerTask<RomplerSample> =
			source.kind === "pack"
				? async (note, signal) => {
						const audio = await this.context.decodeAudioData(
							decodeDataUrl(source.pack.get(note)!)
						)
						signal.throwIfAborted()
						return { note, ...toPCM(audio, false) }
					}
				: streamTask(
						this.context,
						(note) => sampleUrl(baseUrl, preset, note),
						isSustained(preset)
					)
		this.loader.load(
			keys.map((note) => ({ id: note, key: note })),
			task
		)
	}
	/** Sends the preset's zones at once, then its waves nearest the notes in use first */
	private reloadBank(bank: SoundFontBank): void {
		const preset = bank.presets[findPreset(bank, this.options.preset, this.options.bank)]
		const regions = preset?.regions ?? []
		this.stale = false
		if (this.freshSource) {
			this.freshSource = false
			this.post({ type: "clear" })
		}
		this.post({ type: "regions", regions })
		const keysOf = new Map<number, number[]>()
		const roots = new Map<number, number[]>()
		for (const region of regions) {
			const keys = keysOf.get(region.wave) ?? []
			for (
				let note = Math.max(LOWEST_NOTE, region.low);
				note <= Math.min(HIGHEST_NOTE, region.high);
				note++
			) {
				keys.push(note)
			}
			keysOf.set(region.wave, keys)
			roots.set(region.wave, [...(roots.get(region.wave) ?? []), region.root])
		}
		for (const id of this.sentWaves) {
			if (!keysOf.has(id)) {
				this.sentWaves.delete(id)
			}
		}
		this.sampledNotes = [...new Set([...keysOf.values()].flat())]
		this.gui?.resetSamples(this.sampledNotes)
		const loaded = (id: number) => {
			for (const note of keysOf.get(id) ?? []) {
				this.loadedNotes.add(note)
				this.gui?.sampleLoaded(note)
			}
		}
		this.sentWaves.forEach(loaded)
		this.demand = (note) =>
			regions.filter(({ low, high }) => note >= low && note <= high).map(({ wave }) => wave)
		this.deliver = (id, wave: Awaited<ReturnType<typeof waveData>>) => {
			this.sentWaves.add(id)
			loaded(id)
			this.node?.port.postMessage({ type: "wave", id, ...wave }, [wave.data.buffer])
		}
		this.loader.load(
			[...roots]
				.filter(([id]) => !this.sentWaves.has(id))
				.map(([id, list]) => ({
					id,
					key: list.reduce((sum, root) => sum + root, 0) / list.length
				})),
			async (id, signal) => {
				const wave = await waveData(bank, id, this.context)
				signal.throwIfAborted()
				return wave
			}
		)
	}
	/** Downloads or reads a soundfont file, keeping the current sounds until it is ready */
	private async open(key: string): Promise<void> {
		this.opening?.lease.release()
		const lease = acquireSource(key, (received, total) => {
			if (this.opening === opening) {
				this.downloaded = { received, total }
				this.renderStatus()
			}
		})
		const opening = { key, lease }
		this.opening = opening
		this.problem = undefined
		this.downloaded = { received: 0, total: 0 }
		this.renderStatus()
		let source: RomplerSource | undefined
		try {
			source = await lease.source
		} catch (error) {
			lease.release()
			if (this.opening === opening) {
				// Carry on with the sounds already loaded rather than falling silent
				this.problem = `Could not open ${sourceName(key)}: ${error instanceof Error ? error.message : String(error)}`
			}
		}
		if (this.opening !== opening || this.destroyed) {
			return
		}
		this.opening = undefined
		this.downloaded = undefined
		this.sourceKey = key
		if (source) {
			this.lease?.release()
			this.lease = lease
			this.source = source
			this.freshSource = true
			this.sentWaves.clear()
		}
		this.gui?.setView(this.view())
		this.reload()
		this.renderStatus()
	}
	/** Plays a soundfont file from a URL, a file from disk, or streamed OpenGM24 when empty */
	async setSoundFont(source: string | File): Promise<void> {
		const key = typeof source === "string" ? source.trim() : await rememberFile(source)
		if (key === this.options.soundfont && key === this.sourceKey) {
			return
		}
		this.options.soundfont = key
		this.options.bank = 0
		this.problem = undefined
		if (this.node) {
			this.reload()
		} else {
			// Choosing a file is explicit, so it opens now rather than on the first note
			void this.initialize().catch(() => {})
		}
		changed(this)
	}
	private nearest(note: number): number {
		let key = this.grid[0]
		for (const candidate of this.grid) {
			if (Math.abs(candidate - note) < Math.abs(key - note)) {
				key = candidate
			}
		}
		return key
	}
	setPreset(preset: number, bank = this.options.bank): void {
		preset = Math.round(bounded(preset, this.options.preset, 0, 127))
		if (preset === this.options.preset && bank === this.options.bank) {
			return
		}
		this.options.preset = preset
		this.options.bank = bank
		this.gui?.setSelected(this.selected())
		this.reload()
		changed(this)
	}
	/** The list entry the panel highlights: a GM program, or a preset of the open file */
	private selected(): number {
		const { source } = this
		return source.kind === "bank"
			? findPreset(source.bank, this.options.preset, this.options.bank)
			: source.kind === "pack"
				? 0
				: this.options.preset
	}
	private select(id: number): void {
		const { source } = this
		if (source.kind === "bank") {
			const preset = source.bank.presets[id]
			if (preset) {
				this.setPreset(preset.program, preset.bank)
			}
		} else if (source.kind === "stream") {
			this.setPreset(id)
		}
	}
	private step(offset: number): void {
		const { source } = this
		const count =
			source.kind === "bank" ? source.bank.presets.length : source.kind === "pack" ? 1 : 128
		this.select((this.selected() + offset + count) % count)
	}
	private view(): RomplerView {
		const { source } = this
		const entries: RomplerEntry[] | undefined =
			source.kind === "bank"
				? source.bank.presets.map((preset, id) => ({
						id,
						number: String(preset.program + 1).padStart(3, "0"),
						label: preset.name,
						category:
							preset.bank >= 128
								? "Drum kits"
								: preset.bank
									? `Bank ${preset.bank}`
									: presetFamily(preset.program),
						description: `Bank ${preset.bank}, program ${preset.program + 1}, ${preset.regions.length} zones`,
						loops: preset.regions.some(({ loop }) => loop)
					}))
				: source.kind === "pack"
					? [{ id: 0, number: "001", label: source.name, category: "MIDI.js pack" }]
					: undefined
		return {
			kind: source.kind,
			name: source.kind === "bank" ? `${source.name} · ${source.bank.name}` : source.name,
			entries,
			selected: this.selected(),
			sampled: this.sampledNotes,
			loaded: this.loadedNotes
		}
	}
	private entryName(): string {
		const { source } = this
		return source.kind === "bank"
			? (source.bank.presets[this.selected()]?.name ?? source.name)
			: source.kind === "pack"
				? source.name
				: presetTitle(this.options.preset)
	}
	private configure(changes: Partial<Rompler["options"]>): void {
		Object.assign(this.options, changes)
		this.grid = sampleGrid(this.options.spacing)
		this.gui?.setSpacing(this.options.spacing)
		this.reload()
		changed(this)
	}
	async connect(): Promise<void> {
		await this.context.resume()
		await this.initialize()
		if (!this.destroyed) {
			this.connected = true
		}
	}
	async disconnect(): Promise<void> {
		this.connected = false
		this.allNotesOff()
	}
	private post(message: Record<string, unknown>): void {
		this.node?.port.postMessage(message)
	}
	async sendCommand(command: IAudioCommand): Promise<void> {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.allNotesOff()
			return
		}
		if (!this.isConnected) {
			return
		}
		const channel = Math.round(bounded(command.channel, 1, 1, 16)) - 1
		const note = command.number
		// Commands may name a later AudioContext time to play at; the worklet holds them until then
		const time = command.audioTime
		if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity <= 0)) {
			if (this.sustained.has(channel)) {
				this.released.add(`${channel}:${note}`)
			} else {
				this.post({ type: "off", channel, note, time })
				this.gui?.notePlaying(note, false)
			}
			return
		}
		if (command.type === PROGRAM_CHANGE) {
			this.setPreset(command.value ?? command.number)
			return
		}
		if (command.type === CONTROL_CHANGE) {
			this.control(channel, command.number, command.value)
			return
		}
		if (command.type === PITCH_BEND) {
			this.post({
				type: "bend",
				channel,
				time,
				value:
					((bounded(command.value, 8192, 0, 16383) - 8192) / 8192) *
					this.options.pitchBendRange
			})
			return
		}
		if (
			command.type !== NOTE_ON ||
			!Number.isInteger(note) ||
			note < 0 ||
			note > 127 ||
			!Number.isFinite(command.velocity)
		) {
			return
		}
		this.released.delete(`${channel}:${note}`)
		this.loader.request(note, this.demand(note))
		const node = this.node ?? (await this.initialize())
		if (!this.isConnected) {
			return
		}
		if (this.context.state === "suspended") {
			void this.context.resume()
		}
		node.port.postMessage({
			type: "on",
			channel,
			note,
			velocity: bounded(command.velocity, 100, 0, 127) / 127,
			time
		})
		this.gui?.notePlaying(note, true)
	}
	private control(channel: number, controller: number, value: number): void {
		if (controller === 64) {
			if (value >= 64) {
				this.sustained.add(channel)
				return
			}
			this.sustained.delete(channel)
			for (const id of this.released) {
				const [held, note] = id.split(":").map(Number)
				if (held === channel) {
					this.post({ type: "off", channel, note })
					this.gui?.notePlaying(note, false)
					this.released.delete(id)
				}
			}
		} else if (controller === 120 || controller === 123) {
			this.sustained.delete(channel)
			for (const id of this.released) {
				if (id.startsWith(`${channel}:`)) {
					this.released.delete(id)
				}
			}
			this.post({ type: "panic", channel })
			this.gui?.clearPlaying()
		} else if (controller === 0) {
			// Bank select applies with the next program change
			this.options.bank = Math.round(bounded(value, 0, 0, 127)) * 128
		} else if (controller === 7 || controller === 11) {
			;(controller === 7 ? this.volumes : this.expressions)[channel] =
				bounded(value, 127, 0, 127) / 127
			this.post({
				type: "gain",
				channel,
				value: this.volumes[channel] * this.expressions[channel]
			})
		}
	}
	noteOn(number: number, velocity = 100): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): void {
		void this.sendCommand(musicalCommand({ type: NOTE_OFF, number, channel: 1 }))
	}
	allNotesOff(): void {
		this.sustained.clear()
		this.released.clear()
		this.post({ type: "panic" })
		this.gui?.clearPlaying()
	}
	private renderStatus(): void {
		if (!this.gui) {
			return
		}
		const { loaded, failed, total } = this.progress
		const opening = this.downloaded
		const name = sourceName(this.options.soundfont)
		const busy = !!opening || (!!this.node && loaded + failed < total)
		this.gui.setStatus(
			opening
				? opening.total
					? `Downloading ${name}: ${megabytes(opening.received)} of ${megabytes(opening.total)} MB`
					: `Opening ${name}${opening.received ? `: ${megabytes(opening.received)} MB` : ""}`
				: this.problem
					? this.problem
					: !this.node
						? "Samples load when you play or press Play"
						: busy
							? `Loading ${this.entryName()}: ${loaded} of ${total} samples`
							: failed
								? `${loaded} of ${total} samples loaded, ${failed} unavailable`
								: `${this.entryName()} ready`,
			busy,
			!!this.problem
		)
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui.element
		}
		this.gui = new RomplerGui(
			this.options,
			{
				select: (id) => this.select(id),
				step: (offset) => this.step(offset),
				open: (source) => void this.setSoundFont(source),
				spacing: (spacing) => this.configure({ spacing }),
				volume: (volume) => {
					this.options.volume = volume
					this.output.gain.value = volume
				},
				release: (release) => {
					this.options.release = release
					this.post({ type: "release", value: release })
				},
				pitchBendRange: (pitchBendRange) => {
					this.options.pitchBendRange = pitchBendRange
				},
				commit: () => changed(this),
				audition: (note, on) => (on ? void this.noteOn(note) : this.noteOff(note))
			},
			this.view()
		)
		this.renderStatus()
		return this.gui.element
	}
	async destroyGui(): Promise<void> {
		this.gui?.element.remove()
		this.gui = undefined
	}
	destroy(): void {
		if (this.destroyed) {
			return
		}
		this.destroyed = true
		this.connected = false
		this.loader.cancel()
		this.opening?.lease.release()
		this.lease?.release()
		this.allNotesOff()
		this.post({ type: "destroy" })
		this.node?.disconnect()
		this.node?.port.close()
		this.node = undefined
		this.output.disconnect()
		void this.destroyGui()
	}
}