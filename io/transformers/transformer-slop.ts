import type { Settings } from "./performance-transformer.ts"
import { TransformerStrummer } from "./transformer-strummer.ts"

export const ID_SLOP = "Slop"
/** A low-to-high strum whose notes each land slightly late by a different amount every time. */
export class TransformerSlop extends TransformerStrummer {
	type = ID_SLOP
	get name() {
		return "Slop"
	}
	get description() {
		return "Strum each chord from low to high with slight timing imperfections, so it never lands the same way twice."
	}
	constructor(config: Settings = {}) {
		super({ direction: "up", spread: 60, slop: 30, ...config })
	}
}