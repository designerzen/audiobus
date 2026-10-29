/** WAM adapter for the original 303 wavetable engine. Self-contained for worklet loading. */
export default function registerTB303Processor(moduleId, definitions, register303) {
	const { WamProcessor, WamParameterInfo } = globalThis.webAudioModules.getModuleScope(moduleId)
	const Voice = register303(definitions, { Processor: WamProcessor, wam: true, register: false })
	class TB303Processor extends Voice {
		static get parameterDescriptors() {
			return WamProcessor.parameterDescriptors ?? []
		}
		process(inputs, outputs, parameters) {
			return WamProcessor.prototype.process.call(this, inputs, outputs, parameters)
		}
		constructor(options) {
			super(options)
			this.portamento = new Uint8Array(16)
			this.voiceChannel = 0
			this.controls = Object.fromEntries(
				Object.entries(definitions).map(([id, p]) => [id, p.defaultValue])
			)
			this.parameters = Object.fromEntries(
				Object.entries(definitions).map(([id, p]) => [
					id,
					new Float32Array([p.defaultValue])
				])
			)
		}
		_generateWamParameterInfo() {
			return Object.fromEntries(
				Object.entries(definitions).map(([id, p]) => [id, new WamParameterInfo(id, p)])
			)
		}
		select(note, slide) {
			if (note) {
				this.voiceChannel = note.channel
			}
			super.select(note, slide || !!(note && this.portamento[note.channel]))
		}
		_onMidi({ bytes }) {
			// Parameters must be current before a note triggers its envelopes/table.
			this._applyControls()
			const [status, number, value] = bytes
			const channel = status & 15
			if ((status & 0xf0) === 0xb0) {
				if (number === 65) {
					this.portamento[channel] = value >= 64 ? 1 : 0
					return
				}
				if (number === 121) {
					this.portamento[channel] = 0
				}
				// All Sound Off must also clear a released note's delay tail.
				if (number === 120 && !this.active && this.voiceChannel === channel) {
					this.silence()
					return
				}
			}
			this.midi(bytes)
			if ((status & 0xf0) === 0xb0 && number === 121 && this.active?.channel === channel) {
				this.select(this.active, true)
			}
		}
		_applyControls() {
			const c = this.controls
			this.engine.tuning = c.tuning / 100
			this.engine.accent = c.accent
			this.engine.waveform = Math.round(c.waveform)
			this.decay = c.decay * 1000
		}
		_process(start, end, _inputs, outputs) {
			if (!outputs[0]?.length) {
				return
			}
			// WAM splits blocks at MIDI/automation events. Read its interpolators
			// at each sample so ramps and event offsets survive the adapter.
			for (let i = start; i < end; ) {
				for (const id in this.controls) {
					const values = this._parameterInterpolators[id].values
					const value = values[values.length === 1 ? 0 : i]
					this.controls[id] = value
					this.parameters[id][0] =
						id === "tuning" ? value / 100 : id === "decay" ? value * 1000 : value
				}
				let next = i + 1
				for (; next < end; next++) {
					let changed = false
					for (const id in this.controls) {
						const values = this._parameterInterpolators[id].values
						if (values[values.length === 1 ? 0 : next] !== this.controls[id]) {
							changed = true
							break
						}
					}
					if (changed) {
						break
					}
				}
				super.process(_inputs, outputs, this.parameters, i, next)
				i = next
			}
		}
	}
	globalThis.registerProcessor(moduleId, TB303Processor)
}