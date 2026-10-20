import {
	DEFAULT_DRUM_COMPRESSOR_SETTINGS,
	type DrumCompressorSettings,
} from '../../effects/drum-compressor.ts'

export const DRUM_GENRES = {
	percussion: {
		title: 'Percussion ensembles',
		grooves: ['percussion-colours', 'electronic-percussion'],
	},
	funk: {
		title: 'Funk & soul',
		grooves: [
			'funky-drummer',
			'think',
			'hot-pants',
			'impeach-president',
			'synthetic-substitution',
			'soul-pride',
			'cold-sweat',
			'ashleys-roachclip',
			'motown',
			'back-to-life',
			'bo-diddley',
			'purdie-shuffle',
			'mardi-gras',
			'simple-song',
			'handclapping-song',
			'funky-mule',
		],
	},
	breaks: { title: 'Breakbeats', grooves: ['amen', 'apache-break', 'levee-break'] },
	electronic: {
		title: 'Electronic & dance',
		grooves: [
			'electro',
			'disco',
			'uk-garage',
			'dubstep',
			'breakstep',
			'trap',
			'footwork',
			'garage-triplets',
			'trap-sextuplets',
			'jungle-32-fill',
			'dubstep-triplet-roll',
		],
	},
	latin: {
		title: 'Latin & Brazilian',
		grooves: [
			'samba',
			'bossa-nova',
			'salsa-mambo',
			'son-montuno',
			'cha-cha',
			'rumba-guaguanco',
			'cumbia',
			'latin-electro',
			'727-latin-box',
		],
	},
	jazz: { title: 'Jazz', grooves: ['jazz-swing'] },
	rock: { title: 'Rock', grooves: ['punk-rock'] },
	reggae: { title: 'Reggae & Afrobeat', grooves: ['reggae', 'afrobeat'] },
	transitions: {
		title: 'Builds & transitions',
		grooves: [
			'performance-crescendo',
			'performance-bridge',
			'performance-snare-roll',
			'performance-breakdown',
			'performance-drop',
		],
	},
} as const

export type DrumGenre = keyof typeof DRUM_GENRES

export interface DrumAccompanimentSettings extends DrumCompressorSettings {
	genre: DrumGenre
	groove: string
	tuningNote: number
	volume: number
	activityResponse: number
	energy: number
	density: number
	tension: number
	fillChance: number
	chaos: number
	rapidPercussion: boolean
	muteKick: boolean
	muteSnare: boolean
	muteHat: boolean
	muteClap: boolean
}

export const DEFAULT_DRUM_ACCOMPANIMENT_SETTINGS: Readonly<DrumAccompanimentSettings> = {
	...DEFAULT_DRUM_COMPRESSOR_SETTINGS,
	genre: 'funk',
	groove: 'funky-drummer',
	tuningNote: 36,
	volume: 0.55,
	activityResponse: 0.35,
	energy: 0.6,
	density: 0.5,
	tension: 0.2,
	fillChance: 0.3,
	chaos: 0.1,
	rapidPercussion: false,
	muteKick: false,
	muteSnare: false,
	muteHat: false,
	muteClap: false,
}