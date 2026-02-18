import { decode } from '@msgpack/msgpack'
import type { IAudioCommand } from './audio-command-interface'

/**
 * Decode AudioCommand from MessagePack binary
 */
export const decodeAudioCommand = (data: Uint8Array | ArrayBuffer): IAudioCommand => {
	const decoded = decode(data)
	// const command = createAudioCommand( )
	return decoded as IAudioCommand
}
