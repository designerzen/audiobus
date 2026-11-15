import { afterEach, describe, expect, it, vi } from "vitest"
vi.mock("../renderers/WebGLRenderer.ts", () => ({
	WebGLRenderer: class {
		render = vi.fn()
		dispose = vi.fn()
	}
}))
import { RenderSurface } from "../renderers/RenderSurface.ts"

function setup(available: string[], gpu?: unknown) {
	const attempts: string[] = []
	const context = { fillRect: vi.fn(), drawImage: vi.fn() }
	class Offscreen {
		width: number
		height: number
		constructor(width: number, height: number) {
			this.width = width
			this.height = height
		}
		getContext(kind: string) {
			attempts.push(kind)
			return available.includes(kind) ? context : null
		}
		addEventListener = vi.fn()
		transferToImageBitmap = vi.fn()
	}
	vi.stubGlobal("OffscreenCanvas", Offscreen)
	vi.stubGlobal("navigator", { gpu })
	const canvas = {
		width: 320,
		height: 180,
		getContext: vi.fn((kind: string) => (kind === "2d" ? context : null))
	} as unknown as HTMLCanvasElement
	return { canvas, attempts }
}
afterEach(() => {
	vi.restoreAllMocks()
	vi.unstubAllGlobals()
})
describe("renderer preference", () => {
	it("prefers WebGPU and uploads normalized audio to a single render pass", async () => {
		const pass = { setPipeline: vi.fn(), setBindGroup: vi.fn(), draw: vi.fn(), end: vi.fn() }
		const encoder = { beginRenderPass: vi.fn(() => pass), finish: vi.fn(() => ({})) }
		const device = {
			createShaderModule: vi.fn(),
			createRenderPipelineAsync: vi.fn(async () => ({ getBindGroupLayout: vi.fn() })),
			createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
			createBindGroup: vi.fn(),
			createCommandEncoder: vi.fn(() => encoder),
			queue: { writeBuffer: vi.fn(), submit: vi.fn() },
			lost: new Promise(() => {}),
			destroy: vi.fn()
		}
		const context = {
			configure: vi.fn(),
			unconfigure: vi.fn(),
			getCurrentTexture: () => ({ createView: vi.fn() })
		}
		vi.stubGlobal("GPUBufferUsage", { UNIFORM: 64, STORAGE: 128, COPY_DST: 8 })
		const { canvas, attempts } = setup([], {
			requestAdapter: async () => ({ requestDevice: async () => device }),
			getPreferredCanvasFormat: () => "bgra8unorm"
		})
		const Offscreen = globalThis.OffscreenCanvas
		vi.spyOn(Offscreen.prototype, "getContext").mockImplementation((kind: string) => {
			attempts.push(kind)
			return context as unknown as GPUCanvasContext
		})
		const surface = new RenderSurface(canvas)
		await surface.ready
		expect(surface.backend).toBe("webgpu")
		expect(attempts).toEqual(["webgpu"])
		surface.beginFrame()
		surface.add({
			mode: "bars",
			data: new Uint8Array([0, 255]),
			time: 1000,
			colour: [1, 1, 1, 1],
			thickness: 2,
			amplitude: 150,
			decay: 0.0002,
			ratios: [3, 2, 3],
			phases: [0, 0, 0]
		})
		surface.endFrame()
		expect(encoder.beginRenderPass).toHaveBeenCalledTimes(1)
		expect(pass.draw).toHaveBeenCalledWith(6, 2)
		const samples = device.queue.writeBuffer.mock.calls[1][2] as Float32Array
		expect(Array.from(samples.subarray(0, 2))).toEqual([0, 1])
		surface.dispose()
		expect(device.destroy).toHaveBeenCalledTimes(1)
		expect(context.unconfigure).toHaveBeenCalledTimes(1)
		vi.restoreAllMocks()
	})

	it("selects WebGL2 before WebGL when WebGPU has no adapter", async () => {
		const { canvas, attempts } = setup(["webgl2", "webgl", "2d"], {
			requestAdapter: async () => null
		})
		const surface = new RenderSurface(canvas)
		await surface.ready
		expect(surface.backend).toBe("webgl2")
		expect(attempts).toEqual(["webgl2"])
		surface.dispose()
	})
	it("tries WebGL before the final Canvas fallback", async () => {
		const { canvas, attempts } = setup(["webgl", "2d"])
		const surface = new RenderSurface(canvas)
		await surface.ready
		expect(surface.backend).toBe("webgl")
		expect(attempts).toEqual(["webgl2", "webgl"])
		surface.dispose()
	})
	it("uses Canvas only after both GL APIs fail", async () => {
		const { canvas, attempts } = setup(["2d"])
		const surface = new RenderSurface(canvas)
		await surface.ready
		expect(surface.backend).toBe("canvas2d")
		expect(attempts).toEqual(["webgl2", "webgl"])
		surface.beginFrame()
		surface.endFrame()
		surface.dispose()
	})
	it("does not allocate a device after disposal during adapter discovery", async () => {
		let complete!: (adapter: unknown) => void
		const requestDevice = vi.fn()
		const { canvas } = setup(["2d"], {
			requestAdapter: () =>
				new Promise((resolve) => {
					complete = resolve
				})
		})
		const surface = new RenderSurface(canvas)
		surface.dispose()
		complete({ requestDevice })
		await surface.ready
		expect(requestDevice).not.toHaveBeenCalled()
	})
})