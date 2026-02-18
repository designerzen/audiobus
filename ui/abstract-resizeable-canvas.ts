/**
 * Maximum canvas size before downscaling
 * Prevents performance issues on very large displays
 */
const DEFAULT_PERFORMANCE_BOUNDARY_SIZE = 1080

interface ResizeableOptions {
	screenBoundary?: number
	resize?: boolean
	[key: string]: any
}

const DEFAULT_OPTIONS: ResizeableOptions = {
	screenBoundary: DEFAULT_PERFORMANCE_BOUNDARY_SIZE,
	resize: false,
}

/**
 * Abstract base class for canvas elements that can resize
 * Uses OffscreenCanvas and Web Workers for rendering
 */
export class AbstractResizeable {
	element: HTMLCanvasElement
	worker: Worker
	optional: ResizeableOptions

	width?: number
	height?: number
	started?: boolean

	/**
	 * Initialize a resizeable canvas with worker support
	 * @param canvas - HTML canvas element to manage
	 * @param workerURI - URI to the worker script
	 * @param optional - Configuration options
	 */
	constructor(canvas: HTMLCanvasElement, workerURI: string, optional: ResizeableOptions = {}) {
		this.element = canvas
		this.optional = { ...DEFAULT_OPTIONS, ...optional }
		this.onResize = this.onResize.bind(this)

		const canvasWorker = canvas.transferControlToOffscreen()
		const payload = { canvas: canvasWorker, ...this.optional }
		this.worker = new Worker(workerURI)
		this.worker.postMessage(payload, [canvasWorker])

		// Add error listeners for the worker
		this.worker.onerror = (error: ErrorEvent) => {
			console.error(
				'Worker Error:',
				error.message,
				error.filename,
				error.lineno,
				error
			)
			// You might want to add logic here to try and recover or display a message
		}

		this.worker.onmessageerror = (event: MessageEvent) => {
			console.error('Worker Message Error:', event)
		}

		if (this.optional.resize) {
			const resizeObserver = new ResizeObserver(this.onResize)
			resizeObserver.observe(canvas, { box: 'content-box' })
		} else {
			// dispatch worker message to resize to known size
			const payload = {
				type: 'resize',
				displayWidth: canvas.width,
				displayHeight: canvas.height,
				scaleFactor: 1,
				...this.optional,
			}
			this.worker.postMessage(payload)
		}
	}

	/**
	 * Prevents overgrowth and small sizes
	 * Downscales canvas if it exceeds performance boundary
	 * @param width - Display width in CSS pixels
	 * @param height - Display height in CSS pixels
	 * @param dpr - Device pixel ratio
	 * @returns True if resize was needed
	 */
	resizeCanvasToDisplaySize(width: number, height: number, dpr: number): boolean {
		let displayWidth = Math.round(width * dpr)
		let displayHeight = Math.round(height * dpr)
		let scaleFactor = 1

		// HALVE if over size, and keep halving it till it is smaller
		// the CSS should automatically scale it up
		while (
			displayWidth > (this.optional.screenBoundary || DEFAULT_PERFORMANCE_BOUNDARY_SIZE) ||
			displayHeight > (this.optional.screenBoundary || DEFAULT_PERFORMANCE_BOUNDARY_SIZE)
		) {
			displayWidth /= 2
			displayHeight /= 2
			scaleFactor++
		}

		// Get the size the browser is displaying the canvas in device pixels.
		// Check if the canvas is not the same size.
		const needResize = this.element.width !== displayWidth || this.element.height !== displayHeight

		if (needResize) {
			this.started = true

			this.width = displayWidth
			this.height = displayHeight

			// NB. Make the canvas the same size via OffscreenCanvas
			//      this.canvas.width  = displayWidth
			//      this.canvas.height = displayHeight
			const payload = { type: 'resize', displayWidth, displayHeight, scaleFactor, ...this.optional }
			this.worker.postMessage(payload)
		}

		return needResize
	}

	/**
	 * Handle resize observer events
	 * @param entries - ResizeObserverEntry array
	 */
	onResize(entries: ResizeObserverEntry[]): void {
		for (const entry of entries) {
			let width: number
			let height: number
			let dpr = window.devicePixelRatio

			if (entry.devicePixelContentBoxSize) {
				// NOTE: Only this path gives the correct answer
				// The other paths are an imperfect fallback
				// for browsers that don't provide any way to do this
				width = entry.devicePixelContentBoxSize[0].inlineSize
				height = entry.devicePixelContentBoxSize[0].blockSize
				dpr = 1 // it's already in width and height
			} else if (entry.contentBoxSize) {
				if (Array.isArray(entry.contentBoxSize) && entry.contentBoxSize[0]) {
					width = entry.contentBoxSize[0].inlineSize
					height = entry.contentBoxSize[0].blockSize
				} else {
					// legacy
					const contentBox = entry.contentBoxSize as DOMRectReadOnly
					width = contentBox.inlineSize
					height = contentBox.blockSize
				}
			} else {
				// legacy
				width = entry.contentRect.width
				height = entry.contentRect.height
			}

			this.resizeCanvasToDisplaySize(width, height, dpr)
		}
	}
}
