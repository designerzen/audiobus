// PhotoSYNTH drum-kit presets, resolved against each voice’s defaults.

export interface ClackOptions {
	name: string
	velocity: number
	outputGain: number
	length: number
	octave: number
	ratios: number[]
	bandpass: number
	bandpassQ: number
	highpass: number
	triggerAt: number
}

export const CLACK_PRESETS: Readonly<Record<string, ClackOptions>> = {
	rimshot: {
		name: "Rim Shot",
		velocity: 1.1,
		outputGain: 1.8,
		length: 0.05,
		octave: 1.3,
		ratios: [750, 1080],
		bandpass: 3200,
		bandpassQ: 4.5,
		highpass: 8000,
		triggerAt: 0
	},
	crossStick: {
		name: "Cross Stick",
		velocity: 1,
		outputGain: 1.8,
		length: 0.07,
		octave: 1.1,
		ratios: [640, 920],
		bandpass: 2800,
		bandpassQ: 4,
		highpass: 7500,
		triggerAt: 0
	},
	claves: {
		name: "Clave",
		velocity: 1,
		outputGain: 1.8,
		length: 0.08,
		octave: 1.4,
		ratios: [1200, 1800],
		bandpass: 5000,
		bandpassQ: 6.5,
		highpass: 9500,
		triggerAt: 0
	},
	woodblockHigh: {
		name: "Woodblock",
		velocity: 1,
		outputGain: 1.8,
		length: 0.06,
		octave: 1.6,
		ratios: [940, 1410],
		bandpass: 4200,
		bandpassQ: 6,
		highpass: 8000,
		triggerAt: 0
	},
	woodblockLow: {
		name: "Low Woodblock",
		velocity: 1,
		outputGain: 1.8,
		length: 0.06,
		octave: 0.76,
		ratios: [940, 1410],
		bandpass: 4200,
		bandpassQ: 6,
		highpass: 8000,
		triggerAt: 0
	},
	castanets: {
		name: "Castanet",
		velocity: 1,
		outputGain: 1.8,
		length: 0.045,
		octave: 1.8,
		ratios: [1100, 1650],
		bandpass: 5500,
		bandpassQ: 5.5,
		highpass: 9500,
		triggerAt: 0
	},
	clack: {
		name: "Default Clack",
		velocity: 1,
		outputGain: 1.8,
		length: 0.05,
		octave: 1,
		ratios: [587, 845],
		bandpass: 2640,
		bandpassQ: 3.5,
		highpass: 7000,
		triggerAt: 0
	}
}

export interface ClapOptions {
	name: string
	velocity: number
	length: number
	highpass: number
	bandpass: number
	bandpassQ: number
	noiseLevel: number
	burstOffsets: number[]
	burstDecay: number
	burstFloor: number
	tailLevel: number
	frequencyStart: number
	frequencyEnd: number
	attack: number
	decay: number
	sustain: number
	triggerAt: number
}

export const CLAP_PRESETS: Readonly<Record<string, ClapOptions>> = {
	fingerSnap: {
		name: "Finger Snap",
		velocity: 1,
		length: 0.12,
		highpass: 6,
		bandpass: 1400,
		bandpassQ: 0.8,
		noiseLevel: 0.72,
		burstOffsets: [0, 0.012, 0.024, 0.036],
		burstDecay: 0.009,
		burstFloor: 0.08,
		tailLevel: 0.32,
		frequencyStart: 1500,
		frequencyEnd: 6000,
		attack: 0.001,
		decay: 0.04,
		sustain: 0.6,
		triggerAt: 0
	},
	clap: {
		name: "Default Clap",
		velocity: 1,
		length: 0.32,
		highpass: 700,
		bandpass: 1400,
		bandpassQ: 0.8,
		noiseLevel: 0.72,
		burstOffsets: [0, 0.012, 0.024, 0.036],
		burstDecay: 0.009,
		burstFloor: 0.08,
		tailLevel: 0.32,
		frequencyStart: 50,
		frequencyEnd: 3000,
		attack: 0.05,
		decay: 0.2,
		sustain: 0.9,
		triggerAt: 0
	}
}

export interface TomOptions {
	name: string
	velocity: number
	length: number
	attack: number
	decay: number
	sustain: number
	release: number
	pitchDecay: number
	pitchStartRatio: number
	pitchEndRatio: number
	triStart: number
	triEnd: number
	sineStart: number
	sineApex: number
	sineSustain: number
	sineEnd: number
	triggerAt: number
}

export const TOM_PRESETS: Readonly<Record<string, TomOptions>> = {
	tomLow: {
		name: "Low Tom",
		velocity: 1,
		length: 0.65,
		attack: 0.001,
		decay: 0.04,
		sustain: 0.7,
		release: 0.4,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 180,
		triEnd: 90,
		sineStart: 165,
		sineApex: 145,
		sineSustain: 115,
		sineEnd: 82,
		triggerAt: 0
	},
	tomMid: {
		name: "Mid Tom",
		velocity: 1,
		length: 0.45,
		attack: 0.0008,
		decay: 0.03,
		sustain: 0.72,
		release: 0.28,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 300,
		triEnd: 150,
		sineStart: 275,
		sineApex: 240,
		sineSustain: 190,
		sineEnd: 135,
		triggerAt: 0
	},
	tomHigh: {
		name: "High Tom",
		velocity: 1,
		length: 0.35,
		attack: 0.0005,
		decay: 0.025,
		sustain: 0.75,
		release: 0.22,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 480,
		triEnd: 240,
		sineStart: 440,
		sineApex: 380,
		sineSustain: 300,
		sineEnd: 215,
		triggerAt: 0
	},
	tomFloorLow: {
		name: "Low Floor Tom",
		velocity: 1.1,
		length: 0.85,
		attack: 0.001,
		decay: 0.06,
		sustain: 0.7,
		release: 0.5,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 67.27171322029716,
		triEnd: 35.31764944065601,
		sineStart: 75.68067737283431,
		sineApex: 63.06723114402859,
		sineSustain: 46.2493028389543,
		sineEnd: 31.95406377964115,
		triggerAt: 0
	},
	tomFloorHigh: {
		name: "High Floor Tom",
		velocity: 1.1,
		length: 0.68,
		attack: 0.001,
		decay: 0.06,
		sustain: 0.7,
		release: 0.5,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 89.79696386474984,
		triEnd: 47.14340602899367,
		sineStart: 101.02158434784357,
		sineApex: 84.18465362320298,
		sineSustain: 61.735412657015516,
		sineEnd: 42.653557835756175,
		triggerAt: 0
	},
	tomMidHigh: {
		name: "High-Mid Tom",
		velocity: 1,
		length: 0.38,
		attack: 0.0008,
		decay: 0.03,
		sustain: 0.72,
		release: 0.28,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 377.97631496846196,
		triEnd: 188.98815748423098,
		sineStart: 346.4782887210901,
		sineApex: 302.38105197476955,
		sineSustain: 239.3849994800259,
		sineEnd: 170.0893417358079,
		triggerAt: 0
	},
	timbaleHigh: {
		name: "727-style High Timbale",
		velocity: 1.05,
		length: 0.16,
		attack: 0.0003,
		decay: 0.011,
		sustain: 0.78,
		release: 0.08,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 520,
		triEnd: 285,
		sineStart: 610,
		sineApex: 480,
		sineSustain: 350,
		sineEnd: 250,
		triggerAt: 0
	},
	timbaleLow: {
		name: "727-style Low Timbale",
		velocity: 1.08,
		length: 0.2,
		attack: 0.0003,
		decay: 0.014,
		sustain: 0.8,
		release: 0.1,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 360,
		triEnd: 185,
		sineStart: 420,
		sineApex: 320,
		sineSustain: 235,
		sineEnd: 165,
		triggerAt: 0
	},
	surdoMute: {
		name: "Muted Surdo",
		velocity: 1,
		length: 0.2,
		attack: 0.0008,
		decay: 0.022,
		sustain: 0.48,
		release: 0.1,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 125,
		triEnd: 62,
		sineStart: 138,
		sineApex: 102,
		sineSustain: 78,
		sineEnd: 55,
		triggerAt: 0
	},
	surdoOpen: {
		name: "Open Surdo",
		velocity: 1,
		length: 0.72,
		attack: 0.0015,
		decay: 0.055,
		sustain: 0.72,
		release: 0.5,
		pitchDecay: 0.16,
		pitchStartRatio: 1,
		pitchEndRatio: 1,
		triStart: 105,
		triEnd: 48,
		sineStart: 118,
		sineApex: 88,
		sineSustain: 62,
		sineEnd: 42,
		triggerAt: 0
	}
}

export interface HandDrumOptions {
	name: string
	frequency: number
	pitchBend: number
	pitchBendTime: number
	overtoneRatio: number
	overtoneLevel: number
	noiseLevel: number
	noiseFrequency: number
	noiseQ: number
	attack: number
	decay: number
	sustain: number
	length: number
	outputGain: number
	velocity: number
}

export const HAND_DRUM_PRESETS: Readonly<Record<string, HandDrumOptions>> = {
	bongoHigh: {
		name: "727-style High Bongo",
		frequency: 455,
		pitchBend: 1.2,
		pitchBendTime: 0.022,
		overtoneRatio: 1.78,
		overtoneLevel: 0.36,
		noiseLevel: 0.3,
		noiseFrequency: 4200,
		noiseQ: 1.8,
		attack: 0.001,
		decay: 0.025,
		sustain: 0.24,
		length: 0.135,
		outputGain: 0.7,
		velocity: 1
	},
	bongoLow: {
		name: "727-style Low Bongo",
		frequency: 330,
		pitchBend: 1.22,
		pitchBendTime: 0.022,
		overtoneRatio: 1.72,
		overtoneLevel: 0.32,
		noiseLevel: 0.25,
		noiseFrequency: 3200,
		noiseQ: 1.5,
		attack: 0.001,
		decay: 0.03,
		sustain: 0.3,
		length: 0.18,
		outputGain: 0.7,
		velocity: 1
	},
	congaMute: {
		name: "808 Mute Conga",
		frequency: 255,
		pitchBend: 1.22,
		pitchBendTime: 0.022,
		overtoneRatio: 1.52,
		overtoneLevel: 0.24,
		noiseLevel: 0.22,
		noiseFrequency: 3150,
		noiseQ: 0.8,
		attack: 0.001,
		decay: 0.025,
		sustain: 0.12,
		length: 0.105,
		outputGain: 0.7,
		velocity: 1
	},
	congaHigh: {
		name: "808 High Conga",
		frequency: 238,
		pitchBend: 1.3,
		pitchBendTime: 0.022,
		overtoneRatio: 1.45,
		overtoneLevel: 0.16,
		noiseLevel: 0.1,
		noiseFrequency: 2400,
		noiseQ: 0.8,
		attack: 0.001,
		decay: 0.05,
		sustain: 0.38,
		length: 0.25,
		outputGain: 0.7,
		velocity: 1
	},
	congaLow: {
		name: "808 Low Conga",
		frequency: 165,
		pitchBend: 1.36,
		pitchBendTime: 0.022,
		overtoneRatio: 1.42,
		overtoneLevel: 0.12,
		noiseLevel: 0.08,
		noiseFrequency: 1650,
		noiseQ: 0.8,
		attack: 0.001,
		decay: 0.07,
		sustain: 0.5,
		length: 0.38,
		outputGain: 0.7,
		velocity: 1
	}
}

export interface ShakerOptions {
	name: string
	length: number
	attack: number
	decay: number
	release: number
	fineLevel: number
	coarseLevel: number
	bandpass: number
	bandpassQ: number
	highpass: number
	lowpass: number
	seedFrequency: number
	seedQ: number
	bodyFrequency: number
	bodyQ: number
	bodyLevel: number
	velocityCurve: number
	durationVariation: number
	filterVariation: number
	panWidth: number
	bufferVariants: number
	outputGain: number
	velocity: number
	triggerAt: number
}

export const SHAKER_PRESETS: Readonly<Record<string, ShakerOptions>> = {
	cabasa: {
		name: "727-style Cabasa",
		length: 0.16,
		attack: 0.012,
		decay: 0.07,
		release: 0.045,
		fineLevel: 0.36,
		coarseLevel: 0.64,
		bandpass: 6800,
		bandpassQ: 0.9,
		highpass: 2700,
		lowpass: 10500,
		seedFrequency: 2600,
		seedQ: 0.8,
		bodyFrequency: 1350,
		bodyQ: 2.2,
		bodyLevel: 0.045,
		velocityCurve: 1.4,
		durationVariation: 0.1,
		filterVariation: 0.08,
		panWidth: 0.05,
		bufferVariants: 10,
		outputGain: 0.15,
		velocity: 1,
		triggerAt: 0
	},
	maracas: {
		name: "808 Maracas",
		length: 0.07,
		attack: 0.012,
		decay: 0.022,
		release: 0.045,
		fineLevel: 0.82,
		coarseLevel: 0.18,
		bandpass: 6200,
		bandpassQ: 0.62,
		highpass: 2400,
		lowpass: 10500,
		seedFrequency: 2600,
		seedQ: 0.8,
		bodyFrequency: 1350,
		bodyQ: 2.2,
		bodyLevel: 0.045,
		velocityCurve: 1.4,
		durationVariation: 0.1,
		filterVariation: 0.08,
		panWidth: 0.05,
		bufferVariants: 10,
		outputGain: 0.14,
		velocity: 1,
		triggerAt: 0
	}
}

export interface TriangleOptions {
	name: string
	frequency: number
	partialRatios: number[]
	partialLevels: number[]
	highpass: number
	attack: number
	decay: number
	sustain: number
	length: number
	outputGain: number
	pitchVariation: number
	modeVariation: number
	levelVariation: number
	lengthVariation: number
	reverb: number
	velocity: number
}

export const TRIANGLE_PRESETS: Readonly<Record<string, TriangleOptions>> = {
	triangleMute: {
		name: "Muted Triangle",
		frequency: 3850,
		partialRatios: [1, 1.31, 1.77, 2.36, 3.05],
		partialLevels: [0.8, 0.52, 0.3, 0.17, 0.09],
		highpass: 3200,
		attack: 0.0005,
		decay: 0.012,
		sustain: 0.018,
		length: 0.07,
		outputGain: 0.038,
		pitchVariation: 45,
		modeVariation: 18,
		levelVariation: 0.12,
		lengthVariation: 0.12,
		reverb: 0.07,
		velocity: 1
	},
	triangleOpen: {
		name: "Open Triangle",
		frequency: 3350,
		partialRatios: [1, 1.31, 1.77, 2.36, 3.05],
		partialLevels: [0.8, 0.52, 0.3, 0.17, 0.09],
		highpass: 2600,
		attack: 0.0005,
		decay: 0.05,
		sustain: 0.12,
		length: 0.48,
		outputGain: 0.04,
		pitchVariation: 45,
		modeVariation: 18,
		levelVariation: 0.12,
		lengthVariation: 0.12,
		reverb: 0.2,
		velocity: 1
	}
}

export interface JingleOptions {
	name: string
	velocity: number
	length: number
	attack: number
	decay: number
	frequencies: number[]
	levels: number[]
	noiseLevel: number
	bandpass: number
	bandpassQ: number
	highpass: number
	outputGain: number
	triggerAt: number
}

export const JINGLE_PRESETS: Readonly<Record<string, JingleOptions>> = {
	tambourine: {
		name: "707-style Tambourine",
		velocity: 1,
		length: 0.2,
		attack: 0.001,
		decay: 0.08,
		frequencies: [3100, 3980, 5150, 6800],
		levels: [1, 0.72, 0.48, 0.3],
		noiseLevel: 0.3,
		bandpass: 5800,
		bandpassQ: 0.8,
		highpass: 1800,
		outputGain: 0.23,
		triggerAt: 0
	},
	chekere: {
		name: "Chekere",
		velocity: 1,
		length: 0.34,
		attack: 0.001,
		decay: 0.08,
		frequencies: [1750, 2380, 3260, 4480],
		levels: [0.35, 0.28, 0.2, 0.12],
		noiseLevel: 0.75,
		bandpass: 3400,
		bandpassQ: 0.8,
		highpass: 700,
		outputGain: 0.25,
		triggerAt: 0
	},
	jingleBell: {
		name: "Jingle Bell",
		velocity: 1,
		length: 0.48,
		attack: 0.001,
		decay: 0.08,
		frequencies: [2480, 3310, 4210, 5630, 7140],
		levels: [1, 0.76, 0.56, 0.36, 0.2],
		noiseLevel: 0.08,
		bandpass: 4900,
		bandpassQ: 0.8,
		highpass: 1800,
		outputGain: 0.22,
		triggerAt: 0
	}
}

export interface ScrapeOptions {
	name: string
	velocity: number
	length: number
	strokes: number
	spacing: number
	bandpass: number
	bandpassQ: number
	highpass: number
	bodyFrequency: number
	bodyLevel: number
	outputGain: number
	attack: number
	triggerAt: number
}

export const SCRAPE_PRESETS: Readonly<Record<string, ScrapeOptions>> = {
	guiroShort: {
		name: "Short Guiro",
		velocity: 1,
		length: 0.14,
		strokes: 4,
		spacing: 0.024,
		bandpass: 4100,
		bandpassQ: 2.6,
		highpass: 900,
		bodyFrequency: 760,
		bodyLevel: 0.12,
		outputGain: 0.34,
		attack: 0.001,
		triggerAt: 0
	},
	guiroLong: {
		name: "Long Guiro",
		velocity: 1,
		length: 0.38,
		strokes: 11,
		spacing: 0.03,
		bandpass: 3400,
		bandpassQ: 2.6,
		highpass: 900,
		bodyFrequency: 760,
		bodyLevel: 0.12,
		outputGain: 0.3,
		attack: 0.001,
		triggerAt: 0
	},
	quijada: {
		name: "727-style Quijada",
		velocity: 1,
		length: 0.32,
		strokes: 9,
		spacing: 0.027,
		bandpass: 2300,
		bandpassQ: 4.2,
		highpass: 900,
		bodyFrequency: 520,
		bodyLevel: 0.28,
		outputGain: 0.31,
		attack: 0.001,
		triggerAt: 0
	},
	vibraslap: {
		name: "Vibraslap",
		velocity: 1,
		length: 0.46,
		strokes: 12,
		spacing: 0.032,
		bandpass: 2650,
		bandpassQ: 5.2,
		highpass: 900,
		bodyFrequency: 690,
		bodyLevel: 0.34,
		outputGain: 0.3,
		attack: 0.001,
		triggerAt: 0
	}
}

export interface FrictionDrumOptions {
	name: string
	velocity: number
	length: number
	attack: number
	decay: number
	startFrequency: number
	endFrequency: number
	overtoneRatio: number
	overtoneLevel: number
	noiseFrequency: number
	noiseLevel: number
	outputGain: number
	triggerAt: number
}

export const FRICTION_DRUM_PRESETS: Readonly<Record<string, FrictionDrumOptions>> = {
	cuicaMute: {
		name: "Muted Cuica",
		velocity: 1,
		length: 0.13,
		attack: 0.004,
		decay: 0.08,
		startFrequency: 310,
		endFrequency: 440,
		overtoneRatio: 1.92,
		overtoneLevel: 0.13,
		noiseFrequency: 1900,
		noiseLevel: 0.12,
		outputGain: 0.3,
		triggerAt: 0
	},
	cuicaOpen: {
		name: "Open Cuica",
		velocity: 1,
		length: 0.34,
		attack: 0.004,
		decay: 0.08,
		startFrequency: 260,
		endFrequency: 520,
		overtoneRatio: 1.92,
		overtoneLevel: 0.2,
		noiseFrequency: 1900,
		noiseLevel: 0.08,
		outputGain: 0.35,
		triggerAt: 0
	}
}

export interface WhistleOptions {
	name: string
	velocity: number
	length: number
	attack: number
	decay: number
	startFrequency: number
	endFrequency: number
	secondRatio: number
	breathLevel: number
	breathFrequency: number
	outputGain: number
	triggerAt: number
}

export const WHISTLE_PRESETS: Readonly<Record<string, WhistleOptions>> = {
	whistleShort: {
		name: "727-style Short Whistle",
		velocity: 1,
		length: 0.18,
		attack: 0.018,
		decay: 0.06,
		startFrequency: 1680,
		endFrequency: 1980,
		secondRatio: 1.006,
		breathLevel: 0.08,
		breathFrequency: 5200,
		outputGain: 0.22,
		triggerAt: 0
	},
	whistleLong: {
		name: "727-style Long Whistle",
		velocity: 1,
		length: 0.68,
		attack: 0.025,
		decay: 0.16,
		startFrequency: 1450,
		endFrequency: 1810,
		secondRatio: 1.006,
		breathLevel: 0.11,
		breathFrequency: 5200,
		outputGain: 0.2,
		triggerAt: 0
	}
}

export interface ChimeOptions {
	name: string
	velocity: number
	length: number
	attack: number
	frequency: number
	partialRatios: number[]
	partialLevels: number[]
	stagger: number
	highpass: number
	outputGain: number
	pitchVariation: number
	triggerAt: number
}

export const CHIME_PRESETS: Readonly<Record<string, ChimeOptions>> = {
	starChime: {
		name: "727-style Star Chime",
		velocity: 1,
		length: 0.72,
		attack: 0.001,
		frequency: 1120,
		partialRatios: [1, 1.51, 2.08, 2.77, 3.64],
		partialLevels: [1, 0.64, 0.42, 0.27, 0.16],
		stagger: 0.008,
		highpass: 900,
		outputGain: 0.19,
		pitchVariation: 22,
		triggerAt: 0
	},
	windChime: {
		name: "Wind Chime",
		velocity: 1,
		length: 1.35,
		attack: 0.001,
		frequency: 720,
		partialRatios: [1, 1.34, 1.83, 2.31, 3.09],
		partialLevels: [0.72, 1, 0.58, 0.34, 0.2],
		stagger: 0.045,
		highpass: 900,
		outputGain: 0.16,
		pitchVariation: 45,
		triggerAt: 0
	}
}

export interface ElectronicPercussionOptions {
	name: string
	velocity: number
	length: number
	attack: number
	startFrequency: number
	endFrequency: number
	waveform: OscillatorType
	overtoneRatio: number
	overtoneLevel: number
	noiseLevel: number
	noiseFrequency: number
	outputGain: number
	triggerAt: number
}

export const ELECTRONIC_PERCUSSION_PRESETS: Readonly<Record<string, ElectronicPercussionOptions>> =
	{
		syndrum: {
			name: "Syndrum",
			velocity: 1,
			length: 0.44,
			attack: 0.001,
			startFrequency: 620,
			endFrequency: 115,
			waveform: "sine",
			overtoneRatio: 1.97,
			overtoneLevel: 0.18,
			noiseLevel: 0.08,
			noiseFrequency: 2400,
			outputGain: 0.38,
			triggerAt: 0
		},
		laserTom: {
			name: "Laser Tom",
			velocity: 1,
			length: 0.3,
			attack: 0.001,
			startFrequency: 1450,
			endFrequency: 95,
			waveform: "sawtooth",
			overtoneRatio: 1.97,
			overtoneLevel: 0.08,
			noiseLevel: 0.03,
			noiseFrequency: 2400,
			outputGain: 0.26,
			triggerAt: 0
		},
		metalHit: {
			name: "Metallic Hit",
			velocity: 1,
			length: 0.5,
			attack: 0.001,
			startFrequency: 820,
			endFrequency: 610,
			waveform: "square",
			overtoneRatio: 1.414,
			overtoneLevel: 0.52,
			noiseLevel: 0.18,
			noiseFrequency: 4700,
			outputGain: 0.22,
			triggerAt: 0
		}
	}

export interface CowbellOptions {
	name: string
	velocity: number
	length: number
	bandpass: number
	fundamental: number
	ratios: number[]
	q: number
	waveforms: OscillatorType[]
	partialLevels: number[]
	outputGain: number
	pitchSweep: number
	pitchSweepTime: number
	pitchVariation: number
	lengthVariation: number
	velocityVariation: number
	qVariation: number
	filterSweep: number
	filterSweepTime: number
	tuningSemitones: number
	attack: number
	decay: number
	sustain: number
	triggerAt: number
}

export const COWBELL_PRESETS: Readonly<Record<string, CowbellOptions>> = {
	rideBell: {
		name: "Ride Bell",
		velocity: 0.7,
		length: 0.78,
		bandpass: 3900,
		fundamental: 1,
		ratios: [860, 1295],
		q: 5.4,
		waveforms: ["triangle", "sine"],
		partialLevels: [0.88, 0.42],
		outputGain: 0.34,
		pitchSweep: 12,
		pitchSweepTime: 0.035,
		pitchVariation: 6,
		lengthVariation: 0.045,
		velocityVariation: 0.06,
		qVariation: 0.12,
		filterSweep: 0.64,
		filterSweepTime: 0.2,
		tuningSemitones: 0,
		attack: 0.001,
		decay: 0.035,
		sustain: 0.76,
		triggerAt: 0
	},
	agogoHigh: {
		name: "727-style High Agogo",
		velocity: 0.95,
		length: 0.31,
		bandpass: 3900,
		fundamental: 1,
		ratios: [880, 1320],
		q: 7.4,
		waveforms: ["triangle", "sine"],
		partialLevels: [0.84, 0.34],
		outputGain: 0.36,
		pitchSweep: 4,
		pitchSweepTime: 0.035,
		pitchVariation: 3,
		lengthVariation: 0.045,
		velocityVariation: 0.06,
		qVariation: 0.12,
		filterSweep: 0.64,
		filterSweepTime: 0.2,
		tuningSemitones: 0,
		attack: 0.0015,
		decay: 0.02,
		sustain: 0.82,
		triggerAt: 0
	},
	agogoLow: {
		name: "727-style Low Agogo",
		velocity: 0.98,
		length: 0.38,
		bandpass: 2850,
		fundamental: 1,
		ratios: [590, 885],
		q: 6.8,
		waveforms: ["triangle", "sine"],
		partialLevels: [0.9, 0.38],
		outputGain: 0.39,
		pitchSweep: 5,
		pitchSweepTime: 0.035,
		pitchVariation: 3,
		lengthVariation: 0.045,
		velocityVariation: 0.06,
		qVariation: 0.12,
		filterSweep: 0.64,
		filterSweepTime: 0.2,
		tuningSemitones: 0,
		attack: 0.0018,
		decay: 0.024,
		sustain: 0.84,
		triggerAt: 0
	}
}

export interface HihatOptions {
	name: string
	velocity: number
	length: number
	fundamental: number
	ratios: number[]
	attack: number
	decay: number
	sustain: number
	release: number
	highpass: number
	bandpass: number
	bandpassQ: number
	lowpass: number
	type: OscillatorType
	metallicGain: number
	noiseGain: number
	noiseAttack: number
	noiseDecay: number
	noiseHighpass: number
	noiseLowpass: number
	triggerAt: number
	cymbal: boolean
}

export const HIHAT_PRESETS: Readonly<Record<string, HihatOptions>> = {
	crash: {
		name: "Crash-style Open Hihat",
		velocity: 1,
		length: 2.5,
		fundamental: 47,
		ratios: [1.91, 2.73, 3.86, 5.18, 6.71, 8.43],
		attack: 0.003,
		decay: 0.22,
		sustain: 0.58,
		release: 1.45,
		highpass: 5200,
		bandpass: 9200,
		bandpassQ: 0.58,
		lowpass: 14500,
		type: "square",
		metallicGain: 0.42,
		noiseGain: 0.07,
		noiseAttack: 0.008,
		noiseDecay: 0.36,
		noiseHighpass: 5200,
		noiseLowpass: 14500,
		triggerAt: 0,
		cymbal: true
	},
	ride: {
		name: "Ride-style Open Hihat",
		velocity: 1,
		length: 1,
		fundamental: 48,
		ratios: [2.3, 3.5, 4.9, 6.3, 7.9, 9.7],
		attack: 0.0005,
		decay: 0.07,
		sustain: 0.8,
		release: 0.45,
		highpass: 6500,
		bandpass: 9500,
		bandpassQ: 0.7,
		lowpass: 11500,
		type: "triangle",
		metallicGain: 1,
		noiseGain: 0,
		noiseAttack: 0.004,
		noiseDecay: 0.18,
		noiseHighpass: 2800,
		noiseLowpass: 11500,
		triggerAt: 0,
		cymbal: true
	},
	ride2: {
		name: "Ride Cymbal 2",
		velocity: 1,
		length: 1.3,
		fundamental: 42,
		ratios: [2.3, 3.5, 4.9, 6.3, 7.9, 9.7],
		attack: 0.0005,
		decay: 0.07,
		sustain: 0.8,
		release: 0.62,
		highpass: 5200,
		bandpass: 8200,
		bandpassQ: 0.7,
		lowpass: 11500,
		type: "triangle",
		metallicGain: 1,
		noiseGain: 0,
		noiseAttack: 0.004,
		noiseDecay: 0.18,
		noiseHighpass: 2800,
		noiseLowpass: 11500,
		triggerAt: 0,
		cymbal: true
	},
	crash2: {
		name: "Crash Cymbal 2",
		velocity: 1,
		length: 1.75,
		fundamental: 47,
		ratios: [1.91, 2.73, 3.86, 5.18, 6.71, 8.43],
		attack: 0.003,
		decay: 0.22,
		sustain: 0.58,
		release: 0.9,
		highpass: 6100,
		bandpass: 9800,
		bandpassQ: 0.58,
		lowpass: 14500,
		type: "square",
		metallicGain: 0.42,
		noiseGain: 0.07,
		noiseAttack: 0.008,
		noiseDecay: 0.36,
		noiseHighpass: 5200,
		noiseLowpass: 14500,
		triggerAt: 0,
		cymbal: true
	},
	splash: {
		name: "Splash Cymbal",
		velocity: 1.05,
		length: 0.72,
		fundamental: 64,
		ratios: [2.1, 3.3, 4.8, 6.2, 8.1, 10.4],
		attack: 0.0002,
		decay: 0.08,
		sustain: 0.78,
		release: 0.38,
		highpass: 7200,
		bandpass: 11200,
		bandpassQ: 0.7,
		lowpass: 11500,
		type: "square",
		metallicGain: 1,
		noiseGain: 0,
		noiseAttack: 0.004,
		noiseDecay: 0.18,
		noiseHighpass: 2800,
		noiseLowpass: 11500,
		triggerAt: 0,
		cymbal: true
	},
	china: {
		name: "China Cymbal",
		velocity: 1.18,
		length: 1.35,
		fundamental: 43,
		ratios: [1.7, 2.65, 4.2, 5.45, 7.2, 9.8],
		attack: 0.0002,
		decay: 0.13,
		sustain: 0.82,
		release: 0.7,
		highpass: 4300,
		bandpass: 7600,
		bandpassQ: 0.7,
		lowpass: 11500,
		type: "square",
		metallicGain: 1,
		noiseGain: 0,
		noiseAttack: 0.004,
		noiseDecay: 0.18,
		noiseHighpass: 2800,
		noiseLowpass: 11500,
		triggerAt: 0,
		cymbal: true
	}
}