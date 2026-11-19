// MIDI Polyphonic Expression (MPE): each sounding note gets its own member channel so
// pitch bend, channel pressure and CC 74 act per note. A zone's master channel carries
// controls shared by all of its notes.

export type MpeZoneName = "lower" | "upper"
export interface MpeZone {
	master: number
	members: number[]
}
export interface MpeControl {
	channel: number
	controller: number
	value: number
}

export const MPE_TIMBRE_CONTROLLER = 74
export const MPE_DEFAULT_MEMBER_BEND_RANGE = 48
export const MPE_DEFAULT_MASTER_BEND_RANGE = 2
// Registered parameter numbers (LSB, with MSB 0) used to configure MPE.
export const RPN_PITCH_BEND_SENSITIVITY = 0
export const RPN_MPE_CONFIGURATION = 6

/** The lower zone's master is channel 1 and grows upwards; the upper zone's is channel 16. */
export function mpeZone(zone: MpeZoneName, members: number): MpeZone {
	const count = Math.max(0, Math.min(15, Math.round(members)))
	return zone === "upper"
		? { master: 16, members: Array.from({ length: count }, (_, i) => 15 - i) }
		: { master: 1, members: Array.from({ length: count }, (_, i) => 2 + i) }
}

/** Select a registered parameter, set its value, then deselect it. */
export function rpnControls(channel: number, parameter: number, value: number): MpeControl[] {
	return [
		[101, 0],
		[100, parameter],
		[6, value],
		[38, 0],
		[101, 127],
		[100, 127]
	].map(([controller, value]) => ({ channel, controller, value }))
}

/** The MPE Configuration Message followed by pitch bend ranges for master and members. */
export function mpeConfigurationControls(
	zone: MpeZone,
	memberBendRange: number,
	masterBendRange: number
): MpeControl[] {
	return [
		...rpnControls(zone.master, RPN_MPE_CONFIGURATION, zone.members.length),
		...rpnControls(zone.master, RPN_PITCH_BEND_SENSITIVITY, masterBendRange),
		...zone.members.flatMap((channel) =>
			rpnControls(channel, RPN_PITCH_BEND_SENSITIVITY, memberBendRange)
		)
	]
}

export const bendToSemitones = (value: number, range: number) =>
	((Math.max(0, Math.min(16383, value)) - 8192) / 8192) * range

export const semitonesToBend = (semitones: number, range: number) =>
	range > 0 ? Math.max(0, Math.min(16383, Math.round(8192 + (semitones / range) * 8192))) : 8192
// MIDI 2 registered per-note controllers that share a MIDI 1 controller number
// (modulation, breath, volume, balance, pan, expression, sound controllers, effects depths).
const REGISTERED_PER_NOTE_CONTROLLERS = new Set([
	1, 2, 7, 8, 10, 11, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 91, 92, 93, 94, 95
])
/** Whether a member channel controller maps to a registered per-note controller. */
export const isRegisteredPerNoteController = (controller: number) =>
	REGISTERED_PER_NOTE_CONTROLLERS.has(controller)

/** Value a member channel controller returns to for a new note; MPE centres timbre. */
export const mpeControllerDefault = (controller: number) =>
	controller === MPE_TIMBRE_CONTROLLER ? 64 : 0