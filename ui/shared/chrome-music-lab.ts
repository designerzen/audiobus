import type { DeviceAttribution } from "../../io/device-classification.ts"
import type { MIDIAddress } from "../interfaces/instrument.ts"

export const CHROME_MUSIC_LAB_ATTRIBUTION: DeviceAttribution = {
	author: "Google Creative Lab (Chrome Music Lab)",
	sourceUrl: "https://github.com/googlecreativelab/chrome-music-lab",
	license: "Apache-2.0",
	licenseUrls: ["https://github.com/googlecreativelab/chrome-music-lab/blob/master/LICENSE"]
}

export const CHROMATIC_NOTES = [
	"C",
	"C#",
	"D",
	"D#",
	"E",
	"F",
	"F#",
	"G",
	"G#",
	"A",
	"A#",
	"B"
] as const

export type PitchClassName = (typeof CHROMATIC_NOTES)[number]

/** Chrome Music Lab rainbow palette (Chords / Piano Roll). */
export const CML_NOTE_COLORS: Record<PitchClassName, string> = {
	C: "#4e61d8",
	"C#": "#8064c6",
	D: "#a542b1",
	"D#": "#ed3883",
	E: "#f75839",
	F: "#f7943d",
	"F#": "#f6be37",
	G: "#d1c12e",
	"G#": "#95c631",
	A: "#4bb250",
	"A#": "#45b5a1",
	B: "#4598b6"
}

/** Chrome Music Lab Arpeggios circle-of-fifths wheel palette. */
export const CML_ARPEGGIO_COLORS: Record<PitchClassName, string> = {
	C: "#f6be37",
	"C#": "#8064c6",
	D: "#95c631",
	"D#": "#ed3883",
	E: "#45b5a1",
	F: "#f7943d",
	"F#": "#4e61d8",
	G: "#d1c12e",
	"G#": "#a542b1",
	A: "#4bb250",
	"A#": "#f75839",
	B: "#4598b6"
}

/** Chrome Music Lab Melody Maker diatonic palette. */
export const CML_MELODY_COLORS: Record<PitchClassName, string> = {
	C: "#bf4fa8",
	"C#": "#8064c6",
	D: "#4d61d8",
	"D#": "#ed3883",
	E: "#45b5a1",
	F: "#95c631",
	"F#": "#f6be37",
	G: "#edd929",
	"G#": "#95c631",
	A: "#f7943d",
	"A#": "#45b5a1",
	B: "#e33159"
}

export const CML_GOLD = "#ffb729"
export const CML_BLUE = "#16a8f0"

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value))
}

export function noteColorForMidi(
	midi: number,
	palette: Record<PitchClassName, string> = CML_NOTE_COLORS
): string {
	const pitchClass = CHROMATIC_NOTES[((midi % 12) + 12) % 12]!
	return palette[pitchClass]
}

export function midiAddressFromElement(element: Element): MIDIAddress {
	const read = (name: string) => {
		const raw = element.getAttribute(name)
		const value = raw === null || !raw.trim() ? 0 : Number(raw)
		return Number.isInteger(value) && value >= 0 && value <= 15 ? value : 0
	}
	return { group: read("group"), channel: read("channel") }
}

export function harmonicSeriesMidi(root: number, harmonic: number): number {
	return clamp(Math.round(root + 12 * Math.log2(Math.max(1, harmonic))), 0, 127)
}

export function ratioMidi(root: number, ratio: number): number {
	return clamp(Math.round(root + 12 * Math.log2(Math.max(0.01, ratio))), 0, 127)
}

export function isAccidental(midi: number): boolean {
	return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}

/** Shared base stylesheet for Chrome Music Lab event-only input components. */
export const CML_HOST_STYLES = `
:host {
	display: flex;
	flex-direction: column;
	box-sizing: border-box;
	width: 100%;
	height: 100%;
	min-width: var(--min-width, 160px);
	min-height: var(--min-height, 96px);
	color: var(--color, #f7f5ef);
	background: var(--background-color, var(--background, #10131d));
	border-radius: var(--border-radius, 12px);
	overflow: hidden;
	font: var(
		--font,
		var(--font-size, 0.85rem) / var(--line-height, 1.3)
			var(--font-family, system-ui, sans-serif)
	);
}
:host([hidden]) {
	display: none;
}
*, *::before, *::after {
	box-sizing: border-box;
}
.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--gap, 0.45rem 0.75rem);
	padding: var(--padding, 0.45rem 0.65rem);
	border-bottom: 1px solid color-mix(in oklab, currentColor 16%, transparent);
}
label {
	display: flex;
	align-items: center;
	gap: 0.35rem;
	white-space: nowrap;
}
button, select, input {
	font: inherit;
	color: inherit;
}
button, select, input[type="number"] {
	min-height: 30px;
	background: color-mix(in oklab, currentColor 8%, transparent);
	border: 1px solid color-mix(in oklab, currentColor 32%, transparent);
	border-radius: 6px;
	padding: 0.2rem 0.5rem;
}
button {
	cursor: pointer;
}
button[aria-pressed="true"] {
	background: var(--accent-color, #16a8f0);
	border-color: var(--accent-color, #16a8f0);
	color: #091019;
	font-weight: 600;
}
button:disabled, select:disabled, input:disabled {
	cursor: not-allowed;
	opacity: 0.5;
}
select option {
	color: #111;
}
input[type="number"] {
	width: 4rem;
}
input[type="range"] {
	width: 5.5rem;
	accent-color: var(--accent-color, #16a8f0);
}
:focus-visible {
	outline: 2px solid var(--focus-color, #ffb729);
	outline-offset: 2px;
}
.stage {
	position: relative;
	flex: 1 1 var(--stage-height, 200px);
	min-height: 72px;
}
canvas {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	display: block;
	touch-action: none;
}
:host([disabled]) canvas {
	cursor: not-allowed;
	opacity: 0.5;
}
.sr-only {
	position: absolute;
	width: 1px;
	height: 1px;
	overflow: hidden;
	clip-path: inset(50%);
	white-space: nowrap;
}
:host([data-compact]) .toolbar,
:host([controls="none"]) .toolbar {
	display: none;
}
`