import { Visualiser } from "./Visualiser.ts"

export class Harmongraph extends Visualiser {
	public xRatio = 3
	public yRatio = 2
	public zRatio = 3
	public xPhase = 0
	public yPhase = 0
	public zPhase = 0
	public amplitude = 150
	public decay = 0.0002
	constructor() {
		super("Harmongraph")
	}
	update(data: Uint8Array<ArrayBuffer>, time: number, bufferLength = data.length): void {
		this.render(
			"harmongraph",
			data.subarray(0, Math.min(data.length, Math.max(0, bufferLength))),
			time,
			this.amplitude,
			this.decay,
			[this.xRatio, this.yRatio, this.zRatio],
			[this.xPhase, this.yPhase, this.zPhase]
		)
	}
}