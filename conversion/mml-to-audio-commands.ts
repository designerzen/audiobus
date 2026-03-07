import AudioCommand from "../audio-command"

const regex = /([a-g])([#b])?(\d+)?(\.*)/gi

export const MMLtoAudioCommands = (mml: string) => {

	const notes: [] = []
	const noteMap: Record<string, number> = {
		"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11
	}

	let match

	while ((match = regex.exec(mml)) !== null) {
		const noteName = match[1].toLowerCase()
		const accidental = match[2] || ""
		const octave = parseInt(match[3]) || 4
		const dot = match[4]?.length || 0

		let noteNum = noteMap[noteName] + (octave + 1) * 12

		if (accidental === "#") noteNum++
		else if (accidental === "b") noteNum--

		const length = 4 / (1 + dot * 0.5)
		const audioCommand = new AudioCommand()

		audioCommand.number = noteNum
		audioCommand.velocity = 64
		audioCommand.append = length

		notes.push(audioCommand)
	}

	return notes
}