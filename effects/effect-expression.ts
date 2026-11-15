import AbstractEffect from "./abstract-effect"
import { EXPRESSION } from "./effect-definitions"
import type { EffectValue } from "./effect-interface"
import { createExpressionStage, type ExpressionStage } from "./expression-stage"

/** A performance control that darkens, compresses and adds echo and reverb as amount rises. */
export default class EffectExpression extends AbstractEffect {
	private stage: ExpressionStage
	constructor(context: BaseAudioContext, options: Record<string, any> = {}) {
		super(context, EXPRESSION, options)
		this.stage = createExpressionStage(context, (created) => this.node(created))
		this.audioInput.connect(this.stage.input)
		this.stage.output.connect(this.wet)
		this.start()
	}
	protected apply(_id: string, _value: EffectValue, immediate: boolean) {
		const { options } = this
		this.stage.update(
			options.amount as number,
			{
				filter: options.filter as number,
				compression: options.compression as number,
				echo: options.echo as number,
				reverb: options.reverb as number
			},
			immediate
		)
	}
}