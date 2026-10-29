import Colour from "./Colour"

export default class Rainbows {
	public static colour(
		frequency1: number = 0.3,
		frequency2: number = 0.3,
		frequency3: number = 0.3,
		phase1: number = 0,
		phase2: number = 2,
		phase3: number = 4,
		center: number = 128,
		width: number = 127,
		length: number = 255
	): Array<Colour> {
		const rainbow: Array<Colour> = new Array()
		for (let i: number = 0; i < length; ++i) {
			const r: number = Math.sin(frequency1 * i + phase1) * width + center
			const g: number = Math.sin(frequency2 * i + phase2) * width + center
			const b: number = Math.sin(frequency3 * i + phase3) * width + center
			rainbow[i] = new Colour(r, g, b)
		}
		return rainbow
	}
}