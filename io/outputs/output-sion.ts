import type { SiONSession } from "sion"
import type { SiMMLTrack } from "sion/sion"
import type { IAudioOutput } from "./output-interface"
import type { IAudioCommand } from "../../audio-command-interface"
import { NOTE_ON, NOTE_OFF, PITCH_BEND, CONTROL_CHANGE, PROGRAM_CHANGE } from "../../commands"
import { EVENT_CHANGE, EVENT_INPUT, EVENT_CONNECTION_CHANGED } from "../../event-constants"
import { action, bounded, changed, devicePanel, numberControl } from "../device-controls"
import { getAudioDestination } from "../../audio-destination"
import { musicalCommand } from "../event-clip"

interface Voice {
	note: number
	trackId: number
	track: SiMMLTrack
	address: string
	released: boolean
}

export default class OutputSiON extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-SiON-${crypto.randomUUID()}`
	readonly name = "SiON"
	readonly description = "Polyphonic SiON instruments with FM, chip and acoustic presets"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly options: { preset: string; volume: number; pan: number }
	readonly output: GainNode
	private context: AudioContext
	private destination: AudioNode
	private panner: StereoPannerNode
	private session?: SiONSession
	private loading?: Promise<SiONSession>
	private connected = true
	private destroyed = false
	private connectionVersion = 0
	private nextTrackId = 0
	private voices = new Map<string, Voice>()
	private pending = new Map<string, object>()
	private sustain = new Set<string>()
	private bends = new Map<string, number>()
	private programs = new Map<string, string>()
	private gui?: HTMLElement
	private status?: HTMLElement
	private selector?: HTMLSelectElement
	private filter?: HTMLInputElement
	get isConnected() {
		return this.connected
	}
	hasAudioOutput() {
		return true
	}

	constructor(options: Record<string, any> = {}) {
		super()
		if (!options.audioContext) {
			throw new Error("SiON requires an audio context")
		}
		this.context = options.audioContext
		this.destination = options.mixer ?? getAudioDestination(this.context)
		this.options = {
			preset: typeof options.preset === "string" ? options.preset : "",
			volume: bounded(options.volume, 0.7, 0, 1),
			pan: bounded(options.pan, 0, -1, 1)
		}
		this.output = this.context.createGain()
		this.panner = this.context.createStereoPanner()
		this.panner.pan.value = this.options.pan
		this.output.gain.value = this.options.volume
		this.output.connect(this.destination)
		this.panner.connect(this.output)
	}

	private async initialize(): Promise<SiONSession> {
		if (this.destroyed) {
			throw new Error("SiON output has been destroyed")
		}
		if (this.session) {
			return this.session
		}
		if (!this.loading) {
			this.loading = import("sion")
				.then((library) => library.createSiONSession(this.context, this.panner))
				.then((session) => {
					if (this.destroyed) {
						session.dispose()
						throw new Error("SiON output has been destroyed")
					}
					this.session = session
					session.audio.onError = (error) => {
						this.allNotesOff()
						this.report(error)
					}
					if (this.options.preset && !session.voices.includes(this.options.preset)) {
						this.options.preset = ""
					}
					return session
				})
				.finally(() => {
					this.loading = undefined
				})
		}
		return this.loading
	}

	async connect(): Promise<void> {
		if (this.destroyed) {
			return
		}
		const version = this.connectionVersion
		await this.context.resume()
		await this.initialize()
		if (this.destroyed || version !== this.connectionVersion) {
			return
		}
		if (!this.connected) {
			this.output.connect(this.destination)
			this.connected = true
			this.dispatchEvent(new Event(EVENT_CONNECTION_CHANGED))
		}
		if (this.status) {
			this.status.textContent = "Ready to play."
		}
	}

	private address(command: IAudioCommand): string {
		return `${command.ump ? (command.ump[0] >>> 24) & 15 : 0}:${Math.max(1, Math.min(16, command.channel || 1))}`
	}
	getNoteKey(command: IAudioCommand): string {
		return `${this.address(command)}:${command.number}`
	}

	async sendCommand(command: IAudioCommand): Promise<void> {
		if (!this.connected || this.destroyed) {
			return
		}
		const address = this.address(command),
			key = this.getNoteKey(command)
		if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0)) {
			this.pending.delete(key)
			const voice = this.voices.get(key)
			if (voice && this.sustain.has(address)) {
				voice.released = true
			} else {
				this.release(key)
			}
			return
		}
		if (command.type === PITCH_BEND) {
			const bend = Math.round(
				((bounded(command.value, 8192, 0, 16383) - 8192) / 8192) * 2 * 64
			)
			this.bends.set(address, bend)
			for (const voice of this.voices.values()) {
				if (voice.address === address) {
					voice.track.pitchBend = bend
				}
			}
			return
		}
		if (command.type === CONTROL_CHANGE) {
			if (command.number === 64) {
				if (command.value >= 64) {
					this.sustain.add(address)
				} else {
					this.sustain.delete(address)
					for (const [key, voice] of this.voices) {
						if (voice.address === address && voice.released) {
							this.release(key)
						}
					}
				}
			} else if (command.number === 120 || command.number === 123) {
				for (const key of this.pending.keys()) {
					if (key.startsWith(address + ":")) {
						this.pending.delete(key)
					}
				}
				for (const [key, voice] of this.voices) {
					if (voice.address === address) {
						this.release(key, command.number === 120)
					}
				}
				this.sustain.delete(address)
			}
			return
		}
		if (command.type === PROGRAM_CHANGE) {
			const session = await this.initialize()
			const program = Math.round(bounded(command.value, 0, 0, 127))
			// SiON names its General MIDI voices midi.piano1, midi.guitar1, etc.
			const midi = Object.keys(session.presets).filter(
				(name) => name.startsWith("midi.") && session.voices.includes(name)
			)
			const preset = midi[program]
			if (preset) {
				this.programs.set(address, preset)
			}
			return
		}
		if (
			command.type !== NOTE_ON ||
			!Number.isInteger(command.number) ||
			command.number < 0 ||
			command.number > 127
		) {
			return
		}
		const request = {},
			note = command.number,
			velocity = bounded(command.velocity, 100, 0, 127)
		this.pending.set(key, request)
		try {
			await this.connect()
			if (this.pending.get(key) !== request || !this.connected || this.destroyed) {
				return
			}
			this.pending.delete(key)
			this.release(key)
			if (this.voices.size >= 64) {
				this.release(this.voices.keys().next().value!, true)
			}
			const session = this.session!
			if (!session.driver.isPlaying) {
				session.driver.play()
			}
			const preset = this.programs.get(address) ?? this.options.preset
			const trackId = ++this.nextTrackId
			const track = session.driver.noteOn(
				note,
				preset ? session.presets[preset] : null,
				0,
				0,
				0,
				trackId
			)
			if (!track) {
				throw new Error("SiON could not allocate a voice")
			}
			track.velocity = Math.round(velocity)
			track.pitchBend = this.bends.get(address) ?? 0
			this.voices.set(key, { note, trackId, track, address, released: false })
		} catch (error) {
			if (this.pending.get(key) === request) {
				this.pending.delete(key)
			}
			this.report(error)
			throw error
		}
	}

	private release(key: string, immediate = false): void {
		const voice = this.voices.get(key)
		if (!voice) {
			return
		}
		this.voices.delete(key)
		this.session?.driver.noteOff(voice.note, voice.trackId, 0, 0, immediate)
	}
	noteOn(number: number, velocity: number): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): void {
		void this.sendCommand(musicalCommand({ type: NOTE_OFF, number, channel: 1 }))
	}
	allNotesOff(): void {
		this.pending.clear()
		this.voices.clear()
		this.sustain.clear()
		this.bends.clear()
		this.session?.driver.stop()
	}
	async disconnect(): Promise<void> {
		++this.connectionVersion
		this.allNotesOff()
		this.output.disconnect()
		if (this.connected) {
			this.connected = false
			this.dispatchEvent(new Event(EVENT_CONNECTION_CHANGED))
		}
	}
	private report(error: unknown): void {
		if (this.status) {
			this.status.textContent = error instanceof Error ? error.message : String(error)
		}
	}
	private fillPresets(): void {
		if (!this.selector) {
			return
		}
		const search = this.filter?.value.toLowerCase().trim() ?? ""
		const option = (text: string, value: string) => {
			const item = document.createElement("option")
			item.textContent = text
			item.value = value
			return item
		}
		this.selector.replaceChildren(option("Default SiON voice", ""))
		for (const name of this.session?.voices ?? []) {
			const title = this.session?.presets[name]?.name as string | undefined
			const label = title ? `${title} (${name})` : name
			if (search && !label.toLowerCase().includes(search) && name !== this.options.preset) {
				continue
			}
			this.selector.add(option(label, name))
		}
		this.selector.value = this.options.preset
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = (this.gui = devicePanel())
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.status.textContent = "Loading SiON instruments…"
		this.filter = document.createElement("input")
		this.filter.type = "search"
		this.filter.placeholder = "Search instruments"
		this.filter.setAttribute("aria-label", "Search SiON instruments")
		this.filter.addEventListener(EVENT_INPUT, () => this.fillPresets())
		const label = document.createElement("label")
		this.selector = document.createElement("select")
		this.selector.disabled = true
		this.selector.addEventListener(EVENT_CHANGE, () => {
			this.options.preset = this.selector!.value
			this.programs.clear()
			changed(this)
		})
		label.append("Instrument ", this.selector)
		panel.append(this.filter, label)
		numberControl(
			panel,
			"Volume",
			this.options.volume,
			0,
			1,
			(value) => {
				this.options.volume = value
				this.output.gain.setValueAtTime(value, this.context.currentTime)
				changed(this)
			},
			0.01
		)
		numberControl(
			panel,
			"Pan",
			this.options.pan,
			-1,
			1,
			(value) => {
				this.options.pan = value
				this.panner.pan.setValueAtTime(value, this.context.currentTime)
				changed(this)
			},
			0.01
		)
		action(
			panel,
			"Enable audio",
			async () => {
				await this.connect()
				this.fillPresets()
				if (this.selector) {
					this.selector.disabled = false
				}
			},
			this.status
		)
		action(
			panel,
			"Test note",
			async () => {
				await this.noteOn(60, 100)
				const voice = this.voices.get("0:1:60")
				setTimeout(() => {
					if (voice && this.voices.get("0:1:60") === voice) {
						this.noteOff(60)
					}
				}, 400)
			},
			this.status
		)
		action(panel, "All notes off", () => this.allNotesOff())
		panel.append(this.status)
		try {
			await this.initialize()
			this.fillPresets()
			if (this.selector) {
				this.selector.disabled = false
			}
			if (this.status) {
				this.status.textContent =
					"Choose an instrument, then play notes from a connected Input."
			}
		} catch (error) {
			this.report(error)
		}
		return panel
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
		this.status = undefined
		this.selector = undefined
		this.filter = undefined
	}
	destroy(): void {
		this.destroyed = true
		void this.disconnect()
		this.session?.dispose()
		this.session = undefined
		this.panner.disconnect()
		void this.destroyGui()
	}
}