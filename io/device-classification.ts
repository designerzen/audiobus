export const DEVICE_SUBTYPES = {
	controller: ["keyboard", "gamepad", "gesture", "pointer", "pads"],
	midi: ["device"],
	audio: [
		"pitch",
		"formant",
		"trigger",
		"speech",
		"metronome",
		"effect",
		"modulation",
		"dynamics",
		"equalizer",
		"delay",
		"reverb",
		"distortion",
		"utility"
	],
	generator: ["ai", "sequencer"],
	sync: ["clock", "vinyl"],
	visual: ["visualiser", "notation", "description"],
	engine: ["instrument"],
	haptic: ["vibration"],
	debug: ["console"],
	transformer: [
		"routing",
		"timing",
		"duration",
		"harmony",
		"pattern",
		"variation",
		"pitch",
		"range",
		"modulation",
		"input"
	]
} as const

export type DeviceType = keyof typeof DEVICE_SUBTYPES
export type DeviceSubtype<T extends DeviceType = DeviceType> = (typeof DEVICE_SUBTYPES)[T][number]

export interface DeviceClassification<T extends DeviceType = DeviceType> {
	type: T
	subtype: DeviceSubtype<T>
}

export interface DeviceAttribution {
	author: string
	sourceUrl: string
	license: string
	licenseUrls: string[]
}

export const INSTRUMENT_CLASSIFICATION = {
	type: "engine",
	subtype: "instrument"
} as const satisfies DeviceClassification<"engine">