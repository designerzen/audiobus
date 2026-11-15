import type { RenderLayer } from "./RenderSurface.ts"

const VERTEX = `
precision highp float;
attribute float vertexIndex;
uniform vec2 size;
uniform float mode, count, thickness, amplitude, decay;
uniform vec3 ratios, phases;
uniform vec4 colour;
uniform sampler2D samples;
varying vec2 uv;
varying vec4 tint;
float sampleAt(float index) {
  index = clamp(index, 0.0, count - 1.0);
  return texture2D(samples, (vec2(mod(index,256.0),floor(index/256.0))+0.5)/vec2(256.0,128.0)).r;
}
vec3 rainbow(float t) { return 0.55 + 0.45*cos(6.2831853*(t+vec3(0.0,0.33,0.67))); }
void main() {
  float v = mod(vertexIndex,6.0);
  float i = floor(vertexIndex/6.0);
  vec2 corner = vec2(0.0);
  if (v == 1.0 || v == 4.0 || v == 5.0) corner.x = 1.0;
  if (v == 2.0 || v == 3.0 || v == 5.0) corner.y = 1.0;
  vec2 point = corner * size;
  tint = colour;
  if (mode == 0.0) {
    float width = size.x/count;
    point = vec2((i+corner.x*0.85)*width, size.y*(1.0-corner.y*sampleAt(i)));
    tint = vec4(rainbow(i/count),colour.a);
  } else if (mode == 1.0) {
    vec2 a = vec2(i/max(1.0,count-1.0)*size.x,sampleAt(i)*size.y);
    vec2 b = vec2((i+1.0)/max(1.0,count-1.0)*size.x,sampleAt(i+1.0)*size.y);
    vec2 d = b-a;
    point = mix(a,b,corner.x)+vec2(-d.y,d.x)/max(length(d),0.0001)*(corner.y-0.5)*thickness;
  } else if (mode == 2.0) {
    float t = i*0.0174532925;
    float level = sampleAt(mod(i,count));
    float a = min(amplitude,min(size.x,size.y)*0.23)*pow(max(0.0,1.0-decay),i);
    float x = a*((0.5+2.0*level)*sin(ratios.x*t+phases.x)+sin(ratios.z*t+phases.z));
    float y = a*(0.5+2.0*level)*sin(ratios.y*t+phases.y);
    point = size*0.5+vec2(x,y)+(corner-0.5)*thickness;
    tint = vec4(colour.rgb*(0.3+0.7*level),colour.a);
  }
  gl_Position = vec4(point/size*vec2(2.0,-2.0)+vec2(-1.0,1.0),0.0,1.0);
  uv = point/size;
}`
const FRAGMENT = `
precision highp float;
uniform vec2 size;
uniform float mode, count, time;
uniform sampler2D samples;
varying vec2 uv;
varying vec4 tint;
void main() {
  if (mode == 3.0) {
    vec2 p = (uv-0.5)*vec2(size.x/size.y,1.0)*12.0;
    float t = time*0.001;
    float index = floor(clamp(uv.x,0.0,0.9999)*count);
    float energy = texture2D(samples,(vec2(mod(index,256.0),floor(index/256.0))+0.5)/vec2(256.0,128.0)).r;
    float wave = sin(p.x+t)+sin(p.y-t*0.7)+sin(length(p)*1.8-t+energy*3.0);
    vec3 colour = 0.55+0.45*cos(6.2831853*(wave*0.13+t*0.04+vec3(0.0,0.33,0.67)));
    gl_FragColor = vec4(colour*(0.25+energy*0.75),tint.a);
  } else gl_FragColor = tint;
}`

/** The same effect geometry as WebGPU, including browsers without instancing support. */
export class WebGLRenderer {
	private program: WebGLProgram
	private buffer: WebGLBuffer
	private texture: WebGLTexture
	private vertices = 0
	private pixels = new Uint8Array(256 * 128 * 4)
	private uniforms = new Map<string, WebGLUniformLocation | null>()
	constructor(
		readonly gl: WebGLRenderingContext | WebGL2RenderingContext,
		webgl2: boolean
	) {
		const shaders: WebGLShader[] = []
		const compile = (type: number, source: string) => {
			if (webgl2) {
				source =
					"#version 300 es\n" +
					source
						.replace(/attribute/g, "in")
						.replace(/varying/g, type === gl.VERTEX_SHADER ? "out" : "in")
						.replace(/texture2D/g, "texture")
						.replace(
							"void main()",
							type === gl.FRAGMENT_SHADER
								? "out vec4 fragmentColour;\nvoid main()"
								: "void main()"
						)
						.replace(/gl_FragColor/g, "fragmentColour")
			}
			const shader = gl.createShader(type)!
			shaders.push(shader)
			gl.shaderSource(shader, source)
			gl.compileShader(shader)
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(gl.getShaderInfoLog(shader) ?? "WebGL shader compilation failed")
			}
			return shader
		}
		this.program = gl.createProgram()!
		try {
			gl.attachShader(this.program, compile(gl.VERTEX_SHADER, VERTEX))
			gl.attachShader(this.program, compile(gl.FRAGMENT_SHADER, FRAGMENT))
			gl.linkProgram(this.program)
			if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
				throw new Error(gl.getProgramInfoLog(this.program) ?? "WebGL program link failed")
			}
		} catch (error) {
			gl.deleteProgram(this.program)
			throw error
		} finally {
			for (const shader of shaders) {
				gl.deleteShader(shader)
			}
		}
		this.buffer = gl.createBuffer()!
		this.texture = gl.createTexture()!
		gl.bindTexture(gl.TEXTURE_2D, this.texture)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			256,
			128,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			this.pixels
		)
	}
	private uniform(name: string) {
		if (!this.uniforms.has(name)) {
			this.uniforms.set(name, this.gl.getUniformLocation(this.program, name))
		}
		return this.uniforms.get(name)!
	}
	render(layers: RenderLayer[], width: number, height: number): void {
		const gl = this.gl
		gl.viewport(0, 0, width, height)
		gl.clearColor(0.015, 0.025, 0.05, 1)
		gl.clear(gl.COLOR_BUFFER_BIT)
		gl.useProgram(this.program)
		gl.enable(gl.BLEND)
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer)
		const index = gl.getAttribLocation(this.program, "vertexIndex")
		gl.enableVertexAttribArray(index)
		gl.vertexAttribPointer(index, 1, gl.FLOAT, false, 0, 0)
		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture(gl.TEXTURE_2D, this.texture)
		gl.uniform1i(this.uniform("samples"), 0)
		gl.uniform2f(this.uniform("size"), width, height)
		for (const layer of layers) {
			const count = Math.min(32768, layer.data.length)
			if (!count) {
				continue
			}
			for (let i = 0; i < count; i++) {
				this.pixels[i * 4] = layer.data[i]
			}
			gl.texSubImage2D(
				gl.TEXTURE_2D,
				0,
				0,
				0,
				256,
				128,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				this.pixels
			)
			const instances =
				layer.mode === "plasma"
					? 1
					: layer.mode === "harmongraph"
						? count * 8
						: layer.mode === "scope"
							? Math.max(0, count - 1)
							: count
			const vertices = instances * 6
			if (vertices > this.vertices) {
				this.vertices = vertices
				gl.bufferData(
					gl.ARRAY_BUFFER,
					Float32Array.from({ length: vertices }, (_, i) => i),
					gl.STATIC_DRAW
				)
			}
			gl.uniform1f(
				this.uniform("mode"),
				["bars", "scope", "harmongraph", "plasma"].indexOf(layer.mode)
			)
			gl.uniform1f(this.uniform("count"), count)
			gl.uniform1f(this.uniform("time"), layer.time)
			gl.uniform1f(this.uniform("thickness"), layer.thickness)
			gl.uniform1f(this.uniform("amplitude"), layer.amplitude)
			gl.uniform1f(this.uniform("decay"), layer.decay)
			gl.uniform4f(
				this.uniform("colour"),
				layer.colour[0],
				layer.colour[1],
				layer.colour[2],
				layer.colour[3]
			)
			gl.uniform3f(this.uniform("ratios"), layer.ratios[0], layer.ratios[1], layer.ratios[2])
			gl.uniform3f(this.uniform("phases"), layer.phases[0], layer.phases[1], layer.phases[2])
			gl.drawArrays(gl.TRIANGLES, 0, vertices)
		}
	}
	dispose(): void {
		this.gl.deleteBuffer(this.buffer)
		this.gl.deleteTexture(this.texture)
		this.gl.deleteProgram(this.program)
	}
}