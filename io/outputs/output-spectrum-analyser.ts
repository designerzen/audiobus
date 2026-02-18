import type { IAudioOutput } from "./output-interface.ts"
import { convertNoteNumberToColour } from "../../conversion/note-to-colour.ts"
import { noteNumberToFrequency } from "../../conversion/note-to-frequency.ts"

export default class OutputSpectrumAnalyser extends EventTarget implements IAudioOutput {
	static ID: number = 0

	#uuid: string
	#analyser: AnalyserNode
	#animationFrameId: number | null = null
	#dataArray: Uint8Array
	#canvas: HTMLCanvasElement | null = null
	#offscreenCanvas: OffscreenCanvas | null = null
	#worker: Worker | null = null
	#fftSize: number = 2048
	#isRunning: boolean = false

	get uuid(): string {
		return this.#uuid
	}

	get name(): string {
		return "Spectrum Analyser"
	}

	get description(): string {
		return "Visualizes audio spectrum using FFT analysis with realtime waveform display"
	}

	get isConnected(): boolean {
		return this.#analyser !== null
	}
	
	get isHidden(): boolean {
		return false
	}


	constructor(mixerNode: GainNode) {
		super()
		this.#uuid = "Output-SpectrumAnalyser-" + OutputSpectrumAnalyser.ID++
		const audioContext = (mixerNode as any).context || new AudioContext()
		
		// Create analyser node
		this.#analyser = audioContext.createAnalyser()
		this.#analyser.fftSize = this.#fftSize
		
		// Connect mixer to analyser
		mixerNode.connect(this.#analyser)
		
		// Create data buffer
		const bufferLength = this.#analyser.frequencyBinCount
		this.#dataArray = new Uint8Array(bufferLength)
		
		// Create GUI and start visualization
		this.createGui()
		this.#startVisualization()
	}

	
	hasMidiOutput(): boolean {
		return false
	}
	hasAudioOutput(): boolean {
		return false
	}
	hasAutomationOutput(): boolean {
		return false
	}
	hasMpeOutput(): boolean {
		return false
	}
	hasOscOutput(): boolean {
		return false
	}
	hasSysexOutput(): boolean {
		return false
	}


	async createGui(): Promise<HTMLCanvasElement> {
		// Clear existing canvas
		if (this.#canvas) {
			this.#canvas.remove()
		}

		// Create canvas element
		this.#canvas = document.createElement("canvas")
		this.#canvas.width = 404
		this.#canvas.height = 202
		this.#canvas.style.cssText = `
			display: block;
			background: #000;
		`
		document.body.appendChild(this.#canvas)

		// Transfer control to OffscreenCanvas immediately (must be before initializing worker)
		this.#offscreenCanvas = this.#canvas.transferControlToOffscreen()
		
		// Initialize worker with the OffscreenCanvas
		this.#initializeWorker()

		return this.#canvas
	}

	async destroyGui(): Promise<void> {
		if (this.#canvas) {
			this.#canvas.remove()
			this.#canvas = null
		}
		this.#offscreenCanvas = null
	}



	#startVisualization(): void {
		if (this.#isRunning) return
		this.#isRunning = true
		this.#animate()
	}

	#animate = (): void => {
		this.#animationFrameId = requestAnimationFrame(this.#animate)

		if (!this.#analyser || !this.#worker || !this.#canvas) return

		// Get waveform data (time-domain)
		// @ts-ignore - Web Audio API type issue
		this.#analyser.getByteTimeDomainData(this.#dataArray)

		// Send waveform data to worker
		const dataCopy = Array.from(this.#dataArray)
		this.#worker.postMessage({
			type: 'render',
			waveformData: new Uint8Array(dataCopy),
			width: this.#canvas.width,
			height: this.#canvas.height,
			now: Date.now(),
		})
	}

	#initializeWorker(): void {
		if (!this.#offscreenCanvas) return

		const workerCode = `
			let canvas;
			let activeNotes = new Map();
			
			self.onmessage = (event) => {
				const { type } = event.data;
				
				switch (type) {
					case 'init':
						canvas = event.data.offscreenCanvas;
						break;
					case 'render': {
						const { waveformData, width, height, now } = event.data;
						render(waveformData, width, height, now);
						break;
					}
					case 'noteOn': {
						const { note, velocity, frequency, color } = event.data;
						activeNotes.set(note, {
							note,
							velocity,
							startTime: Date.now(),
							frequency,
							color,
						});
						break;
					}
					case 'noteOff':
						activeNotes.delete(event.data.note);
						break;
					case 'allNotesOff':
						activeNotes.clear();
						break;
				}
			};
			
			function render(waveformData, width, height, now) {
				if (!canvas) return;
				const ctx = canvas.getContext('2d');
				if (!ctx) return;
				
				// Clear
				ctx.fillStyle = '#000';
				ctx.fillRect(0, 0, width, height);
				
				// Draw waveform
				const bufferLength = waveformData.length;
				const sliceWidth = width / bufferLength;
				
				ctx.strokeStyle = '#00ff00';
				ctx.lineWidth = 2;
				ctx.beginPath();
				
				let x = 0;
				for (let i = 0; i < bufferLength; i++) {
					const v = waveformData[i] / 128.0;
					const y = (v * height) / 2;
					
					if (i === 0) {
						ctx.moveTo(x, y);
					} else {
						ctx.lineTo(x, y);
					}
					x += sliceWidth;
				}
				ctx.stroke();
				
				// Note effects
				if (activeNotes.size > 0) {
					const currentNow = Date.now();
					activeNotes.forEach((note) => {
						const timeSinceNote = (currentNow - note.startTime) / 1000;
						
						// Draw circle at center for note
						const centerX = width / 2;
						const centerY = height / 2;
						const radius = Math.max(10, 30 - timeSinceNote * 10);
						
						ctx.strokeStyle = note.color;
						ctx.lineWidth = 3;
						ctx.globalAlpha = Math.max(0, 1 - timeSinceNote * 0.5);
						ctx.beginPath();
						ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
						ctx.stroke();
						
						// Label
						ctx.globalAlpha = Math.max(0, 1 - timeSinceNote * 0.5);
						ctx.fillStyle = note.color;
						ctx.font = 'bold 14px monospace';
						ctx.textAlign = 'center';
						ctx.fillText(\`\${note.note}\`, centerX, centerY + 5);
					});
					ctx.globalAlpha = 1;
				}
			}
		`;

		const blob = new Blob([workerCode], { type: 'application/javascript' })
		const workerUrl = URL.createObjectURL(blob)
		this.#worker = new Worker(workerUrl)

		// Send OffscreenCanvas to worker
		this.#worker.postMessage(
			{
				type: 'init',
				offscreenCanvas: this.#offscreenCanvas,
			},
			[this.#offscreenCanvas as any]
		)
	}



	#stopVisualization(): void {
		if (!this.#isRunning) return
		this.#isRunning = false
		if (this.#animationFrameId !== null) {
			cancelAnimationFrame(this.#animationFrameId)
			this.#animationFrameId = null
		}
	}

	disconnect?(): Promise<void> | (() => void) {
		return () => {
			this.#stopVisualization()
			this.destroyGui()
			if (this.#worker) {
				this.#worker.terminate()
				this.#worker = null
			}
			this.#analyser.disconnect()
		}
	}

	noteOn(note: number, velocity: number): void {
		if (!this.#worker) return

		const frequency = noteNumberToFrequency(note)
		const color = convertNoteNumberToColour(note, 12, velocity)

		this.#worker.postMessage({
			type: 'noteOn',
			note,
			velocity,
			frequency,
			color,
			now: Date.now(),
		})
	}

	noteOff(note: number): void {
		if (!this.#worker) return

		this.#worker.postMessage({
			type: 'noteOff',
			note,
		})
	}

	allNotesOff(): void {
		if (!this.#worker) return

		this.#worker.postMessage({
			type: 'allNotesOff',
		})
	}
}
