// oxlint-disable-next-line typescript/triple-slash-reference -- Standalone bundler asset declarations.
/// <reference path="./assets.d.ts" />
import { EVENT_CHANGE, EVENT_CLICK, EVENT_INSTRUMENT_CHANGE } from "../../../event-constants.ts"
import artwork from "./star-controller.svg?raw"
import styles from "./star-controller.css?inline"
import { ChordController } from "../../shared/chord-controller.ts"
import { dispatchInstrumentEvent, instrumentNote, range } from "../../interfaces/instrument.ts"
import { TUNING_MODE_NAMES } from "../../shared/chords.js"
import {
	choices,
	defaults,
	numericSettings,
	petals,
	intensityRanks,
	pitchNames,
	voicingNames,
	presets,
	parseRoots,
	modalScale,
	petalRoot,
	padChord,
	smoothVoicing,
	chordName,
	type Setting,
	type Settings,
	type Preset
} from "./star-settings.ts"

const settingNames = Object.keys(defaults) as Setting[]
const storageKey = "photosynth.star-controller.settings.v1"
const select = (name: string, label: string, values: readonly string[]) =>
	`<label>${label}<select data-control="${name}">${values.map((value) => `<option value="${value}">${value}</option>`).join("")}</select></label>`
const numberInput = (name: string, label: string, min: number, max: number, step = 1) =>
	`<label>${label}<input data-control="${name}" type="number" min="${min}" max="${max}" step="${step}" required></label>`

/** Plutchik's SVG as a configurable event-only chord instrument. */
export class StarController extends ChordController {
	static observedAttributes = [...ChordController.observedAttributes, ...settingNames]
	private lastVoicing: number[] = []
	private playedVoicings = new Map<string, number[]>()

	private setting<K extends Setting>(name: K): Settings[K] {
		const text = this.getAttribute(name)
		const fallback = defaults[name]
		if (name in numericSettings) {
			const [min, max, integer] = numericSettings[name as keyof typeof numericSettings]
			const value = text === null || !text.trim() ? fallback : Number(text)
			return (
				typeof value === "number" &&
				Number.isFinite(value) &&
				value >= min &&
				value <= max &&
				(!integer || Number.isInteger(value))
					? value
					: fallback
			) as Settings[K]
		}
		if (name === "custom-roots") {
			return (text && parseRoots(text) ? text : fallback) as Settings[K]
		}
		const options: readonly string[] = choices[name as keyof typeof choices]
		return (text && options.includes(text) ? text : fallback) as Settings[K]
	}

	private setSetting<K extends Setting>(name: K, value: Settings[K]) {
		if (name in numericSettings) {
			const [min, max, integer] = numericSettings[name as keyof typeof numericSettings]
			range(value as number, min, max, name, integer)
		} else if (name === "custom-roots") {
			if (!parseRoots(String(value))) {
				throw new RangeError("custom-roots needs eight comma-separated pitch classes, 0–11")
			}
		} else if (!(choices[name as keyof typeof choices] as readonly unknown[]).includes(value)) {
			throw new RangeError(`Invalid ${name}: ${value}`)
		}
		this.setAttribute(name, String(value))
	}

	get key() {
		return this.setting("key")
	}
	set key(value: number) {
		this.setSetting("key", value)
	}
	get transpose() {
		return this.setting("transpose")
	}
	set transpose(value: number) {
		this.setSetting("transpose", value)
	}
	get harmony() {
		return this.setting("harmony")
	}
	set harmony(value: Settings["harmony"]) {
		this.setSetting("harmony", value)
	}
	get customRoots() {
		return parseRoots(this.setting("custom-roots"))!
	}
	set customRoots(value: number[]) {
		this.setSetting("custom-roots", value.join(","))
	}
	get regionBehavior() {
		return this.setting("region-behavior")
	}
	set regionBehavior(value: Settings["region-behavior"]) {
		this.setSetting("region-behavior", value)
	}
	get chordType() {
		return this.setting("chord-type")
	}
	set chordType(value: Settings["chord-type"]) {
		this.setSetting("chord-type", value)
	}
	get holdBehavior() {
		return this.setting("hold-behavior")
	}
	set holdBehavior(value: Settings["hold-behavior"]) {
		this.setSetting("hold-behavior", value)
	}
	get velocityMode() {
		return this.setting("velocity-mode")
	}
	set velocityMode(value: Settings["velocity-mode"]) {
		this.setSetting("velocity-mode", value)
	}
	get velocity() {
		return this.setting("velocity")
	}
	set velocity(value: number) {
		this.setSetting("velocity", value)
	}
	get sensitivity() {
		return this.setting("sensitivity")
	}
	set sensitivity(value: number) {
		this.setSetting("sensitivity", value)
	}
	get minimumVelocity() {
		return this.setting("minimum-velocity")
	}
	set minimumVelocity(value: number) {
		this.setSetting("minimum-velocity", value)
	}
	get labels() {
		return this.setting("labels")
	}
	set labels(value: Settings["labels"]) {
		this.setSetting("labels", value)
	}
	get voiceLeading() {
		return this.setting("voice-leading")
	}
	set voiceLeading(value: Settings["voice-leading"]) {
		this.setSetting("voice-leading", value)
	}

	get settings(): Settings {
		return Object.fromEntries(
			settingNames.map((name) => [name, this.setting(name)])
		) as Settings
	}

	/** Presets retain key, transpose, octave, scale/mode and MIDI routing. */
	applyPreset(name: Preset) {
		if (!Object.hasOwn(presets, name)) {
			throw new RangeError(`Unknown star preset: ${name}`)
		}
		const values = {
			...defaults,
			key: this.key,
			transpose: this.transpose,
			...presets[name].settings
		}
		for (const setting of settingNames) {
			this.setSetting(setting, values[setting])
		}
	}

	resetSettings() {
		this.stop()
		for (const name of settingNames) {
			this.setSetting(name, defaults[name])
		}
		this.octave = 4
		this.scale = "Major"
		this.mode = 0
	}

	/** Persistence is opt-in, scoped to this browser, and excludes patch/MIDI routing. */
	saveSettings() {
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				version: 1,
				settings: this.settings,
				octave: this.octave,
				scale: this.scale,
				mode: this.mode
			})
		)
	}

	loadSettings() {
		const text = localStorage.getItem(storageKey)
		if (!text) {
			return false
		}
		const saved = JSON.parse(text)
		if (saved?.version !== 1 || !saved.settings || typeof saved.settings !== "object") {
			throw new Error("Unsupported saved wheel settings")
		}
		// Validate everything before changing the live instrument.
		const probe = document.createElement("star-controller")
		for (const name of settingNames) {
			probe.setSetting(name, saved.settings[name])
		}
		probe.octave = saved.octave
		if (!["Major", "Minor"].includes(saved.scale)) {
			throw new Error("Invalid saved scale")
		}
		probe.scale = saved.scale
		probe.mode = saved.mode
		this.stop()
		for (const name of settingNames) {
			this.setSetting(name, probe.setting(name))
		}
		this.octave = probe.octave
		this.scale = probe.scale
		this.mode = probe.mode
		return true
	}

	attributeChangedCallback(name: string, previous: string | null, next: string | null) {
		super.attributeChangedCallback(name, previous, next)
		if (
			previous !== next &&
			settingNames.includes(name as Setting) &&
			this.isConnected &&
			this.root.childElementCount
		) {
			dispatchInstrumentEvent(this, EVENT_INSTRUMENT_CHANGE, {
				control: name as Setting,
				value: this.setting(name as Setting)
			})
		}
	}

	stop() {
		this.lastVoicing = []
		this.playedVoicings?.clear()
		super.stop()
	}

	protected chord(root: number, pad?: SVGElement): number[] {
		if (!pad) {
			return super.chord(root)
		}
		return padChord(
			this.settings,
			modalScale(this.scale, this.mode),
			root,
			Number(pad.dataset.petal),
			Number(pad.dataset.voicing)
		)
	}

	protected gestureChord(root: number, pad: SVGElement) {
		const notes = this.chord(root, pad)
		const voiced =
			this.voiceLeading === "smooth" ? smoothVoicing(notes, this.lastVoicing) : notes
		this.lastVoicing = voiced
		this.playedVoicings.set(pad.dataset.pad!, voiced)
		return voiced
	}

	protected gestureVelocity(pressure: number, pad: SVGElement) {
		const touch = this.velocityMode === "fixed" ? 1 : Math.pow(pressure, 1 / this.sensitivity)
		const intensity =
			this.regionBehavior === "velocity" ? (Number(pad.dataset.intensity) + 1) / 4 : 1
		return Math.min(1, Math.max(this.minimumVelocity, touch * this.velocity * intensity))
	}

	protected isPadSounding(pad: SVGElement): boolean {
		const notes =
			this.playedVoicings?.get(pad.dataset.pad!) ?? this.chord(Number(pad.dataset.note), pad)
		return notes.length > 0 && notes.every((note) => this.activeNotes.has(note))
	}

	protected connectControls(options: { signal: AbortSignal }) {
		this.root.addEventListener(
			EVENT_CHANGE,
			(event) => {
				const input = event.target as HTMLInputElement | HTMLSelectElement
				if (!input.dataset.control) {
					return
				}
				input.setCustomValidity("")
				if (input.dataset.control === "custom-roots" && !parseRoots(input.value)) {
					input.setCustomValidity(
						"Enter eight comma-separated pitch classes from 0 to 11."
					)
				}
				if (!input.checkValidity()) {
					event.stopImmediatePropagation()
					input.reportValidity()
				}
			},
			{ ...options, capture: true }
		)
		this.root.querySelector<HTMLSelectElement>("[data-preset]")!.addEventListener(
			EVENT_CHANGE,
			(event) => {
				if (!this.disabled) {
					this.applyPreset((event.target as HTMLSelectElement).value as Preset)
				}
			},
			options
		)
		this.root.querySelector("[data-actions]")!.addEventListener(
			EVENT_CLICK,
			(event) => {
				const action = (event.target as Element).closest<HTMLButtonElement>("button")
					?.dataset.action
				if (!action || this.disabled) {
					return
				}
				try {
					if (action === "release") {
						this.stop()
					}
					if (action === "reset") {
						this.resetSettings()
					}
					if (action === "save") {
						this.saveSettings()
					}
					const loaded = action === "load" ? this.loadSettings() : true
					this.root.querySelector("[data-status]")!.textContent =
						action === "save"
							? "Settings saved in this browser."
							: action === "load"
								? loaded
									? "Saved settings loaded."
									: "No saved settings yet."
								: action === "reset"
									? "Original settings restored."
									: "All notes released."
				} catch {
					this.root.querySelector("[data-status]")!.textContent =
						"Settings could not be saved or loaded. Check browser storage or save a new preset."
				}
			},
			options
		)
		for (const type of ["pointerover", "focusin"]) {
			this.root.querySelector("svg")!.addEventListener(
				type,
				(event) => {
					const pad = (event.target as Element).closest<SVGElement>("[data-pad]")
					if (pad) {
						this.root.querySelector("[data-region]")!.textContent =
							pad.getAttribute("aria-label")
					}
				},
				options
			)
		}
	}

	protected render() {
		this.root.innerHTML = `<style>${styles}</style><figure>${artwork}<figcaption>Emotion star chord controller</figcaption></figure>
          <div class="controls">
            <label>Preset<select data-preset>${Object.entries(presets)
				.map(([name, preset]) => `<option value="${name}">${preset.label}</option>`)
				.join("")}<option value="custom" disabled>Custom settings</option></select></label>
            <label>Key<select data-control="key">${pitchNames.map((name, i) => `<option value="${i}">${name}</option>`).join("")}</select></label>
            ${numberInput("octave", "Octave", 0, 8)}
            ${select("hold-behavior", "Hold behaviour", choices["hold-behavior"])}
          </div>
          <div class="actions" data-actions><button data-action="release">Release all</button><button data-action="reset">Reset</button><button data-action="save">Save settings</button><button data-action="load">Load saved</button></div>
          <p data-status role="status"></p>
          <details><summary>More settings</summary><div class="controls">
            ${select("harmony", "Harmony layout", choices.harmony)}
            ${numberInput("transpose", "Transpose (semitones)", -24, 24)}
            ${select("scale", "Scale", ["Major", "Minor"])}
            <label>Mode<select data-control="mode">${TUNING_MODE_NAMES.map((name, i) => `<option value="${i}">${name}</option>`).join("")}</select></label>
            ${select("chord-type", "Chord type", choices["chord-type"])}
            ${select("region-behavior", "Regions control", choices["region-behavior"])}
            ${select("voice-leading", "Voice leading", choices["voice-leading"])}
            ${select("velocity-mode", "Velocity source", choices["velocity-mode"])}
            ${numberInput("velocity", "Velocity level", 0.01, 1, 0.01)}
            ${numberInput("sensitivity", "Pressure sensitivity", 0.25, 4, 0.25)}
            ${numberInput("minimum-velocity", "Minimum velocity", 0.01, 1, 0.01)}
            ${select("labels", "Region labels", choices.labels)}
            ${numberInput("program", "Timbre / program", 0, 127)}
            <label class="custom-roots">Custom petal roots<input data-control="custom-roots" placeholder="0,7,2,9,4,11,6,1" aria-describedby="roots-help"></label>
          </div><p id="roots-help">Custom roots: eight pitch classes (0–11) relative to the key, clockwise from the top. In-key layouts follow seven scale degrees and an upper tonic. Complexity regions use single notes, triads, sevenths and ninths; register regions span −1 to +2 octaves from outside inward. Smooth voice leading can change the chosen inversion/register.</p></details>
          <p>Hold a region, drag between regions, use multiple fingers, or focus a region and hold Enter / Space. Toggle keeps individual regions on; latch holds one region until the next. Release all stops sustained notes.</p>
          <p data-region>Focus or point to a region to inspect its mapping.</p>
          <output data-notes aria-live="polite">No held notes.</output>
          <p class="feedback-key">Pressed: dark outline. Incoming notes: gold fill. Both can appear together.</p>
          <details><summary>Region mapping</summary><div class="mapping">${petals.map((petal) => `<section data-mapping="${petal}"><strong>${petal}</strong><ol></ol></section>`).join("")}</div></details>`
		petals.forEach((family, petal) => {
			this.root
				.querySelectorAll<SVGElement>(`g[data-emotion="${family}"] > path`)
				.forEach((pad, index) => {
					pad.dataset.pad = `${family}:${index}`
					pad.dataset.petal = String(petal)
					pad.dataset.voicing = String(index)
					pad.dataset.intensity = String(intensityRanks[petal]![index])
					pad.dataset.emotion = pad.getAttribute("aria-label")!
					pad.setAttribute("role", "button")
					pad.setAttribute("tabindex", "0")
					pad.append(document.createElementNS("http://www.w3.org/2000/svg", "title"))
				})
		})
	}

	protected update() {
		const settings = this.settings
		const scale = modalScale(this.scale, this.mode)
		for (const input of this.root.querySelectorAll<HTMLInputElement>("[data-control]")) {
			const name = input.dataset.control!
			input.value = String(
				name in defaults
					? settings[name as Setting]
					: this[name as "octave" | "mode" | "scale" | "program"]
			)
			input.disabled =
				this.disabled ||
				(name === "custom-roots" && this.harmony !== "custom") ||
				(name === "sensitivity" && this.velocityMode === "fixed") ||
				(name === "chord-type" && this.regionBehavior === "complexity")
		}
		const preset = this.root.querySelector<HTMLSelectElement>("[data-preset]")!
		preset.value =
			Object.entries(presets).find(([, value]) => {
				const candidate = { ...defaults, ...value.settings }
				return settingNames.every(
					(name) =>
						name === "key" || name === "transpose" || settings[name] === candidate[name]
				)
			})?.[0] ?? "custom"
		preset.disabled = this.disabled
		for (const button of this.root.querySelectorAll<HTMLButtonElement>("button")) {
			button.disabled = this.disabled
		}
		for (const list of this.root.querySelectorAll("[data-mapping] ol")) {
			list.replaceChildren()
		}
		for (const pad of this.root.querySelectorAll<SVGElement>("[data-pad]")) {
			const root = petalRoot(settings, scale, this.octave, Number(pad.dataset.petal))
			pad.dataset.note = String(root)
			const notes = this.chord(root, pad)
			const noteNames =
				notes.map((n) => instrumentNote(n).noteName).join(", ") || "outside MIDI range"
			const chord = chordName(notes, root)
			const behavior =
				this.regionBehavior === "voicing"
					? voicingNames[Number(pad.dataset.voicing)]
					: `${this.regionBehavior} level ${Number(pad.dataset.intensity) + 1}`
			const description = `${pad.dataset.emotion}, ${chord}, ${behavior}: ${noteNames}`
			pad.setAttribute("aria-label", description)
			pad.querySelector("title")!.textContent = description
			pad.setAttribute("aria-disabled", String(this.disabled || notes.length === 0))
			pad.setAttribute("tabindex", this.disabled || notes.length === 0 ? "-1" : "0")
			const item = document.createElement("li")
			item.textContent =
				this.labels === "emotion"
					? pad.dataset.emotion!
					: this.labels === "chord"
						? `${chord} (${behavior})`
						: this.labels === "notes"
							? noteNames
							: description
			this.root
				.querySelector(`[data-mapping="${petals[Number(pad.dataset.petal)]}"] ol`)!
				.append(item)
		}
		this.root.querySelector("[data-region]")!.textContent =
			"Focus or point to a region to inspect its mapping."
		this.updatePressed()
	}

	protected updatePressed() {
		super.updatePressed()
		const output = this.root.querySelector("[data-notes]")
		if (output) {
			output.textContent = this.held.size
				? `Held notes: ${[...new Set([...this.held.values()].map((detail) => detail.note.noteName))].join(", ")}`
				: "No held notes."
		}
	}
}

if (!customElements.get("star-controller")) {
	customElements.define("star-controller", StarController)
}
declare global {
	interface HTMLElementTagNameMap {
		"star-controller": StarController
	}
}