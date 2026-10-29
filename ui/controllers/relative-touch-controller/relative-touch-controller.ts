import { PitchSurface } from "../pitch-surfaces/pitch-surfaces.ts"

export class RelativeTouchController extends PitchSurface {
	protected kind = "relative" as const
}

if (!customElements.get("relative-touch-controller")) {
	customElements.define("relative-touch-controller", RelativeTouchController)
}

declare global {
	interface HTMLElementTagNameMap {
		"relative-touch-controller": RelativeTouchController
	}
}