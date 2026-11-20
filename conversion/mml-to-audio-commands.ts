import { parseMML } from "../formats/mml"

/** Convert core MML into timed note-on and note-off commands. */
export const MMLtoAudioCommands = (mml: string) => parseMML(mml).commands