const MAX_VOICES = 64
const SCALE = 1 / 32767
// Avoids clicks on note start and when a voice is stolen
const ATTACK = 0.002
// Voices below this level have faded out (-80 dB)
const SILENT = 0.0001
// Envelope stages; streamed samples rise and then hold until released
const ATTACKING = 0
const HOLDING = 1
const DECAYING = 2
const SUSTAINING = 3

class RomplerProcessor extends AudioWorkletProcessor {
	constructor() {
		super()
		this.samples = new Map()
		this.keys = []
		// Soundfont files play zones by key and velocity instead of the nearest sample
		this.regions = []
		this.waves = new Map()
		this.voices = []
		// Held notes that arrived before any sample; started when one lands
		this.waiting = new Map()
		this.bends = new Float32Array(16)
		this.gains = new Float32Array(16).fill(1)
		this.release = 0.3
		this.alive = true
		// Notes, releases and bends timed for later, in time order
		this.events = []
		this.port.onmessage = ({ data }) => this.receive(data)
	}
	receive(data) {
		if (data.time > currentTime) {
			let index = this.events.length
			while (index > 0 && this.events[index - 1].time > data.time) {
				index--
			}
			this.events.splice(index, 0, data)
			return
		}
		this.apply(data)
	}
	apply(data) {
		switch (data.type) {
			case "sample":
				this.samples.set(data.note, data)
				this.keys = [...this.samples.keys()]
				this.retry()
				break
			case "regions": {
				this.regions = data.regions
				// Keep only the waves the new zones still use
				const used = new Set(data.regions.map((region) => region.wave))
				for (const id of this.waves.keys()) {
					if (!used.has(id)) {
						this.waves.delete(id)
					}
				}
				this.samples.clear()
				this.keys = []
				break
			}
			case "wave":
				this.waves.set(data.id, data)
				this.retry()
				break
			case "clear":
				this.samples.clear()
				this.keys = []
				this.regions = []
				this.waves.clear()
				break
			case "on":
				if (!this.start(data.channel, data.note, data.velocity)) {
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
				this.events =
					data.channel === undefined
						? []
						: this.events.filter((event) => event.channel !== data.channel)
				this.voices =
					data.channel === undefined
						? []
						: this.voices.filter((voice) => voice.channel !== data.channel)
				break
			case "destroy":
				this.alive = false
				this.events = []
				this.voices = []
				this.samples.clear()
				this.regions = []
				this.waves.clear()
				break
		}
	}
	/** Starts held notes whose sound has just arrived */
	retry() {
		for (const [id, held] of this.waiting) {
			if (this.start(held.channel, held.note, held.velocity)) {
				this.waiting.delete(id)
			}
		}
	}
	push(voice) {
		if (this.voices.length >= MAX_VOICES) {
			this.voices.shift()
		}
		this.voices.push(voice)
	}
	/** Returns false while the note still waits for its sound to load */
	start(channel, note, velocity) {
		if (this.regions.length) {
			return this.startRegions(channel, note, velocity)
		}
		if (!this.keys.length) {
			return false
		}
		let key = this.keys[0]
		for (const candidate of this.keys) {
			if (Math.abs(candidate - note) < Math.abs(key - note)) {
				key = candidate
			}
		}
		const { channels, loopStart, loopEnd } = this.samples.get(key)
		this.push({
			channel,
			note,
			channels,
			// Looped voices sound until released; one-shots stop at their last frame
			loopStart: loopEnd ? loopStart : -1,
			loopEnd: loopEnd ?? channels[0].length - 1,
			position: 0,
			rate: 2 ** ((note - key) / 12),
			gain: velocity * velocity,
			left: 1,
			right: 1,
			level: 0,
			stage: ATTACKING,
			rise: 1 / (ATTACK * sampleRate),
			hold: 0,
			decay: 1,
			sustain: 1,
			releasing: false
		})
		return true
	}
	startRegions(channel, note, velocity) {
		const strength = Math.round(velocity * 127)
		let started = false,
			missing = false
		for (const region of this.regions) {
			if (
				note < region.low ||
				note > region.high ||
				strength < region.velocityLow ||
				strength > region.velocityHigh
			) {
				continue
			}
			const wave = this.waves.get(region.wave)
			if (!wave) {
				missing = true
				continue
			}
			// Zone positions count frames at the wave's native rate; decoded waves may differ
			const { data, scale } = wave,
				last =
					Math.min(data.length, Math.round(data.length + region.endOffset * scale)) - 1,
				loopStart = Math.round(region.loopStart * scale),
				loopEnd = Math.round(region.loopEnd * scale),
				looped = region.loop && loopStart >= 0 && loopEnd > loopStart + 1 && loopEnd <= last
			this.push({
				channel,
				note,
				channels: [data],
				loopStart: looped ? loopStart : -1,
				loopEnd: looped ? loopEnd : last,
				position: Math.max(0, Math.min(last, region.start * scale)),
				rate:
					2 ** (((note - region.root) * region.scale) / 12) *
					(wave.sampleRate / sampleRate),
				gain: velocity * velocity * region.gain,
				left: Math.min(1, 1 - region.pan),
				right: Math.min(1, 1 + region.pan),
				release: region.release,
				// Soundfont envelopes fall exponentially, as they are specified in decibels
				exponential: true,
				level: 0,
				stage: ATTACKING,
				rise: 1 / (Math.max(ATTACK, region.attack) * sampleRate),
				hold: Math.round(region.hold * sampleRate),
				// Per-frame factor that falls 100 dB over the decay time
				decay: 0.00001 ** (1 / (Math.max(0.001, region.decay) * sampleRate)),
				sustain: region.sustain,
				releasing: false
			})
			started = true
		}
		return started || !missing
	}
	process(_inputs, outputs) {
		const [left, right] = outputs[0]
		left.fill(0)
		right.fill(0)
		if (!this.alive) {
			return false
		}
		while (this.events.length && this.events[0].time <= currentTime) {
			this.apply(this.events.shift())
		}
		if (!this.voices.length) {
			return true
		}
		for (const voice of this.voices) {
			const l = voice.channels[0],
				r = voice.channels[1] ?? l,
				looped = voice.loopStart >= 0,
				span = voice.loopEnd - voice.loopStart
			const rate = voice.rate * 2 ** (this.bends[voice.channel] / 12)
			const gain = voice.gain * this.gains[voice.channel] * SCALE
			const release = Math.max(0.005, voice.release ?? this.release)
			const drop = voice.exponential
				? 0.00001 ** (1 / (release * sampleRate))
				: 1 / (release * sampleRate)
			for (let frame = 0; frame < left.length; frame++) {
				if (voice.position >= voice.loopEnd) {
					if (!looped) {
						voice.done = true
						break
					}
					voice.position -= span
				}
				const index = voice.position | 0
				if (voice.releasing) {
					voice.level = voice.exponential ? voice.level * drop : voice.level - drop
					if (voice.level <= SILENT) {
						voice.done = true
						break
					}
				} else if (voice.stage === ATTACKING) {
					voice.level += voice.rise
					if (voice.level >= 1) {
						voice.level = 1
						voice.stage = voice.hold > 0 ? HOLDING : DECAYING
					}
				} else if (voice.stage === HOLDING) {
					if (--voice.hold <= 0) {
						voice.stage = DECAYING
					}
				} else if (voice.stage === DECAYING) {
					voice.level *= voice.decay
					if (voice.level <= voice.sustain) {
						voice.level = voice.sustain
						voice.stage = SUSTAINING
						// Decayed to silence, as plucked and struck sounds do while held
						if (voice.level <= SILENT) {
							voice.done = true
							break
						}
					}
				}
				// The frame after a loop's last is its first
				const next = index + 1 < l.length ? index + 1 : voice.loopStart,
					fraction = voice.position - index,
					amount = gain * voice.level
				left[frame] += (l[index] + (l[next] - l[index]) * fraction) * amount * voice.left
				right[frame] += (r[index] + (r[next] - r[index]) * fraction) * amount * voice.right
				voice.position += rate
			}
		}
		this.voices = this.voices.filter((voice) => !voice.done)
		return true
	}
}
registerProcessor("harmoneasy-rompler", RomplerProcessor)