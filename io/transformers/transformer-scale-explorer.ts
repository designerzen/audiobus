import {
	PerformanceTransformer,
	noteKey,
	type Settings,
	type Voice
} from "./performance-transformer"
import {
	SCALE_EXPLORER_DEFAULTS,
	effectiveScaleSet,
	scaleExplorerControls
} from "../scale-explorer-controls"
import { pitchSetMask, quantisePitchSet } from "../../tuning/pitch-class-set"

export const ID_SCALE_EXPLORER = "Scale-Explorer"

export class TransformerScaleExplorer extends PerformanceTransformer {
	type = ID_SCALE_EXPLORER
	category = "Tuning"
	get name() {
		return "Scale Explorer"
	}
	get description() {
		return "Play through any twelve-tone pitch set, its modes, reflection, complement or fourths/fifths mapping."
	}
	constructor(config: Settings = {}) {
		super(
			{ ...SCALE_EXPLORER_DEFAULTS, direction: "nearest" },
			[
				...scaleExplorerControls(),
				{
					name: "direction",
					label: "Incoming notes",
					values: ["nearest", "up", "down", "filter"],
					help: "Nearest ties go down. Filter drops notes outside the set. An empty set is silent."
				}
			],
			config
		)
	}
	override setConfig(key: string, value: unknown): void {
		if (key === "mask") {
			value = pitchSetMask(value)
		}
		if (key === "root" || key === "mode") {
			const number = Number(value)
			value = Number.isFinite(number) ? Math.min(11, Math.max(0, Math.round(number))) : 0
		}
		super.setConfig(key, value)
	}
	protected noteOn(voice: Voice) {
		const pitch = quantisePitchSet(
			voice.input.number,
			effectiveScaleSet(this.options),
			Number(this.options.root),
			String(this.options.direction)
		)
		if (pitch === undefined) {
			return []
		}
		const target = this.start(voice, pitch)
		// Several held keys can converge on one output pitch. Keep it sounding
		// until the last key releases, without retriggering it for each key.
		const alreadyHeld = [...this.voices].some(
			(other) =>
				other !== voice && other.targets.some((held) => noteKey(held) === noteKey(target))
		)
		return alreadyHeld ? [] : [target]
	}
	protected override noteOff(voice: Voice) {
		return this.release(voice).filter(
			(target) =>
				![...this.voices].some((other) =>
					other.targets.some((held) => noteKey(held) === noteKey(target))
				)
		)
	}
}