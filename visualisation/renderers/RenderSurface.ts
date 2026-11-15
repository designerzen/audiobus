/// <reference types="@webgpu/types" />
import { WebGLRenderer } from "./WebGLRenderer.ts"
import { VISUALISER_SHADER } from "./shader.ts"

export type VisualisationMode = "bars" | "scope" | "harmongraph" | "plasma"
export interface RenderLayer {
	mode: VisualisationMode
	data: Uint8Array<ArrayBuffer>
	time: number
	colour: readonly number[]
	thickness: number
	amplitude: number
	decay: number
	ratios: readonly number[]
	phases: readonly number[]
}
interface LayerBuffers {
	uniform: GPUBuffer
	samples: GPUBuffer
	bindGroup: GPUBindGroup
}

/** GPU rasterisation on an offscreen surface, presented without CPU pixel readback.
 * Keeping presentation separate permits a 2D fallback even after device loss.
 */
export class RenderSurface {
	readonly ready: Promise<void>
	backend: "pending" | "webgpu" | "webgl2" | "webgl" | "canvas2d" = "pending"
	private device?: GPUDevice
	private gpuContext?: GPUCanvasContext
	private pipeline?: GPURenderPipeline
	private offscreen?: OffscreenCanvas | HTMLCanvasElement
	private webgl?: WebGLRenderer
	private bitmap?: ImageBitmapRenderingContext
	private context?: CanvasRenderingContext2D
	private fallback?: OffscreenCanvasRenderingContext2D
	private buffers: LayerBuffers[] = []
	private packed = new Float32Array(32768)
	private settings = new Float32Array(20)
	private disposed = false
	private recovering = false
	private layers: RenderLayer[] = []

	constructor(readonly canvas: HTMLCanvasElement) {
		this.ready = this.initialise()
	}

	private async initialise(): Promise<void> {
		let device: GPUDevice | undefined
		try {
			if (
				typeof navigator === "undefined" ||
				!navigator.gpu ||
				typeof OffscreenCanvas === "undefined"
			) {
				throw new Error("WebGPU is unavailable")
			}
			const adapter = await navigator.gpu.requestAdapter()
			if (!adapter || this.disposed) {
				throw new Error("No WebGPU adapter")
			}
			device = await adapter.requestDevice()
			const offscreen = new OffscreenCanvas(this.canvas.width, this.canvas.height)
			const context = offscreen.getContext("webgpu")
			if (!context) {
				throw new Error("WebGPU canvas is unavailable")
			}
			const format = navigator.gpu.getPreferredCanvasFormat()
			const module = device.createShaderModule({ code: VISUALISER_SHADER })
			const pipeline = await device.createRenderPipelineAsync({
				layout: "auto",
				vertex: { module, entryPoint: "vertex" },
				fragment: {
					module,
					entryPoint: "fragment",
					targets: [
						{
							format,
							blend: {
								color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
								alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }
							}
						}
					]
				},
				primitive: { topology: "triangle-list" }
			})
			if (this.disposed) {
				device.destroy()
				return
			}
			context.configure({ device, format, alphaMode: "opaque" })
			this.device = device
			this.webgl?.dispose()
			this.webgl = undefined
			this.fallback = undefined
			this.offscreen = offscreen
			this.gpuContext = context
			this.pipeline = pipeline
			this.preparePresentation()
			this.backend = "webgpu"
			void device.lost.then(() => {
				if (!this.disposed && this.device === device) {
					this.releaseGPU()
					this.useFallback()
					// Request a fresh adapter once; fallback remains usable during recovery.
					if (!this.recovering) {
						this.recovering = true
						void this.initialise()
					}
				}
			})
		} catch {
			device?.destroy()
			if (!this.disposed) {
				this.useFallback()
			}
		}
	}

	private preparePresentation(): void {
		if (!this.bitmap && !this.context) {
			this.bitmap =
				typeof OffscreenCanvas !== "undefined"
					? (this.canvas.getContext("bitmaprenderer") ?? undefined)
					: undefined
			if (!this.bitmap) {
				this.context = this.canvas.getContext("2d") ?? undefined
			}
			if (!this.bitmap && !this.context) {
				throw new Error("Canvas presentation is unavailable")
			}
		}
	}

	private useFallback(): void {
		this.preparePresentation()
		this.webgl?.dispose()
		this.webgl = undefined
		for (const kind of ["webgl2", "webgl"] as const) {
			const surface =
				typeof OffscreenCanvas !== "undefined"
					? new OffscreenCanvas(this.canvas.width, this.canvas.height)
					: Object.assign(document.createElement("canvas"), {
							width: this.canvas.width,
							height: this.canvas.height
						})
			try {
				const gl = surface.getContext(kind, {
					alpha: false,
					preserveDrawingBuffer: true
				}) as WebGLRenderingContext | WebGL2RenderingContext | null
				if (!gl) {
					continue
				}
				const renderer = new WebGLRenderer(gl, kind === "webgl2")
				this.webgl = renderer
				this.offscreen = surface
				this.backend = kind
				surface.addEventListener("webglcontextlost", (event) => {
					event.preventDefault()
					if (!this.disposed && this.offscreen === surface) {
						this.useFallback()
					}
				})
				return
			} catch {
				/* Try the next rendering API with a fresh canvas. */
			}
		}
		if (this.bitmap) {
			this.offscreen = new OffscreenCanvas(this.canvas.width, this.canvas.height)
			this.fallback = this.offscreen.getContext("2d") ?? undefined
		} else {
			this.offscreen = undefined
			this.fallback = undefined
		}
		this.backend = "canvas2d"
	}

	beginFrame(): void {
		this.layers.length = 0
	}
	add(layer: RenderLayer): void {
		this.layers.push(layer)
	}
	endFrame(): void {
		if (
			this.disposed ||
			this.backend === "pending" ||
			!this.canvas.width ||
			!this.canvas.height
		) {
			return
		}
		if (this.offscreen) {
			if (this.offscreen.width !== this.canvas.width) {
				this.offscreen.width = this.canvas.width
			}
			if (this.offscreen.height !== this.canvas.height) {
				this.offscreen.height = this.canvas.height
			}
		}
		if (this.device && this.gpuContext && this.pipeline) {
			this.renderGPU()
		} else if (this.webgl) {
			this.webgl.render(this.layers, this.canvas.width, this.canvas.height)
		} else {
			this.renderFallback()
		}
		if (this.offscreen) {
			if (this.bitmap && this.offscreen instanceof OffscreenCanvas) {
				this.bitmap.transferFromImageBitmap(this.offscreen.transferToImageBitmap())
			} else if (this.context) {
				this.context.drawImage(this.offscreen, 0, 0)
			}
		}
	}

	private layerBuffers(index: number): LayerBuffers {
		if (!this.buffers[index]) {
			const device = this.device!
			const uniform = device.createBuffer({
				size: 80,
				usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
			})
			const samples = device.createBuffer({
				size: this.packed.byteLength,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
			})
			this.buffers[index] = {
				uniform,
				samples,
				bindGroup: device.createBindGroup({
					layout: this.pipeline!.getBindGroupLayout(0),
					entries: [
						{ binding: 0, resource: { buffer: uniform } },
						{ binding: 1, resource: { buffer: samples } }
					]
				})
			}
		}
		return this.buffers[index]
	}

	private renderGPU(): void {
		const device = this.device!
		const encoder = device.createCommandEncoder()
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: this.gpuContext!.getCurrentTexture().createView(),
					clearValue: { r: 0.015, g: 0.025, b: 0.05, a: 1 },
					loadOp: "clear",
					storeOp: "store"
				}
			]
		})
		pass.setPipeline(this.pipeline!)
		this.layers.forEach((layer, index) => {
			const count = Math.min(layer.data.length, this.packed.length)
			if (!count) {
				return
			}
			const buffers = this.layerBuffers(index)
			for (let i = 0; i < count; i++) {
				this.packed[i] = layer.data[i] / 255
			}
			this.settings.set([
				this.canvas.width,
				this.canvas.height,
				layer.time,
				["bars", "scope", "harmongraph", "plasma"].indexOf(layer.mode),
				...layer.colour,
				count,
				layer.thickness,
				layer.amplitude,
				layer.decay,
				...layer.ratios,
				0,
				...layer.phases,
				0
			])
			device.queue.writeBuffer(buffers.uniform, 0, this.settings)
			device.queue.writeBuffer(buffers.samples, 0, this.packed, 0, count)
			pass.setBindGroup(0, buffers.bindGroup)
			pass.draw(
				6,
				layer.mode === "plasma"
					? 1
					: layer.mode === "harmongraph"
						? count * 8
						: layer.mode === "scope"
							? Math.max(0, count - 1)
							: count
			)
		})
		pass.end()
		device.queue.submit([encoder.finish()])
	}

	private renderFallback(): void {
		const ctx = this.fallback ?? this.context
		if (!ctx) {
			return
		}
		const { width, height } = this.canvas
		ctx.fillStyle = "#04060d"
		ctx.fillRect(0, 0, width, height)
		for (const layer of this.layers) {
			const count = layer.data.length
			if (!count) {
				continue
			}
			const [r, g, b, alpha] = layer.colour
			ctx.strokeStyle = ctx.fillStyle = `rgba(${r * 255},${g * 255},${b * 255},${alpha})`
			ctx.lineWidth = layer.thickness
			if (layer.mode === "bars") {
				for (let i = 0; i < count; i++) {
					const level = layer.data[i] / 255
					ctx.fillStyle = `hsl(${(i / count) * 300} 80% 65% / ${alpha})`
					ctx.fillRect(
						(i * width) / count,
						height * (1 - level),
						(width / count) * 0.85,
						height * level
					)
				}
			} else if (layer.mode === "scope") {
				ctx.beginPath()
				for (let i = 0; i < count; i++) {
					const x = (i / Math.max(1, count - 1)) * width
					const y = (layer.data[i] / 255) * height
					if (i === 0) {
						ctx.moveTo(x, y)
					} else {
						ctx.lineTo(x, y)
					}
				}
				ctx.stroke()
			} else if (layer.mode === "harmongraph") {
				let a = Math.min(layer.amplitude, Math.min(width, height) * 0.23)
				for (let i = 0; i < count * 8; i++) {
					const t = (i * Math.PI) / 180
					const level = 0.5 + (2 * layer.data[i % count]) / 255
					const x =
						a *
						(level * Math.sin(layer.ratios[0] * t + layer.phases[0]) +
							Math.sin(layer.ratios[2] * t + layer.phases[2]))
					const y = a * level * Math.sin(layer.ratios[1] * t + layer.phases[1])
					ctx.fillRect(width / 2 + x, height / 2 + y, layer.thickness, layer.thickness)
					a *= Math.max(0, 1 - layer.decay)
				}
			} else {
				// Bounded fallback: coarse tiles rather than a full-resolution CPU pixel loop.
				for (let y = 0; y < 36; y++) {
					for (let x = 0; x < 64; x++) {
						const energy = layer.data[Math.floor((x / 64) * count)] / 255
						const t = layer.time / 1000
						const wave =
							Math.sin(x / 5 + t) +
							Math.sin(y / 4 - t) +
							Math.sin(Math.hypot(x - 32, y - 18) / 5 - t)
						ctx.fillStyle = `hsl(${wave * 60 + t * 15} 80% ${20 + energy * 45}% / ${alpha})`
						ctx.fillRect(
							(x * width) / 64,
							(y * height) / 36,
							Math.ceil(width / 64),
							Math.ceil(height / 36)
						)
					}
				}
			}
		}
	}

	private releaseGPU(): void {
		for (const buffers of this.buffers) {
			buffers.uniform.destroy()
			buffers.samples.destroy()
		}
		this.buffers = []
		this.gpuContext?.unconfigure()
		this.gpuContext = undefined
		this.pipeline = undefined
		const device = this.device
		this.device = undefined
		device?.destroy()
	}
	dispose(): void {
		this.disposed = true
		this.releaseGPU()
		this.webgl?.dispose()
		this.webgl = undefined
		this.layers.length = 0
		this.offscreen = undefined
	}
}