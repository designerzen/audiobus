import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_INPUT,
	EVENT_KEY_DOWN,
	EVENT_KEY_UP,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_UP
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
import "./rompler-gui.css"

export interface RomplerSettings {
	preset: number
	baseUrl: string
	spacing: number
	volume: number
	release: number
	pitchBendRange: number
}

/** What the panel asks of its Rompler; sliders apply while dragging and commit once released */
export interface RomplerActions {
	preset(program: number): void
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

const pad = (program: number) => String(program + 1).padStart(3, "0")

const matches = (instrument: RomplerInstrument, query: string) =>
	!query ||
	[
		pad(instrument.program),
		instrument.label,
		instrument.category,
		...(instrument.alternateNames ?? []),
		...(instrument.commonUses ?? [])
	].some((text) => text.toLowerCase().includes(query))

/**
 * Instrument browser and front panel for the Rompler: a screen for the
 * current instrument, searchable categories, and a key map that lights
 * up as samples stream in and as notes play.
 */
export class RomplerGui {
	readonly element = element("section", "rompler nodrag nopan nowheel")
	private instruments = fallbackCatalogue()
	private category = ""
	private query = ""
	private readonly screen = element("div", "rompler-screen")
	private readonly title = element("strong", "rompler-title")
	private readonly number = element("span", "rompler-number")
	private readonly meta = element("span", "rompler-meta")
	private readonly about = element("p", "rompler-about")
	private readonly uses = element("ul", "rompler-uses")
	private readonly status = element("output", "rompler-status")
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
		loaded: Iterable<number>,
		grid: number[]
	) {
		this.status.setAttribute("aria-live", "polite")
		this.element.setAttribute("aria-label", "Rompler")
		this.element.append(
			this.header(),
			this.front(),
			this.browser(),
			this.controls(),
			this.credit
		)
		this.resetSamples(grid)
		for (const note of loaded) {
			this.sampleLoaded(note)
		}
		this.render()
		void loadCatalogue(settings.baseUrl).then((instruments) => {
			this.instruments = instruments
			this.render()
		})
	}

	private header(): HTMLElement {
		const header = element("header")
		const brand = element("strong", "rompler-brand", "Rompler")
		header.append(brand, element("span", "rompler-soundfont", "OpenGM24 · General MIDI"))
		return header
	}

	private front(): HTMLElement {
		const step = (text: string, label: string, offset: number) => {
			const button = element("button", "rompler-step", text)
			button.type = "button"
			button.setAttribute("aria-label", label)
			button.addEventListener(EVENT_CLICK, () =>
				this.actions.preset((this.settings.preset + offset + 128) % 128)
			)
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
		const density = element("div", "rompler-density")
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

	/** Rebuilds the category chips and instrument list from the catalogue */
	private render(): void {
		const categories = [...new Set(this.instruments.map(({ category }) => category))]
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
			...this.instruments.map((instrument) => {
				const item = element("button", "rompler-item")
				item.type = "button"
				item.title = instrument.description ?? instrument.label
				item.append(
					element("span", "rompler-item-number", pad(instrument.program)),
					element("span", "rompler-item-name", instrument.label)
				)
				if (isSustained(instrument.program)) {
					item.append(element("span", "rompler-tag", "loops"))
				}
				item.addEventListener(EVENT_CLICK, () => this.actions.preset(instrument.program))
				this.items.set(instrument.program, item)
				return item
			})
		)
		this.filter()
		this.setPreset(this.settings.preset)
		this.setSpacing(this.settings.spacing)
	}

	private filter(): void {
		let shown = 0
		for (const instrument of this.instruments) {
			const item = this.items.get(instrument.program)!
			item.hidden =
				(!!this.category && instrument.category !== this.category) ||
				!matches(instrument, this.query)
			shown += Number(!item.hidden)
		}
		this.count.textContent = `${shown} of ${this.instruments.length}`
	}

	setPreset(program: number): void {
		const instrument = this.instruments[program]
		this.number.textContent = pad(program)
		this.title.textContent = instrument.label
		this.meta.textContent = [
			instrument.category,
			isSustained(program) ? "Sustains and loops" : "One-shot",
			instrument.license
		]
			.filter(Boolean)
			.join(" · ")
		this.about.textContent = instrument.description ?? ""
		this.uses.replaceChildren(
			...(instrument.commonUses ?? []).slice(0, 4).map((use) => element("li", "", use))
		)
		this.credit.textContent = instrument.source ? `${instrument.source}. ${CREDIT}` : CREDIT
		for (const [index, item] of this.items) {
			item.setAttribute("aria-pressed", String(index === program))
		}
		// Scroll only the list: scrollIntoView would also pan the graph around the panel
		const item = this.items.get(program)
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

	setStatus(text: string, busy: boolean): void {
		this.status.textContent = text
		this.element.classList.toggle("rompler-busy", busy)
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