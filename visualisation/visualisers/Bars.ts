import { Visualiser } from "./Visualiser.ts"

export class Bars extends Visualiser {
	constructor() {
		super("Bars")
	}
	update(data: Uint8Array<ArrayBuffer>, time: number, bufferLength = data.length): void {
		this.render(
			"bars",
			data.subarray(0, Math.min(data.length, Math.max(0, bufferLength))),
			time
		)
	}
}