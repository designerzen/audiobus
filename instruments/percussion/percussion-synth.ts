import { GENERAL_MIDI_PERCUSSION_NOTES } from '../../timing/percussion-note-map.ts'
import type { IPercussionOutput, PercussionHit } from '../../timing/percussion-types.ts'
import {
	DEFAULT_DRUM_COMPRESSOR_SETTINGS,
	type DrumCompressorSettings,
} from '../../effects/drum-compressor.ts'

interface PercussionVoice {
	source: AudioScheduledSourceNode
	nodes: AudioNode[]
	part: string
	startAt: number
	stopAt: number
}

/** Small native Web Audio kit with no sample downloads or plugin dependencies. */
export class PercussionSynth implements IPercussionOutput {
	readonly output: GainNode
	private readonly input: GainNode
	private readonly compressor: DynamicsCompressorNode
	private readonly makeup: GainNode
	private readonly dry: GainNode
	private readonly wet: GainNode
	private readonly noise: AudioBuffer
	private readonly voices = new Set<PercussionVoice>()

	constructor(
		private readonly context: AudioContext,
		destination: AudioNode = context.destination,
	) {
		this.output = context.createGain()
		this.output.gain.value = 0.55
		this.output.connect(destination)
		this.input = context.createGain()
		this.compressor = context.createDynamicsCompressor()
		this.makeup = context.createGain()
		this.dry = context.createGain()
		this.wet = context.createGain()
		this.input.connect(this.dry)
		this.dry.connect(this.output)
		this.input.connect(this.compressor)
		this.compressor.connect(this.makeup)
		this.makeup.connect(this.wet)
		this.wet.connect(this.output)
		this.dry.gain.value = 0
		this.wet.gain.value = 1
		this.setCompressor(DEFAULT_DRUM_COMPRESSOR_SETTINGS)
		this.noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
		const data = this.noise.getChannelData(0)
		for (let index = 0; index < data.length; index++) data[index] = Math.random() * 2 - 1
	}

	setVolume(volume: number): void {
		this.output.gain.setTargetAtTime(volume, this.context.currentTime, 0.01)
	}

	setCompressor(settings: Readonly<DrumCompressorSettings>): void {
		const now = this.context.currentTime
		for (const [parameter, value] of [
			[this.compressor.threshold, settings.compressorThreshold],
			[this.compressor.ratio, settings.compressorRatio],
			[this.compressor.knee, settings.compressorKnee],
			[this.compressor.attack, settings.compressorAttack],
			[this.compressor.release, settings.compressorRelease],
		] as const)
			parameter.setTargetAtTime(value, now, 0.01)
		this.makeup.gain.setTargetAtTime(10 ** (settings.compressorMakeupGain / 20), now, 0.01)
		this.dry.gain.setTargetAtTime(settings.compressorEnabled ? 0 : 1, now, 0.01)
		this.wet.gain.setTargetAtTime(settings.compressorEnabled ? 1 : 0, now, 0.01)
	}

	trigger(hit: Readonly<PercussionHit>): void {
		if (!Number.isFinite(hit.velocity) || hit.velocity <= 0) return
		const part = hit.part === 'hat' ? (hit.open ? 'hatOpen' : 'hatClosed') : hit.part
		const note = GENERAL_MIDI_PERCUSSION_NOTES[part]
		if (note === undefined) return
		const at = Math.max(this.context.currentTime, hit.triggerAt)
		const velocity = Math.min(1, hit.velocity)
		const scale = hit.lengthScale ?? 1
		if (part === 'hatClosed' || part === 'hatPedal') {
			for (const voice of this.voices) {
				if (voice.part === 'hatOpen' && voice.startAt <= at && voice.stopAt > at) {
					voice.source.stop(at)
					voice.stopAt = at
				}
			}
		}
		if (note === 35 || note === 36) {
			this.tone(part, at, velocity * 0.9, 145, 42, 0.32 * scale, 'sine')
		} else if (note === 38 || note === 40 || note === 39) {
			this.noiseHit(
				part,
				at,
				velocity * 0.45,
				note === 39 ? 0.12 : 0.18,
				1600,
				'highpass',
				scale,
			)
			if (note !== 39)
				this.tone(part, at, velocity * 0.22, 190, 115, 0.09 * scale, 'triangle')
		} else if ([42, 44, 46, 49, 51, 52, 53, 55, 57, 59, 69, 70, 54, 82, 83].includes(note)) {
			const duration =
				part === 'hatOpen' ? 0.24 : part.startsWith('hat') ? 0.045 : note >= 69 ? 0.08 : 0.5
			this.noiseHit(
				part,
				at,
				velocity * 0.3,
				duration,
				note >= 69 ? 3500 : 6500,
				'highpass',
				scale,
			)
		} else {
			const frequency = 80 * 2 ** ((note - 41) / 16)
			this.tone(
				part,
				at,
				velocity * 0.45,
				frequency * 1.5,
				frequency,
				0.16 * scale,
				note >= 56 ? 'square' : 'sine',
			)
		}
	}

	private tone(
		part: string,
		at: number,
		velocity: number,
		from: number,
		to: number,
		duration: number,
		type: OscillatorType,
	): void {
		const source = this.context.createOscillator()
		source.type = type
		source.frequency.setValueAtTime(from, at)
		source.frequency.exponentialRampToValueAtTime(to, at + Math.max(0.01, duration * 0.7))
		this.voice(source, [], part, at, velocity, duration)
	}

	private noiseHit(
		part: string,
		at: number,
		velocity: number,
		duration: number,
		frequency: number,
		type: BiquadFilterType,
		scale: number,
	): void {
		const source = this.context.createBufferSource()
		source.buffer = this.noise
		const filter = this.context.createBiquadFilter()
		filter.type = type
		filter.frequency.value = frequency
		source.connect(filter)
		this.voice(source, [filter], part, at, velocity, duration * scale)
	}

	private voice(
		source: AudioScheduledSourceNode,
		nodes: AudioNode[],
		part: string,
		at: number,
		velocity: number,
		length: number,
	): void {
		const duration = Math.max(0.015, length)
		const envelope = this.context.createGain()
		envelope.gain.setValueAtTime(0, at)
		envelope.gain.linearRampToValueAtTime(velocity, at + 0.002)
		envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration)
		;(nodes.at(-1) ?? source).connect(envelope)
		envelope.connect(this.input)
		const voice: PercussionVoice = {
			source,
			nodes: [...nodes, envelope],
			part,
			startAt: at,
			stopAt: at + duration + 0.01,
		}
		this.voices.add(voice)
		source.onended = () => {
			this.voices.delete(voice)
			source.disconnect()
			for (const node of voice.nodes) node.disconnect()
		}
		source.start(at)
		source.stop(at + duration + 0.01)
	}

	allNotesOff(): void {
		for (const voice of this.voices) {
			voice.source.stop()
			voice.source.disconnect()
			for (const node of voice.nodes) node.disconnect()
		}
		this.voices.clear()
	}

	destroy(): void {
		this.allNotesOff()
		this.output.disconnect()
		this.input.disconnect()
		this.compressor.disconnect()
		this.makeup.disconnect()
		this.dry.disconnect()
		this.wet.disconnect()
	}
}