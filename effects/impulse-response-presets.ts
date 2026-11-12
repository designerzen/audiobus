export interface ImpulseResponsePreset {
	id: string
	name: string
	group: string
	readonly author: string
	readonly license: string
	readonly source: string
}

export const IMPULSE_RESPONSE_ASSET_PATH = "/audio/impulse-responses/"
export const BUILTIN_ROOM_PRESET = "builtin-room"
export const IMPULSE_RESPONSE_SOURCE_REVISION = "6ad21a43346af80ca43b39762f0634ee6226ffe5"

// Audio and original attribution notices are redistributed unchanged from Reverb.js.
// Licenses apply individually to each recording, independently of the application.
export const IMPULSE_RESPONSE_PRESETS: readonly ImpulseResponsePreset[] = [
	["Basement", "Basement workshop", "Rooms", "Public domain"],
	["DomesticLivingRoom", "Domestic living room", "Rooms", "Public domain"],
	["EmptyApartmentBedroom", "Empty apartment bedroom", "Rooms", "Public domain"],
	["TerrysTypingRoom", "Terry’s typing room", "Rooms", "CC BY-SA"],
	["SpokaneWomansClub", "Spokane Woman’s Club", "Halls", "CC BY"],
	["SportsCentreUniversityOfYork", "University of York sports hall", "Halls", "CC BY-SA"],
	["TerrysFactoryWarehouse", "Terry’s factory warehouse", "Halls", "CC BY-SA"],
	["HamiltonMausoleum", "Hamilton Mausoleum", "Churches and monuments", "CC BY-SA"],
	[
		"LadyChapelStAlbansCathedral",
		"St Albans Cathedral — Lady Chapel",
		"Churches and monuments",
		"CC BY-SA"
	],
	[
		"SaintLawrenceChurchMolenbeekWersbeekBelgium",
		"Saint Lawrence Church, Belgium",
		"Churches and monuments",
		"Public domain"
	],
	["StAndrewsChurch", "St Andrew’s Church", "Churches and monuments", "CC BY-SA 3.0"],
	[
		"StMarysAbbeyReconstructionPhase1",
		"St Mary’s Abbey — reconstruction 1",
		"Churches and monuments",
		"CC BY-SA"
	],
	[
		"StMarysAbbeyReconstructionPhase2",
		"St Mary’s Abbey — reconstruction 2",
		"Churches and monuments",
		"CC BY-SA"
	],
	[
		"StMarysAbbeyReconstructionPhase3",
		"St Mary’s Abbey — reconstruction 3",
		"Churches and monuments",
		"CC BY-SA"
	],
	[
		"StPatricksChurchPatringtonPosition1",
		"St Patrick’s Church — position 1",
		"Churches and monuments",
		"CC BY-SA"
	],
	[
		"StPatricksChurchPatringtonPosition2",
		"St Patrick’s Church — position 2",
		"Churches and monuments",
		"CC BY-SA"
	],
	[
		"StPatricksChurchPatringtonPosition3",
		"St Patrick’s Church — position 3",
		"Churches and monuments",
		"CC BY-SA"
	],
	["YorkMinster", "York Minster", "Churches and monuments", "CC BY-SA"],
	["TyndallBruceMonument", "Tyndall Bruce Monument", "Churches and monuments", "CC BY-SA"],
	[
		"FalklandPalaceRoyalTennisCourt",
		"Falkland Palace tennis court",
		"Unusual spaces",
		"CC BY-SA"
	],
	["MaesHowe", "Maes Howe chambered tomb", "Unusual spaces", "CC BY-SA"],
	["PurnodesRailroadTunnel", "Purnode railway tunnel", "Unusual spaces", "Public domain"],
	["R1NuclearReactorHall", "R1 reactor hall", "Unusual spaces", "CC BY-SA"],
	["UndergroundCarPark", "Underground car park", "Unusual spaces", "CC BY-SA 3.0"],
	["InsidePiano", "Inside a Yamaha baby grand", "Instruments and hardware", "CC BY-SA 3.0"],
	[
		"MidiverbMark2Preset29",
		"Alesis Midiverb II — preset 29",
		"Instruments and hardware",
		"CC BY-SA 3.0"
	]
].map(([id, name, group, license]) => ({
	id,
	name,
	group,
	license,
	author: ["InsidePiano", "MidiverbMark2Preset29"].includes(id) ? "Andi" : "OpenAirLib",
	source: `https://github.com/andigamesandmusic/Reverb.js/blob/${IMPULSE_RESPONSE_SOURCE_REVISION}/Library/${id}.attribution.txt`
}))