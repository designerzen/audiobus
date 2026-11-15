import { Visualiser } from "./Visualiser.ts"

export class Scope extends Visualiser {
	public override readonly dataDomain = "time" as const
	constructor() {
		super("Scope")
	}
	update(data: Uint8Array<ArrayBuffer>, time: number, bufferLength = data.length): void {
		this.render(
			"scope",
			data.subarray(0, Math.min(data.length, Math.max(0, bufferLength))),
			time
		)
	}
}