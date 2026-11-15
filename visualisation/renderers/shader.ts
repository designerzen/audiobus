/** One instanced pipeline for bars, waveform segments, harmonic points and plasma. */
export const VISUALISER_SHADER = /* wgsl */ `
struct Settings {
  size: vec2f, time: f32, mode: f32,
  colour: vec4f,
  count: f32, thickness: f32, amplitude: f32, decay: f32,
  ratios: vec4f, phases: vec4f,
}
@group(0) @binding(0) var<uniform> settings: Settings;
@group(0) @binding(1) var<storage, read> samples: array<f32>;
struct Vertex { @builtin(position) position: vec4f, @location(0) uv: vec2f, @location(1) colour: vec4f }
fn rainbow(t: f32) -> vec3f { return 0.55 + 0.45 * cos(6.2831853 * (t + vec3f(0.0, 0.33, 0.67))); }
fn sampleAt(i: u32) -> f32 { return samples[min(i, u32(settings.count) - 1u)]; }
@vertex fn vertex(@builtin(vertex_index) v: u32, @builtin(instance_index) i: u32) -> Vertex {
  let corners = array<vec2f, 6>(vec2f(0,0), vec2f(1,0), vec2f(0,1), vec2f(0,1), vec2f(1,0), vec2f(1,1));
  let corner = corners[v];
  var point = corner * settings.size;
  var colour = settings.colour;
  if settings.mode == 0.0 {
    let width = settings.size.x / settings.count;
    let level = sampleAt(i);
    point = vec2f((f32(i) + corner.x * 0.85) * width, settings.size.y * (1.0 - corner.y * level));
    colour = vec4f(rainbow(f32(i) / settings.count), colour.a);
  } else if settings.mode == 1.0 {
    let a = vec2f(f32(i) / max(1.0, settings.count - 1.0) * settings.size.x, sampleAt(i) * settings.size.y);
    let b = vec2f(f32(i + 1u) / max(1.0, settings.count - 1.0) * settings.size.x, sampleAt(i + 1u) * settings.size.y);
    let direction = b - a;
    let normal = vec2f(-direction.y, direction.x) / max(length(direction), 0.0001);
    point = mix(a, b, corner.x) + normal * (corner.y - 0.5) * settings.thickness;
  } else if settings.mode == 2.0 {
    let t = f32(i) * 0.0174532925;
    let level = sampleAt(i % u32(settings.count));
    let a = min(settings.amplitude, min(settings.size.x, settings.size.y) * 0.23) * pow(max(0.0, 1.0 - settings.decay), f32(i));
    let x = a * ((0.5 + 2.0 * level) * sin(settings.ratios.x * t + settings.phases.x) + sin(settings.ratios.z * t + settings.phases.z));
    let y = a * (0.5 + 2.0 * level) * sin(settings.ratios.y * t + settings.phases.y);
    point = settings.size * 0.5 + vec2f(x,y) + (corner - 0.5) * settings.thickness;
    colour = vec4f(colour.rgb * (0.3 + 0.7 * level), colour.a);
  }
  var out: Vertex;
  out.position = vec4f(point / settings.size * vec2f(2,-2) + vec2f(-1,1), 0, 1);
  out.uv = point / settings.size;
  out.colour = colour;
  return out;
}
@fragment fn fragment(in: Vertex) -> @location(0) vec4f {
  if settings.mode == 3.0 {
    let p = (in.uv - 0.5) * vec2f(settings.size.x / settings.size.y, 1.0) * 12.0;
    let t = settings.time * 0.001;
    let energy = sampleAt(u32(clamp(in.uv.x, 0.0, 0.9999) * settings.count));
    let wave = sin(p.x + t) + sin(p.y - t * 0.7) + sin(length(p) * 1.8 - t + energy * 3.0);
    return vec4f(rainbow(wave * 0.13 + t * 0.04) * (0.25 + energy * 0.75), settings.colour.a);
  }
  return in.colour;
}
`