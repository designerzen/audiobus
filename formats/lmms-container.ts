import { Unzlib, zlibSync } from "fflate"
import { MAX_MEDIA_BYTES } from "../importers/dropped-media"

/** Qt qCompress: a big-endian expanded size followed by a zlib stream. */
export function decodeLMMSContainer(bytes: Uint8Array): string {
	if (bytes.length < 12) {
		throw new Error("Truncated compressed LMMS project")
	}
	const expected = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
	if (!expected || expected > MAX_MEDIA_BYTES) {
		throw new Error("LMMS project exceeds the 64 MB expanded limit")
	}
	let length = 0
	const chunks: Uint8Array[] = []
	const stream = new Unzlib((chunk) => {
		length += chunk.length
		if (length > expected) {
			throw new Error("Invalid compressed LMMS expanded size")
		}
		chunks.push(chunk)
	})
	for (let at = 4; at < bytes.length; at += 4096) {
		stream.push(bytes.subarray(at, at + 4096), at + 4096 >= bytes.length)
	}
	if (length !== expected) {
		throw new Error("Truncated compressed LMMS project")
	}
	const expanded = new Uint8Array(length)
	let offset = 0
	for (const chunk of chunks) {
		expanded.set(chunk, offset)
		offset += chunk.length
	}
	// fflate's streaming decoder does not check the zlib Adler-32 trailer.
	let a = 1,
		b = 0
	for (let start = 0; start < expanded.length; start += 5552) {
		for (let at = start; at < Math.min(start + 5552, expanded.length); at++) {
			a += expanded[at]
			b += a
		}
		a %= 65521
		b %= 65521
	}
	const checksum = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
		bytes.length - 4
	)
	if (((b << 16) | a) >>> 0 !== checksum) {
		throw new Error("Invalid compressed LMMS checksum")
	}
	return new TextDecoder().decode(expanded)
}

export function encodeLMMSContainer(xml: string): Uint8Array<ArrayBuffer> {
	const raw = new TextEncoder().encode(xml),
		compressed = zlibSync(raw)
	const bytes = new Uint8Array(4 + compressed.length)
	new DataView(bytes.buffer).setUint32(0, raw.length)
	bytes.set(compressed, 4)
	return bytes
}