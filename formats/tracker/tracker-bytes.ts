/** Growable little/big-endian byte buffer shared by the tracker module writers */
export class ByteWriter {
	#bytes = new Uint8Array(4096)
	#length = 0

	get length() {
		return this.#length
	}

	#reserve(extra: number) {
		const needed = this.#length + extra
		if (needed <= this.#bytes.length) {
			return
		}
		const grown = new Uint8Array(Math.max(needed, this.#bytes.length * 2))
		grown.set(this.#bytes.subarray(0, this.#length))
		this.#bytes = grown
	}

	u8(value: number) {
		this.#reserve(1)
		this.#bytes[this.#length++] = value & 0xff
		return this
	}

	u16le(value: number) {
		return this.u8(value).u8(value >>> 8)
	}

	u32le(value: number) {
		return this.u16le(value).u16le(value >>> 16)
	}

	u16be(value: number) {
		return this.u8(value >>> 8).u8(value)
	}

	u32be(value: number) {
		return this.u16be(value >>> 16).u16be(value)
	}

	bytes(data: ArrayLike<number>) {
		this.#reserve(data.length)
		for (let i = 0; i < data.length; i++) {
			this.#bytes[this.#length++] = data[i] & 0xff
		}
		return this
	}

	/** ASCII text padded or truncated to a fixed width; anything outside printable ASCII becomes "?" */
	text(value: string, width: number, pad = 0) {
		for (let i = 0; i < width; i++) {
			const code = value.charCodeAt(i)
			this.u8(i >= value.length ? pad : code >= 32 && code < 127 ? code : 63)
		}
		return this
	}

	zeros(count: number) {
		return this.bytes(new Uint8Array(count))
	}

	/** Pad with zeros up to a multiple of `boundary` bytes */
	align(boundary: number) {
		return this.zeros((boundary - (this.#length % boundary)) % boundary)
	}

	/** Overwrite earlier bytes, for offsets only known once later sections are laid out */
	patch32be(offset: number, value: number) {
		new DataView(this.#bytes.buffer).setUint32(offset, value >>> 0, false)
	}

	patchBytes(offset: number, data: ArrayLike<number>) {
		for (let i = 0; i < data.length; i++) {
			this.#bytes[offset + i] = data[i] & 0xff
		}
	}

	patch32le(offset: number, value: number) {
		new DataView(this.#bytes.buffer).setUint32(offset, value >>> 0, true)
	}

	patch16le(offset: number, value: number) {
		new DataView(this.#bytes.buffer).setUint16(offset, value & 0xffff, true)
	}

	toUint8Array() {
		return this.#bytes.slice(0, this.#length)
	}

	toArrayBuffer(): ArrayBuffer {
		return this.#bytes.slice(0, this.#length).buffer as ArrayBuffer
	}
}

/** Module titles and sample names are ASCII; strip anything a tracker's font cannot show */
export const trackerName = (value: string, width: number) =>
	value.replace(/[^\x20-\x7e]/g, "?").slice(0, width)