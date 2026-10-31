import OutputSamplePlayer from "./output-sample-player"
import type { IAudioCommand } from "../../audio-command-interface"
import type { AudioClockTick } from "../../timing/audio-clock-tick"
import { NOTE_OFF, NOTE_ON } from "../../commands"
import { EVENT_CHANGE, EVENT_ENDED } from "../../event-constants"
import { action, bounded, changed, numberControl } from "../device-controls"

interface Emitter { position: number; transpose: number; level: number }
interface SampleStep { beat: number; duration: number; note: number }
export function samplerTimeline(value: unknown): SampleStep[] {
	if (!Array.isArray(value) || value.length > 128) throw new Error("Maximum 128 sample timeline events")
	return value.map((step) => {
		if (!step || !Number.isFinite(step.beat) || step.beat < 0 || step.beat >= 256 || !Number.isFinite(step.duration) || step.duration < 0.01 || step.duration > 64 || !Number.isInteger(step.note) || step.note < 0 || step.note > 127) throw new Error("Invalid sample timeline event")
		return { beat: step.beat, duration: step.duration, note: step.note }
	})
}

export default class OutputHarmonySampler extends OutputSamplePlayer {
	override readonly name = "Harmony Sampler"
	override readonly description = "Retune samples, loops and eight granular emitters to shared harmony"
	private gates = new Map<string, IAudioCommand>()
	private grains = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>()
	private samplerGui?: HTMLElement
	private lastStep = -1
	private epoch = 0
	constructor(options: Record<string, any> = {}) {
		super(options)
		this.options.follow = ["none", "scale", "chord"].includes(options.follow) ? options.follow : "scale"
		this.options.mode = options.mode === "granular" ? "granular" : "sample"
		this.options.grain = bounded(options.grain, 0.12, 0.02, 0.5)
		this.options.density = Math.round(bounded(options.density, 2, 1, 4))
		this.options.length = bounded(options.length, 16, 1, 256)
		this.options.timelineEnabled = options.timelineEnabled === true
		this.options.timeline = samplerTimeline(options.timeline ?? [])
		this.options.emitters = Array.from({ length: 8 }, (_, i): Emitter => ({
			position: bounded(options.emitters?.[i]?.position, i / 8, 0, 1),
			transpose: Math.round(bounded(options.emitters?.[i]?.transpose, 0, -24, 24)),
			level: bounded(options.emitters?.[i]?.level, i === 0 ? 0.5 : 0, 0, 1)
		}))
	}
	override async sendCommand(command: IAudioCommand): Promise<void> {
		if (!this.isConnected) return
		if (this.options.mode !== "granular") return super.sendCommand(command)
		const key = this.getNoteKey(command)
		if (command.type === NOTE_OFF || (command.type === NOTE_ON && command.velocity === 0)) { this.gates.delete(key); return }
		if (command.type !== NOTE_ON || !Number.isInteger(command.number) || command.number < 0 || command.number > 127) return
		if (this.gates.size >= 16) this.gates.delete(this.gates.keys().next().value!)
		this.gates.set(key, { ...command })
		const epoch = this.epoch
		const buffer = await this.decodeSaved()
		if (epoch === this.epoch && this.gates.has(key) && this.isConnected) this.emit(buffer, command, this.context.currentTime)
	}
	private play(buffer: AudioBuffer, note: number, velocity: number, at: number, duration: number, position: number, level: number, loop = false) {
		const pitch = this.targetPitch(note)
		if (pitch === undefined || level <= 0 || this.grains.size >= 128) return
		at = Math.max(this.context.currentTime, at)
		const source = this.context.createBufferSource(), gain = this.context.createGain()
		source.buffer = buffer; source.loop = loop
		source.playbackRate.value = 2 ** ((pitch - this.options.root) / 12)
		gain.gain.setValueAtTime(0, at)
		gain.gain.linearRampToValueAtTime(Math.min(127, Math.max(0, velocity)) / 127 * level, at + Math.min(0.01, duration / 4))
		gain.gain.setValueAtTime(Math.min(127, Math.max(0, velocity)) / 127 * level, at + duration * 0.6)
		gain.gain.linearRampToValueAtTime(0, at + duration)
		source.connect(gain); gain.connect(this.output)
		const voice = { source, gain }; this.grains.add(voice)
		source.addEventListener(EVENT_ENDED, () => { source.disconnect(); gain.disconnect(); this.grains.delete(voice) }, { once: true })
		source.start(at, Math.min(buffer.duration - 1 / buffer.sampleRate, position * buffer.duration))
		source.stop(at + duration)
	}
	private emit(buffer: AudioBuffer, command: IAudioCommand, at: number) {
		for (const emitter of this.options.emitters as Emitter[]) this.play(buffer, Math.max(0, Math.min(127, command.number + emitter.transpose)), command.velocity, at, this.options.grain, emitter.position, emitter.level)
	}
	onClockTick(tick: Readonly<AudioClockTick>): void {
		if (!this.isConnected || tick.step === this.lastStep) return
		this.lastStep = tick.step
		const epoch = this.epoch
		if (!this.options.sample) return
		void this.decodeSaved().then((buffer) => {
			if (epoch !== this.epoch || !this.isConnected || tick.triggerAt + tick.stepDuration < this.context.currentTime) return
			if (this.options.mode === "granular") {
				for (let n = 0; n < this.options.density; n++) for (const command of this.gates.values()) this.emit(buffer, command, tick.triggerAt + n * tick.stepDuration / this.options.density)
			}
			if (this.options.timelineEnabled) {
				const beat = ((tick.step / 4) % this.options.length + this.options.length) % this.options.length
				for (const step of this.options.timeline as SampleStep[]) {
					const offset = (step.beat - beat + this.options.length) % this.options.length
					if (step.beat >= this.options.length || offset >= 0.25) continue
					const at = tick.triggerAt + offset * 60 / tick.bpm
					if (this.options.mode === "granular") {
						for (const emitter of this.options.emitters as Emitter[]) this.play(buffer, Math.max(0, Math.min(127, step.note + emitter.transpose)), 90, at, Math.min(step.duration * 60 / tick.bpm, this.options.grain), emitter.position, emitter.level)
					} else this.play(buffer, step.note, 90, at, step.duration * 60 / tick.bpm, 0, 0.7, this.options.loop)
				}
			}
		}).catch(() => { /* The sample picker reports decode errors. */ })
	}
	stopClock(): void { this.lastStep = -1; this.allNotesOff() }
	override allNotesOff(): void {
		super.allNotesOff()
		this.gates?.clear(); this.epoch++
		for (const grain of this.grains ?? []) { try { grain.source.stop() } catch { /* Already ended. */ } grain.source.disconnect(); grain.gain.disconnect() }
		this.grains?.clear()
	}
	override async createGui(): Promise<HTMLElement> {
		if (this.samplerGui) return this.samplerGui
		const panel = await super.createGui()
		const select = (label: string, key: string, values: string[]) => {
			const row = document.createElement("label"), input = document.createElement("select")
			for (const value of values) { const option = document.createElement("option"); option.value = value; option.textContent = value; input.append(option) }
			input.value = this.options[key]
			input.addEventListener(EVENT_CHANGE, () => { this.allNotesOff(); this.options[key] = input.value; changed(this) })
			row.append(label, input); panel.append(row)
		}
		select("Follow harmony", "follow", ["none", "scale", "chord"])
		select("Playback", "mode", ["sample", "granular"])
		numberControl(panel, "Grain duration (seconds)", this.options.grain, 0.02, 0.5, (n) => { this.options.grain = n; changed(this) }, 0.01)
		numberControl(panel, "Grains per sixteenth per emitter", this.options.density, 1, 4, (n) => { this.options.density = n; changed(this) })
		const info = document.createElement("p"); info.textContent = "Granular sustain and the sample timeline follow transport. Retuning changes playback speed and duration."; panel.append(info)
		for (const [i, emitter] of (this.options.emitters as Emitter[]).entries()) {
			const details = document.createElement("details"), title = document.createElement("summary"); title.textContent = `Emitter ${i + 1}`; details.append(title); panel.append(details)
			numberControl(details, "Sample position", emitter.position, 0, 1, (n) => { emitter.position = n; changed(this) }, 0.01)
			numberControl(details, "Transpose", emitter.transpose, -24, 24, (n) => { emitter.transpose = n; changed(this) })
			numberControl(details, "Level", emitter.level, 0, 1, (n) => { emitter.level = n; changed(this) }, 0.05)
		}
		const enabledLabel = document.createElement("label"), enabled = document.createElement("input"); enabled.type = "checkbox"; enabled.checked = this.options.timelineEnabled
		enabled.addEventListener(EVENT_CHANGE, () => { this.options.timelineEnabled = enabled.checked; changed(this) })
		enabledLabel.append(enabled, " Play sample timeline"); panel.append(enabledLabel)
		numberControl(panel, "Timeline length (beats)", this.options.length, 1, 256, (n) => { this.options.length = n; changed(this) })
		const list = document.createElement("div"); panel.append(list)
		const render = () => {
			list.replaceChildren()
			;(this.options.timeline as SampleStep[]).forEach((step, index) => {
				const row = document.createElement("fieldset"), legend = document.createElement("legend"); legend.textContent = `Sample event ${index + 1}`; row.append(legend)
				numberControl(row, "Beat", step.beat, 0, 255.75, (n) => { step.beat = n; changed(this) }, 0.25)
				numberControl(row, "Duration (beats)", step.duration, 0.25, 64, (n) => { step.duration = n; changed(this) }, 0.25)
				numberControl(row, "Note", step.note, 0, 127, (n) => { step.note = n; changed(this) })
				action(row, "Remove event", () => { this.options.timeline.splice(index, 1); changed(this); render() })
				list.append(row)
			})
		}
		action(panel, "Add sample event", () => { if (this.options.timeline.length >= 128) return; this.options.timeline.push({ beat: 0, duration: 1, note: 60 }); changed(this); render() })
		render(); return this.samplerGui = panel
	}
	override async destroyGui(): Promise<void> { this.samplerGui = undefined; await super.destroyGui() }
}
