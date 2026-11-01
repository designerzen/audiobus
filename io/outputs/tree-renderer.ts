/** One instance per round-ended segment or leaf. All geometry is drawn in one GPU call. */
export interface TreeRenderer {
	readonly backend: string
	draw(data: Float32Array, count: number, width: number, height: number): void
	destroy(): void
}

const STRIDE = 48
const CAPACITY = 16384
export const TREE_INSTANCE_CAPACITY = CAPACITY
const BACKGROUND = [0.025, 0.055, 0.075, 1] as const

// WebGPU interfaces are not in TypeScript's DOM library yet. Keep the untyped
// browser API boundary here; the model and shared instance format remain typed.
async function webgpu(canvas: HTMLCanvasElement): Promise<TreeRenderer | undefined> {
	const gpu = (navigator as Navigator & { gpu?: any }).gpu
	if (!gpu) {
		return
	}
	const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" })
	if (!adapter) {
		return
	}
	const device = await adapter.requestDevice()
	let context: any
	try {
		context = canvas.getContext("webgpu" as any)
		if (!context) {
			device.destroy()
			return
		}
		const format = gpu.getPreferredCanvasFormat()
		context.configure({ device, format, alphaMode: "opaque" })
		const module = device.createShaderModule({
			code: `
struct View { size: vec2f }
@group(0) @binding(0) var<uniform> view: View;
struct Out {
 @builtin(position) position: vec4f,
 @location(0) local: vec2f,
 @location(1) @interpolate(flat) extent: vec2f,
 @location(2) @interpolate(flat) color: vec3f,
 @location(3) @interpolate(flat) leaf: f32,
}
@vertex fn vertex(@builtin(vertex_index) i: u32,
 @location(0) a: vec2f, @location(1) b: vec2f,
 @location(2) radius: f32, @location(3) color: vec3f, @location(4) leaf: f32) -> Out {
 let corners = array<vec2f, 6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1));
 let length = max(distance(a,b), 0.001);
 let direction = (b-a) / length;
 let extent = vec2f(length * 0.5, radius);
 let local = corners[i] * (extent + vec2f(radius + 1.0, 1.0));
 let pixel = (a+b)*0.5 + direction*local.x + vec2f(-direction.y,direction.x)*local.y;
 var out: Out;
 out.position = vec4f(pixel / view.size * vec2f(2,-2) + vec2f(-1,1), 0, 1);
 out.local = local; out.extent = extent; out.color = color; out.leaf = leaf;
 return out;
}
@fragment fn fragment(in: Out) -> @location(0) vec4f {
 let capsule = length(vec2f(max(abs(in.local.x)-in.extent.x,0),in.local.y))-in.extent.y;
 let p = in.local / max(in.extent,vec2f(0.001));
 let leaf = (abs(p.y)+p.x*p.x-1.0)*in.extent.y*0.6;
 let distance = select(capsule,leaf,in.leaf > 0.5);
 let alpha = 1.0-smoothstep(-fwidth(distance),fwidth(distance),distance);
 return vec4f(in.color,alpha);
}`
		})
		const pipeline = await device.createRenderPipelineAsync({
			layout: "auto",
			vertex: {
				module,
				entryPoint: "vertex",
				buffers: [
					{
						arrayStride: STRIDE,
						stepMode: "instance",
						attributes: [
							{ shaderLocation: 0, offset: 0, format: "float32x2" },
							{ shaderLocation: 1, offset: 8, format: "float32x2" },
							{ shaderLocation: 2, offset: 16, format: "float32" },
							{ shaderLocation: 3, offset: 20, format: "float32x3" },
							{ shaderLocation: 4, offset: 32, format: "float32" }
						]
					}
				]
			},
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
		// GPUBufferUsage: COPY_DST | VERTEX, COPY_DST | UNIFORM.
		const buffer = device.createBuffer({ size: CAPACITY * STRIDE, usage: 0x28 })
		const uniform = device.createBuffer({ size: 16, usage: 0x48 })
		const bind = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [{ binding: 0, resource: { buffer: uniform } }]
		})
		let lost = false
		void device.lost.then(() => {
			lost = true
		})
		return {
			backend: "WebGPU",
			draw(data, count, width, height) {
				if (lost) {
					throw new Error("Tree WebGPU device lost")
				}
				device.queue.writeBuffer(buffer, 0, data.buffer, 0, count * STRIDE)
				device.queue.writeBuffer(uniform, 0, new Float32Array([width, height, 0, 0]))
				const encoder = device.createCommandEncoder()
				const pass = encoder.beginRenderPass({
					colorAttachments: [
						{
							view: context.getCurrentTexture().createView(),
							clearValue: BACKGROUND,
							loadOp: "clear",
							storeOp: "store"
						}
					]
				})
				pass.setPipeline(pipeline)
				pass.setBindGroup(0, bind)
				pass.setVertexBuffer(0, buffer)
				pass.draw(6, count)
				pass.end()
				device.queue.submit([encoder.finish()])
			},
			destroy() {
				buffer.destroy()
				uniform.destroy()
				context.unconfigure()
				device.destroy()
			}
		}
	} catch (error) {
		context?.unconfigure()
		device.destroy()
		throw error
	}
}

function webgl(canvas: HTMLCanvasElement): TreeRenderer | undefined {
	const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false })
	if (!gl) {
		return
	}
	const shaders: WebGLShader[] = []
	const program = gl.createProgram()!
	const buffer = gl.createBuffer()!
	const vao = gl.createVertexArray()!
	const destroy = () => {
		gl.deleteBuffer(buffer)
		gl.deleteVertexArray(vao)
		shaders.forEach((shader) => gl.deleteShader(shader))
		gl.deleteProgram(program)
	}
	try {
		for (const [type, source] of [
			[
				gl.VERTEX_SHADER,
				`#version 300 es
precision highp float;
layout(location=0) in vec2 a; layout(location=1) in vec2 b;
layout(location=2) in float radius; layout(location=3) in vec3 color; layout(location=4) in float leaf;
uniform vec2 view; out vec2 local; flat out vec2 extent; flat out vec3 tint; flat out float kind;
void main() {
 vec2 corners[6]=vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
 float len=max(distance(a,b),0.001); vec2 direction=(b-a)/len;
 extent=vec2(len*.5,radius); local=corners[gl_VertexID]*(extent+vec2(radius+1.,1.));
 vec2 pixel=(a+b)*.5+direction*local.x+vec2(-direction.y,direction.x)*local.y;
 gl_Position=vec4(pixel/view*vec2(2,-2)+vec2(-1,1),0,1); tint=color; kind=leaf;
}`
			],
			[
				gl.FRAGMENT_SHADER,
				`#version 300 es
precision highp float;
in vec2 local; flat in vec2 extent; flat in vec3 tint; flat in float kind; out vec4 result;
void main() {
 vec2 p=local/max(extent,vec2(.001));
 float d=kind>.5 ? (abs(p.y)+p.x*p.x-1.)*extent.y*.6 : length(vec2(max(abs(local.x)-extent.x,0.),local.y))-extent.y;
 float alpha=1.-smoothstep(-fwidth(d),fwidth(d),d); result=vec4(tint,alpha);
}`
			]
		] as const) {
			const shader = gl.createShader(type)!
			shaders.push(shader)
			gl.shaderSource(shader, source)
			gl.compileShader(shader)
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(gl.getShaderInfoLog(shader) ?? "Tree shader failed")
			}
			gl.attachShader(program, shader)
		}
		gl.linkProgram(program)
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			throw new Error(gl.getProgramInfoLog(program) ?? "Tree pipeline failed")
		}
		gl.bindVertexArray(vao)
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, CAPACITY * STRIDE, gl.DYNAMIC_DRAW)
		for (const [location, size, offset] of [
			[0, 2, 0],
			[1, 2, 8],
			[2, 1, 16],
			[3, 3, 20],
			[4, 1, 32]
		]) {
			gl.enableVertexAttribArray(location)
			gl.vertexAttribPointer(location, size, gl.FLOAT, false, STRIDE, offset)
			gl.vertexAttribDivisor(location, 1)
		}
		const view = gl.getUniformLocation(program, "view")
		return {
			backend: "WebGL2",
			destroy,
			draw(data, count, width, height) {
				if (gl.isContextLost()) {
					throw new Error("Tree WebGL context lost")
				}
				gl.viewport(0, 0, canvas.width, canvas.height)
				gl.clearColor(...BACKGROUND)
				gl.clear(gl.COLOR_BUFFER_BIT)
				gl.useProgram(program)
				gl.bindVertexArray(vao)
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
				gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count * 12))
				gl.uniform2f(view, width, height)
				gl.enable(gl.BLEND)
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
				gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count)
			}
		}
	} catch (error) {
		destroy()
		throw error
	}
}

function canvas2d(canvas: HTMLCanvasElement): TreeRenderer | undefined {
	const context = canvas.getContext("2d", { alpha: false })
	if (!context) {
		return
	}
	return {
		backend: "Canvas",
		destroy() {},
		draw(data, count, width, height) {
			context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0)
			context.fillStyle = "rgb(6,14,19)"
			context.fillRect(0, 0, width, height)
			context.lineCap = "round"
			context.lineJoin = "round"
			for (let i = 0; i < count * 12; i += 12) {
				const [ax, ay, bx, by, radius, r, g, b, leaf] = data.subarray(i, i + 9)
				context.strokeStyle = context.fillStyle = `rgb(${r * 255},${g * 255},${b * 255})`
				context.beginPath()
				if (leaf) {
					const dx = bx - ax,
						dy = by - ay,
						length = Math.max(0.001, Math.hypot(dx, dy))
					const nx = ((-dy / length) * radius * 4) / 3,
						ny = ((dx / length) * radius * 4) / 3
					context.moveTo(ax, ay)
					context.bezierCurveTo(
						ax + dx / 3 + nx,
						ay + dy / 3 + ny,
						bx - dx / 3 + nx,
						by - dy / 3 + ny,
						bx,
						by
					)
					context.bezierCurveTo(
						bx - dx / 3 - nx,
						by - dy / 3 - ny,
						ax + dx / 3 - nx,
						ay + dy / 3 - ny,
						ax,
						ay
					)
					context.fill()
				} else {
					context.lineWidth = radius * 2
					context.moveTo(ax, ay)
					context.lineTo(bx, by)
					context.stroke()
				}
			}
		}
	}
}

/** Each attempt needs a fresh canvas: browsers lock a canvas to its first context type. */
export async function createTreeRenderer(
	makeCanvas: () => HTMLCanvasElement,
	skip = 0
): Promise<{ canvas: HTMLCanvasElement; renderer: TreeRenderer }> {
	const factories = [webgpu, webgl, canvas2d]
	for (let index = skip; index < factories.length; index++) {
		const canvas = makeCanvas()
		try {
			const renderer = await factories[index](canvas)
			if (renderer) {
				return { canvas, renderer }
			}
		} catch {
			/* Adapter rejection and context failure both advance to the next backend. */
		}
	}
	throw new Error("This browser does not support tree rendering")
}