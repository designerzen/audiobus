import type { EffectDefinition, EffectParameter, EffectValue, IEffect } from "./effect-interface"
import { EVENT_CHANGE } from "../events/event-constants"
import { bounded, changed, devicePanel, numberControl } from "../io/device-controls"

/** Time constant for parameter changes, short enough to feel immediate without zipper noise. */
const GLIDE = 0.015

export const MIX_PARAMETER = "mix"

const validate = (parameter: EffectParameter, value: unknown): EffectValue =>
	parameter.choices
		? parameter.choices.some((choice) => choice.value === value)
			? (value as string)
			: parameter.initial
		: bounded(
				value,
				parameter.initial as number,
				parameter.min ?? -Infinity,
				parameter.max ?? Infinity
			)

/**
 * Base for effects built from native AudioNodes. Subclasses route audioInput through
 * their processing into wet, then call start() once their graph is connected.
 */
export default abstract class AbstractEffect extends EventTarget implements IEffect {
	readonly uuid: string
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly audioInput: GainNode
	readonly output: GainNode
	readonly parameters: readonly EffectParameter[]
	readonly options: Record<string, EffectValue | undefined> = {}
	protected readonly wet: GainNode
	private readonly dry?: GainNode
	private readonly nodes: AudioNode[] = []
	private readonly sources: AudioScheduledSourceNode[] = []
	private connected = true
	protected guiEvents?: AbortController

	get type() {
		return this.definition.id
	}
	get name() {
		return this.definition.name
	}
	get description() {
		return this.definition.description
	}
	get isConnected() {
		return this.connected
	}
	hasAudioOutput() {
		return true
	}
	noteOn() {}
	noteOff() {}
	allNotesOff() {}

	constructor(
		protected readonly context: BaseAudioContext,
		readonly definition: EffectDefinition,
		options: Record<string, any> = {}
	) {
		super()
		this.uuid = `Effect-${definition.id}-${crypto.randomUUID()}`
		this.parameters =
			definition.mix === false
				? definition.parameters
				: [
						...definition.parameters,
						{
							id: MIX_PARAMETER,
							name: "Wet mix",
							initial: definition.mix,
							min: 0,
							max: 1,
							step: 0.01
						}
					]
		for (const parameter of this.parameters) {
			this.options[parameter.id] = validate(parameter, options[parameter.id])
		}
		this.audioInput = this.node(context.createGain())
		this.output = this.node(context.createGain())
		this.wet = this.node(context.createGain())
		this.wet.connect(this.output)
		if (definition.mix !== false) {
			this.dry = this.node(context.createGain())
			this.audioInput.connect(this.dry).connect(this.output)
		}
	}

	/** Applies every stored value once the subclass has built its graph. */
	protected start(): void {
		for (const parameter of this.parameters) {
			this.update(parameter.id, this.options[parameter.id]!, true)
		}
	}

	/** Applies one validated parameter value to the subclass graph. */
	protected abstract apply(id: string, value: EffectValue, immediate: boolean): void

	getParameter(id: string): EffectValue | undefined {
		return this.options[id]
	}

	setParameter(id: string, value: EffectValue): void {
		const parameter = this.parameters.find((entry) => entry.id === id)
		if (!parameter) {
			return
		}
		this.options[id] = validate(parameter, value)
		if (this.connected) {
			this.update(id, this.options[id]!, false)
		}
	}

	private update(id: string, value: EffectValue, immediate: boolean): void {
		if (id === MIX_PARAMETER && this.dry) {
			this.glide(this.dry.gain, 1 - (value as number), immediate)
			this.glide(this.wet.gain, value as number, immediate)
		} else {
			this.apply(id, value, immediate)
		}
	}

	protected glide(param: AudioParam, value: number, immediate = false): void {
		if (immediate) {
			param.value = value
		} else {
			param.setTargetAtTime(value, this.context.currentTime, GLIDE)
		}
	}

	/** Registers a node so destroy() disconnects it. */
	protected node<T extends AudioNode>(node: T): T {
		this.nodes.push(node)
		return node
	}

	/** Starts a low frequency oscillator; connect it through a depth gain to modulate a param. */
	protected lfo(frequency: number, type: OscillatorType = "sine"): OscillatorNode {
		const oscillator = this.node(this.context.createOscillator())
		oscillator.type = type
		oscillator.frequency.value = frequency
		oscillator.start()
		this.sources.push(oscillator)
		return oscillator
	}

	/** Adds effect-specific controls above the parameter controls. */
	protected decorateGui(_panel: HTMLElement, _signal: AbortSignal): void {}

	async createGui(): Promise<HTMLElement> {
		await this.destroyGui()
		this.guiEvents = new AbortController()
		const { signal } = this.guiEvents
		const panel = devicePanel()
		this.decorateGui(panel, signal)
		for (const parameter of this.parameters) {
			const title = parameter.unit ? `${parameter.name} (${parameter.unit})` : parameter.name
			const update = (value: EffectValue) => {
				this.setParameter(parameter.id, value)
				changed(this)
			}
			if (parameter.choices) {
				const label = document.createElement("label")
				const select = document.createElement("select")
				for (const choice of parameter.choices) {
					const option = document.createElement("option")
					option.value = choice.value
					option.textContent = choice.label
					select.append(option)
				}
				select.value = String(this.options[parameter.id])
				select.addEventListener(EVENT_CHANGE, () => update(select.value), { signal })
				label.append(`${title} `, select)
				panel.append(label)
			} else {
				numberControl(
					panel,
					title,
					this.options[parameter.id] as number,
					parameter.min ?? -Infinity,
					parameter.max ?? Infinity,
					update,
					parameter.step ?? 1
				)
			}
		}
		return panel
	}

	async destroyGui(): Promise<void> {
		this.guiEvents?.abort()
	}

	async destroy(): Promise<void> {
		this.connected = false
		await this.destroyGui()
		for (const source of this.sources) {
			try {
				source.stop()
			} catch {
				/* Already stopped. */
			}
		}
		for (const node of this.nodes) {
			node.disconnect()
		}
	}
}