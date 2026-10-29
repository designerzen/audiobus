import { encode } from "@msgpack/msgpack"
import type { IAudioCommand } from "./audio-command-interface.ts"

/**
 * Encode AudioCommand to MessagePack binary
 * @param command
 * @returns
 */
export const encodeAudioCommand = (command: IAudioCommand): Uint8Array => {
	return encode(command)
}