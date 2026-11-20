import { parseRTTTL } from "../formats/rtttl"
import { MAX_MEDIA_BYTES } from "./dropped-media"

export async function importRTTTLFile(file: File) {
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("RTTTL file exceeds the 64 MB limit")
	}
	return parseRTTTL(await file.text(), file.name)
}