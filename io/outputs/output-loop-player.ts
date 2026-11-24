import type { IAudioCommand } from "../../commands/audio-command-interface"
import type { AudioClockTick } from "../../timing/audio-clock-tick"
import type { IAudioOutput } from "./output-interface"
import { MIDI_STOP, PLAYBACK_STOP } from "../../commands/commands"
import { EVENT_CHANGE, EVENT_ENDED } from "../../events/event-constants"
import { changed, devicePanel, numberControl } from "../device-controls"
import { getAudioDestination } from "../audio-destination"
import { loadCaptureWorklet } from "../inputs/load-capture-worklet"
import { loopPlayerSettings, loopSourceBpm, type LoopPlayerSettings } from "./loop-player-settings"
import {
	alignLoopToBeats,
	describeDetectedLoop,
	detectedLoop,
	type DetectedLoop,
	type LoopAlignmentSource
} from "./loop-alignment"
import { LOOP_PLAYER_PROCESSOR, LOOP_PLAYER_WORKLET_CODE } from "./loop-player-worklet"
import { AUDIO_MEDIA_ACCEPT, decodeAudioMedia } from "../media/audio-media"

const MAX_SAMPLE_BYTES = 4 * 1024 * 1024
const FADE_SECONDS = 0.005

interface LoopVoice {
	source: AudioBufferSourceNode
	gain: GainNode
}

export default class OutputLoopPlayer extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-LoopPlayer-${crypto.randomUUID()}`
	readonly name = "Loop Player"
	readonly description = "Loop your own audio in time with the transport"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly options: Record<string, any>
	readonly output: GainNode
	private context: AudioContext
	private destination: AudioNode
	private connected = true
	private destroyed = false
	private buffer?: AudioBuffer
	private generation = 0
	private fileRequest = 0
	private loading?: Promise<void>
	private preparing?: Promise<void>
	private worklet?: AudioWorkletNode
	private regionRevision = 0
	private uploadedRevision = -1
	private granularUnavailable = false
	private voices = new Set<LoopVoice>()
	private current?: LoopVoice
	private lastTick?: Readonly<AudioClockTick>
	private gui?: HTMLElement
	private status?: HTMLElement
	private bpmLabel?: HTMLElement
	private startControl?: HTMLInputElement
	private endControl?: HTMLInputElement
	private beatsControl?: HTMLInputElement
	private modeControl?: HTMLSelectElement

	constructor(options: Record<string, any> = {}) {
		super()
		if (!options.audioContext) {
			throw new Error("Loop Player requires an audio context")
		}
		if (
			options.sample !== undefined &&
			(typeof options.sample !== "string" ||
				options.sample.length > Math.ceil(MAX_SAMPLE_BYTES / 3) * 4)
		) {
			throw new Error("Saved sample exceeds 4 MB")
		}
		this.context = options.audioContext
		this.destination = options.mixer ?? getAudioDestination(this.context)
		this.options = {
			...options,
			...loopPlayerSettings(options, Number.MAX_SAFE_INTEGER),
			end:
				typeof options.end === "number" && Number.isFinite(options.end)
					? options.end
					: undefined,
			analysis: detectedLoop(options.analysis)
		}
		this.output = this.context.createGain()
		this.output.connect(this.destination)
		if (this.options.sample) {
			void this.restoreSample()
		}
	}
	get isConnected(): boolean {
		return this.connected
	}
	get sourceBpm(): number | undefined {
		return this.buffer ? loopSourceBpm(this.settings) : undefined
	}
	/** The decoded audio, once loaded; it changes when another file is loaded. */
	get audioBuffer(): AudioBuffer | undefined {
		return this.buffer
	}
	/** Tempo and key found by analysis, kept with the saved sample. */
	get detected(): DetectedLoop | undefined {
		return this.options.analysis
	}
	private get settings(): LoopPlayerSettings {
		return loopPlayerSettings(this.options, this.buffer!.duration)
	}
	/**
	 * Keep what analysis found and, unless align is false, start the loop on the first detected beat
	 * with a whole number of beats, so the source BPM matches the detected tempo.
	 * Returns whether the loop was realigned.
	 */
	applyAnalysis(
		analysis: LoopAlignmentSource & Omit<DetectedLoop, "bpm">,
		{ align = true }: { align?: boolean } = {}
	): boolean {
		if (!this.buffer) {
			return false
		}
		const detected = detectedLoop(analysis)
		if (!detected) {
			return false
		}
		this.options.analysis = detected
		const region = align ? alignLoopToBeats(analysis, this.buffer.duration) : undefined
		if (region) {
			this.configure(region)
		} else {
			this.refreshGui()
			changed(this)
		}
		return region !== undefined
	}
	hasAudioOutput(): boolean {
		return true
	}
	hasMidiOutput(): boolean {
		return false
	}
	configure(patch: Partial<LoopPlayerSettings>): void {
		const { start: previousStart, end: previousEnd, mode: previousMode } = this.options
		const end = patch.end ?? this.options.end
		Object.assign(
			this.options,
			loopPlayerSettings(
				{ ...this.options, ...patch },
				this.buffer?.duration ?? Number.MAX_SAFE_INTEGER
			)
		)
		if (!this.buffer) {
			this.options.end = end
		}
		const regionChanged =
			this.options.start !== previousStart || this.options.end !== previousEnd
		if (regionChanged || this.options.mode !== previousMode) {
			this.stopClock()
		} else {
			// Loop length only changes the rate: resync on the next tick without a cut
			this.lastTick = undefined
		}
		if (regionChanged) {
			++this.regionRevision
		}
		this.refreshGui()
		changed(this)
		this.prepareGranular()
	}
	private refreshGui(): void {
		if (this.status) {
			this.status.textContent =
				this.options.fileName ??
				"Load an audio file up to 4 MB. Audio is saved with your workspace."
		}
		if (this.bpmLabel) {
			this.bpmLabel.textContent =
				this.sourceBpm === undefined
					? "Source BPM: load audio first"
					: `Source BPM: ${this.sourceBpm.toFixed(2)}`
			if (this.options.analysis) {
				this.bpmLabel.textContent += ` · ${describeDetectedLoop(this.options.analysis)}`
			}
		}
		for (const [control, key] of [
			[this.startControl, "start"],
			[this.endControl, "end"],
			[this.beatsControl, "loopBeats"]
		] as const) {
			if (control) {
				control.value = String(this.options[key] ?? 0)
			}
		}
		if (this.modeControl) {
			this.modeControl.value = this.options.mode
		}
	}
	private acceptBuffer(buffer: AudioBuffer): void {
		this.stopClock()
		this.buffer = buffer
		Object.assign(this.options, this.settings)
		++this.regionRevision
		this.refreshGui()
		this.prepareGranular()
	}
	private restoreSample(): Promise<void> {
		if (!this.loading) {
			const generation = this.generation
			this.loading = Promise.resolve()
				.then(async () => {
					const bytes = Uint8Array.from(atob(this.options.sample), (character) =>
						character.charCodeAt(0)
					)
					if (bytes.byteLength > MAX_SAMPLE_BYTES) {
						throw new Error("Saved sample exceeds 4 MB")
					}
					const buffer = await decodeAudioMedia(this.context, bytes.buffer)
					if (generation === this.generation && !this.destroyed) {
						this.acceptBuffer(buffer)
					}
				})
				.catch((error) => this.showError(error))
				.finally(() => {
					this.loading = undefined
				})
		}
		return this.loading
	}
	async loadSample(bytes: ArrayBuffer, fileName: string): Promise<void> {
		if (bytes.byteLength > MAX_SAMPLE_BYTES) {
			throw new Error("Sample exceeds 4 MB")
		}
		const generation = ++this.generation
		const buffer = await decodeAudioMedia(this.context, bytes)
		if (generation !== this.generation || this.destroyed) {
			return
		}
		const data = new Uint8Array(bytes)
		let binary = ""
		for (let start = 0; start < data.length; start += 8192) {
			binary += String.fromCharCode(...data.subarray(start, start + 8192))
		}
		this.options.sample = btoa(binary)
		this.options.fileName = fileName
		this.options.start = 0
		this.options.end = buffer.duration
		// Tempo and key belong to the previous audio
		this.options.analysis = undefined
		this.acceptBuffer(buffer)
		changed(this)
	}
	private showError(error: unknown): void {
		if (this.status) {
			this.status.textContent = error instanceof Error ? error.message : String(error)
		}
	}
	private prepareGranular(): void {
		if (
			!this.buffer ||
			this.options.mode !== "granular" ||
			this.granularUnavailable ||
			this.destroyed ||
			this.preparing
		) {
			return
		}
		this.preparing = loadCaptureWorklet(
			this.context,
			LOOP_PLAYER_PROCESSOR,
			LOOP_PLAYER_WORKLET_CODE
		)
			.then(() => {
				if (this.destroyed || !this.buffer || this.options.mode !== "granular") {
					return
				}
				if (!this.worklet) {
					this.worklet = new AudioWorkletNode(this.context, LOOP_PLAYER_PROCESSOR, {
						numberOfInputs: 0,
						numberOfOutputs: 1,
						outputChannelCount: [2]
					})
					this.worklet.connect(this.output)
				}
				if (this.uploadedRevision === this.regionRevision) {
					return
				}
				const { start, end } = this.settings
				const from = Math.floor(start * this.buffer.sampleRate)
				const to = Math.max(from + 1, Math.floor(end * this.buffer.sampleRate))
				const channels = Array.from(
					{ length: Math.min(2, this.buffer.numberOfChannels) },
					(_, i) => this.buffer!.getChannelData(i).slice(from, to)
				)
				this.worklet.port.postMessage(
					{
						type: "buffer",
						channels,
						sampleRate: this.buffer.sampleRate
					},
					channels.map((channel) => channel.buffer)
				)
				this.uploadedRevision = this.regionRevision
			})
			.catch((error) => {
				// Without AudioWorklet support, fall back to varispeed rather than silence
				this.granularUnavailable = true
				this.showError(
					`Granular stretch unavailable (${error instanceof Error ? error.message : error}); using varispeed`
				)
			})
			.finally(() => {
				this.preparing = undefined
			})
	}
	onClockTick(tick: Readonly<AudioClockTick>): void {
		if (
			!this.connected ||
			this.destroyed ||
			!this.buffer ||
			this.context.state === "suspended" ||
			this.context.state === "closed" ||
			!Number.isInteger(tick.step) ||
			tick.step < 0 ||
			!Number.isFinite(tick.bpm) ||
			tick.bpm <= 0 ||
			!Number.isFinite(tick.triggerAt) ||
			!Number.isFinite(tick.stepDuration) ||
			tick.stepDuration <= 0
		) {
			return
		}
		if (this.lastTick?.step === tick.step && this.lastTick.bpm === tick.bpm) {
			return
		}
		const { start, end, loopBeats } = this.settings
		const mode =
			this.settings.mode === "granular" && this.granularUnavailable
				? "varispeed"
				: this.settings.mode
		if (
			mode === "granular" &&
			(!this.worklet || this.uploadedRevision !== this.regionRevision)
		) {
			this.prepareGranular()
			return
		}
		const at = Math.max(this.context.currentTime, tick.triggerAt)
		const slice = (end - start) / (loopBeats * 4)
		const phase = tick.step % (loopBeats * 4)
		const ratio = tick.bpm / this.sourceBpm!
		// Cut short any stop fade still pending at this time
		this.output.gain.cancelScheduledValues(at)
		this.output.gain.setValueAtTime(1, at)
		if (mode === "slice") {
			this.startVoice(at, start + phase * slice, 1, Math.min(slice, tick.stepDuration))
		} else if (
			!this.lastTick ||
			tick.step % 4 === 0 ||
			tick.bpm !== this.lastTick.bpm ||
			tick.step !== this.lastTick.step + 1
		) {
			const late = (at - tick.triggerAt) * ratio
			const position = (phase * slice + late) % (end - start)
			if (mode === "granular") {
				this.worklet!.port.postMessage({ type: "sync", at, position, ratio })
			} else {
				if (this.current) {
					this.current.gain.gain.cancelScheduledValues(at)
					this.current.gain.gain.setValueAtTime(1, at)
					this.current.gain.gain.linearRampToValueAtTime(0, at + FADE_SECONDS)
					this.current.source.stop(at + FADE_SECONDS)
				}
				this.current = this.startVoice(at, start + position, ratio)
			}
		}
		this.lastTick = { ...tick }
	}
	private startVoice(at: number, offset: number, rate: number, duration?: number): LoopVoice {
		const source = this.context.createBufferSource(),
			gain = this.context.createGain()
		source.buffer = this.buffer!
		source.playbackRate.setValueAtTime(rate, at)
		source.loop = duration === undefined
		source.loopStart = this.options.start
		source.loopEnd = this.options.end
		const fade = Math.min(FADE_SECONDS, (duration ?? 1) / 2)
		gain.gain.setValueAtTime(0, at)
		gain.gain.linearRampToValueAtTime(1, at + fade)
		if (duration !== undefined) {
			gain.gain.setValueAtTime(1, at + duration - fade)
			gain.gain.linearRampToValueAtTime(0, at + duration)
		}
		source.connect(gain)
		gain.connect(this.output)
		const voice = { source, gain }
		this.voices.add(voice)
		source.addEventListener(
			EVENT_ENDED,
			() => {
				source.disconnect()
				gain.disconnect()
				this.voices.delete(voice)
			},
			{ once: true }
		)
		if (duration === undefined) {
			source.start(at, offset)
		} else {
			source.start(at, offset, duration)
		}
		return voice
	}
	noteOn(_note: number, _velocity: number): void {}
	noteOff(_note: number): void {}
	sendCommand(command: IAudioCommand): void {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.stopClock()
		}
	}
	stopClock(): void {
		// Fade out rather than cut, so stops and chain edits do not click
		const now = this.context.currentTime
		const end = now + FADE_SECONDS
		this.output.gain.cancelScheduledValues(now)
		this.output.gain.setValueAtTime(this.output.gain.value, now)
		this.output.gain.linearRampToValueAtTime(0, end)
		this.worklet?.port.postMessage({ type: "stop", at: end })
		for (const voice of this.voices) {
			voice.source.stop(end)
		}
		this.current = undefined
		this.lastTick = undefined
	}
	allNotesOff(): void {
		this.stopClock()
	}
	async connect(): Promise<void> {
		if (this.destroyed) {
			return
		}
		await this.context.resume()
		if (!this.connected && !this.destroyed) {
			this.output.connect(this.destination)
			this.connected = true
		}
	}
	async disconnect(): Promise<void> {
		this.stopClock()
		this.output.disconnect()
		this.connected = false
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = devicePanel(),
			file = document.createElement("input")
		const label = document.createElement("label"),
			modeLabel = document.createElement("label")
		const mode = document.createElement("select")
		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.bpmLabel = document.createElement("p")
		file.type = "file"
		file.accept = AUDIO_MEDIA_ACCEPT
		file.addEventListener(EVENT_CHANGE, async () => {
			const selected = file.files?.[0]
			if (!selected) {
				return
			}
			const request = ++this.fileRequest
			try {
				if (selected.size > MAX_SAMPLE_BYTES) {
					throw new Error("Sample exceeds 4 MB")
				}
				await this.context.resume()
				const bytes = await selected.arrayBuffer()
				if (request === this.fileRequest && !this.destroyed) {
					await this.loadSample(bytes, selected.name)
				}
			} catch (error) {
				if (request === this.fileRequest && !this.destroyed) {
					this.showError(error)
				}
			}
			if (request === this.fileRequest) {
				file.value = ""
			}
		})
		label.append("Audio file ", file)
		panel.append(label, this.status)
		for (const [value, title] of [
			["granular", "Granular — preserve pitch"],
			["slice", "Slice — 16th-note slices"],
			["varispeed", "Varispeed — pitch follows tempo"]
		]) {
			const option = document.createElement("option")
			option.value = value
			option.textContent = title
			mode.append(option)
		}
		mode.value = this.options.mode
		this.modeControl = mode
		mode.addEventListener(EVENT_CHANGE, () =>
			this.configure({ mode: mode.value as LoopPlayerSettings["mode"] })
		)
		modeLabel.append("Stretch mode ", mode)
		panel.append(modeLabel)
		this.startControl = numberControl(
			panel,
			"Start position (seconds)",
			this.options.start,
			0,
			Number.MAX_SAFE_INTEGER,
			(value) => this.configure({ start: value }),
			0.01
		)
		this.endControl = numberControl(
			panel,
			"Loop end (seconds)",
			this.options.end ?? 0,
			0,
			Number.MAX_SAFE_INTEGER,
			(value) => this.configure({ end: value }),
			0.01
		)
		this.beatsControl = numberControl(
			panel,
			"Loop length (beats)",
			this.options.loopBeats,
			1,
			32,
			(value) => this.configure({ loopBeats: value })
		)
		for (const control of [this.startControl, this.endControl, this.beatsControl]) {
			control.addEventListener(EVENT_CHANGE, () => this.refreshGui())
		}
		panel.append(this.bpmLabel)
		this.refreshGui()
		return (this.gui = panel)
	}
	async destroyGui(): Promise<void> {
		this.gui?.remove()
		this.gui = undefined
		this.status = undefined
		this.bpmLabel = undefined
		this.startControl = undefined
		this.endControl = undefined
		this.beatsControl = undefined
		this.modeControl = undefined
	}
	destroy(): void {
		this.destroyed = true
		++this.generation
		++this.fileRequest
		void this.disconnect()
		this.worklet?.port.postMessage({ type: "dispose" })
		this.worklet?.disconnect()
		this.worklet?.port.close()
		this.worklet = undefined
		this.buffer = undefined
		void this.destroyGui()
	}
}