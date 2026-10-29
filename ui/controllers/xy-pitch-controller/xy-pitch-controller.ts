import { PitchSurface } from "../pitch-surfaces/pitch-surfaces.ts"

export class XYPitchController extends PitchSurface {
	protected kind = "xy" as const
}

if (!customElements.get("xy-pitch-controller")) {
	customElements.define("xy-pitch-controller", XYPitchController)
}

declare global {
	interface HTMLElementTagNameMap {
		"xy-pitch-controller": XYPitchController
	}
}