export const LOOP_PLAYER_PROCESSOR = "loop-player-wsola"

export const LOOP_PLAYER_WORKLET_CODE = `
class LoopPlayerProcessor extends AudioWorkletProcessor {
	constructor() {
		super()
		this.channels = []
		this.events = []
		this.active = null
		this.previous = null
		this.fade = 0
		this.hop = Math.max(1, Math.round(sampleRate * 0.03))
		this.fadeLength = Math.max(1, Math.round(sampleRate * 0.005))
		// Resync only when the playhead has drifted further than this many source frames
		this.driftLimit = sampleRate * 0.01
		this.window = Float32Array.from({ length: this.hop }, (_, i) =>
			0.5 - 0.5 * Math.cos(Math.PI * i / this.hop))
		this.port.onmessage = ({ data }) => {
			if (data.type === "buffer") {
				this.channels = data.channels
				this.length = this.channels[0].length
				this.scale = data.sampleRate / sampleRate
				this.stop()
			} else if (data.type === "stop") {
				if (Number.isFinite(data.at)) {
					// Fade-out time: drop syncs scheduled after it, silence once it arrives
					this.events = this.events.filter((event) => event.at < data.at)
					this.events.push({ at: data.at, stop: true })
				} else {
					this.stop()
				}
			} else if (data.type === "dispose") {
				this.stop()
				this.channels = []
				this.disposed = true
			} else if (data.type === "sync" && Number.isFinite(data.position) &&
				Number.isFinite(data.ratio) && data.ratio > 0 && Number.isFinite(data.at)) {
				this.events.push(data)
				this.events.sort((a, b) => a.at - b.at)
			}
		}
	}
	stop() {
		this.events.length = 0
		this.active = null
		this.previous = null
	}
	read(channel, position) {
		const wrapped = ((position % this.length) + this.length) % this.length
		const index = Math.floor(wrapped)
		const data = this.channels[channel] || this.channels[0]
		return data[index] + (data[(index + 1) % this.length] - data[index]) * (wrapped - index)
	}
	// Nearest-sample read for the correlation search; cheaper than interpolating
	sample(data, position) {
		let index = Math.floor(position) % this.length
		if (index < 0) index += this.length
		return data[index]
	}
	correlate(state, shift) {
		let cross = 0, left = 0, right = 0
		// Use both channels with a shared offset to preserve the stereo image.
		for (let channel = 0; channel < this.channels.length; channel++) {
			const data = this.channels[channel]
			for (let i = 0; i < this.hop; i += 16) {
				const a = this.sample(data, state.grain + (this.hop + i) * this.scale)
				const b = this.sample(data, state.position + shift + i * this.scale)
				cross += a * b
				left += a * a
				right += b * b
			}
		}
		return cross / Math.sqrt(left * right + 1e-20) - Math.abs(shift) * 1e-9
	}
	// Coarse-to-fine search keeps the per-hop cost well inside one render quantum
	align(state) {
		const coarse = Math.max(1, Math.round(32 * this.scale))
		const fine = Math.max(1, Math.round(4 * this.scale))
		// Whole multiples of the coarse step keep zero offset on the search grid
		const tolerance = Math.round((sampleRate * this.scale * 0.005) / coarse) * coarse
		let best = -Infinity
		let offset = 0
		for (let shift = -tolerance; shift <= tolerance; shift += coarse) {
			const score = this.correlate(state, shift)
			if (score > best) {
				best = score
				offset = shift
			}
		}
		const centre = offset
		for (let shift = centre - coarse; shift <= centre + coarse; shift += fine) {
			const score = this.correlate(state, shift)
			if (score > best) {
				best = score
				offset = shift
			}
		}
		return state.position + offset
	}
	advance(state) {
		state.position += state.ratio * this.scale
		if (++state.phase === this.hop) {
			const next = this.align(state)
			state.tail = state.grain
			state.grain = next
			state.phase = 0
		}
	}
	value(state, channel) {
		const phase = state.phase
		const weight = this.window[phase]
		return this.read(channel, state.grain + phase * this.scale) * weight +
			this.read(channel, state.tail + (phase + this.hop) * this.scale) * (1 - weight)
	}
	process(_inputs, outputs) {
		if (this.disposed) return false
		const output = outputs[0]
		if (!output || !this.channels.length) return true
		for (let frame = 0; frame < output[0].length; frame++) {
			const now = currentTime + frame / sampleRate
			while (this.events.length && this.events[0].at <= now) {
				const event = this.events.shift()
				if (event.stop) {
					this.active = null
					this.previous = null
					continue
				}
				const position = event.position * this.scale * sampleRate +
					Math.max(0, now - event.at) * event.ratio * this.scale * sampleRate
				if (this.active) {
					// Still in phase: follow the tempo in place instead of crossfading grains
					const distance = ((this.active.position - position) % this.length + this.length) % this.length
					if (Math.min(distance, this.length - distance) < this.driftLimit * this.scale) {
						this.active.ratio = event.ratio
						continue
					}
				}
				this.previous = this.active
				this.fade = 0
				this.active = { position, ratio: event.ratio, phase: 0,
					grain: position, tail: position - this.hop * this.scale }
			}
			for (let channel = 0; channel < output.length; channel++) {
				const mix = Math.min(1, this.fade / this.fadeLength)
				output[channel][frame] = this.active ? this.value(this.active, channel) * mix +
					(this.previous ? this.value(this.previous, channel) * (1 - mix) : 0) : 0
			}
			if (this.active) this.advance(this.active)
			if (this.previous) this.advance(this.previous)
			if (++this.fade >= this.fadeLength) this.previous = null
		}
		return true
	}
}
registerProcessor("loop-player-wsola", LoopPlayerProcessor)
`