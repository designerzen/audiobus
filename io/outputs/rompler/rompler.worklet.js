const MAX_VOICES = 64
const SCALE = 1 / 32767
// Avoids clicks on note start and when a voice is stolen
const ATTACK = 0.002

class RomplerProcessor extends AudioWorkletProcessor {
	constructor() {
		super()
		this.samples = new Map()
		this.keys = []
		this.voices = []
		// Held notes that arrived before any sample; started when one lands
		this.waiting = new Map()
		this.bends = new Float32Array(16)
		this.gains = new Float32Array(16).fill(1)
		this.release = 0.3
		this.alive = true
		this.port.onmessage = ({ data }) => this.receive(data)
	}
	receive(data) {
		switch (data.type) {
			case "sample":
				this.samples.set(data.note, data.channels)
				this.keys = [...this.samples.keys()]
				for (const [id, held] of this.waiting) {
					this.waiting.delete(id)
					this.start(held.channel, held.note, held.velocity)
				}
				break
			case "clear":
				this.samples.clear()
				this.keys = []
				break
			case "on":
				if (this.keys.length) {
					this.start(data.channel, data.note, data.velocity)
				} else {
					this.waiting.set(`${data.channel}:${data.note}`, data)
				}
				break
			case "off":
				this.waiting.delete(`${data.channel}:${data.note}`)
				for (const voice of this.voices) {
					if (voice.channel === data.channel && voice.note === data.note) {
						voice.releasing = true
					}
				}
				break
			case "bend":
				this.bends[data.channel] = data.value
				break
			case "gain":
				this.gains[data.channel] = data.value
				break
			case "release":
				this.release = data.value
				break
			case "panic":
				this.waiting.clear()
				this.voices =
					data.channel === undefined
						? []
						: this.voices.filter((voice) => voice.channel !== data.channel)
				break
			case "destroy":
				this.alive = false
				this.voices = []
				this.samples.clear()
				break
		}
	}
	start(channel, note, velocity) {
		let key = this.keys[0]
		for (const candidate of this.keys) {
			if (Math.abs(candidate - note) < Math.abs(key - note)) {
				key = candidate
			}
		}
		if (this.voices.length >= MAX_VOICES) {
			this.voices.shift()
		}
		this.voices.push({
			channel,
			note,
			channels: this.samples.get(key),
			position: 0,
			rate: 2 ** ((note - key) / 12),
			gain: velocity * velocity,
			level: 0,
			releasing: false
		})
	}
	process(_inputs, outputs) {
		const [left, right] = outputs[0]
		left.fill(0)
		right.fill(0)
		if (!this.alive) {
			return false
		}
		if (!this.voices.length) {
			return true
		}
		const rise = 1 / (ATTACK * sampleRate)
		const fall = 1 / (Math.max(0.005, this.release) * sampleRate)
		for (const voice of this.voices) {
			const l = voice.channels[0],
				r = voice.channels[1] ?? l,
				last = l.length - 1
			const rate = voice.rate * 2 ** (this.bends[voice.channel] / 12)
			const gain = voice.gain * this.gains[voice.channel] * SCALE
			for (let frame = 0; frame < left.length; frame++) {
				const index = voice.position | 0
				if (index >= last) {
					voice.done = true
					break
				}
				if (voice.releasing) {
					voice.level -= fall
					if (voice.level <= 0) {
						voice.done = true
						break
					}
				} else if (voice.level < 1) {
					voice.level = Math.min(1, voice.level + rise)
				}
				const fraction = voice.position - index,
					amount = gain * voice.level
				left[frame] += (l[index] + (l[index + 1] - l[index]) * fraction) * amount
				right[frame] += (r[index] + (r[index + 1] - r[index]) * fraction) * amount
				voice.position += rate
			}
		}
		this.voices = this.voices.filter((voice) => !voice.done)
		return true
	}
}
registerProcessor("harmoneasy-rompler", RomplerProcessor)