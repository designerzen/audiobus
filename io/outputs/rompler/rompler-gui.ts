import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_DRAG_LEAVE,
	EVENT_DRAG_OVER,
	EVENT_DROP,
	EVENT_INPUT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_UP,
	EVENT_SUBMIT
} from "../../../events/event-constants"
import {
	HIGHEST_NOTE,
	ROMPLER_SPACINGS,
	LOWEST_NOTE,
	fallbackCatalogue,
	isSustained,
	loadCatalogue,
	noteName,
	type RomplerInstrument
} from "./rompler-catalogue"
import { SOUNDFONT_EXTENSIONS, storedFile } from "./rompler-source"
import { ROMPLER_SOUNDFONTS, formatSize, soundFontEntry } from "./rompler-soundfonts"
import "./rompler-gui.css"

export interface RomplerSettings {
	preset: number
	soundfont: string
	baseUrl: string
	spacing: number
	volume: number
	release: number
	pitchBendRange: number
}

/** What the panel asks of its Rompler; sliders apply while dragging and commit once released */
export interface RomplerActions {
	select(id: number): void
	step(offset: number): void
	// A URL or file to play, or an empty string to stream OpenGM24
	open(source: string | File): void
	spacing(spacing: number): void
	volume(volume: number): void
	release(seconds: number): void
	pitchBendRange(semitones: number): void
	commit(): void
	audition(note: number, on: boolean): void
}

const AUDITION_NOTE = 60
const BLACK_KEYS = new Set([1, 3, 6, 8, 10])
const CREDIT = "OpenGM24: FluidR3, Musyng Kite, FatBoy, Tabla and Meta Open Sound"

const element = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className = "",
	text = ""
): HTMLElementTagNameMap[K] => {
	const node = document.createElement(tag)
	node.className = className
	node.textContent = text
	return node
}

/** One choice in the instrument list: a General MIDI program or a preset of a soundfont file */
export interface RomplerEntry {
	id: number
	number: string
	label: string
	category: string
	description?: string
	commonUses?: string[]
	alternateNames?: string[]
	source?: string
	license?: string
	loops?: boolean
}

/** What the Rompler is playing from, for the panel to show */
export interface RomplerView {
	kind: "stream" | "bank" | "pack"
	name: string
	// Omitted while streaming, where the panel lists the OpenGM24 catalogue
	entries?: RomplerEntry[]
	selected: number
	sampled: number[]
	loaded: Iterable<number>
}

const pad = (program: number) => String(program + 1).padStart(3, "0")

const fromCatalogue = (instruments: RomplerInstrument[]): RomplerEntry[] =>
	instruments.map((instrument) => ({
		...instrument,
		id: instrument.program,
		number: pad(instrument.program),
		loops: isSustained(instrument.program)
	}))

const matches = (entry: RomplerEntry, query: string) =>
	!query ||
	[
		entry.number,
		entry.label,
		entry.category,
		...(entry.alternateNames ?? []),
		...(entry.commonUses ?? [])
	].some((text) => text.toLowerCase().includes(query))

/**
 * Instrument browser and front panel for the Rompler: a screen for the
 * current instrument, searchable categories, and a key map that lights
 * up as samples stream in and as notes play.
 */
export class RomplerGui {
	readonly element = element("section", "rompler nodrag nopan nowheel")
	private catalogue = fromCatalogue(fallbackCatalogue())
	private entries = this.catalogue
	private view: RomplerView
	private category = ""
	private query = ""
	private readonly screen = element("div", "rompler-screen")
	private readonly title = element("strong", "rompler-title")
	private readonly number = element("span", "rompler-number")
	private readonly meta = element("span", "rompler-meta")
	private readonly about = element("p", "rompler-about")
	private readonly uses = element("ul", "rompler-uses")
	private readonly status = element("output", "rompler-status")
	private readonly soundfont = element("span", "rompler-soundfont")
	private readonly current = element("button", "rompler-current")
	private readonly library = element("div", "rompler-library")
	private readonly cards = new Map<string, HTMLButtonElement>()
	private readonly density = element("div", "rompler-density")
	private readonly credit = element("small", "rompler-credit")
	private readonly categories = element("div", "rompler-categories")
	private readonly list = element("div", "rompler-list")
	private readonly count = element("span", "rompler-count")
	private readonly keymap = element("div", "rompler-keys")
	private readonly keys = new Map<number, HTMLElement>()
	private readonly items = new Map<number, HTMLButtonElement>()
	private readonly spacings = new Map<number, HTMLButtonElement>()

	constructor(
		private readonly settings: RomplerSettings,
		private readonly actions: RomplerActions,
		view: RomplerView
	) {
		this.view = view
		this.status.setAttribute("aria-live", "polite")
		this.element.setAttribute("aria-label", "Rompler")
		this.element.append(
			this.header(),
			this.sources(),
			this.front(),
			this.browser(),
			this.controls(),
			this.credit
		)
		this.dropTarget()
		this.setView(view)
		void loadCatalogue(settings.baseUrl).then((instruments) => {
			this.catalogue = fromCatalogue(instruments)
			if (!this.view.entries) {
				this.entries = this.catalogue
				this.render()
			}
		})
	}

	private header(): HTMLElement {
		const header = element("header")
		const brand = element("strong", "rompler-brand", "Rompler")
		header.append(brand, this.soundfont)
		return header
	}

	/** Pick a soundfont from the collection, or open a .sf2, .sf3 or MIDI.js file from disk or a URL */
	private sources(): HTMLElement {
		const button = (text: string, className = "") => {
			const item = element("button", className, text)
			item.type = "button"
			return item
		}
		const picker = element("input")
		picker.type = "file"
		picker.accept = SOUNDFONT_EXTENSIONS
		picker.hidden = true
		picker.addEventListener(EVENT_CHANGE, () => {
			const file = picker.files?.[0]
			if (file) {
				this.actions.open(file)
				this.showLibrary(false)
			}
			picker.value = ""
		})
		const file = button("Open file…")
		file.title =
			"SoundFont 2 or 3 (.sf2, .sf3) or a MIDI.js pack (.js, .json); you can also drop one here"
		file.addEventListener(EVENT_CLICK, () => picker.click())

		const form = element("form", "rompler-url")
		const url = element("input")
		url.type = "url"
		url.required = true
		url.placeholder = "https://example.com/soundfont.sf2"
		url.setAttribute("aria-label", "Soundfont URL")
		const load = button("Load")
		load.type = "submit"
		form.hidden = true
		form.append(url, load)
		form.addEventListener(EVENT_SUBMIT, (event) => {
			event.preventDefault()
			this.actions.open(url.value)
			form.hidden = true
			link.setAttribute("aria-expanded", "false")
			this.showLibrary(false)
		})
		const link = button("From URL")
		link.setAttribute("aria-expanded", "false")
		link.addEventListener(EVENT_CLICK, () => {
			form.hidden = !form.hidden
			link.setAttribute("aria-expanded", String(!form.hidden))
			if (!form.hidden) {
				url.value = this.settings.soundfont.startsWith("http")
					? this.settings.soundfont
					: ""
				url.focus()
			}
		})

		const cards = element("div", "rompler-cards")
		cards.setAttribute("role", "group")
		cards.setAttribute("aria-label", "Soundfonts")
		for (const soundfont of ROMPLER_SOUNDFONTS) {
			const card = button("", "rompler-card")
			const detail = [
				soundfont.format,
				soundfont.size ? formatSize(soundfont.size) : "",
				soundfont.license
			]
				.filter(Boolean)
				.join(" · ")
			card.title = `${soundfont.name} by ${soundfont.author}`
			card.append(
				element("strong", "", soundfont.name),
				element("span", "rompler-card-detail", detail),
				element("span", "rompler-card-about", soundfont.description)
			)
			card.addEventListener(EVENT_CLICK, () => {
				this.actions.open(soundfont.url)
				this.showLibrary(false)
			})
			this.cards.set(soundfont.url, card)
			cards.append(card)
		}
		const files = element("div", "rompler-files")
		files.append(file, link, picker)
		this.library.hidden = true
		this.library.append(cards, files, form)

		this.current.type = "button"
		this.current.setAttribute("aria-expanded", "false")
		this.current.addEventListener(EVENT_CLICK, () => this.showLibrary(this.library.hidden))
		const wrapper = element("div", "rompler-source")
		wrapper.append(this.current, this.library)
		return wrapper
	}

	private showLibrary(open: boolean): void {
		this.library.hidden = !open
		this.current.setAttribute("aria-expanded", String(open))
		if (open) {
			// Marks soundfonts already kept in this browser, which open without downloading
			for (const [url, card] of this.cards) {
				if (url) {
					void storedFile(url).then((file) => card.classList.toggle("saved", !!file))
				}
			}
		}
	}

	private dropTarget(): void {
		// Tells the app's page-wide drop handler to leave soundfonts dropped here to this panel
		this.element.dataset.fileDrop = SOUNDFONT_EXTENSIONS
		const dragging = (event: DragEvent) => !!event.dataTransfer?.types.includes("Files")
		this.element.addEventListener(EVENT_DRAG_OVER, (event) => {
			if (dragging(event)) {
				event.preventDefault()
				this.element.classList.add("rompler-dropping")
			}
		})
		this.element.addEventListener(EVENT_DRAG_LEAVE, (event) => {
			if (!this.element.contains(event.relatedTarget as Node)) {
				this.element.classList.remove("rompler-dropping")
			}
		})
		this.element.addEventListener(EVENT_DROP, (event) => {
			const file = event.dataTransfer?.files[0]
			this.element.classList.remove("rompler-dropping")
			if (file) {
				event.preventDefault()
				event.stopPropagation()
				this.actions.open(file)
			}
		})
	}

	private front(): HTMLElement {
		const step = (text: string, label: string, offset: number) => {
			const button = element("button", "rompler-step", text)
			button.type = "button"
			button.setAttribute("aria-label", label)
			button.addEventListener(EVENT_CLICK, () => this.actions.step(offset))
			return button
		}
		const play = element("button", "rompler-play", "▶ Play")
		play.type = "button"
		play.setAttribute("aria-label", `Play ${noteName(AUDITION_NOTE)}`)
		this.hold(play, () => AUDITION_NOTE)
		// Keyboard players get the same audition on Enter or Space
		play.addEventListener(EVENT_KEY_DOWN, (event) => {
			if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
				event.preventDefault()
				this.actions.audition(AUDITION_NOTE, true)
				play.addEventListener(
					EVENT_KEY_UP,
					() => this.actions.audition(AUDITION_NOTE, false),
					{
						once: true
					}
				)
			}
		})

		const heading = element("div", "rompler-heading")
		heading.append(this.number, this.title)
		this.screen.append(heading, this.meta, this.about, this.uses)

		const transport = element("div", "rompler-transport")
		transport.append(
			step("◀", "Previous instrument", -1),
			play,
			step("▶", "Next instrument", 1)
		)

		this.keymap.setAttribute("aria-hidden", "true")
		for (let note = LOWEST_NOTE; note <= HIGHEST_NOTE; note++) {
			const key = element("span", BLACK_KEYS.has(note % 12) ? "black" : "white")
			key.dataset.note = String(note)
			this.keys.set(note, key)
			this.keymap.append(key)
		}
		this.hold(
			this.keymap,
			(event) => Number((event.target as HTMLElement).dataset.note) || undefined
		)

		const front = element("div", "rompler-front")
		front.append(this.screen, this.keymap, transport, this.status)
		return front
	}

	/** Plays a note while the pointer is held on the target */
	private hold(target: HTMLElement, pick: (event: PointerEvent) => number | undefined): void {
		target.addEventListener(EVENT_POINTER_DOWN, (event) => {
			const note = pick(event)
			if (note === undefined || event.button !== 0) {
				return
			}
			const stop = () => {
				this.actions.audition(note, false)
				window.removeEventListener(EVENT_POINTER_UP, stop)
				window.removeEventListener(EVENT_POINTER_CANCEL, stop)
			}
			window.addEventListener(EVENT_POINTER_UP, stop)
			window.addEventListener(EVENT_POINTER_CANCEL, stop)
			this.actions.audition(note, true)
		})
	}

	private browser(): HTMLElement {
		const search = element("input", "rompler-search")
		search.type = "search"
		search.placeholder = "Search instruments, styles or numbers"
		search.setAttribute("aria-label", "Search instruments")
		search.addEventListener(EVENT_INPUT, () => {
			this.query = search.value.trim().toLowerCase()
			this.filter()
		})
		this.categories.setAttribute("role", "group")
		this.categories.setAttribute("aria-label", "Categories")
		this.list.setAttribute("aria-label", "Instruments")
		this.list.addEventListener(EVENT_KEY_DOWN, (event) => {
			if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
				return
			}
			event.preventDefault()
			const visible = [...this.items.values()].filter((item) => !item.hidden)
			const index = visible.indexOf(document.activeElement as HTMLButtonElement)
			visible[
				Math.max(
					0,
					Math.min(visible.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))
				)
			]?.focus()
		})
		const toolbar = element("div", "rompler-toolbar")
		toolbar.append(search, this.count)
		const browser = element("div", "rompler-browser")
		browser.append(toolbar, this.categories, this.list)
		return browser
	}

	private controls(): HTMLElement {
		const controls = element("div", "rompler-controls")
		const density = this.density
		density.setAttribute("role", "group")
		density.setAttribute("aria-label", "Sample density")
		density.append(element("span", "rompler-label", "Samples"))
		for (const spacing of ROMPLER_SPACINGS) {
			const button = element("button", "", spacing === 1 ? "Every key" : `1 in ${spacing}`)
			button.type = "button"
			button.title =
				spacing === 1
					? "A sample for every key: best quality, most downloads"
					: `A sample every ${spacing} keys, pitched in between`
			button.addEventListener(EVENT_CLICK, () => this.actions.spacing(spacing))
			this.spacings.set(spacing, button)
			density.append(button)
		}
		const sliders = element("div", "rompler-sliders")
		sliders.append(
			this.slider(
				"Gain",
				this.settings.volume,
				0,
				2,
				0.01,
				(value) => `${Math.round(value * 100)}%`,
				(value) => this.actions.volume(value)
			),
			// Release sweeps 5 ms to 5 s on a logarithmic scale so short tails stay easy to set
			this.slider(
				"Release",
				Math.log(this.settings.release / 0.005) / Math.log(1000),
				0,
				1,
				0.001,
				(value) => `${(0.005 * 1000 ** value).toFixed(value < 0.5 ? 3 : 2)} s`,
				(value) => this.actions.release(0.005 * 1000 ** value)
			),
			this.slider(
				"Bend",
				this.settings.pitchBendRange,
				0,
				24,
				1,
				(value) => `±${value} st`,
				(value) => this.actions.pitchBendRange(value)
			)
		)
		controls.append(density, sliders)
		return controls
	}

	private slider(
		title: string,
		value: number,
		min: number,
		max: number,
		step: number,
		format: (value: number) => string,
		change: (value: number) => void
	): HTMLLabelElement {
		const label = element("label", "rompler-slider")
		const input = element("input")
		const readout = element("output", "", format(value))
		input.type = "range"
		input.min = String(min)
		input.max = String(max)
		input.step = String(step)
		input.value = String(value)
		input.addEventListener(EVENT_INPUT, () => {
			readout.textContent = format(input.valueAsNumber)
			input.setAttribute("aria-valuetext", readout.textContent)
			change(input.valueAsNumber)
		})
		input.addEventListener(EVENT_CHANGE, () => this.actions.commit())
		input.setAttribute("aria-valuetext", readout.textContent)
		label.append(element("span", "rompler-label", title), readout, input)
		return label
	}

	/** Shows a new source: its name, its list of instruments and the keys it samples */
	setView(view: RomplerView): void {
		this.view = view
		this.entries = view.entries ?? this.catalogue
		this.soundfont.textContent = view.kind === "stream" ? "OpenGM24 · General MIDI" : view.name
		const known = soundFontEntry(view.kind === "stream" ? "" : this.settings.soundfont)
		const label = element("span", "rompler-current-name", known?.name ?? view.name)
		this.current.replaceChildren(
			element("span", "rompler-label", "Soundfont"),
			label,
			element(
				"span",
				"rompler-current-detail",
				known?.format ?? (view.kind === "pack" ? "MIDI.js" : "File")
			)
		)
		for (const [url, card] of this.cards) {
			card.setAttribute("aria-pressed", String(!!known && url === known.url))
		}
		// Banks bring their own zones, so sample density only applies to note-by-note sources
		this.density.hidden = view.kind === "bank"
		this.resetSamples(view.sampled)
		for (const note of view.loaded) {
			this.sampleLoaded(note)
		}
		this.render()
	}

	/** Rebuilds the category chips and instrument list */
	private render(): void {
		const categories = [...new Set(this.entries.map(({ category }) => category))]
		if (!categories.includes(this.category)) {
			this.category = ""
		}
		this.categories.replaceChildren(
			...["", ...categories].map((category) => {
				const chip = element("button", "", category || "All")
				chip.type = "button"
				chip.setAttribute("aria-pressed", String(category === this.category))
				chip.addEventListener(EVENT_CLICK, () => {
					this.category = category
					for (const other of this.categories.children) {
						other.setAttribute("aria-pressed", String(other === chip))
					}
					this.filter()
				})
				return chip
			})
		)
		this.items.clear()
		this.list.replaceChildren(
			...this.entries.map((entry) => {
				const item = element("button", "rompler-item")
				item.type = "button"
				item.title = entry.description ?? entry.label
				item.append(
					element("span", "rompler-item-number", entry.number),
					element("span", "rompler-item-name", entry.label)
				)
				if (entry.loops) {
					item.append(element("span", "rompler-tag", "loops"))
				}
				item.addEventListener(EVENT_CLICK, () => this.actions.select(entry.id))
				this.items.set(entry.id, item)
				return item
			})
		)
		this.filter()
		this.setSelected(this.view.selected)
		this.setSpacing(this.settings.spacing)
	}

	private filter(): void {
		let shown = 0
		for (const entry of this.entries) {
			const item = this.items.get(entry.id)!
			item.hidden =
				(!!this.category && entry.category !== this.category) || !matches(entry, this.query)
			shown += Number(!item.hidden)
		}
		this.count.textContent = `${shown} of ${this.entries.length}`
	}

	setSelected(id: number): void {
		this.view.selected = id
		const entry = this.entries.find((candidate) => candidate.id === id) ?? this.entries[0]
		if (!entry) {
			return
		}
		this.number.textContent = entry.number
		this.title.textContent = entry.label
		this.meta.textContent = [
			entry.category,
			entry.loops ? "Sustains and loops" : "One-shot",
			entry.license
		]
			.filter(Boolean)
			.join(" · ")
		this.about.textContent = entry.description ?? ""
		this.uses.replaceChildren(
			...(entry.commonUses ?? []).slice(0, 4).map((use) => element("li", "", use))
		)
		const credit = this.view.kind === "stream" ? CREDIT : this.view.name
		this.credit.textContent = entry.source ? `${entry.source}. ${credit}` : credit
		for (const [index, item] of this.items) {
			item.setAttribute("aria-pressed", String(index === entry.id))
		}
		// Scroll only the list: scrollIntoView would also pan the graph around the panel
		const item = this.items.get(entry.id)
		if (item && !item.hidden) {
			const { offsetTop: top, offsetHeight: height } = item
			const { scrollTop, clientHeight } = this.list
			if (top < scrollTop) {
				this.list.scrollTop = top
			} else if (top + height > scrollTop + clientHeight) {
				this.list.scrollTop = top + height - clientHeight
			}
		}
	}

	setSpacing(spacing: number): void {
		for (const [value, button] of this.spacings) {
			button.setAttribute("aria-pressed", String(value === spacing))
		}
	}

	setStatus(text: string, busy: boolean, problem = false): void {
		this.status.textContent = text
		this.element.classList.toggle("rompler-busy", busy)
		this.element.classList.toggle("rompler-problem", problem)
	}

	/** Marks the keys that will get their own sample for the new preset */
	resetSamples(grid: number[]): void {
		const sampled = new Set(grid)
		for (const [note, key] of this.keys) {
			key.classList.toggle("sampled", sampled.has(note))
			key.classList.remove("loaded")
		}
	}

	sampleLoaded(note: number): void {
		this.keys.get(note)?.classList.add("loaded")
	}

	notePlaying(note: number, on: boolean): void {
		this.keys.get(note)?.classList.toggle("playing", on)
	}

	clearPlaying(): void {
		for (const key of this.keys.values()) {
			key.classList.remove("playing")
		}
	}
}