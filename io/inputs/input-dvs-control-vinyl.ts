/**
 * DVS Control Vinyl Input - Serato v2
 * 
 * Captures line-in audio from a Serato v2 control vinyl/CD signal,
 * estimates relative speed from the pilot tone in an AudioWorklet, and
 * dispatches CLOCK signal AudioCommands for synchronization.
 * 
 * This pilot-tone tracker generates relative clock ticks. It does not
 * decode absolute timecode position or determine rotation direction.
 */
import AbstractInput from "./abstract-input.ts"
import { loadCaptureWorklet } from './load-capture-worklet.ts'
import { createAudioCommand } from "../../audio-command-factory.ts"
import { DVS_CLOCK, MIDI_CLOCK } from '../../commands.ts'

import type { IAudioInput } from "./input-interface.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"

export const DVS_CONTROL_VINYL_INPUT_ID = "DVS Control Vinyl"

// Serato v2 control vinyl pilot tone frequency
const PILOT_FREQUENCY = 1000

// Clock ticks per revolution (matching MIDI clock: 24 per quarter note)
const TICKS_PER_REVOLUTION = 24

// Reference RPM for standard turntable
const REFERENCE_RPM = 33.333

// Minimum signal amplitude to consider valid
const MIN_SIGNAL_THRESHOLD = 0.01

// Smoothing factor for speed calculation
const SPEED_SMOOTHING = 0.85

const DEFAULT_OPTIONS = {
	audioContext: undefined as AudioContext | undefined,
	deviceId: undefined as string | undefined,
	ticksPerRevolution: TICKS_PER_REVOLUTION,
	referenceRPM: REFERENCE_RPM,
	minSignalThreshold: MIN_SIGNAL_THRESHOLD,
	speedSmoothing: SPEED_SMOOTHING,
	useMidiClock: false,
}

const WORKLET_PROCESSOR_CODE = `
class DvsDecoderProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super()
		this._sampleRate = sampleRate
		this._pilotFreq = options.processorOptions?.pilotFrequency || 1000
		this._threshold = options.processorOptions?.threshold || 0.01
		this._ticksPerRevolution = options.processorOptions?.ticksPerRevolution || 24
		this._referenceRPM = options.processorOptions?.referenceRPM || 33.333
		this._smoothing = options.processorOptions?.speedSmoothing ?? 0.85
		
		// State
		this._prevSample = 0
		this._crossingCount = 0
		this._lastCrossingTime = 0
		this._lastTimestamp = currentTime
		this._tickCounter = 0
		this._totalPhase = 0
		this._direction = 0
		this._instantSpeed = 0
		this._smoothedSpeed = 0
		this._signalLevel = 0
		this._hasSignal = false
		
		// IIR bandpass filter coefficients (Q=10 around pilot freq)
		const Q = 10
		const w0 = 2 * Math.PI * this._pilotFreq / this._sampleRate
		const alpha = Math.sin(w0) / (2 * Q)
		const cosW0 = Math.cos(w0)
		
		this._b0 = alpha
		this._b1 = 0
		this._b2 = -alpha
		this._a0 = 1 + alpha
		this._a1 = -2 * cosW0
		this._a2 = 1 - alpha
		
		// Filter state
		this._x1 = 0
		this._x2 = 0
		this._y1 = 0
		this._y2 = 0
		
		// RMS calculation
		this._rmsSum = 0
		this._rmsCount = 0
		this._rmsWindowSize = 512
	}
	
	_filter(sample) {
		const x0 = sample
		const y0 = (this._b0 * x0 + this._b1 * this._x1 + this._b2 * this._x2 - this._a1 * this._y1 - this._a2 * this._y2) / this._a0
		
		this._x2 = this._x1
		this._x1 = x0
		this._y2 = this._y1
		this._y1 = y0
		
		return y0
	}
	
	_updateRMS(sample) {
		this._rmsSum += sample * sample
		this._rmsCount++
		
		if (this._rmsCount >= this._rmsWindowSize) {
			this._signalLevel = Math.sqrt(this._rmsSum / this._rmsCount)
			this._hasSignal = this._signalLevel > this._threshold
			this._rmsSum = 0
			this._rmsCount = 0
		}
	}
	
	process(inputs, outputs, parameters) {
		const input = inputs[0]
		if (!input || !input[0]) return true
		
		const channel = input[0]
		const now = currentTime
		
		for (let i = 0; i < channel.length; i++) {
			const sample = channel[i]
			
			// Update signal level
			this._updateRMS(sample)
			
			if (!this._hasSignal) {
				this._lastCrossingTime = 0
				this._prevSample = 0
				this._smoothedSpeed = 0
				this._totalPhase = 0
				continue
			}
			
			// Apply bandpass filter
			const filtered = this._filter(sample)
			
			// Detect zero crossings (positive-going)
			if (this._prevSample <= 0 && filtered > 0) {
				const fraction = -this._prevSample / (filtered - this._prevSample)
				const crossingTime = now + (i - 1 + fraction) / this._sampleRate
				const timeDelta = crossingTime - this._lastCrossingTime
				
				if (this._lastCrossingTime > 0 && timeDelta > 0.0001) {
					// Calculate instantaneous frequency
					const instantFreq = 1 / timeDelta
					
					// Calculate speed ratio (1.0 = reference speed)
					this._instantSpeed = instantFreq / this._pilotFreq
					this._smoothedSpeed = this._smoothedSpeed * this._smoothing + this._instantSpeed * (1 - this._smoothing)
					
					// Accumulate phase
					this._totalPhase += this._referenceRPM / (60 * this._pilotFreq)
					
					// Generate tick when phase accumulator reaches threshold
					const phasePerTick = 1 / this._ticksPerRevolution
					while (this._totalPhase >= phasePerTick) {
						this._totalPhase -= phasePerTick
						this._tickCounter++
						
						this.port.postMessage({
							type: 'tick',
							tickCount: this._tickCounter,
							direction: this._direction,
							speed: this._smoothedSpeed,
							timestamp: crossingTime
						})
					}
				}
				
				this._lastCrossingTime = crossingTime
				this._crossingCount++
			}
			
			this._prevSample = filtered
		}
		
		// Periodically send status
		if (now - this._lastTimestamp > 0.1) {
			this._lastTimestamp = now
			this.port.postMessage({
				type: 'status',
				signalLevel: this._signalLevel,
				hasSignal: this._hasSignal,
				crossingCount: this._crossingCount,
				speed: this._smoothedSpeed,
				direction: this._direction,
				tickCount: this._tickCounter,
				timestamp: now
			})
		}
		
		return true
	}
}

registerProcessor('dvs-decoder-processor', DvsDecoderProcessor)
`

interface IDvsStats {
	signalLevel: number
	hasSignal: boolean
	speed: number
	direction: number
	tickCount: number
	bpm: number
}

export default class InputDvsControlVinyl extends AbstractInput implements IAudioInput {
	#mediaStream: MediaStream | null = null
	#sourceNode: MediaStreamAudioSourceNode | null = null
	#workletNode: AudioWorkletNode | null = null
	#isListening: boolean = false
	#tickCount: number = 0
	#tickTimes: number[] = []
	#stats: IDvsStats = {
		signalLevel: 0,
		hasSignal: false,
		speed: 0,
		direction: 0,
		tickCount: 0,
		bpm: 0,
	}

	get name(): string {
		return DVS_CONTROL_VINYL_INPUT_ID
	}

	get description(): string {
		return "Control vinyl pilot-tone clock (relative speed only; no direction or absolute position decoding)"
	}

	get isListening(): boolean {
		return this.#isListening
	}

	get stats(): IDvsStats {
		return { ...this.#stats }
	}

	constructor(options: Record<string, any> = DEFAULT_OPTIONS) {
		super({ ...DEFAULT_OPTIONS, ...options })
		for (const name of ['ticksPerRevolution', 'referenceRPM', 'minSignalThreshold']) {
			if (!Number.isFinite(this.options[name]) || this.options[name] <= 0) {
				throw new RangeError(`${name} must be positive and finite`)
			}
		}
		if (!Number.isFinite(this.options.speedSmoothing) || this.options.speedSmoothing < 0 || this.options.speedSmoothing >= 1) {
			throw new RangeError('speedSmoothing must be between 0 (inclusive) and 1 (exclusive)')
		}
	}

	hasAudioInput(): boolean {
		return true
	}

	async connect(): Promise<Function> {
		if (this.#isListening) return () => this.disconnect()
		if (!this.options.audioContext) {
			throw new Error('InputDvsControlVinyl requires audioContext to be passed via options')
		}

		const audioContext: AudioContext = this.options.audioContext
		await loadCaptureWorklet(audioContext, 'dvs-decoder-processor', WORKLET_PROCESSOR_CODE)

		const audioConstraints: MediaTrackConstraints = {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false,
		}

		if (this.options.deviceId) {
			audioConstraints.deviceId = { exact: this.options.deviceId }
		} else {
			audioConstraints.channelCount = { ideal: 1 }
		}

		this.#mediaStream = await navigator.mediaDevices.getUserMedia({
			audio: audioConstraints
		})

		this.#sourceNode = audioContext.createMediaStreamSource(this.#mediaStream)

		this.#workletNode = new AudioWorkletNode(audioContext, 'dvs-decoder-processor', {
			processorOptions: {
				pilotFrequency: PILOT_FREQUENCY,
				threshold: this.options.minSignalThreshold,
				ticksPerRevolution: this.options.ticksPerRevolution,
				referenceRPM: this.options.referenceRPM,
				speedSmoothing: this.options.speedSmoothing,
			}
		})

		this.#workletNode.port.onmessage = (event) => this.#onWorkletMessage(event.data)

		this.#sourceNode.connect(this.#workletNode)

		this.#isListening = true
		this.setAsConnected()

		console.info("[DVS Control Vinyl] Connected and listening", {
			sampleRate: audioContext.sampleRate,
			deviceId: this.options.deviceId || 'default',
		})

		return () => this.disconnect()
	}

	async disconnect(): Promise<void> {
		this.#isListening = false

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

		this.#tickTimes = []
		this.#tickCount = 0
		this.#stats = { signalLevel: 0, hasSignal: false, speed: 0, direction: 0, tickCount: 0, bpm: 0 }
		this.setAsDisconnected()
		console.info("[DVS Control Vinyl] Disconnected")
	}

	#onWorkletMessage(data: any): void {
		if (!this.#isListening) return

		if (data.type === 'tick') {
			this.#handleTick(data)
		} else if (data.type === 'status') {
			this.#stats.signalLevel = data.signalLevel
			this.#stats.hasSignal = data.hasSignal
			this.#stats.speed = data.speed
			this.#stats.direction = data.direction
			this.#stats.tickCount = data.tickCount
			if (!data.hasSignal) {
				this.#tickTimes = []
				this.#stats.bpm = 0
			}
		}
	}

	#handleTick(data: any): void {
		const now = this.now
		const direction = data.direction
		const speed = data.speed

		this.#tickCount++
		this.#stats.tickCount = this.#tickCount

		// Track tick times for BPM calculation
		this.#tickTimes.push(data.timestamp)
		if (this.#tickTimes.length > 48) {
			this.#tickTimes.shift()
		}

		// Calculate BPM from recent ticks
		if (this.#tickTimes.length >= 2) {
			const timeSpan = this.#tickTimes[this.#tickTimes.length - 1] - this.#tickTimes[0]
			const tickCount = this.#tickTimes.length - 1
			if (timeSpan > 0) {
				this.#stats.bpm = 60 * tickCount / (timeSpan * 24)
			}
		}

		const commandType = this.options.useMidiClock ? MIDI_CLOCK : DVS_CLOCK

		// Dispatch clock command
		const command: IAudioCommand = createAudioCommand(
			commandType,
			this.#tickCount,
			now,
			this.name
		)
		command.value = speed * 1000
		command.bpm = this.#stats.bpm
		command.velocity = Math.abs(direction) * 127
		command.text = 'direction unknown'
		this.dispatch(command)
	}

	async destroy(): Promise<void> {
		if (this.#isListening) {
			await this.disconnect()
		}
	}
}
