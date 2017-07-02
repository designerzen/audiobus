// [General MIDI Instrument Patch Map](https://www.midi.org/specifications/item/gm-level-1-sound-set)
// [General MIDI Instrument Patch Map](http://cs.uccs.edu/~cs525/midi/midi.html)
/*
General MIDI Level 1 Instrument Families

The General MIDI Level 1 instrument sounds are grouped by families.
In each family are 8 specific instruments.

PC# 	Family Name
1-8 	Piano
9-16 	Chromatic Percussion
17-24 	Organ
25-32 	Guitar
33-40 	Bass
41-48 	Strings
49-56 	Ensemble
57-64 	Brass
65-72 	Reed
73-80 	Pipe
81-88 	Synth Lead
89-96 	Synth Pad
97-104 	Synth Effects
105-112 	Ethnic
113-120 	Percussive
121-128 	Sound Effects


On MIDI Channel 10, each MIDI Note number ("Key#") corresponds to a different drum sound, as shown below.
GM-compatible instruments must have the sounds on the keys shown here.

While many current instruments also have additional sounds above or below the range show here,
and may even have additional "kits" with variations of these sounds, only these sounds are supported
by General MIDI Level 1 devices.

Key#


Drum Sound

35


Acoustic Bass Drum

36


Bass Drum 1

37


Side Stick

38


Acoustic Snare

39


Hand Clap

40


Electric Snare

41


Low Floor Tom

42


Closed Hi Hat

43


High Floor Tom

44


Pedal Hi-Hat

45


Low Tom

46


Open Hi-Hat

47


Low-Mid Tom

48


Hi-Mid Tom

49


Crash Cymbal 1

50


High Tom

51


Ride Cymbal 1

52


Chinese Cymbal

53


Ride Bell

54


Tambourine

55


Splash Cymbal

56


Cowbell

57


Crash Cymbal 2

58


Vibraslap

59


Ride Cymbal 2

60


Hi Bongo

61


Low Bongo

62


Mute Hi Conga

63


Open Hi Conga

64


Low Conga

65


High Timbale

66


Low Timbale

67


High Agogo

68


Low Agogo

69


Cabasa

70


Maracas

71


Short Whistle

72


Long Whistle

73


Short Guiro

74


Long Guiro

75


Claves

76


Hi Wood Block

77


Low Wood Block

78


Mute Cuica

79


Open Cuica

80


Mute Triangle

81


Open Triangle
*/
export const MidiInstrumentCodes = [
	"acoustic grand piano",
	"bright acoustic piano",
	"electric grand piano",
	"honky-tonk piano",
	"electric piano 1",
	"electric piano 2",
	"harpsichord",
	"clavi",
	"celesta",
	"glockenspiel",
	"music box",
	"vibraphone",
	"marimba",
	"xylophone",
	"tubular bells",
	"dulcimer",
	"drawbar organ",
	"percussive organ",
	"rock organ",
	"church organ",
	"reed organ",
	"accordion",
	"harmonica",
	"tango accordion",
	"acoustic guitar (nylon)",
	"acoustic guitar (steel)",
	"electric guitar (jazz)",
	"electric guitar (clean)",
	"electric guitar (muted)",
	"overdriven guitar",
	"distortion guitar",
	"guitar harmonics",
	"acoustic bass",
	"electric bass (finger)",
	"electric bass (pick)",
	"fretless bass",
	"slap bass 1",
	"slap bass 2",
	"synth bass 1",
	"synth bass 2",
	"violin",
	"viola",
	"cello",
	"contrabass",
	"tremolo strings",
	"pizzicato strings",
	"orchestral harp",
	"timpani",
	"string ensemble 1",
	"string ensemble 2",
	"synthstrings 1",
	"synthstrings 2",
	"choir aahs",
	"voice oohs",
	"synth voice",
	"orchestra hit",
	"trumpet",
	"trombone",
	"tuba",
	"muted trumpet",
	"french horn",
	"brass section",
	"synthbrass 1",
	"synthbrass 2",
	"soprano sax",
	"alto sax",
	"tenor sax",
	"baritone sax",
	"oboe",
	"english horn",
	"bassoon",
	"clarinet",
	"piccolo",
	"flute",
	"recorder",
	"pan flute",
	"blown bottle",
	"shakuhachi",
	"whistle",
	"ocarina",
	"lead 1 (square)",
	"lead 2 (sawtooth)",
	"lead 3 (calliope)",
	"lead 4 (chiff)",
	"lead 5 (charang)",
	"lead 6 (voice)",
	"lead 7 (fifths)",
	"lead 8 (bass + lead)",
	"pad 1 (new age)",
	"pad 2 (warm)",
	"pad 3 (polysynth)",
	"pad 4 (choir)",
	"pad 5 (bowed)",
	"pad 6 (metallic)",
	"pad 7 (halo)",
	"pad 8 (sweep)",
	"fx 1 (rain)",
	"fx 2 (soundtrack)",
	"fx 3 (crystal)",
	"fx 4 (atmosphere)",
	"fx 5 (brightness)",
	"fx 6 (goblins)",
	"fx 7 (echoes)",
	"fx 8 (sci-fi)",
	"sitar",
	"banjo",
	"shamisen",
	"koto",
	"kalimba",
	"bag pipe",
	"fiddle",
	"shanai",
	"tinkle bell",
	"agogo",
	"steel drums",
	"woodblock",
	"taiko drum",
	"melodic tom",
	"synth drum",
	"reverse cymbal",
	"guitar fret noise",
	"breath noise",
	"seashore",
	"bird tweet",
	"telephone ring",
	"helicopter",
	"applause",
	"gunshot",
]

export const InstrumentFamilyByID = [
	"piano",
	"chromatic percussion",
	"organ",
	"guitar",
	"bass",
	"strings",
	"ensemble",
	"brass",
	"reed",
	"pipe",
	"synth lead",
	"synth pad",
	"synth effects",
	"ethnic",
	"percussive",
	"sound effects",
]

export const DrumKitByPatchID = {
	 0: "standard kit",
	 8: "room kit",
	16: "power kit",
	24: "electronic kit",
	25: "tr-808 kit",
	32: "jazz kit",
	40: "brush kit",
	48: "orchestra kit",
	56: "sound fx kit",
}
