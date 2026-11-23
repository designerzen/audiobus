import PhotoSynthOutput, {
	commonParameters,
	numeric,
	pitchControl,
	type CommonSettings,
	type OutputOptions,
	type Parameters,
	type VoiceGraph
} from "../../instruments/photosynth/output-base"
import { ZETA_VARIATIONS, zetaSequence, zetaSpectrum } from "../../instruments/zeta/zeta-wave"
import { EVENT_CHANGE, EVENT_CONFIGURATION_CHANGED } from "../../events/event-constants"

export interface ZetaSettings extends CommonSettings {
	variation: number
	n: number
	firstZero: number
	zeroCount: number
}
const parameters: Parameters<ZetaSettings> = {
	...commonParameters,
	variation: numeric(2, 0, ZETA_VARIATIONS.length - 1, 1),
	n: numeric(12, 2, 1000000, 1),
	firstZero: numeric(1, 1, 29999, 1),
	zeroCount: numeric(4000, 2, 30000, 1)
}

/** Pitched sonification of Baugh's logarithmic-integral traces (arXiv:0712.0934). */
export default class OutputZeta extends PhotoSynthOutput<ZetaSettings> {
	readonly name = "Zeta"
	readonly description =
		"Zeta-zero logarithmic integrals, cumulative sums and cycle approximation"
	private wave?: PeriodicWave
	private waveKey?: string
	private controlsEvents?: AbortController

	constructor(options: OutputOptions<ZetaSettings>) {
		super(options, parameters)
	}
	protected buildVoice(input: GainNode): VoiceGraph {
		const { variation, n, firstZero, zeroCount } = this.settings
		const key = JSON.stringify([variation, n, firstZero, zeroCount])
		if (!this.wave || key !== this.waveKey) {
			const { real, imag } = zetaSpectrum(zetaSequence(this.settings))
			this.wave = this.context.createPeriodicWave(real, imag)
			this.waveKey = key
		}
		const oscillator = this.context.createOscillator()
		oscillator.setPeriodicWave(this.wave)
		oscillator.connect(input)
		return {
			nodes: [],
			sources: [oscillator],
			pitch: pitchControl(this.context, oscillator.frequency)
		}
	}
	async createGui(): Promise<HTMLElement> {
		const panel = await super.createGui()
		if (panel.querySelector("select[name=variation]")) {
			return panel
		}
		this.controlsEvents = new AbortController()
		const input = panel.querySelector<HTMLInputElement>("input[name=variation]")!
		const select = document.createElement("select")
		select.name = "variation"
		for (const [value, title] of ZETA_VARIATIONS.entries()) {
			const option = document.createElement("option")
			option.value = String(value)
			option.textContent = title
			select.append(option)
		}
		input.replaceWith(select)
		const signal = this.controlsEvents.signal
		select.addEventListener(
			EVENT_CHANGE,
			() => this.configure({ variation: Number(select.value) }),
			{ signal }
		)
		const update = () => {
			select.value = String(this.settings.variation)
		}
		this.addEventListener(EVENT_CONFIGURATION_CHANGED, update, { signal })
		update()
		const titles: Record<string, string> = {
			variation: "Variation",
			n: "n",
			firstZero: "First zero (1–29,999)",
			zeroCount: "Number of zeros",
			maxPolyphony: "Polyphony",
			pitchBendRange: "Pitch bend (semitones)"
		}
		for (const label of panel.querySelectorAll("label")) {
			const control = label.querySelector<HTMLInputElement | HTMLSelectElement>(
				"input, select"
			)
			if (control && label.firstChild?.nodeType === Node.TEXT_NODE) {
				label.firstChild.textContent = (titles[control.name] ?? control.name) + " "
			}
		}
		const help = document.createElement("p")
		help.textContent =
			"Each trace repeats once per MIDI-note cycle. Waveforms are centered, normalized and band-limited; imaginary modes subtract π before summing. The range ends at zero 30,000. Changes apply to new notes. Try n = 12, 1295, 1302 or 1000000."
		const source = document.createElement("a")
		source.href = "https://arxiv.org/abs/0712.0934"
		source.target = "_blank"
		source.rel = "noopener noreferrer"
		source.textContent = "David D. Baugh — The Cycle Problem"
		panel.append(help, source)
		return panel
	}
	async destroyGui(): Promise<void> {
		this.controlsEvents?.abort()
		await super.destroyGui()
	}
}