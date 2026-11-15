import { Visualiser } from "./Visualiser.ts"

export class Plasma extends Visualiser {
	constructor() {
		super("Plasma")
	}
	update(data: Uint8Array<ArrayBuffer>, time: number, bufferLength = data.length): void {
		this.render(
			"plasma",
			data.subarray(0, Math.min(data.length, Math.max(0, bufferLength))),
			time
		)
	}
}