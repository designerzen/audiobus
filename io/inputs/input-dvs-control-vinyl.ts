/**
 * DVS Control Vinyl Input - Serato v2
 *
 * Captures line-in audio from a Serato v2 control vinyl/CD signal,
 * estimates relative speed from the pilot tone in an AudioWorklet, and
 * dispatches DVS_CLOCK AudioCommands for synchronization.
 *
 * Ticks are musical: 24 per beat of referenceBPM x speed, so the reported
 * bpm is the track tempo. DVS_START / DVS_STOP bracket a run of ticks.
 * This pilot-tone tracker does not decode absolute timecode position or
 * determine rotation direction.
 */
import AbstractInput from "./abstract-input.ts"
import { loadCaptureWorklet } from "./load-capture-worklet.ts"
import { createAudioCommand } from "../../commands/audio-command-factory.ts"
import { DVS_CLOCK, DVS_START, DVS_STOP } from "../../commands/commands.ts"

import type { IAudioInput } from "./input-interface.ts"
import type { IAudioCommand } from "../../commands/audio-command-interface.ts"

export const DVS_CONTROL_VINYL_INPUT_ID = "DVS Control Vinyl"

// Serato v2 control vinyl pilot tone frequency
const PILOT_FREQUENCY = 1000

// Track tempo at speed 1.0 (24 ticks per beat, matching MIDI clock)
const REFERENCE_BPM = 120

// Stop the run when no tick has arrived for this long (seconds)
const STOP_TIMEOUT = 0.5

// Minimum signal amplitude to consider valid
const MIN_SIGNAL_THRESHOLD = 0.01

// Smoothing factor for speed calculation
const SPEED_SMOOTHING = 0.85

const DEFAULT_OPTIONS = {
	audioContext: undefined as AudioContext | undefined,
	deviceId: undefined as string | undefined,
	referenceBPM: REFERENCE_BPM,
	minSignalThreshold: MIN_SIGNAL_THRESHOLD,
	speedSmoothing: SPEED_SMOOTHING
}

const WORKLET_PROCESSOR_CODE = `
class DvsDecoderProcessor extends AudioWorkletProcessor {
	constructor(options) {
		super()
		this._sampleRate = sampleRate
		this._pilotFreq = options.processorOptions?.pilotFrequency || 1000
		this._threshold = options.processorOptions?.threshold || 0.01
		this._referenceBPM = options.processorOptions?.referenceBPM || 120
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
		
		this.port.onmessage = (event) => {
			const bpm = event.data?.referenceBPM
			if (event.data?.type === 'referenceBPM' && Number.isFinite(bpm) && bpm > 0) {
				this._referenceBPM = bpm
			}
		}
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
					
					// Accumulate ticks: 24 per beat of referenceBPM at speed 1.0
					this._totalPhase += this._referenceBPM * 24 / (60 * this._pilotFreq)
					
					while (this._totalPhase >= 1) {
						this._totalPhase -= 1
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

const emptyStats = (): IDvsStats => ({
	signalLevel: 0,
	hasSignal: false,
	speed: 0,
	direction: 0,
	tickCount: 0,
	bpm: 0
})

export default class InputDvsControlVinyl extends AbstractInput implements IAudioInput {
	#mediaStream: MediaStream | null = null
	#sourceNode: MediaStreamAudioSourceNode | null = null
	#workletNode: AudioWorkletNode | null = null
	#isListening: boolean = false
	#tickCount: number = 0
	#tickTimes: number[] = []
	#running: boolean = false
	#referenceBPM: number
	#stats: IDvsStats = emptyStats()

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

	get referenceBPM(): number {
		return this.#referenceBPM
	}

	/** Track tempo at speed 1.0; takes effect immediately in the worklet */
	setReferenceBPM(bpm: number): void {
		if (!Number.isFinite(bpm) || bpm <= 0) {
			throw new RangeError("referenceBPM must be positive and finite")
		}
		this.#referenceBPM = bpm
		this.#workletNode?.port.postMessage({
			type: "referenceBPM",
			referenceBPM: bpm
		})
	}

	constructor(options: Record<string, any> = DEFAULT_OPTIONS) {
		super({ ...DEFAULT_OPTIONS, ...options })
		for (const name of ["referenceBPM", "minSignalThreshold"]) {
			if (!Number.isFinite(this.options[name]) || this.options[name] <= 0) {
				throw new RangeError(`${name} must be positive and finite`)
			}
		}
		if (
			!Number.isFinite(this.options.speedSmoothing) ||
			this.options.speedSmoothing < 0 ||
			this.options.speedSmoothing >= 1
		) {
			throw new RangeError("speedSmoothing must be between 0 (inclusive) and 1 (exclusive)")
		}
		this.#referenceBPM = this.options.referenceBPM
	}

	hasAudioInput(): boolean {
		return true
	}

	async connect(): Promise<Function> {
		if (this.#isListening) {
			return () => this.disconnect()
		}
		if (!this.options.audioContext) {
			throw new Error("InputDvsControlVinyl requires audioContext to be passed via options")
		}

		const audioContext: AudioContext = this.options.audioContext
		await loadCaptureWorklet(audioContext, "dvs-decoder-processor", WORKLET_PROCESSOR_CODE)

		const audioConstraints: MediaTrackConstraints = {
			echoCancellation: false,
			noiseSuppression: false,
			autoGainControl: false
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

		this.#workletNode = new AudioWorkletNode(audioContext, "dvs-decoder-processor", {
			processorOptions: {
				pilotFrequency: PILOT_FREQUENCY,
				threshold: this.options.minSignalThreshold,
				referenceBPM: this.#referenceBPM,
				speedSmoothing: this.options.speedSmoothing
			}
		})

		this.#workletNode.port.onmessage = (event) => this.#onWorkletMessage(event.data)

		this.#sourceNode.connect(this.#workletNode)

		this.#isListening = true
		this.setAsConnected()

		console.info("[DVS Control Vinyl] Connected and listening", {
			sampleRate: audioContext.sampleRate,
			deviceId: this.options.deviceId || "default"
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
			this.#mediaStream.getTracks().forEach((track) => track.stop())
			this.#mediaStream = null
		}

		this.#tickTimes = []
		this.#tickCount = 0
		this.#running = false
		this.#stats = emptyStats()
		this.setAsDisconnected()
		console.info("[DVS Control Vinyl] Disconnected")
	}

	#onWorkletMessage(data: any): void {
		if (!this.#isListening) {
			return
		}

		if (data.type === "tick") {
			this.#handleTick(data)
		} else if (data.type === "status") {
			this.#stats.signalLevel = data.signalLevel
			this.#stats.hasSignal = data.hasSignal
			this.#stats.speed = data.speed
			this.#stats.direction = data.direction
			this.#stats.tickCount = data.tickCount
			const lastTick = this.#tickTimes.at(-1)
			if (
				this.#running &&
				(!data.hasSignal ||
					(lastTick !== undefined && data.timestamp - lastTick > STOP_TIMEOUT))
			) {
				this.#running = false
				this.#dispatchCommand(DVS_STOP, data.timestamp)
			}
			if (!data.hasSignal) {
				this.#tickTimes = []
				this.#stats.bpm = 0
			}
		}
	}

	#handleTick(data: any): void {
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
				this.#stats.bpm = (60 * tickCount) / (timeSpan * 24)
			}
		}

		if (!this.#running) {
			this.#running = true
			this.#dispatchCommand(DVS_START, data.timestamp)
		}

		this.#dispatchCommand(DVS_CLOCK, data.timestamp, (command) => {
			command.value = speed * 1000
			command.bpm = this.#stats.bpm
			command.velocity = Math.abs(direction) * 127
			command.text = "direction unknown"
		})
	}

	#dispatchCommand(
		type: string,
		audioTime: number,
		configure?: (command: IAudioCommand) => void
	): void {
		const command: IAudioCommand = createAudioCommand(
			type,
			this.#tickCount,
			this.now,
			this.name
		)
		command.audioTime = audioTime
		configure?.(command)
		this.dispatch(command)
	}

	async destroy(): Promise<void> {
		if (this.#isListening) {
			await this.disconnect()
		}
	}
}