/**
 * Microphone Input with ML-based Polyphonic Pitch Detection
 * 
 * Uses Spotify's Basic Pitch neural network to detect
 * polyphonic notes from microphone audio in near-real-time.
 * Audio is captured in chunks, resampled to 22050Hz, and fed through
 * the model which outputs note events with pitch bend data.
 * 
 * https://github.com/spotify/basic-pitch-ts/tree/main
 */
import AbstractInput from "./abstract-input.ts"
import { loadCaptureWorklet } from './load-capture-worklet.ts'
import { createAudioCommand } from "../../audio-command-factory.ts"
import { NOTE_ON, NOTE_OFF, PITCH_BEND } from '../../commands.ts'

import type { IAudioInput } from "./input-interface.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { NoteEventTime } from "@spotify/basic-pitch"

export const MICROPHONE_PITCH_INPUT_ID = "MicrophonePitch"

const BASIC_PITCH_SAMPLE_RATE = 22050

const DEFAULT_OPTIONS = {
	modelUrl: '/models/basic-pitch/model.json',
	bufferDurationSeconds: 2,
	onsetThreshold: 0.5,
	frameThreshold: 0.3,
	minNoteLength: 5,
	audioContext: undefined as AudioContext | undefined,
}

const WORKLET_PROCESSOR_CODE = `
class PitchCaptureProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super()
		this._bufferSize = options.processorOptions?.bufferSize || 4096
		this._buffer = new Float32Array(this._bufferSize)
		this._writeIndex = 0
	}
	process(inputs) {
		const input = inputs[0]
		if (!input || !input[0]) return true
		const channel = input[0]
		for (let i = 0; i < channel.length; i++) {
			this._buffer[this._writeIndex++] = channel[i]
			if (this._writeIndex >= this._bufferSize) {
				this.port.postMessage({ audioData: this._buffer.slice() })
				this._writeIndex = 0
			}
		}
		return true
	}
}
registerProcessor('pitch-capture-processor', PitchCaptureProcessor)
`

export default class InputMicrophonePitch extends AbstractInput implements IAudioInput {

	#audioContext: AudioContext | null = null
	#mediaStream: MediaStream | null = null
	#sourceNode: MediaStreamAudioSourceNode | null = null
	#workletNode: AudioWorkletNode | null = null
	#isListening: boolean = false
	#activeNotes: Set<number> = new Set()

	#basicPitch: any = null
	#audioBuffer: Float32Array[] = []
	#samplesCollected: number = 0
	#samplesNeeded: number = 0
	#processing: boolean = false

	get name(): string {
		return MICROPHONE_PITCH_INPUT_ID
	}

	get description(): string {
		return "Microphone (Basic Pitch ML)"
	}

	get isListening(): boolean {
		return this.#isListening
	}

	constructor(options: Record<string, any> = DEFAULT_OPTIONS) {
		super({ ...DEFAULT_OPTIONS, ...options })
		this.#samplesNeeded = (this.options.bufferDurationSeconds || 2) * BASIC_PITCH_SAMPLE_RATE
	}

	hasAudioInput(): boolean {
		return true
	}

	async connect(): Promise<Function> {
		if (this.#isListening) return () => this.disconnect()
		if (!this.options.audioContext) {
			throw new Error('InputMicrophonePitch requires audioContext to be passed via options')
		}

		const audioContext: AudioContext = this.options.audioContext
		this.#audioContext = audioContext
		await loadCaptureWorklet(audioContext, 'pitch-capture-processor', WORKLET_PROCESSOR_CODE)

		const { BasicPitch } = await import("@spotify/basic-pitch")
		this.#basicPitch = new BasicPitch(this.options.modelUrl || DEFAULT_OPTIONS.modelUrl)

		this.#mediaStream = await navigator.mediaDevices.getUserMedia({
			audio: {
				echoCancellation: false,
				noiseSuppression: false,
				autoGainControl: false,
			}
		})

		this.#sourceNode = audioContext.createMediaStreamSource(this.#mediaStream)

		this.#workletNode = new AudioWorkletNode(audioContext, 'pitch-capture-processor', {
			processorOptions: { bufferSize: 4096 }
		})
		this.#workletNode.port.onmessage = (event) => this.#onAudioData(event.data.audioData)

		this.#sourceNode.connect(this.#workletNode)

		this.#isListening = true
		this.setAsConnected()

		console.info("[MicrophonePitch] Connected and listening", {
			sampleRate: audioContext.sampleRate,
			modelUrl: this.options.modelUrl
		})

		return () => this.disconnect()
	}

	async disconnect(): Promise<void> {
		this.#isListening = false

		// Send note off for any active notes
		for (const note of this.#activeNotes) {
			this.#dispatchNoteOff(note)
		}
		this.#activeNotes.clear()

		if (this.#workletNode) {
			this.#workletNode.port.onmessage = null
			this.#workletNode.disconnect()
			this.#workletNode = null
		}

		if (this.#sourceNode) {
			this.#sourceNode.disconnect()
			this.#sourceNode = null
		}

		if (this.#mediaStream) {
			this.#mediaStream.getTracks().forEach(track => track.stop())
			this.#mediaStream = null
		}

		this.#audioBuffer = []
		this.#samplesCollected = 0

		this.setAsDisconnected()
		console.info("[MicrophonePitch] Disconnected")
	}

	#onAudioData(audioData: Float32Array): void {
		if (!this.#isListening) return

		this.#audioBuffer.push(audioData)
		this.#samplesCollected += audioData.length

		if (this.#samplesCollected >= this.#samplesNeeded && !this.#processing) {
			this.#processBuffer()
		}
	}

	async #processBuffer(): Promise<void> {
		if (this.#processing || !this.#basicPitch || !this.#audioContext) return
		this.#processing = true

		try {
			// Concatenate collected chunks
			const totalSamples = this.#audioBuffer.reduce((sum, buf) => sum + buf.length, 0)
			const rawAudio = new Float32Array(totalSamples)
			let offset = 0
			for (const chunk of this.#audioBuffer) {
				rawAudio.set(chunk, offset)
				offset += chunk.length
			}

			// Reset buffer
			this.#audioBuffer = []
			this.#samplesCollected = 0

			// Resample to 22050Hz using OfflineAudioContext
			const resampled = await this.#resample(rawAudio, this.#audioContext.sampleRate)

			// Run through BasicPitch model
			const frames: number[][] = []
			const onsets: number[][] = []
			const contours: number[][] = []

			await this.#basicPitch.evaluateModel(
				resampled,
				(f: number[][], o: number[][], c: number[][]) => {
					frames.push(...f)
					onsets.push(...o)
					contours.push(...c)
				},
				() => {}
			)

			if (frames.length === 0) {
				this.#processing = false
				return
			}

			// Convert model output to note events
			const { outputToNotesPoly, addPitchBendsToNoteEvents, noteFramesToTime } = await import("@spotify/basic-pitch")

			const noteEvents = noteFramesToTime(
				addPitchBendsToNoteEvents(
					contours,
					outputToNotesPoly(
						frames,
						onsets,
						this.options.onsetThreshold ?? DEFAULT_OPTIONS.onsetThreshold,
						this.options.frameThreshold ?? DEFAULT_OPTIONS.frameThreshold,
						this.options.minNoteLength ?? DEFAULT_OPTIONS.minNoteLength
					)
				)
			)

			this.#handleNoteEvents(noteEvents)
		} catch (error) {
			console.error("[MicrophonePitch] Processing error", error)
		}

		this.#processing = false
	}

	async #resample(audioData: Float32Array, sourceSampleRate: number): Promise<Float32Array> {
		if (sourceSampleRate === BASIC_PITCH_SAMPLE_RATE) {
			return audioData
		}

		const duration = audioData.length / sourceSampleRate
		const offlineCtx = new OfflineAudioContext(1, Math.ceil(duration * BASIC_PITCH_SAMPLE_RATE), BASIC_PITCH_SAMPLE_RATE)
		const buffer = offlineCtx.createBuffer(1, audioData.length, sourceSampleRate)
		buffer.getChannelData(0).set(audioData)

		const source = offlineCtx.createBufferSource()
		source.buffer = buffer
		source.connect(offlineCtx.destination)
		source.start(0)

		const rendered = await offlineCtx.startRendering()
		return rendered.getChannelData(0)
	}

	#handleNoteEvents(notes: NoteEventTime[]): void {
		if (!this.#isListening) return

		const newActiveNotes = new Set<number>()

		for (const note of notes) {
			const midiNote = note.pitchMidi
			newActiveNotes.add(midiNote)

			if (!this.#activeNotes.has(midiNote)) {
				this.#dispatchNoteOn(midiNote, note.amplitude)
			}

			// Dispatch pitch bends if present
			if (note.pitchBends && note.pitchBends.length > 0) {
				const avgBend = note.pitchBends.reduce((a, b) => a + b, 0) / note.pitchBends.length
				if (Math.abs(avgBend) > 0.1) {
					this.#dispatchPitchBend(midiNote, avgBend)
				}
			}
		}

		// Send note off for notes no longer active
		for (const note of this.#activeNotes) {
			if (!newActiveNotes.has(note)) {
				this.#dispatchNoteOff(note)
			}
		}

		this.#activeNotes = newActiveNotes
	}

	#dispatchNoteOn(noteNumber: number, amplitude: number): void {
		const command: IAudioCommand = createAudioCommand(
			NOTE_ON,
			noteNumber,
			this.now,
			this.name
		)
		command.velocity = Math.round(Math.min(1, amplitude) * 127)
		this.dispatch(command)
	}

	#dispatchNoteOff(noteNumber: number): void {
		const command: IAudioCommand = createAudioCommand(
			NOTE_OFF,
			noteNumber,
			this.now,
			this.name
		)
		this.dispatch(command)
	}

	#dispatchPitchBend(noteNumber: number, bendValue: number): void {
		// bendValue from basic-pitch is in semitone fractions
		// Convert to MIDI pitch bend range (0-16383, center 8192)
		const pitchBendMidi = Math.round(8192 + (bendValue / 2) * 8192)
		const command: IAudioCommand = createAudioCommand(
			PITCH_BEND,
			noteNumber,
			this.now,
			this.name
		)
		command.value = Math.max(0, Math.min(16383, pitchBendMidi))
		this.dispatch(command)
	}

	async destroy(): Promise<void> {
		if (this.#isListening) {
			await this.disconnect()
		}
	}
}
