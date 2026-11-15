/**
 * Maps a facial-expression emoji to a chord. Pure functions only: the profile
 * tables decide the emotional colour, then the chord is voiced either from the
 * played note as a free root or inside a shared key.
 */
import {
	CHROMATIC_INTERVAL_LIBRARY as CHROMATIC,
	CHORD_VOICING_INTERVAL_LIBRARY as VOICINGS,
	type IntervalSet
} from "./emotional-intervals.ts"
import {
	HARMONY_MODE_GLOBAL_KEY,
	getPitchClassForKey,
	getScaleFormula,
	isChromaticScale,
	type KeyInput,
	type ScaleFormula
} from "./keys.ts"
import {
	AEOLIAN_INTERVALS,
	DORIAN_INTERVALS,
	IONIAN_INTERVALS,
	LOCRIAN_INTERVALS,
	LYDIAN_INTERVALS,
	MIXOLYDIAN_INTERVALS,
	PHRYGIAN_INTERVALS
} from "./intervals.ts"
import {
	TUNING_MODE_AEOLIAN,
	TUNING_MODE_DORIAN,
	TUNING_MODE_IONIAN,
	TUNING_MODE_LOCRIAN,
	TUNING_MODE_LYDIAN,
	TUNING_MODE_MIXOLYDIAN,
	TUNING_MODE_PHRYGIAN
} from "./scales.ts"

export interface ChordNote {
	noteNumber: number
	/** Flat spelling with the octave, C4 = 60 */
	noteName: string
}

export interface EmotionalProfile {
	title: string
	intervals: IntervalSet
	candidateIntervals: IntervalSet
}

export interface EmotionHarmonyOptions {
	harmonyMode?: string
	/** Key tonic used when harmonyMode is "global-key" */
	tonic?: KeyInput
	keyScale?: ScaleFormula | string
	previousChord?: ChordNote[]
}

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
const MIDI_NOTE_COUNT = 128

const getNote = (noteNumber: number): ChordNote | undefined => {
	if (!Number.isInteger(noteNumber) || noteNumber < 0 || noteNumber >= MIDI_NOTE_COUNT) {
		return undefined
	}
	return {
		noteNumber,
		noteName: `${NOTE_NAMES[noteNumber % 12]}${Math.floor(noteNumber / 12) - 1}`
	}
}

const isNote = (note: ChordNote | undefined): note is ChordNote => note !== undefined

/** Every expression emoji PhotoSYNTH maps, keyed by its EMOJI_* name. */
export const EMOJI_EXPRESSIONS = Object.freeze({
	EMOJI_NEUTRAL: "😐",
	EMOJI_NEUTRAL_EYES_CLOSED: "😑",
	EMOJI_LEFT_WINK: "😉",
	EMOJI_RIGHT_WINK: "😉",
	EMOJI_DIAGONAL_MOUTH: "🫤",
	EMOJI_EYES_ROLLING_UP: "🙄",
	EMOJI_SMILING_SLIGHTLY: "🙂",
	EMOJI_SMILING_EYES_CLOSED: "😊",
	EMOJI_SMILING_GRIN: "😀",
	EMOJI_SMILING_BIG_GRIN: "😃",
	EMOJI_SMILING_GRIN_SQUINT: "😆",
	EMOJI_SMILING_BIG_TEETH_GRIN_EYES_CLOSED: "😁",
	EMOJI_SMILING_GRIN_EYES_CLOSED: "😄",
	EMOJI_OPEN_MOUTH: "😯",
	EMOJI_OPEN_MOUTH_BIG: "😮",
	EMOJI_WAIL: "😩",
	EMOJI_ASTONISHED: "😲",
	EMOJI_GRIMACING: "😬",
	EMOJI_ZANY: "🤪",
	EMOJI_KISS: "😗",
	EMOJI_KISS_EYES_CLOSED: "😙",
	EMOJI_KISS_EYES_CLOSED_EYEBROWS_RAISED: "😚",
	EMOJI_SMIRK: "😏",
	EMOJI_UNAMUSED: "😒",
	EMOJI_RAISED_EYEBROW: "🤨",
	EMOJI_CONFUSED: "😕",
	EMOJI_WORRIED: "😟",
	EMOJI_FROWNING: "☹️",
	EMOJI_FROWN_EYES_CLOSED: "😞",
	EMOJI_ANGRY: "😠",
	EMOJI_TRIPPY: "😵‍💫",
	EMOJI_SHAKING: "🫨",
	EMOJI_SHAKING_HORIZONTALLY: "🙂‍↔️",
	EMOJI_SHAKING_VERTICALLY: "🙂‍↕️",
	EMOJI_CRYING: "😭",
	EMOJI_KISSING_WINK: "😘",
	EMOJI_HEARTS: "🥰",
	EMOJI_HEART_EYES: "😍",
	EMOJI_STAR_STRUCK: "🤩",
	EMOJI_PARTY: "🥳",
	EMOJI_UPSIDE_DOWN: "🙃",
	EMOJI_HAPPY_TEARS: "🥲",
	EMOJI_HOLDING_TEARS: "🥹",
	EMOJI_SAVORING: "😋",
	EMOJI_TONGUE: "😛",
	EMOJI_TONGUE_WINK: "😜",
	EMOJI_TONGUE_SQUINT: "😝",
	EMOJI_HALO: "😇",
	EMOJI_SALUTE: "🫡",
	EMOJI_THINKING: "🤔",
	EMOJI_SHUSHING: "🤫",
	EMOJI_HAND_OVER_MOUTH: "🫢",
	EMOJI_GIGGLING: "🤭",
	EMOJI_YAWNING: "🥱",
	EMOJI_HUGGING: "🤗",
	EMOJI_PEEKING: "🫣",
	EMOJI_SCREAMING: "😱",
	EMOJI_MONOCLE: "🧐",
	EMOJI_EXHALING: "😮‍💨",
	EMOJI_STEAM: "😤",
	EMOJI_RAGE: "🤬",
	EMOJI_PLEADING: "🥺",
	EMOJI_ANXIOUS: "😰",
	EMOJI_FEARFUL: "😨",
	EMOJI_ANGUISHED_EYEBROWS_RAISED: "😧",
	EMOJI_ANGUISHED: "😦",
	EMOJI_SHOCKED: "😲",
	EMOJI_FLUSHED: "😳",
	EMOJI_MIND_BLOWN: "🤯",
	EMOJI_DOWNCAST_SWEAT: "😓",
	EMOJI_PERSEVERING: "😣",
	EMOJI_TIRED: "😫",
	EMOJI_DIZZY: "😵",
	EMOJI_DOTTED_LINE: "🫥",
	EMOJI_SLEEPING: "😴",
	EMOJI_SLEEPY: "😪",
	EMOJI_DROOLING: "🤤",
	EMOJI_MOON_FACE: "🌛",
	EMOJI_MOON_FACE_LEFT: "🌜",
	EMOJI_NEW_MOON_FACE: "🌚",
	EMOJI_FULL_MOON_FACE: "🌝",
	EMOJI_SUN_FACE: "🌞",
	EMOJI_MELTING: "🫠",
	EMOJI_FOG: "😶‍🌫︎",
	EMOJI_WOOZY: "🥴",
	EMOJI_HOT: "🥵",
	EMOJI_COLD: "🥶",
	EMOJI_NAUSEATED: "🤢",
	EMOJI_VOMITING: "🤮",
	EMOJI_SNEEZING: "🤧",
	EMOJI_SICK: "🤒",
	EMOJI_INJURED: "🤕",
	EMOJI_MASK: "😷",
	EMOJI_COWBOY: "🤠",
	EMOJI_MONEY: "🤑",
	EMOJI_SUNGLASSES: "😎",
	EMOJI_NERD: "🤓",
	EMOJI_DISGUISED: "🥸",
	EMOJI_LYING: "🤥",
	EMOJI_CLOWN: "🤡",
	EMOJI_GHOST: "👻",
	EMOJI_POOP: "💩",
	EMOJI_ALIEN: "👽",
	EMOJI_ROBOT: "🤖",
	EMOJI_SLEEPING_SYMBOL: "💤",
	EMOJI_HOLE: "🕳︎",
	EMOJI_PARTY_POPPER: "🎉",
	EMOJI_CONFETTI: "🎊",
	EMOJI_SEE_NO_EVIL: "🙈",
	EMOJI_HEAR_NO_EVIL: "🙉",
	EMOJI_SPEAK_NO_EVIL: "🙊",
	EMOJI_CAT_GRINNING: "😺",
	EMOJI_CAT_HAPPY: "😸",
	EMOJI_CAT_TEARS_JOY: "😹",
	EMOJI_CAT_HEART_EYES: "😻",
	EMOJI_CAT_SMIRK: "😼",
	EMOJI_CAT_KISSING: "😽",
	EMOJI_CAT_SCREAMING: "🙀",
	EMOJI_CAT_CRYING: "😿",
	EMOJI_CAT_POUTING: "😾",
	EMOJI_HEART_RED: "❤︎",
	EMOJI_HEART_ORANGE: "🧡",
	EMOJI_HEART_YELLOW: "💛",
	EMOJI_HEART_GREEN: "💚",
	EMOJI_HEART_BLUE: "💙",
	EMOJI_HEART_PURPLE: "💜",
	EMOJI_HEART_BROWN: "🤎",
	EMOJI_HEART_BLACK: "🖤",
	EMOJI_HEART_WHITE: "🤍",
	EMOJI_HEART_CLASSIC: "♥︎",
	EMOJI_MOOD_ALL: "all",
	EMOJI_MOOD_HAPPY: "happy",
	EMOJI_MOOD_SAD: "sad"
} as const)

const DEFAULT_CHORD_VOICE_COUNT = 3
export const MAX_CHORD_VOICE_COUNT = 5
const normaliseVoiceCount = (voiceCount: unknown) =>
	Math.min(
		Math.max(Math.round(Number(voiceCount)) || DEFAULT_CHORD_VOICE_COUNT, 1),
		MAX_CHORD_VOICE_COUNT
	)

const emotionalProfile = (title: string, intervals: IntervalSet): EmotionalProfile =>
	Object.freeze({
		title,
		intervals,
		candidateIntervals: intervals
	})

export const CHORD_EMOTIONAL_PROFILES = Object.freeze({
	rest: emotionalProfile("still / neutral", CHROMATIC.rest),
	openFifth: emotionalProfile("open / grounded", CHROMATIC.unisonFifth),
	brightResolved: emotionalProfile("bright / resolved", VOICINGS.major),
	warmNostalgic: emotionalProfile("warm / nostalgic", VOICINGS.major6),
	refinedMysterious: emotionalProfile("refined / slightly mysterious", VOICINGS.major7),
	openOptimistic: emotionalProfile("open / optimistic", VOICINGS.sixth9),
	joyfulExpansive: emotionalProfile("joyful / expansive", VOICINGS.major9),
	radiantExuberant: emotionalProfile("radiant / exuberant", VOICINGS.radiantMajor11),
	ecstaticOpen: emotionalProfile("ecstatic / maximally open", VOICINGS.ecstaticMajor13),
	darkIntrospective: emotionalProfile("dark / introspective", VOICINGS.minor),
	tenderBittersweet: emotionalProfile("tender / bittersweet", VOICINGS.minor6),
	soulfulDeep: emotionalProfile("soulful / emotionally deep", VOICINGS.minor7),
	lushIntrospective: emotionalProfile("lush / introspective", VOICINGS.minor9),
	hauntingIntense: emotionalProfile("haunting / intense", VOICINGS.minorMajor7),
	weepingVulnerable: emotionalProfile("weeping / vulnerable", VOICINGS.weepingMinor11),
	desolateAnguished: emotionalProfile("desolate / anguished", VOICINGS.desolateMinorMajor13),
	openUnresolved: emotionalProfile("open / unresolved", VOICINGS.suspended),
	airyUncertain: emotionalProfile("airy / uncertain", VOICINGS.suspended2),
	dissonantDemanding: emotionalProfile("dissonant / demanding resolution", VOICINGS.suspended7),
	dramaticUnsettling: emotionalProfile("dramatic / unsettling", VOICINGS.diminished),
	anxiousUnresolved: emotionalProfile("anxious / unresolved", VOICINGS.diminished7),
	shadowyUnstable: emotionalProfile("shadowy / unstable", VOICINGS.halfDiminished),
	strongPull: emotionalProfile("strong pull / resolution-seeking", VOICINGS.dominant7),
	colourfulUrgent: emotionalProfile("colourful / urgent", VOICINGS.dominant9),
	brightUnsettled: emotionalProfile("bright / unsettled", VOICINGS.augmented),
	lydianGlow: emotionalProfile("luminous / expectant", CHROMATIC.lydianGlow),
	phrygian: emotionalProfile("dark / confrontational", CHROMATIC.phrygian),
	question: emotionalProfile("uncertain / questioning", CHROMATIC.question),
	cluster: emotionalProfile("compressed / nervous", CHROMATIC.cluster),
	wideCluster: emotionalProfile("anxious / spacious", CHROMATIC.wideCluster),
	tritone: emotionalProfile("suspicious / unstable", CHROMATIC.tritoneTension),
	alarm: emotionalProfile("urgent / highly dissonant", CHROMATIC.alarm),
	wholeTone: emotionalProfile("floating / surreal", CHROMATIC.wholeToneColour),
	dream: emotionalProfile("soft / ambiguous", CHROMATIC.dream),
	sleep: emotionalProfile("calm / hollow", CHROMATIC.sleep),
	hollow: emotionalProfile("empty / neutral", CHROMATIC.hollow),
	lowHollow: emotionalProfile("subdued / unresolved", CHROMATIC.lowHollow),
	blues: emotionalProfile("gritty / expressive", CHROMATIC.blues),
	comic: emotionalProfile("buoyant / awkward", CHROMATIC.comic),
	alien: emotionalProfile("strange / unsettled", CHROMATIC.alien),
	coolHeart: emotionalProfile("tender / distant", CHROMATIC.coolHeart),
	darkHeart: emotionalProfile("sombre / unresolved", CHROMATIC.darkHeart)
})

const EMOTION_INTERVAL_PROFILES = Object.freeze({
	rest: [CHORD_EMOTIONAL_PROFILES.rest],
	unison: [CHORD_EMOTIONAL_PROFILES.openFifth],
	neutral: [CHORD_EMOTIONAL_PROFILES.brightResolved, CHORD_EMOTIONAL_PROFILES.refinedMysterious],
	softMajor: [
		CHORD_EMOTIONAL_PROFILES.brightResolved,
		CHORD_EMOTIONAL_PROFILES.warmNostalgic,
		CHORD_EMOTIONAL_PROFILES.refinedMysterious,
		CHORD_EMOTIONAL_PROFILES.openOptimistic
	],
	openMajor: [
		CHORD_EMOTIONAL_PROFILES.refinedMysterious,
		CHORD_EMOTIONAL_PROFILES.brightResolved
	],
	brightSixth: [CHORD_EMOTIONAL_PROFILES.warmNostalgic, CHORD_EMOTIONAL_PROFILES.openOptimistic],
	joy: [CHORD_EMOTIONAL_PROFILES.brightResolved, CHORD_EMOTIONAL_PROFILES.openOptimistic],
	celebration: [CHORD_EMOTIONAL_PROFILES.openOptimistic, CHORD_EMOTIONAL_PROFILES.brightResolved],
	lydianGlow: [CHORD_EMOTIONAL_PROFILES.lydianGlow, CHORD_EMOTIONAL_PROFILES.refinedMysterious],
	mixolydian: [CHORD_EMOTIONAL_PROFILES.strongPull, CHORD_EMOTIONAL_PROFILES.brightResolved],
	dorian: [CHORD_EMOTIONAL_PROFILES.warmNostalgic, CHORD_EMOTIONAL_PROFILES.soulfulDeep],
	minor: [CHORD_EMOTIONAL_PROFILES.darkIntrospective, CHORD_EMOTIONAL_PROFILES.soulfulDeep],
	sadSixth: [CHORD_EMOTIONAL_PROFILES.soulfulDeep, CHORD_EMOTIONAL_PROFILES.tenderBittersweet],
	heavyMinor: [
		CHORD_EMOTIONAL_PROFILES.hauntingIntense,
		CHORD_EMOTIONAL_PROFILES.soulfulDeep,
		CHORD_EMOTIONAL_PROFILES.lushIntrospective
	],
	phrygian: [CHORD_EMOTIONAL_PROFILES.phrygian, CHORD_EMOTIONAL_PROFILES.darkIntrospective],
	question: [CHORD_EMOTIONAL_PROFILES.question, CHORD_EMOTIONAL_PROFILES.airyUncertain],
	suspension: [
		CHORD_EMOTIONAL_PROFILES.dissonantDemanding,
		CHORD_EMOTIONAL_PROFILES.openUnresolved,
		CHORD_EMOTIONAL_PROFILES.airyUncertain
	],
	sus2: [CHORD_EMOTIONAL_PROFILES.airyUncertain, CHORD_EMOTIONAL_PROFILES.openUnresolved],
	sus4: [CHORD_EMOTIONAL_PROFILES.openUnresolved, CHORD_EMOTIONAL_PROFILES.dissonantDemanding],
	cluster: [CHORD_EMOTIONAL_PROFILES.cluster, CHORD_EMOTIONAL_PROFILES.shadowyUnstable],
	wideCluster: [CHORD_EMOTIONAL_PROFILES.wideCluster, CHORD_EMOTIONAL_PROFILES.shadowyUnstable],
	diminished: [
		CHORD_EMOTIONAL_PROFILES.dramaticUnsettling,
		CHORD_EMOTIONAL_PROFILES.anxiousUnresolved
	],
	tritone: [CHORD_EMOTIONAL_PROFILES.tritone, CHORD_EMOTIONAL_PROFILES.strongPull],
	alarm: [CHORD_EMOTIONAL_PROFILES.alarm, CHORD_EMOTIONAL_PROFILES.anxiousUnresolved],
	wholeTone: [CHORD_EMOTIONAL_PROFILES.wholeTone, CHORD_EMOTIONAL_PROFILES.brightUnsettled],
	augmented: [
		CHORD_EMOTIONAL_PROFILES.brightUnsettled,
		CHORD_EMOTIONAL_PROFILES.refinedMysterious
	],
	dream: [CHORD_EMOTIONAL_PROFILES.dream, CHORD_EMOTIONAL_PROFILES.refinedMysterious],
	sleep: [CHORD_EMOTIONAL_PROFILES.sleep, CHORD_EMOTIONAL_PROFILES.openFifth],
	hollow: [CHORD_EMOTIONAL_PROFILES.hollow, CHORD_EMOTIONAL_PROFILES.openFifth],
	lowHollow: [CHORD_EMOTIONAL_PROFILES.lowHollow, CHORD_EMOTIONAL_PROFILES.hollow],
	blues: [CHORD_EMOTIONAL_PROFILES.blues, CHORD_EMOTIONAL_PROFILES.strongPull],
	sly: [CHORD_EMOTIONAL_PROFILES.strongPull, CHORD_EMOTIONAL_PROFILES.colourfulUrgent],
	comic: [CHORD_EMOTIONAL_PROFILES.comic, CHORD_EMOTIONAL_PROFILES.brightResolved],
	mechanical: [CHORD_EMOTIONAL_PROFILES.refinedMysterious],
	alien: [CHORD_EMOTIONAL_PROFILES.alien],
	heart: [CHORD_EMOTIONAL_PROFILES.openOptimistic, CHORD_EMOTIONAL_PROFILES.warmNostalgic],
	warmHeart: [CHORD_EMOTIONAL_PROFILES.warmNostalgic],
	coolHeart: [CHORD_EMOTIONAL_PROFILES.coolHeart],
	darkHeart: [CHORD_EMOTIONAL_PROFILES.darkHeart],
	catHappy: [CHORD_EMOTIONAL_PROFILES.brightResolved],
	catSad: [CHORD_EMOTIONAL_PROFILES.soulfulDeep],
	catAngry: [CHORD_EMOTIONAL_PROFILES.anxiousUnresolved]
})

export const EMOJI_INTERVAL_CHOICES = new Map<string, readonly EmotionalProfile[]>([
	[EMOJI_EXPRESSIONS.EMOJI_NEUTRAL, EMOTION_INTERVAL_PROFILES.neutral],
	[EMOJI_EXPRESSIONS.EMOJI_NEUTRAL_EYES_CLOSED, EMOTION_INTERVAL_PROFILES.rest],
	[EMOJI_EXPRESSIONS.EMOJI_LEFT_WINK, EMOTION_INTERVAL_PROFILES.dorian],
	[EMOJI_EXPRESSIONS.EMOJI_RIGHT_WINK, EMOTION_INTERVAL_PROFILES.dorian],
	[EMOJI_EXPRESSIONS.EMOJI_DIAGONAL_MOUTH, EMOTION_INTERVAL_PROFILES.question],
	[EMOJI_EXPRESSIONS.EMOJI_EYES_ROLLING_UP, EMOTION_INTERVAL_PROFILES.suspension],
	[
		EMOJI_EXPRESSIONS.EMOJI_SMILING_SLIGHTLY,
		[
			CHORD_EMOTIONAL_PROFILES.brightResolved,
			CHORD_EMOTIONAL_PROFILES.warmNostalgic,
			CHORD_EMOTIONAL_PROFILES.refinedMysterious
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_SMILING_EYES_CLOSED,
		[
			CHORD_EMOTIONAL_PROFILES.warmNostalgic,
			CHORD_EMOTIONAL_PROFILES.brightResolved,
			CHORD_EMOTIONAL_PROFILES.refinedMysterious
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_SMILING_GRIN,
		[
			CHORD_EMOTIONAL_PROFILES.refinedMysterious,
			CHORD_EMOTIONAL_PROFILES.warmNostalgic,
			CHORD_EMOTIONAL_PROFILES.brightResolved
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_SMILING_BIG_GRIN,
		[
			CHORD_EMOTIONAL_PROFILES.joyfulExpansive,
			CHORD_EMOTIONAL_PROFILES.openOptimistic,
			CHORD_EMOTIONAL_PROFILES.refinedMysterious
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_SMILING_GRIN_SQUINT,
		[
			CHORD_EMOTIONAL_PROFILES.radiantExuberant,
			CHORD_EMOTIONAL_PROFILES.joyfulExpansive,
			CHORD_EMOTIONAL_PROFILES.openOptimistic
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_SMILING_BIG_TEETH_GRIN_EYES_CLOSED,
		[
			CHORD_EMOTIONAL_PROFILES.ecstaticOpen,
			CHORD_EMOTIONAL_PROFILES.radiantExuberant,
			CHORD_EMOTIONAL_PROFILES.joyfulExpansive
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_SMILING_GRIN_EYES_CLOSED,
		[
			CHORD_EMOTIONAL_PROFILES.openOptimistic,
			CHORD_EMOTIONAL_PROFILES.joyfulExpansive,
			CHORD_EMOTIONAL_PROFILES.warmNostalgic
		]
	],
	[EMOJI_EXPRESSIONS.EMOJI_OPEN_MOUTH, EMOTION_INTERVAL_PROFILES.minor],
	[EMOJI_EXPRESSIONS.EMOJI_OPEN_MOUTH_BIG, EMOTION_INTERVAL_PROFILES.heavyMinor],
	[
		EMOJI_EXPRESSIONS.EMOJI_WAIL,
		[
			CHORD_EMOTIONAL_PROFILES.desolateAnguished,
			CHORD_EMOTIONAL_PROFILES.weepingVulnerable,
			CHORD_EMOTIONAL_PROFILES.hauntingIntense
		]
	],
	[EMOJI_EXPRESSIONS.EMOJI_ASTONISHED, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_GRIMACING, EMOTION_INTERVAL_PROFILES.phrygian],
	[EMOJI_EXPRESSIONS.EMOJI_ZANY, EMOTION_INTERVAL_PROFILES.comic],
	[EMOJI_EXPRESSIONS.EMOJI_KISS, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_KISS_EYES_CLOSED, EMOTION_INTERVAL_PROFILES.dream],
	[
		EMOJI_EXPRESSIONS.EMOJI_KISS_EYES_CLOSED_EYEBROWS_RAISED,
		EMOTION_INTERVAL_PROFILES.lydianGlow
	],
	[EMOJI_EXPRESSIONS.EMOJI_SMIRK, EMOTION_INTERVAL_PROFILES.tritone],
	[EMOJI_EXPRESSIONS.EMOJI_UNAMUSED, EMOTION_INTERVAL_PROFILES.sly],
	[EMOJI_EXPRESSIONS.EMOJI_RAISED_EYEBROW, EMOTION_INTERVAL_PROFILES.question],
	[EMOJI_EXPRESSIONS.EMOJI_CONFUSED, EMOTION_INTERVAL_PROFILES.phrygian],
	[
		EMOJI_EXPRESSIONS.EMOJI_WORRIED,
		[
			CHORD_EMOTIONAL_PROFILES.darkIntrospective,
			CHORD_EMOTIONAL_PROFILES.tenderBittersweet,
			CHORD_EMOTIONAL_PROFILES.soulfulDeep
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_FROWNING,
		[
			CHORD_EMOTIONAL_PROFILES.tenderBittersweet,
			CHORD_EMOTIONAL_PROFILES.darkIntrospective,
			CHORD_EMOTIONAL_PROFILES.soulfulDeep
		]
	],
	[
		EMOJI_EXPRESSIONS.EMOJI_FROWN_EYES_CLOSED,
		[
			CHORD_EMOTIONAL_PROFILES.soulfulDeep,
			CHORD_EMOTIONAL_PROFILES.tenderBittersweet,
			CHORD_EMOTIONAL_PROFILES.darkIntrospective
		]
	],
	[EMOJI_EXPRESSIONS.EMOJI_ANGRY, EMOTION_INTERVAL_PROFILES.diminished],
	[EMOJI_EXPRESSIONS.EMOJI_TRIPPY, EMOTION_INTERVAL_PROFILES.wholeTone],
	[EMOJI_EXPRESSIONS.EMOJI_SHAKING, EMOTION_INTERVAL_PROFILES.alarm],
	[EMOJI_EXPRESSIONS.EMOJI_SHAKING_HORIZONTALLY, EMOTION_INTERVAL_PROFILES.alarm],
	[EMOJI_EXPRESSIONS.EMOJI_SHAKING_VERTICALLY, EMOTION_INTERVAL_PROFILES.cluster],
	[
		EMOJI_EXPRESSIONS.EMOJI_CRYING,
		[
			CHORD_EMOTIONAL_PROFILES.weepingVulnerable,
			CHORD_EMOTIONAL_PROFILES.lushIntrospective,
			CHORD_EMOTIONAL_PROFILES.soulfulDeep
		]
	],
	[EMOJI_EXPRESSIONS.EMOJI_KISSING_WINK, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_HEARTS, EMOTION_INTERVAL_PROFILES.heart],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_EYES, EMOTION_INTERVAL_PROFILES.heart],
	[EMOJI_EXPRESSIONS.EMOJI_STAR_STRUCK, EMOTION_INTERVAL_PROFILES.celebration],
	[EMOJI_EXPRESSIONS.EMOJI_PARTY, EMOTION_INTERVAL_PROFILES.celebration],
	[EMOJI_EXPRESSIONS.EMOJI_UPSIDE_DOWN, EMOTION_INTERVAL_PROFILES.mixolydian],
	[EMOJI_EXPRESSIONS.EMOJI_HAPPY_TEARS, EMOTION_INTERVAL_PROFILES.dorian],
	[
		EMOJI_EXPRESSIONS.EMOJI_HOLDING_TEARS,
		[
			CHORD_EMOTIONAL_PROFILES.lushIntrospective,
			CHORD_EMOTIONAL_PROFILES.soulfulDeep,
			CHORD_EMOTIONAL_PROFILES.tenderBittersweet
		]
	],
	[EMOJI_EXPRESSIONS.EMOJI_SAVORING, EMOTION_INTERVAL_PROFILES.brightSixth],
	[EMOJI_EXPRESSIONS.EMOJI_TONGUE, EMOTION_INTERVAL_PROFILES.comic],
	[EMOJI_EXPRESSIONS.EMOJI_TONGUE_WINK, EMOTION_INTERVAL_PROFILES.sly],
	[EMOJI_EXPRESSIONS.EMOJI_TONGUE_SQUINT, EMOTION_INTERVAL_PROFILES.blues],
	[EMOJI_EXPRESSIONS.EMOJI_HALO, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_SALUTE, EMOTION_INTERVAL_PROFILES.openMajor],
	[EMOJI_EXPRESSIONS.EMOJI_THINKING, EMOTION_INTERVAL_PROFILES.question],
	[EMOJI_EXPRESSIONS.EMOJI_SHUSHING, EMOTION_INTERVAL_PROFILES.hollow],
	[EMOJI_EXPRESSIONS.EMOJI_HAND_OVER_MOUTH, EMOTION_INTERVAL_PROFILES.sus2],
	[EMOJI_EXPRESSIONS.EMOJI_GIGGLING, EMOTION_INTERVAL_PROFILES.dorian],
	[EMOJI_EXPRESSIONS.EMOJI_YAWNING, EMOTION_INTERVAL_PROFILES.sleep],
	[EMOJI_EXPRESSIONS.EMOJI_HUGGING, EMOTION_INTERVAL_PROFILES.warmHeart],
	[EMOJI_EXPRESSIONS.EMOJI_PEEKING, EMOTION_INTERVAL_PROFILES.sus2],
	[EMOJI_EXPRESSIONS.EMOJI_SCREAMING, EMOTION_INTERVAL_PROFILES.alarm],
	[EMOJI_EXPRESSIONS.EMOJI_MONOCLE, EMOTION_INTERVAL_PROFILES.question],
	[EMOJI_EXPRESSIONS.EMOJI_EXHALING, EMOTION_INTERVAL_PROFILES.suspension],
	[EMOJI_EXPRESSIONS.EMOJI_STEAM, EMOTION_INTERVAL_PROFILES.phrygian],
	[
		EMOJI_EXPRESSIONS.EMOJI_RAGE,
		[
			CHORD_EMOTIONAL_PROFILES.anxiousUnresolved,
			CHORD_EMOTIONAL_PROFILES.dramaticUnsettling,
			CHORD_EMOTIONAL_PROFILES.shadowyUnstable
		]
	],
	[EMOJI_EXPRESSIONS.EMOJI_PLEADING, EMOTION_INTERVAL_PROFILES.sadSixth],
	[
		EMOJI_EXPRESSIONS.EMOJI_ANXIOUS,
		[
			CHORD_EMOTIONAL_PROFILES.anxiousUnresolved,
			CHORD_EMOTIONAL_PROFILES.shadowyUnstable,
			CHORD_EMOTIONAL_PROFILES.dramaticUnsettling
		]
	],
	[EMOJI_EXPRESSIONS.EMOJI_FEARFUL, EMOTION_INTERVAL_PROFILES.phrygian],
	[EMOJI_EXPRESSIONS.EMOJI_ANGUISHED_EYEBROWS_RAISED, EMOTION_INTERVAL_PROFILES.alarm],
	[EMOJI_EXPRESSIONS.EMOJI_ANGUISHED, EMOTION_INTERVAL_PROFILES.heavyMinor],
	[EMOJI_EXPRESSIONS.EMOJI_SHOCKED, EMOTION_INTERVAL_PROFILES.alarm],
	[EMOJI_EXPRESSIONS.EMOJI_FLUSHED, EMOTION_INTERVAL_PROFILES.suspension],
	[EMOJI_EXPRESSIONS.EMOJI_MIND_BLOWN, EMOTION_INTERVAL_PROFILES.wholeTone],
	[EMOJI_EXPRESSIONS.EMOJI_DOWNCAST_SWEAT, EMOTION_INTERVAL_PROFILES.lowHollow],
	[EMOJI_EXPRESSIONS.EMOJI_PERSEVERING, EMOTION_INTERVAL_PROFILES.phrygian],
	[EMOJI_EXPRESSIONS.EMOJI_TIRED, EMOTION_INTERVAL_PROFILES.sleep],
	[EMOJI_EXPRESSIONS.EMOJI_DIZZY, EMOTION_INTERVAL_PROFILES.wholeTone],
	[EMOJI_EXPRESSIONS.EMOJI_DOTTED_LINE, EMOTION_INTERVAL_PROFILES.hollow],
	[EMOJI_EXPRESSIONS.EMOJI_SLEEPING, EMOTION_INTERVAL_PROFILES.sleep],
	[EMOJI_EXPRESSIONS.EMOJI_SLEEPY, EMOTION_INTERVAL_PROFILES.sleep],
	[EMOJI_EXPRESSIONS.EMOJI_DROOLING, EMOTION_INTERVAL_PROFILES.dream],
	[EMOJI_EXPRESSIONS.EMOJI_MOON_FACE, EMOTION_INTERVAL_PROFILES.dream],
	[EMOJI_EXPRESSIONS.EMOJI_MOON_FACE_LEFT, EMOTION_INTERVAL_PROFILES.dream],
	[EMOJI_EXPRESSIONS.EMOJI_NEW_MOON_FACE, EMOTION_INTERVAL_PROFILES.hollow],
	[EMOJI_EXPRESSIONS.EMOJI_FULL_MOON_FACE, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_SUN_FACE, EMOTION_INTERVAL_PROFILES.celebration],
	[EMOJI_EXPRESSIONS.EMOJI_MELTING, EMOTION_INTERVAL_PROFILES.augmented],
	[EMOJI_EXPRESSIONS.EMOJI_FOG, EMOTION_INTERVAL_PROFILES.dream],
	[EMOJI_EXPRESSIONS.EMOJI_WOOZY, EMOTION_INTERVAL_PROFILES.wholeTone],
	[EMOJI_EXPRESSIONS.EMOJI_HOT, EMOTION_INTERVAL_PROFILES.alarm],
	[EMOJI_EXPRESSIONS.EMOJI_COLD, EMOTION_INTERVAL_PROFILES.hollow],
	[EMOJI_EXPRESSIONS.EMOJI_NAUSEATED, EMOTION_INTERVAL_PROFILES.phrygian],
	[EMOJI_EXPRESSIONS.EMOJI_VOMITING, EMOTION_INTERVAL_PROFILES.cluster],
	[EMOJI_EXPRESSIONS.EMOJI_SNEEZING, EMOTION_INTERVAL_PROFILES.sus2],
	[EMOJI_EXPRESSIONS.EMOJI_SICK, EMOTION_INTERVAL_PROFILES.phrygian],
	[EMOJI_EXPRESSIONS.EMOJI_INJURED, EMOTION_INTERVAL_PROFILES.lowHollow],
	[EMOJI_EXPRESSIONS.EMOJI_MASK, EMOTION_INTERVAL_PROFILES.hollow],
	[EMOJI_EXPRESSIONS.EMOJI_COWBOY, EMOTION_INTERVAL_PROFILES.mixolydian],
	[EMOJI_EXPRESSIONS.EMOJI_MONEY, EMOTION_INTERVAL_PROFILES.brightSixth],
	[EMOJI_EXPRESSIONS.EMOJI_SUNGLASSES, EMOTION_INTERVAL_PROFILES.blues],
	[EMOJI_EXPRESSIONS.EMOJI_NERD, EMOTION_INTERVAL_PROFILES.question],
	[EMOJI_EXPRESSIONS.EMOJI_DISGUISED, EMOTION_INTERVAL_PROFILES.sly],
	[EMOJI_EXPRESSIONS.EMOJI_LYING, EMOTION_INTERVAL_PROFILES.tritone],
	[EMOJI_EXPRESSIONS.EMOJI_CLOWN, EMOTION_INTERVAL_PROFILES.comic],
	[EMOJI_EXPRESSIONS.EMOJI_GHOST, EMOTION_INTERVAL_PROFILES.hollow],
	[EMOJI_EXPRESSIONS.EMOJI_POOP, EMOTION_INTERVAL_PROFILES.lowHollow],
	[EMOJI_EXPRESSIONS.EMOJI_ALIEN, EMOTION_INTERVAL_PROFILES.alien],
	[EMOJI_EXPRESSIONS.EMOJI_ROBOT, EMOTION_INTERVAL_PROFILES.mechanical],
	[EMOJI_EXPRESSIONS.EMOJI_SLEEPING_SYMBOL, EMOTION_INTERVAL_PROFILES.sleep],
	[EMOJI_EXPRESSIONS.EMOJI_HOLE, EMOTION_INTERVAL_PROFILES.lowHollow],
	[EMOJI_EXPRESSIONS.EMOJI_PARTY_POPPER, EMOTION_INTERVAL_PROFILES.celebration],
	[EMOJI_EXPRESSIONS.EMOJI_CONFETTI, EMOTION_INTERVAL_PROFILES.celebration],
	[EMOJI_EXPRESSIONS.EMOJI_SEE_NO_EVIL, EMOTION_INTERVAL_PROFILES.sus2],
	[EMOJI_EXPRESSIONS.EMOJI_HEAR_NO_EVIL, EMOTION_INTERVAL_PROFILES.hollow],
	[EMOJI_EXPRESSIONS.EMOJI_SPEAK_NO_EVIL, EMOTION_INTERVAL_PROFILES.suspension],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_GRINNING, EMOTION_INTERVAL_PROFILES.catHappy],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_HAPPY, EMOTION_INTERVAL_PROFILES.catHappy],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_TEARS_JOY, EMOTION_INTERVAL_PROFILES.dorian],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_HEART_EYES, EMOTION_INTERVAL_PROFILES.heart],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_SMIRK, EMOTION_INTERVAL_PROFILES.sly],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_KISSING, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_SCREAMING, EMOTION_INTERVAL_PROFILES.alarm],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_CRYING, EMOTION_INTERVAL_PROFILES.catSad],
	[EMOJI_EXPRESSIONS.EMOJI_CAT_POUTING, EMOTION_INTERVAL_PROFILES.catAngry],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_RED, EMOTION_INTERVAL_PROFILES.heart],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_ORANGE, EMOTION_INTERVAL_PROFILES.warmHeart],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_YELLOW, EMOTION_INTERVAL_PROFILES.brightSixth],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_GREEN, EMOTION_INTERVAL_PROFILES.dorian],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_BLUE, EMOTION_INTERVAL_PROFILES.coolHeart],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_PURPLE, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_BROWN, EMOTION_INTERVAL_PROFILES.lowHollow],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_BLACK, EMOTION_INTERVAL_PROFILES.darkHeart],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_WHITE, EMOTION_INTERVAL_PROFILES.lydianGlow],
	[EMOJI_EXPRESSIONS.EMOJI_HEART_CLASSIC, EMOTION_INTERVAL_PROFILES.heart]
])

// Density describes the expression, not the chord formula. Any emoji omitted
// here sounds as a triad, even when its ordered candidate pool contains richer
// sixths, sevenths or extensions for key-aware substitution.
export const EMOJI_CHORD_VOICE_COUNTS = new Map<string, number>([
	[EMOJI_EXPRESSIONS.EMOJI_NEUTRAL_EYES_CLOSED, 1],
	[EMOJI_EXPRESSIONS.EMOJI_EYES_ROLLING_UP, 4],
	[EMOJI_EXPRESSIONS.EMOJI_SMILING_BIG_GRIN, 4],
	[EMOJI_EXPRESSIONS.EMOJI_SMILING_GRIN_SQUINT, 4],
	[EMOJI_EXPRESSIONS.EMOJI_SMILING_GRIN_EYES_CLOSED, 4],
	[EMOJI_EXPRESSIONS.EMOJI_HOLDING_TEARS, 4],
	[EMOJI_EXPRESSIONS.EMOJI_CRYING, 4],
	[EMOJI_EXPRESSIONS.EMOJI_OPEN_MOUTH_BIG, 4],
	[EMOJI_EXPRESSIONS.EMOJI_FLUSHED, 4],
	[EMOJI_EXPRESSIONS.EMOJI_ANXIOUS, 4],
	[EMOJI_EXPRESSIONS.EMOJI_ANGUISHED, 4],
	[EMOJI_EXPRESSIONS.EMOJI_PLEADING, 4],
	[EMOJI_EXPRESSIONS.EMOJI_SMILING_BIG_TEETH_GRIN_EYES_CLOSED, 5],
	[EMOJI_EXPRESSIONS.EMOJI_WAIL, 5],
	[EMOJI_EXPRESSIONS.EMOJI_RAGE, 5],
	[EMOJI_EXPRESSIONS.EMOJI_SCREAMING, 5],
	[EMOJI_EXPRESSIONS.EMOJI_MIND_BLOWN, 5]
])

export const getVoiceCountForEmoji = (emoji: string) =>
	normaliseVoiceCount(EMOJI_CHORD_VOICE_COUNTS.get(emoji) ?? DEFAULT_CHORD_VOICE_COUNT)

const E = EMOJI_EXPRESSIONS

interface ScaleContext {
	keyRoot: number
	scaleFormula: ScaleFormula
	pitchClasses: number[]
	isChromatic: boolean
}

const scaleContextCache = new Map<string, ScaleContext>()
const globalChordCache = new Map<string, ChordNote[]>()
const MAX_GLOBAL_CHORD_CACHE_SIZE = 2048

const getScaleCacheKey = (key: KeyInput = 0, scale: ScaleFormula | string = "MAJOR_SCALE") => {
	const scaleKey = Array.isArray(scale) ? scale.join(",") : scale
	return `${key}|${scaleKey}`
}

const getMidiNoteAtOrAbove = (noteNumber: number, pitchClass: number) => {
	const currentPitchClass = noteNumber % 12
	const distance = (pitchClass - currentPitchClass + 12) % 12
	return noteNumber + distance
}

const getNearestPitchClass = (pitchClass: number, allowedPitchClasses: number[]) => {
	return allowedPitchClasses.reduce(
		(nearest, allowedPitchClass) => {
			const upwardDistance = (allowedPitchClass - pitchClass + 12) % 12
			const downwardDistance = (pitchClass - allowedPitchClass + 12) % 12
			const distance = Math.min(upwardDistance, downwardDistance)
			return distance < nearest.distance
				? { pitchClass: allowedPitchClass, distance }
				: nearest
		},
		{ pitchClass: allowedPitchClasses[0], distance: Number.MAX_VALUE }
	).pitchClass
}

const getNearestMidiNote = (noteNumber: number, pitchClass: number) => {
	const currentPitchClass = noteNumber % 12
	const upwardDistance = (pitchClass - currentPitchClass + 12) % 12
	const downwardDistance = (currentPitchClass - pitchClass + 12) % 12
	return upwardDistance < downwardDistance
		? noteNumber + upwardDistance
		: noteNumber - downwardDistance
}

/** Emoji with no profile fall back to a mode: happy = Ionian, sad = Aeolian, tense = Phrygian/Locrian. */
export const getTuningModeForEmoji = (emoji: string): string => {
	switch (emoji) {
		case E.EMOJI_LEFT_WINK:
		case E.EMOJI_EYES_ROLLING_UP:
		case E.EMOJI_FROWN_EYES_CLOSED:
		case E.EMOJI_TRIPPY:
		case E.EMOJI_GIGGLING:
		case E.EMOJI_HAPPY_TEARS:
		case E.EMOJI_HOLDING_TEARS:
		case E.EMOJI_THINKING:
		case E.EMOJI_ZANY:
			return TUNING_MODE_DORIAN

		case E.EMOJI_KISS_EYES_CLOSED_EYEBROWS_RAISED:
		case E.EMOJI_KISS_EYES_CLOSED:
		case E.EMOJI_KISS:
		case E.EMOJI_KISSING_WINK:
		case E.EMOJI_CAT_KISSING:
		case E.EMOJI_ASTONISHED:
		case E.EMOJI_FROWNING:
		case E.EMOJI_WORRIED:
			return TUNING_MODE_LYDIAN

		case E.EMOJI_SMILING_BIG_GRIN:
		case E.EMOJI_SMILING_BIG_TEETH_GRIN_EYES_CLOSED:
		case E.EMOJI_HEARTS:
		case E.EMOJI_HEART_EYES:
		case E.EMOJI_STAR_STRUCK:
		case E.EMOJI_PARTY:
			return TUNING_MODE_MIXOLYDIAN

		case E.EMOJI_OPEN_MOUTH:
		case E.EMOJI_OPEN_MOUTH_BIG:
		case E.EMOJI_WAIL:
		case E.EMOJI_FLUSHED:
		case E.EMOJI_FEARFUL:
		case E.EMOJI_ANGUISHED:
		case E.EMOJI_ANGUISHED_EYEBROWS_RAISED:
			return TUNING_MODE_AEOLIAN

		case E.EMOJI_CONFUSED:
		case E.EMOJI_GRIMACING:
		case E.EMOJI_PERSEVERING:
		case E.EMOJI_RAISED_EYEBROW:
			return TUNING_MODE_PHRYGIAN

		case E.EMOJI_SHAKING:
		case E.EMOJI_ANGRY:
		case E.EMOJI_SMIRK:
		case E.EMOJI_RAGE:
			return TUNING_MODE_LOCRIAN

		default:
			return TUNING_MODE_IONIAN
	}
}

const MODE_FORMULAS: Record<string, ScaleFormula> = {
	[TUNING_MODE_IONIAN]: IONIAN_INTERVALS,
	[TUNING_MODE_DORIAN]: DORIAN_INTERVALS,
	[TUNING_MODE_PHRYGIAN]: PHRYGIAN_INTERVALS,
	[TUNING_MODE_LYDIAN]: LYDIAN_INTERVALS,
	[TUNING_MODE_MIXOLYDIAN]: MIXOLYDIAN_INTERVALS,
	[TUNING_MODE_AEOLIAN]: AEOLIAN_INTERVALS,
	[TUNING_MODE_LOCRIAN]: LOCRIAN_INTERVALS
}

export const getEmotionalProfileChoicesForEmoji = (emoji: string): readonly EmotionalProfile[] =>
	EMOJI_INTERVAL_CHOICES.get(emoji) ?? []

export const getIntervalChoicesForEmoji = (emoji: string): IntervalSet[] =>
	getEmotionalProfileChoicesForEmoji(emoji).map((profile) => profile.candidateIntervals)

export const getPrimaryIntervalsForEmoji = (emoji: string): IntervalSet =>
	getIntervalChoicesForEmoji(emoji)[0] ?? CHROMATIC.majorTriad

/** Intervals for free-range (chromatic) play; the same as the primary profile. */
export const getChromaticIntervalsForEmoji = (emoji: string): IntervalSet =>
	getPrimaryIntervalsForEmoji(emoji)

/** Expression defines the harmony, so the first profile always wins. */
export const selectEmotionalProfileForEmoji = (
	_tonic: number,
	emoji: string,
	_previousChord: ChordNote[] = [],
	_harmonyOptions: EmotionHarmonyOptions = {}
): EmotionalProfile | null => getEmotionalProfileChoicesForEmoji(emoji)[0] ?? null

export const selectIntervalsForEmoji = (
	tonic: number,
	emoji: string,
	previousChord: ChordNote[] = [],
	harmonyOptions: EmotionHarmonyOptions = {}
): IntervalSet | null =>
	selectEmotionalProfileForEmoji(tonic, emoji, previousChord, harmonyOptions)
		?.candidateIntervals ?? null

const getChordQualityForIntervals = (intervals: IntervalSet) => {
	const quality = Object.entries(VOICINGS).find(([, voicing]) => voicing === intervals)
	return quality?.[0] ?? null
}

/** Name in CHORD_VOICING_INTERVAL_LIBRARY of the emoji's primary voicing, or null. */
export const getChordQualityForEmoji = (
	emoji: string,
	tonic = 60,
	previousChord: ChordNote[] = [],
	harmonyOptions: EmotionHarmonyOptions = {}
): string | null => {
	const selectedProfile = selectEmotionalProfileForEmoji(
		tonic,
		emoji,
		previousChord,
		harmonyOptions
	)
	return selectedProfile ? getChordQualityForIntervals(selectedProfile.candidateIntervals) : null
}

// Keep the root and third, then the upper colour tones. Taking a prefix
// turns sixths and sevenths back into the same plain major/minor triad.
const prioritiseColourIntervals = (intervals: IntervalSet, voiceCount: number): IntervalSet =>
	intervals.length <= voiceCount || voiceCount <= 2
		? intervals
		: [
				...intervals.slice(0, 2),
				...intervals.slice(-(voiceCount - 2)),
				...intervals.slice(2, intervals.length - (voiceCount - 2))
			]

const getResolvedNotesForProfile = (
	tonic: number,
	profile: EmotionalProfile,
	voiceCount = DEFAULT_CHORD_VOICE_COUNT,
	harmonyOptions: EmotionHarmonyOptions = {}
): ChordNote[] => {
	const targetVoiceCount = normaliseVoiceCount(voiceCount)
	if (harmonyOptions.harmonyMode === HARMONY_MODE_GLOBAL_KEY) {
		return getChordFromIntervalsInKey(
			tonic,
			harmonyOptions.tonic,
			harmonyOptions.keyScale,
			profile.candidateIntervals,
			targetVoiceCount
		)
	}

	const completionIntervals = [
		...prioritiseColourIntervals(profile.candidateIntervals, targetVoiceCount),
		...CHROMATIC.majorTriad,
		12,
		16,
		19,
		24
	]
	const selectedIntervals = [...new Set(completionIntervals)]
		.slice(0, targetVoiceCount)
		.sort((a, b) => a - b)

	return selectedIntervals.map((interval) => getNote(tonic + interval)).filter(isNote)
}

const getScaleContext = (key: KeyInput = 0, scale: ScaleFormula | string = "MAJOR_SCALE") => {
	const cacheKey = getScaleCacheKey(key, scale)
	const cached = scaleContextCache.get(cacheKey)
	if (cached) {
		return cached
	}

	const keyRoot = getPitchClassForKey(key)
	const scaleFormula = getScaleFormula(scale)
	const pitchClasses = scaleFormula.map((interval) => (keyRoot + interval) % 12)
	const context = {
		keyRoot,
		scaleFormula,
		pitchClasses,
		isChromatic: isChromaticScale(scaleFormula)
	}
	scaleContextCache.set(cacheKey, context)
	return context
}

/** Stack scale degrees (0 = the degree nearest the tonic, 2 = a third above...) in a key. */
export const getDiatonicChordInKey = (
	tonic: number,
	key: KeyInput = 0,
	scale: ScaleFormula | string = "MAJOR_SCALE",
	degreeOffsets: readonly number[] = [0, 2, 4]
): ChordNote[] => {
	const { pitchClasses } = getScaleContext(key, scale)
	const tonicPitchClass = tonic % 12
	const rootPitchClass = getNearestPitchClass(tonicPitchClass, pitchClasses)
	const rootNote = getNearestMidiNote(tonic, rootPitchClass)
	const rootDegree = pitchClasses.indexOf(rootPitchClass)

	return degreeOffsets
		.map((degreeOffset) => {
			const targetDegree = rootDegree + degreeOffset
			const pitchClass = pitchClasses[targetDegree % pitchClasses.length]
			const octaveOffset = Math.floor(degreeOffset / pitchClasses.length) * 12
			return getNote(getMidiNoteAtOrAbove(rootNote, pitchClass) + octaveOffset)
		})
		.filter(isNote)
}

/**
 * Voice the intervals above the nearest in-key root, dropping any tone the key
 * does not contain, then top up with stacked diatonic thirds.
 */
export function getChordFromIntervalsInKey(
	tonic: number,
	key: KeyInput = 0,
	scale: ScaleFormula | string = "MAJOR_SCALE",
	intervals: IntervalSet = CHROMATIC.majorTriad,
	voiceCount = DEFAULT_CHORD_VOICE_COUNT
): ChordNote[] {
	const { pitchClasses } = getScaleContext(key, scale)
	const rootPitchClass = getNearestPitchClass(tonic % 12, pitchClasses)
	const rootNote = getNearestMidiNote(tonic, rootPitchClass)
	const allowedPitchClasses = new Set(pitchClasses)
	const targetVoiceCount = normaliseVoiceCount(voiceCount)
	const selectedNotes: ChordNote[] = []
	const selectedNoteNumbers = new Set<number>()
	const byNoteNumber = (a: ChordNote, b: ChordNote) => a.noteNumber - b.noteNumber

	for (const interval of prioritiseColourIntervals(intervals, targetVoiceCount)) {
		const desiredNote = rootNote + interval
		const desiredPitchClass = ((desiredNote % 12) + 12) % 12
		const note = getNote(desiredNote)
		if (
			!allowedPitchClasses.has(desiredPitchClass) ||
			!note ||
			selectedNoteNumbers.has(desiredNote)
		) {
			continue
		}

		selectedNotes.push(note)
		selectedNoteNumbers.add(desiredNote)
		if (selectedNotes.length === targetVoiceCount) {
			return selectedNotes.sort(byNoteNumber)
		}
	}

	const degreeOffsets = Array.from({ length: targetVoiceCount }, (_, index) => index * 2)
	for (const note of getDiatonicChordInKey(tonic, key, scale, degreeOffsets)) {
		if (!selectedNoteNumbers.has(note.noteNumber)) {
			selectedNotes.push(note)
			selectedNoteNumbers.add(note.noteNumber)
		}
		if (selectedNotes.length === targetVoiceCount) {
			break
		}
	}

	return selectedNotes.sort(byNoteNumber).slice(0, targetVoiceCount)
}

/**
 * Chord that best matches the emotion behind the emoji.
 * Free range uses the played note as the root; "global-key" keeps every tone in the key.
 * Emoji with no profile fall back to the triad of their mode (null if out of MIDI range).
 */
export const getMusicalDetailsFromEmoji = (
	tonic: number,
	emoji: string,
	_includeTonic = true,
	harmonyOptions: EmotionHarmonyOptions = {}
): ChordNote[] | null => {
	const selectedProfile = selectEmotionalProfileForEmoji(
		tonic,
		emoji,
		harmonyOptions.previousChord,
		harmonyOptions
	)
	const voiceCount = getVoiceCountForEmoji(emoji)
	if (harmonyOptions.harmonyMode === HARMONY_MODE_GLOBAL_KEY) {
		const intervals = selectedProfile?.candidateIntervals ?? CHROMATIC.majorTriad
		const cacheKey = `${tonic}|${emoji}|${harmonyOptions.tonic}|${harmonyOptions.keyScale}|${voiceCount}|${intervals.join(",")}`
		const cached = globalChordCache.get(cacheKey)
		if (cached) {
			return cached
		}
		const chord = getChordFromIntervalsInKey(
			tonic,
			harmonyOptions.tonic,
			harmonyOptions.keyScale,
			intervals,
			voiceCount
		)
		if (globalChordCache.size > MAX_GLOBAL_CHORD_CACHE_SIZE) {
			globalChordCache.clear()
		}
		globalChordCache.set(cacheKey, chord)
		return chord
	}

	if (selectedProfile) {
		return getResolvedNotesForProfile(tonic, selectedProfile, voiceCount)
	}

	const formula = MODE_FORMULAS[getTuningModeForEmoji(emoji)] ?? IONIAN_INTERVALS
	const chord = [0, 2, 4].map((degree) => getNote(tonic + formula[degree])).filter(isNote)
	return chord.length ? chord : null
}