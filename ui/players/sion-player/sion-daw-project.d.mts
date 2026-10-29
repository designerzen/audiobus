export function createProject(): {
	version: number
	tempo: number
	repeats: number
	tracks: {
		name: string
		instrument: number
		volume: number
		pan: number
		mute: boolean
		solo: boolean
		mml: string
	}[]
}
/** Validate imported projects before they reach either the UI or the MML compiler. */
export function parseProject(value: any): {
	version: number
	tempo: any
	repeats: any
	tracks: any
}
export function projectMML(value: any): string
/** Shared SiON voices; existing project instrument indices remain stable. */
export const instruments: {
	name: string
	mml: string
}[]