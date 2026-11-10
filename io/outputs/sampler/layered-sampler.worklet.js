import { samplerVelocityGain } from "./sampler-state.js"

class LayeredSamplerProcessor extends AudioWorkletProcessor {
	constructor() {
		super()
		this.keys = new Map()
		this.voices = []
		this.events = []
		this.bends = new Map()
		this.alive = true
		this.port.onmessage = ({ data }) => {
			if (data.type === "layer") {
				const layers = this.keys.get(data.key) ?? []
				layers[data.index] = {
					...data.layer,
					channels:
						data.layer.channels === undefined
							? layers[data.index]?.channels
							: data.layer.channels
				}
				this.keys.set(data.key, layers)
			} else if (data.type === "panic" || data.type === "detach") {
				this.voices = this.voices.filter((voice) => voice.part !== data.part)
				this.events = this.events.filter((event) => event.part !== data.part)
				if (data.type === "detach") {
					this.bends.delete(data.part)
				}
			} else if (data.type === "destroy") {
				this.alive = false
				this.voices = []
				this.events = []
			} else {
				this.events.push({ ...data, time: Math.max(currentTime, data.time ?? currentTime) })
				this.events.sort((a, b) => a.time - b.time)
			}
		}
	}
	apply(event) {
		if (event.type === "bend") {
			this.bends.set(event.part, event.value)
			return
		}
		if (event.type === "off") {
			for (const voice of this.voices) {
				if (
					voice.part === event.part &&
					voice.note === event.note &&
					!voice.layer.oneShot &&
					voice.released === undefined
				) {
					voice.released = 0
					voice.releaseLevel = voice.level
				}
			}
			return
		}
		if (event.type !== "on") {
			return
		}
		// An explicitly mapped key wins; otherwise transpose the closest loaded key.
		const keys = [...this.keys.keys()].filter((key) =>
			this.keys.get(key).some((layer) => layer?.channels?.length)
		)
		if (!keys.length) {
			return
		}
		const key = keys.reduce((best, key) =>
			Math.abs(key - event.note) < Math.abs(best - event.note) ? key : best
		)
		for (const layer of this.keys.get(key)) {
			if (!layer?.channels?.length) {
				continue
			}
			const gain = samplerVelocityGain(layer, event.velocity)
			if (gain <= 0) {
				continue
			}
			const length = layer.channels[0].length
			const cutoff = Math.min(sampleRate * 0.45, layer.cutoff)
			const w = (2 * Math.PI * cutoff) / sampleRate,
				cos = Math.cos(w),
				alpha = Math.sin(w) / (2 * layer.resonance),
				a0 = 1 + alpha
			const b =
				layer.filter === "highpass"
					? [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2]
					: layer.filter === "bandpass"
						? [alpha, 0, -alpha]
						: [(1 - cos) / 2, 1 - cos, (1 - cos) / 2]
			this.voices.push({
				part: event.part,
				note: event.note,
				layer,
				position: layer.start * length,
				age: 0,
				level: 0,
				gain:
					gain *
					(1 - layer.velocitySensitivity + event.velocity * layer.velocitySensitivity) *
					layer.gain,
				rate:
					(layer.sampleRate / sampleRate) *
					2 ** ((event.note - layer.root + layer.tune) / 12),
				b: b.map((value) => value / a0),
				a1: (-2 * cos) / a0,
				a2: (1 - alpha) / a0,
				z: [
					[0, 0],
					[0, 0]
				]
			})
		}
		// Bounded polyphony, including release tails and all four layers.
		while (this.voices.filter((voice) => voice.part === event.part).length > 128) {
			this.voices.splice(
				this.voices.findIndex((voice) => voice.part === event.part),
				1
			)
		}
	}
	process(inputs, outputs) {
		for (const channels of outputs) {
			for (const channel of channels) {
				channel.fill(0)
			}
		}
		if (!this.alive) {
			return false
		}
		const frames = outputs[0]?.[0]?.length ?? 128
		for (let frame = 0; frame < frames; frame++) {
			const now = currentTime + frame / sampleRate
			while (this.events[0]?.time <= now) {
				this.apply(this.events.shift())
			}
			for (const voice of this.voices) {
				if (voice.done) {
					continue
				}
				const l = voice.layer,
					length = l.channels[0].length,
					end = l.end * length
				const loopEnd = l.loopEnd * length,
					loopStart = l.loopStart * length
				if (l.loop && voice.position >= loopEnd) {
					voice.position =
						loopStart + ((voice.position - loopStart) % (loopEnd - loopStart))
				}
				if (voice.position >= end) {
					voice.done = true
					continue
				}
				const age = voice.age / sampleRate
				if (voice.released !== undefined) {
					voice.level =
						voice.releaseLevel *
						Math.max(0, 1 - voice.released / Math.max(1, l.release * sampleRate))
					voice.released++
					if (voice.level <= 0) {
						voice.done = true
						continue
					}
				} else {
					voice.level =
						age < l.attack
							? age / l.attack
							: age < l.attack + l.decay
								? 1 - ((1 - l.sustain) * (age - l.attack)) / l.decay
								: l.sustain
				}
				const index = Math.floor(voice.position),
					fraction = voice.position - index
				for (let ch = 0; ch < 2; ch++) {
					const channel = l.channels[ch % l.channels.length]
					const next =
						l.loop && index + 1 >= loopEnd
							? Math.floor(loopStart)
							: Math.min(index + 1, Math.ceil(end) - 1)
					let value = channel[index] * (1 - fraction) + (channel[next] ?? 0) * fraction
					if (l.filter !== "off") {
						const z = voice.z[ch],
							filtered = voice.b[0] * value + z[0]
						z[0] = voice.b[1] * value - voice.a1 * filtered + z[1]
						z[1] = voice.b[2] * value - voice.a2 * filtered
						value = filtered
					}
					if (outputs[voice.part]?.[ch]) {
						outputs[voice.part][ch][frame] += value * voice.gain * voice.level
					}
				}
				voice.position += voice.rate * 2 ** ((this.bends.get(voice.part) ?? 0) / 12)
				voice.age++
			}
		}
		this.voices = this.voices.filter((voice) => !voice.done)
		return true
	}
}
registerProcessor("harmoneasy-layered-sampler", LayeredSamplerProcessor)