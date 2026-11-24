/** Cuts arbitrary-length sample chunks into overlapping fixed-size frames. */
export class StreamFramer {
	#buffer: Float32Array
	#filled = 0
	#consumed = 0

	constructor(
		readonly frameSize: number,
		readonly hopSize: number
	) {
		this.#buffer = new Float32Array(frameSize * 2)
	}

	/** Returns each completed frame with its start offset in samples since the first push. */
	push(samples: Float32Array): { frame: Float32Array; offset: number }[] {
		const frames: { frame: Float32Array; offset: number }[] = []
		let read = 0
		while (read < samples.length) {
			const count = Math.min(samples.length - read, this.#buffer.length - this.#filled)
			this.#buffer.set(samples.subarray(read, read + count), this.#filled)
			this.#filled += count
			read += count
			while (this.#filled >= this.frameSize) {
				frames.push({
					frame: this.#buffer.slice(0, this.frameSize),
					offset: this.#consumed
				})
				this.#buffer.copyWithin(0, this.hopSize, this.#filled)
				this.#filled -= this.hopSize
				this.#consumed += this.hopSize
			}
		}
		return frames
	}
}