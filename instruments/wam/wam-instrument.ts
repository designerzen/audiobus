import OutputWAM2 from "../../io/outputs/output-wam2"

export interface WAMInstrumentOptions {
	pluginUrl?: string
	name?: string
	gain?: number
}

/** WAM2 synth with an unconnected output for the instrument mixer's audio path. */
export default class WAMInstrument extends OutputWAM2 {
	readonly requiresConnectionControl = false

	constructor(context: AudioContext, options: WAMInstrumentOptions = {}) {
		super(context, options.pluginUrl, options.name ?? "WAM2 Instrument", null)
		this.gain = options.gain ?? 1
	}

	get gain() {
		return this.output.gain.value
	}
	set gain(value: number) {
		if (Number.isFinite(value)) {
			this.output.gain.value = Math.max(0, value)
		}
	}
	get volume() {
		return this.gain
	}
	set volume(value: number) {
		this.gain = value
	}
	get options() {
		return { ...super.options, gain: this.gain }
	}
	async dispose() {
		await this.destroy()
	}
}