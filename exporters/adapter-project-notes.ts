import {
	recordingNotes,
	recordingVoices,
	exportTempo,
	escapeXML,
	type NoteRecording,
	type SequenceNote
} from "../formats/note-sequence"
import { encodeLMMSContainer } from "../formats/lmms-container"
import { songBars, songTimeAxis } from "../formats/song-source"

export type ProjectNoteExportId = "svp" | "ufdata" | "ustx" | "lmms" | "lmms-compressed"

/** Editable note projects; synthesis settings and lyrics cannot be recovered from MIDI recordings.
 * Vocal projects keep a song's tempo map and meters; LMMS keeps its first tempo and meter.
 */
export async function exportProjectNotes(
	recording: NoteRecording,
	timer: { readonly BPM: number },
	format: ProjectNoteExportId
): Promise<Blob> {
	const bpm = exportTempo(timer)
	const voices = recordingVoices(recording)
	if (!voices.length) {
		throw new Error("Record some notes before exporting a project")
	}
	const fixedTick = (seconds: number, ppq = 480) => Math.round(((seconds * bpm) / 60) * ppq)
	const song = recording.song,
		axis = song && songTimeAxis(song)
	const tick = (seconds: number, ppq = 480) =>
		axis ? Math.round(axis.ticks(seconds, ppq)) : fixedTick(seconds, ppq)
	const tempos = (ppq: number) =>
		song?.tempos.map((tempo) => ({ position: tick(tempo.time, ppq), bpm: tempo.bpm })) ?? [
			{ position: 0, bpm }
		]
	// Vocal projects place meters by bar index; a meter change always starts a bar.
	const meters = (() => {
		if (!song || !axis) {
			return [{ bar: 0, numerator: 4, denominator: 4 }]
		}
		const bars = songBars(song, song.meters.at(-1)!.time)
		return song.meters.map((meter) => {
			const beat = axis.beats(meter.time)
			const bar = bars.findIndex((entry) => Math.abs(entry.start - beat) < 1e-6)
			return {
				bar: bar < 0 ? bars.length : bar,
				numerator: meter.numerator,
				denominator: meter.denominator
			}
		})
	})()
	if (format === "lmms" || format === "lmms-compressed") {
		const groups = new Map<string, SequenceNote[]>()
		const names = new Map<string, string>()
		for (const [index, track] of (song?.tracks ?? []).entries()) {
			groups.set(String(index), [])
			names.set(String(index), track.name)
		}
		for (const note of song ? [] : recordingNotes(recording)) {
			if (note.number < 12 || note.number > 119) {
				throw new Error(
					"LMMS piano-roll export supports MIDI pitches 12–119. Use MIDI for this recording."
				)
			}
			const key = `${note.channel}:${note.patch}`,
				group = groups.get(key) ?? []
			group.push(note)
			groups.set(key, group)
		}
		for (const [index, track] of (song?.tracks ?? []).entries()) {
			if (track.notes.some((note) => note.number < 12 || note.number > 119)) {
				throw new Error(
					"LMMS piano-roll export supports MIDI pitches 12–119. Use MIDI for this recording."
				)
			}
			groups.get(String(index))!.push(...track.notes)
		}
		const tracks = [...groups]
			.filter(([, notes]) => notes.length)
			.map(([key, notes], index) => {
				const content = notes
					.map((note) => {
						const start = fixedTick(note.start, 48),
							end = Math.max(start + 1, fixedTick(note.start + note.duration, 48))
						return `<note key="${note.number - 12}" pos="${start}" len="${end - start}" vol="${(note.velocity * 200) / 127}" pan="0"/>`
					})
					.join("")
				const end =
					Math.ceil(
						fixedTick(
							notes.reduce(
								(max, note) => Math.max(max, note.start + note.duration),
								0
							),
							48
						) / 192
					) * 192
				return `<track type="0" name="${escapeXML(names.get(key) ?? `${recording.name} ${index + 1}`)}" muted="0"><instrumenttrack basenote="57" vol="100" pan="0" pitch="0" usemasterpitch="1"><instrument name="tripleoscillator"><tripleoscillator vol0="100" vol1="0" vol2="0" wavetype0="0"/></instrument><midiport outputchannel="${notes[0].channel}" outputprogram="${notes[0].patch + 1}" readable="0" writable="0"/></instrumenttrack><pattern type="1" name="Recorded notes" pos="0" len="${Math.max(192, end)}" steps="16" muted="0">${content}</pattern></track>`
			})
			.join("")
		const xml = `<?xml version="1.0" encoding="UTF-8"?><lmms-project creator="LMMS" creatorversion="1.2.2" version="1.0" type="song"><head bpm="${bpm}" mastervol="100" masterpitch="0" timesig_numerator="${meters[0].numerator}" timesig_denominator="${meters[0].denominator}"/><song><trackcontainer type="song">${tracks}</trackcontainer></song></lmms-project>`
		return format === "lmms"
			? new Blob([xml], { type: "application/xml" })
			: new Blob([encodeLMMSContainer(xml)], { type: "application/octet-stream" })
	}
	if (voices.length > 15) {
		throw new Error("Vocal project export supports at most 15 melodic voices")
	}
	const notesFor = (voice: SequenceNote[]) =>
		voice.map((note) => {
			const start = tick(note.start),
				end = Math.max(start + 1, tick(note.start + note.duration))
			return { pitch: note.number, start, duration: end - start }
		})
	if (format === "ufdata") {
		return new Blob(
			[
				JSON.stringify(
					{
						formatVersion: 1,
						project: {
							name: recording.name,
							measurePrefix: 0,
							tempos: tempos(480).map((tempo) => ({
								tickPosition: tempo.position,
								bpm: tempo.bpm
							})),
							timeSignatures: meters.map((meter) => ({
								measurePosition: meter.bar,
								numerator: meter.numerator,
								denominator: meter.denominator
							})),
							tracks: voices.map((voice, index) => ({
								name: `Voice ${index + 1}`,
								notes: notesFor(voice).map((note) => ({
									key: note.pitch,
									tickOn: note.start,
									tickOff: note.start + note.duration,
									lyric: "a",
									phoneme: null
								}))
							}))
						}
					},
					null,
					2
				) + "\n"
			],
			{ type: "application/json" }
		)
	}
	if (format === "ustx") {
		const { stringify } = await import("yaml")
		const project = {
			name: recording.name,
			ustx_version: "0.6",
			resolution: 480,
			key: 0,
			tempos: tempos(480),
			time_signatures: meters.map((meter) => ({
				bar_position: meter.bar,
				beat_per_bar: meter.numerator,
				beat_unit: meter.denominator
			})),
			expressions: {},
			tracks: voices.map((_, index) => ({
				track_name: `Voice ${index + 1}`,
				singer: "",
				phonemizer: "OpenUtau.Core.DefaultPhonemizer",
				mute: false,
				solo: false,
				volume: 0
			})),
			voice_parts: voices.map((voice, index) => {
				const notes = notesFor(voice)
				return {
					name: `Voice ${index + 1}`,
					track_no: index,
					position: 0,
					duration: notes.at(-1)!.start + notes.at(-1)!.duration,
					notes: notes.map((note) => ({
						position: note.start,
						duration: note.duration,
						tone: note.pitch,
						lyric: "a",
						pitch: { data: [], snap_first: true },
						vibrato: { length: 0 },
						phoneme_expressions: [],
						phoneme_overrides: []
					})),
					curves: []
				}
			}),
			wave_parts: []
		}
		return new Blob([stringify(project)], { type: "application/yaml" })
	}
	const tracks = voices.map((voice, index) => {
		const uuid = crypto.randomUUID()
		return {
			name: `Voice ${index + 1}`,
			dispOrder: index,
			dispColor: "ff7db235",
			renderEnabled: false,
			mixer: { gainDecibel: 0, pan: 0, mute: false, solo: false, display: true },
			mainGroup: {
				name: recording.name,
				uuid,
				parameters: Object.fromEntries(
					[
						"pitchDelta",
						"vibratoEnv",
						"loudness",
						"tension",
						"breathiness",
						"voicing",
						"gender"
					].map((key) => [key, { mode: "cubic", points: [] }])
				),
				notes: voice.map((note) => {
					const start = tick(note.start, 705600000),
						end = Math.max(start + 1, tick(note.start + note.duration, 705600000))
					return {
						onset: start,
						duration: end - start,
						pitch: note.number,
						lyrics: "a",
						phonemes: "",
						attributes: {}
					}
				})
			},
			mainRef: {
				groupID: uuid,
				blickOffset: 0,
				pitchOffset: 0,
				isInstrumental: false,
				database: { name: "", language: "", phoneset: "" },
				dictionary: "",
				voice: {},
				audio: { filename: "", duration: 0 }
			},
			groups: []
		}
	})
	return new Blob(
		[
			JSON.stringify(
				{
					version: 113,
					time: {
						tempo: tempos(705600000),
						meter: meters.map((meter) => ({
							index: meter.bar,
							numerator: meter.numerator,
							denominator: meter.denominator
						}))
					},
					library: [],
					tracks,
					renderConfig: {
						destination: "./",
						filename: recording.name,
						numChannels: 1,
						aspirationFormat: "noAspiration",
						bitDepth: 16,
						sampleRate: 44100,
						exportMixDown: true
					}
				},
				null,
				2
			) + "\n"
		],
		{ type: "application/json" }
	)
}