import { parseMML } from "../formats/mml"
import { MAX_MEDIA_BYTES } from "./dropped-media"

export async function importMMLFile(file: File) {
	if (file.size > MAX_MEDIA_BYTES) {
		throw new Error("MML file exceeds the 64 MB limit")
	}
	return parseMML(await file.text(), file.name)
}