const clamp = (value, fallback, min, max) =>
	Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback

export const createSamplerLayer = () => ({
	name: "Empty",
	start: 0,
	end: 1,
	loopStart: 0,
	loopEnd: 1,
	loop: false,
	oneShot: false,
	root: 60,
	tune: 0,
	gain: 1,
	velocitySensitivity: 1,
	attack: 0.005,
	decay: 0.15,
	sustain: 0.8,
	release: 0.2,
	filter: "lowpass",
	cutoff: 18000,
	resonance: 0.7,
	velocityLow: 0,
	fadeIn: 0,
	fadeOut: 1,
	velocityHigh: 1
})

export const normaliseSamplerLayer = (value) => {
	const layer = { ...createSamplerLayer(), ...value }
	for (const [key, min, max] of [
		["start", 0, 0.9999],
		["end", 0.0001, 1],
		["loopStart", 0, 0.9999],
		["loopEnd", 0.0001, 1],
		["root", 0, 127],
		["tune", -24, 24],
		["gain", 0, 2],
		["velocitySensitivity", 0, 1],
		["attack", 0, 10],
		["decay", 0, 10],
		["sustain", 0, 1],
		["release", 0, 20],
		["cutoff", 20, 20000],
		["resonance", 0.1, 20],
		["velocityLow", 0, 1],
		["fadeIn", 0, 1],
		["fadeOut", 0, 1],
		["velocityHigh", 0, 1]
	]) {
		layer[key] = clamp(layer[key], createSamplerLayer()[key], min, max)
	}
	layer.end = Math.max(layer.start + 0.0001, layer.end)
	layer.loopStart = Math.max(layer.start, Math.min(layer.end - 0.0001, layer.loopStart))
	layer.loopEnd = Math.max(layer.loopStart + 0.0001, Math.min(layer.end, layer.loopEnd))
	layer.velocityHigh = Math.max(layer.velocityLow, layer.velocityHigh)
	layer.fadeIn = Math.max(layer.velocityLow, Math.min(layer.velocityHigh, layer.fadeIn))
	layer.fadeOut = Math.max(layer.fadeIn, Math.min(layer.velocityHigh, layer.fadeOut))
	layer.filter = ["lowpass", "highpass", "bandpass", "off"].includes(layer.filter)
		? layer.filter
		: "lowpass"
	layer.loop = !!layer.loop
	layer.oneShot = !!layer.oneShot
	return layer
}

export const samplerVelocityGain = (layer, velocity) => {
	if (velocity < layer.velocityLow || velocity > layer.velocityHigh) {
		return 0
	}
	const up =
		layer.fadeIn > layer.velocityLow
			? (velocity - layer.velocityLow) / (layer.fadeIn - layer.velocityLow)
			: 1
	const down =
		layer.velocityHigh > layer.fadeOut
			? (layer.velocityHigh - velocity) / (layer.velocityHigh - layer.fadeOut)
			: 1
	return Math.max(0, Math.min(1, up, down))
}