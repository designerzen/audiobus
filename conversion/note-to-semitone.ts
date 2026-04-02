// Note letter to semitone offset within octave (C = 0)
const SEMITONE_NOTE_MAP: Record<string, number> = {
	C: 0,
	D: 2,
	E: 4,
	F: 5,
	G: 7,
	A: 9,
	B: 11
}

export const convertNoteLetterToSemitone = (noteLetter:string) => {
	return SEMITONE_NOTE_MAP[noteLetter]
}