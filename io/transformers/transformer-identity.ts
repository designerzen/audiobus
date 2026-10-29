import type { IAudioCommand } from "../../audio-command-interface.ts"
import type { Timer } from "netronome"
import type { ITransformer } from "./interface-transformer.ts"
import { Transformer } from "./abstract-transformer.ts"

export const ID_IDENTITY = "identity"

export class IdentityTransformer extends Transformer<{}> implements ITransformer {
	type = ID_IDENTITY

	get name(): string {
		return "Identity"
	}
	transform(command: IAudioCommand[], _timer: Timer): IAudioCommand[] {
		return command
	}
}