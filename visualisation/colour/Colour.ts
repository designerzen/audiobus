export class Colour {
	public red: number
	public green: number
	public blue: number

	constructor(r: number, g: number, b: number) {
		this.red = Math.max(0, Math.min(255, Math.round(r)))
		this.green = Math.max(0, Math.min(255, Math.round(g)))
		this.blue = Math.max(0, Math.min(255, Math.round(b)))
	}

	public toRGB(): string {
		return "rgb(" + this.red + "," + this.green + "," + this.blue + ")"
	}

	public toRGBA(alpha: number): string {
		return (
			"rgba(" +
			this.red +
			"," +
			this.green +
			"," +
			this.blue +
			"," +
			Math.max(0, Math.min(1, alpha)) +
			")"
		)
	}

	public toString(): string {
		return (
			"#" +
			((1 << 24) + (this.red << 16) + (this.green << 8) + this.blue).toString(16).slice(1)
		)
	}
}
export default Colour