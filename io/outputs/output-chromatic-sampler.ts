import type { IAudioCommand } from "../../audio-command-interface"
import type { IAudioOutput } from "./output-interface"
import {
	NOTE_ON,
	NOTE_OFF,
	CONTROL_CHANGE,
	PITCH_BEND,
	MIDI_STOP,
	PLAYBACK_STOP
} from "../../commands"
import { getAudioDestination } from "../../audio-destination"
import { bounded, changed, devicePanel, numberControl } from "../device-controls"
import { musicalCommand } from "../event-clip"
import {
	createSamplerLayer,
	normaliseSamplerLayer,
	type SamplerLayer
} from "./sampler/sampler-state.js"
import { setupSamplerEditor } from "./sampler/sampler-editor.js"
import processorURL from "./sampler/layered-sampler.worklet.js?worker&url"
import "./sampler/sampler-editor.scss"

interface SavedLayer extends Omit<SamplerLayer, "channels" | "sampleRate"> {
	sample?: string
}
const MAX_SAMPLE_BYTES = 16 * 1024 * 1024
const MAX_BANK_BYTES = 64 * 1024 * 1024
const registrations = new WeakMap<AudioContext, Promise<void>>()

export default class ChromaticSampler extends EventTarget implements IAudioOutput {
	readonly uuid = `Output-ChromaticSampler-${crypto.randomUUID()}`
	readonly name = "ChromaticSampler"
	readonly description =
		"Four sample layers per key with trim, loops, envelopes, filters and velocity fades"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly output: GainNode
	readonly options: {
		layers: Record<string, SavedLayer[]>
		volume: number
		pitchBendRange: number
	}
	private readonly context: AudioContext
	private node?: AudioWorkletNode
	private starting?: Promise<AudioWorkletNode>
	private bank = new Map<number, SamplerLayer[]>()
	private parts: GainNode[] = []
	private channelVolumes = Array(16).fill(1) as number[]
	private expressions = Array(16).fill(1) as number[]
	private revisions = new Map<string, number>()
	private pending = new Map<string, object>()
	private sustained = new Set<number>()
	private released = new Map<string, { part: number; note: number }>()
	private connected = true
	private destroyed = false
	private generation = 0
	private previewGeneration = 0
	private gui?: HTMLElement
	private editor?: ReturnType<typeof setupSamplerEditor>

	constructor(options: Record<string, any> = {}) {
		super()
		if (!options.audioContext) {
			throw Error("ChromaticSampler requires an audio context")
		}
		this.context = options.audioContext
		this.options = {
			layers: {},
			volume: bounded(options.volume, 0.7, 0, 2),
			pitchBendRange: bounded(options.pitchBendRange, 2, 0, 24)
		}
		let savedBytes = 0
		for (const [key, layers] of Object.entries(options.layers ?? {})) {
			if (
				!/^\d+$/.test(key) ||
				Number(key) > 127 ||
				!Array.isArray(layers) ||
				layers.length > 4
			) {
				throw Error("Invalid sampler key mapping")
			}
			this.options.layers[key] = layers.map((value) => {
				const {
					channels: _channels,
					sampleRate: _rate,
					...layer
				} = normaliseSamplerLayer(value)
				const sample = value.sample
				if (
					sample !== undefined &&
					(typeof sample !== "string" ||
						sample.length > Math.ceil(MAX_SAMPLE_BYTES / 3) * 4)
				) {
					throw Error("Saved sample exceeds 16 MB")
				}
				savedBytes += typeof sample === "string" ? (sample.length * 3) / 4 : 0
				return { ...layer, sample }
			})
		}
		if (savedBytes > MAX_BANK_BYTES) {
			throw Error("Sample bank exceeds 64 MB")
		}
		this.output = this.context.createGain()
		this.output.gain.value = this.options.volume
		this.output.connect(options.mixer ?? getAudioDestination(this.context))
		for (let part = 0; part < 17; part++) {
			const gain = this.context.createGain()
			gain.gain.value = part === 16 ? 0.5 : 1
			gain.connect(this.output)
			this.parts.push(gain)
		}
	}
	get isConnected(): boolean {
		return this.connected && !this.destroyed
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
	getLayers(key: number): SamplerLayer[] {
		return (
			this.bank.get(key) ??
			Array.from({ length: 4 }, (_, index) => {
				const { sample: _sample, ...settings } = this.options.layers[key]?.[index] ?? {}
				return { ...createSamplerLayer(), ...settings, root: settings.root ?? key }
			})
		)
	}
	private checkSlot(key: number, index: number): void {
		if (
			!Number.isInteger(key) ||
			key < 0 ||
			key > 127 ||
			!Number.isInteger(index) ||
			index < 0 ||
			index > 3
		) {
			throw Error("Invalid sampler layer")
		}
	}
	private sendLayer(key: number, index: number, includeAudio = true): void {
		const layer = this.getLayers(key)[index]
		this.node?.port.postMessage({
			type: "layer",
			key,
			index,
			layer: { ...layer, channels: includeAudio ? (layer.channels ?? null) : undefined }
		})
	}
	private saveLayer(key: number, index: number): void {
		const { channels: _channels, sampleRate: _rate, ...settings } = this.getLayers(key)[index]
		const layers =
			this.options.layers[key] ??
			Array.from({ length: 4 }, () => ({ ...createSamplerLayer(), root: key }))
		layers[index] = { ...settings, sample: layers[index]?.sample }
		this.options.layers[key] = layers
		changed(this)
	}
	updateLayer(key: number, index: number, changes: Partial<SamplerLayer>): SamplerLayer {
		this.checkSlot(key, index)
		const layers = this.getLayers(key).slice()
		layers[index] = normaliseSamplerLayer({ ...layers[index], ...changes })
		this.bank.set(key, layers)
		this.sendLayer(key, index, false)
		this.saveLayer(key, index)
		return layers[index]
	}
	clearLayer(key: number, index: number): void {
		this.checkSlot(key, index)
		const slot = `${key}:${index}`
		this.revisions.set(slot, (this.revisions.get(slot) ?? 0) + 1)
		const layers = this.getLayers(key).slice()
		layers[index] = { ...createSamplerLayer(), root: key }
		this.bank.set(key, layers)
		if (this.options.layers[key]?.[index]) {
			delete this.options.layers[key][index].sample
		}
		this.sendLayer(key, index)
		this.saveLayer(key, index)
	}
	private initialize(): Promise<AudioWorkletNode> {
		if (this.destroyed) {
			return Promise.reject(Error("Sampler has been destroyed"))
		}
		if (this.node) {
			return Promise.resolve(this.node)
		}
		return (this.starting ??= (async () => {
			if (!this.context.audioWorklet) {
				throw Error("The sampler requires AudioWorklet support and a secure connection")
			}
			if (!registrations.has(this.context)) {
				const pending = this.context.audioWorklet.addModule(processorURL)
				registrations.set(this.context, pending)
				pending.catch(() => registrations.delete(this.context))
			}
			await registrations.get(this.context)
			await Promise.all(
				Object.entries(this.options.layers).flatMap(([key, layers]) =>
					layers.map(async (saved, index) => {
						if (!saved.sample || this.getLayers(Number(key))[index].channels) {
							return
						}
						const slot = `${key}:${index}`,
							revision = this.revisions.get(slot)
						const audio = await this.context.decodeAudioData(
							Uint8Array.from(atob(saved.sample), (c) => c.charCodeAt(0)).buffer
						)
						if (this.destroyed || this.revisions.get(slot) !== revision) {
							return
						}
						const current = this.getLayers(Number(key)).slice()
						current[index] = {
							...current[index],
							channels: this.channels(audio),
							sampleRate: audio.sampleRate
						}
						this.bank.set(Number(key), current)
					})
				)
			)
			if (this.destroyed) {
				throw Error("Sampler has been destroyed")
			}
			const node = new AudioWorkletNode(this.context, "harmoneasy-layered-sampler", {
				numberOfInputs: 0,
				numberOfOutputs: 17,
				outputChannelCount: Array(17).fill(2)
			})
			node.onprocessorerror = () => {
				this.allNotesOff()
			}
			this.parts.forEach((gain, part) => node.connect(gain, part, 0))
			this.node = node
			for (const [key, layers] of this.bank) {
				layers.forEach((_, index) => this.sendLayer(key, index))
			}
			return node
		})().finally(() => {
			this.starting = undefined
		}))
	}
	private channels(audio: AudioBuffer): Float32Array[] {
		if (!audio.length || audio.duration > 300) {
			throw Error("Samples must be shorter than five minutes")
		}
		return Array.from(
			{ length: Math.min(2, audio.numberOfChannels) },
			(_, ch) => new Float32Array(audio.getChannelData(ch))
		)
	}
	async loadSample(key: number, index: number, file: File): Promise<void> {
		this.checkSlot(key, index)
		if (file.size > MAX_SAMPLE_BYTES) {
			throw Error("Choose a sample smaller than 16 MB")
		}
		const slot = `${key}:${index}`,
			revision = (this.revisions.get(slot) ?? 0) + 1
		this.revisions.set(slot, revision)
		const bytes = await file.arrayBuffer()
		if (bytes.byteLength > MAX_SAMPLE_BYTES) {
			throw Error("Choose a sample smaller than 16 MB")
		}
		const audio = await this.context.decodeAudioData(bytes.slice(0))
		const channels = this.channels(audio)
		if (this.destroyed || this.revisions.get(slot) !== revision) {
			return
		}
		let binary = ""
		const data = new Uint8Array(bytes)
		for (let start = 0; start < data.length; start += 8192) {
			binary += String.fromCharCode(...data.subarray(start, start + 8192))
		}
		const sample = btoa(binary)
		let total = (sample.length * 3) / 4
		for (const [savedKey, layers] of Object.entries(this.options.layers)) {
			layers.forEach((saved, savedIndex) => {
				if (savedKey !== String(key) || savedIndex !== index) {
					total += ((saved.sample?.length ?? 0) * 3) / 4
				}
			})
		}
		if (total > MAX_BANK_BYTES) {
			throw Error("Sample bank exceeds 64 MB")
		}
		const layers = this.getLayers(key).slice()
		layers[index] = {
			...createSamplerLayer(),
			root: key,
			name: file.name,
			channels,
			sampleRate: audio.sampleRate
		}
		this.bank.set(key, layers)
		this.saveLayer(key, index)
		this.options.layers[key][index].sample = sample
		this.sendLayer(key, index)
		changed(this)
	}
	async connect(): Promise<void> {
		const generation = this.generation
		await this.context.resume()
		await this.initialize()
		if (!this.destroyed && generation === this.generation) {
			this.connected = true
		}
	}
	async disconnect(): Promise<void> {
		this.connected = false
		this.allNotesOff()
	}
	async sendCommand(command: IAudioCommand): Promise<void> {
		if (command.type === MIDI_STOP || command.type === PLAYBACK_STOP) {
			this.allNotesOff()
			return
		}
		if (!this.isConnected) {
			return
		}
		const part = Math.round(bounded(command.channel, 1, 1, 16)) - 1
		const key = `${part}:${command.number}`
		if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity <= 0)) {
			this.pending.delete(key)
			if (this.sustained.has(part)) {
				this.released.set(key, { part, note: command.number })
			} else {
				this.node?.port.postMessage({
					type: "off",
					part,
					note: command.number,
					time: this.context.currentTime
				})
			}
			return
		}
		if (command.type === CONTROL_CHANGE) {
			if (command.number === 64) {
				if (command.value >= 64) {
					this.sustained.add(part)
				} else {
					this.sustained.delete(part)
					for (const [id, voice] of this.released) {
						if (voice.part === part) {
							this.node?.port.postMessage({
								type: "off",
								...voice,
								time: this.context.currentTime
							})
							this.released.delete(id)
						}
					}
				}
			} else if (command.number === 120 || command.number === 123) {
				for (const id of this.pending.keys()) {
					if (id.startsWith(`${part}:`)) {
						this.pending.delete(id)
					}
				}
				for (const [id, voice] of this.released) {
					if (voice.part === part) {
						this.released.delete(id)
					}
				}
				this.sustained.delete(part)
				this.node?.port.postMessage({ type: "panic", part })
			} else if (command.number === 7 || command.number === 11) {
				;(command.number === 7 ? this.channelVolumes : this.expressions)[part] =
					bounded(command.value, 127, 0, 127) / 127
				this.parts[part].gain.setTargetAtTime(
					this.channelVolumes[part] * this.expressions[part],
					this.context.currentTime,
					0.01
				)
			}
			return
		}
		if (command.type !== NOTE_ON && command.type !== PITCH_BEND) {
			return
		}
		if (
			command.type === NOTE_ON &&
			(!Number.isInteger(command.number) ||
				command.number < 0 ||
				command.number > 127 ||
				!Number.isFinite(command.velocity))
		) {
			return
		}
		const request = {},
			generation = this.generation
		if (command.type === NOTE_ON) {
			this.pending.set(key, request)
		}
		if (this.context.state === "suspended") {
			await this.context.resume()
		}
		const node = await this.initialize()
		if (!this.isConnected || generation !== this.generation) {
			return
		}
		if (command.type === PITCH_BEND) {
			node.port.postMessage({
				type: "bend",
				part,
				value:
					((bounded(command.value, 8192, 0, 16383) - 8192) / 8192) *
					this.options.pitchBendRange,
				time: this.context.currentTime
			})
			return
		}
		if (this.pending.get(key) !== request) {
			return
		}
		this.pending.delete(key)
		this.released.delete(key)
		node.port.postMessage({
			type: "on",
			part,
			note: command.number,
			velocity: bounded(command.velocity, 100, 0, 127) / 127,
			time: this.context.currentTime
		})
	}
	noteOn(number: number, velocity = 100): Promise<void> {
		return this.sendCommand(musicalCommand({ type: NOTE_ON, number, velocity, channel: 1 }))
	}
	noteOff(number: number): void {
		void this.sendCommand(musicalCommand({ type: NOTE_OFF, number, channel: 1 }))
	}
	allNotesOff(): void {
		this.generation++
		this.previewGeneration++
		this.pending.clear()
		this.sustained.clear()
		this.released.clear()
		for (let part = 0; part < 17; part++) {
			this.node?.port.postMessage({ type: "panic", part })
		}
	}
	preview(note: number, velocity = 0.8): void {
		const generation = this.previewGeneration
		void this.context
			.resume()
			.then(() => this.initialize())
			.then(() => {
				if (generation === this.previewGeneration) {
					this.node?.port.postMessage({
						type: "on",
						part: 16,
						note,
						velocity,
						time: this.context.currentTime
					})
				}
			})
			.catch((error) => {
				this.gui
					?.querySelector("[data-sampler-status]")
					?.replaceChildren(String(error.message))
			})
	}
	stopPreview(): void {
		this.previewGeneration++
		this.node?.port.postMessage({ type: "panic", part: 16 })
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		if (
			Object.values(this.options.layers).some((layers) =>
				layers.some((layer) => layer.sample)
			)
		) {
			await this.initialize()
		}
		if (this.destroyed) {
			throw Error("Sampler has been destroyed")
		}
		const gui = devicePanel(),
			sampler = document.createElement("div")
		sampler.className = "chromatic-sampler"
		gui.append(sampler)
		numberControl(
			gui,
			"Output gain",
			this.options.volume,
			0,
			2,
			(value) => {
				this.options.volume = value
				this.output.gain.value = value
				changed(this)
			},
			0.01
		)
		numberControl(
			gui,
			"Pitch bend (semitones)",
			this.options.pitchBendRange,
			0,
			24,
			(value) => {
				this.options.pitchBendRange = value
				changed(this)
			}
		)
		this.gui = gui
		this.editor = setupSamplerEditor(sampler, () => (this.destroyed ? null : this))
		this.editor.refresh()
		return gui
	}
	async destroyGui(): Promise<void> {
		this.editor?.destroy()
		this.editor = undefined
		this.gui?.remove()
		this.gui = undefined
	}
	destroy(): void {
		if (this.destroyed) {
			return
		}
		this.destroyed = true
		this.connected = false
		this.allNotesOff()
		this.node?.port.postMessage({ type: "destroy" })
		this.node?.disconnect()
		this.node?.port.close()
		this.node = undefined
		this.parts.forEach((part) => part.disconnect())
		this.output.disconnect()
		this.bank.clear()
		void this.destroyGui()
	}
}