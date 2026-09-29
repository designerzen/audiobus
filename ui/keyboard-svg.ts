import AbstractInteractive from './abstract-interactive.ts'

const DEFAULT_TITLE = 'Piano Keyboard with 12 keys'

interface KeyInfo {
	noteNumber: number
	noteName: string
	noteKey?: string
	colour: string
	frequency: number
	octave: number
	accidental?: boolean
	[key: string]: any
}

interface KeyboardResult {
	svg: string
	keyElements: string[]
	whiteKeyElements: string[]
	blackKeyElements: string[]
}

export default class SVGKeyboard extends AbstractInteractive {
	static uniqueID: number = 0

	keyElements: Element[] = []
	htmlElement!: DocumentFragment
	titleElement!: Element | null

	firstNoteNumber: number = 0

	notes: KeyInfo[] = []
	smoothID: number = -1

	titleID!: string
	descriptionID!: string
	svgString!: string
	keyMap: Map<number, Element> = new Map()
	private noteMap = new Map<number, KeyInfo>()
	readonly asElement: HTMLDivElement
	private rangeController = new AbortController()
	private resizeObserver: ResizeObserver
	private layoutFrame = 0

	get svg(): string {
		return this.svgString
	}

	get fragment(): DocumentFragment {
		return this.htmlElement
	}

	get element(): DocumentFragment {
		return this.htmlElement
	}

	get description(): string {
		return DEFAULT_TITLE
	}

	set title(value: string) {
		if (this.titleElement) {
			this.titleElement.textContent = value
		}
	}

	constructor(
		notes: KeyInfo[],
		noteOn: (noteNumber: number, pressure: number, id: number) => void,
		noteOff: (noteNumber: number, velocity: number, id: number) => void
	) {
		super()
		const unique = `keyboard-${SVGKeyboard.uniqueID++}`
		this.titleID = `${unique}-title`
		this.descriptionID = `${unique}-desc`
		const { svg } = this.createKeyboard(notes)

		this.htmlElement = document.createDocumentFragment()
		const pianoElement = this.htmlElement.appendChild(document.createElement('div'))
		this.asElement = pianoElement
		pianoElement.className = 'piano'
		pianoElement.setAttribute('data-piano', 'true')
		const viewport = pianoElement.appendChild(document.createElement('div'))
		viewport.className = 'piano-viewport'
		viewport.innerHTML = svg
		pianoElement.style.setProperty('--piano-white-keys', String(notes.filter(note => !note.accidental).length))
		const range = pianoElement.appendChild(document.createElement('input'))
		range.type = 'range'
		range.className = 'piano-range'
		range.min = '0'
		range.max = '100'
		range.step = 'any'
		range.value = '50'
		range.setAttribute('aria-label', 'Keyboard range, low to high notes')
		const positionKeyboard = () => {
			const overflow = Math.max(0, viewport.scrollWidth - viewport.clientWidth)
			range.disabled = overflow === 0
			viewport.scrollLeft = overflow * Number(range.value) / 100
		}
		range.addEventListener('input', () => {
			this.allNotesOff()
			positionKeyboard()
		}, { signal: this.rangeController.signal })
		this.resizeObserver = new ResizeObserver(() => {
			cancelAnimationFrame(this.layoutFrame)
			this.layoutFrame = requestAnimationFrame(positionKeyboard)
		})
		this.resizeObserver.observe(viewport)
		this.layoutFrame = requestAnimationFrame(positionKeyboard)
		this.titleElement = pianoElement.querySelector('title')
		this.keyElements = Array.from(pianoElement.querySelectorAll('.piano-key'))

		this.keyMap = new Map()
		this.keyElements.forEach((value) => {
			const noteNum = parseInt(value.getAttribute('data-number') ?? '0')
			this.keyMap.set(noteNum, value)
		})

		this.firstNoteNumber = notes[0]?.noteNumber ?? 0
		this.noteMap = new Map(notes.map(note => [note.noteNumber, note]))
		this.svgString = svg
		this.addInteractivity(this.keyElements, noteOn, noteOff)
	}

	getNoteFromKey(button: Element): KeyInfo {
		const noteNumber = parseInt(button.getAttribute('data-number') ?? '0')
		return this.noteMap.get(noteNumber)!
	}

	private createKeyName(key: KeyInfo, x: number, y: number, _width: number = 23, height: number = 120): string {
		const textYPosition = y + height
		return `<text x="${x}" y="${textYPosition}" class="piano-key-name">${key.noteName}</text>`
	}

	private createBlackKey(
		key: KeyInfo,
		x: number,
		y: number,
		r: number = 1.5,
		width: number = 13,
		height: number = 80
	): string {
		return `<rect 
					x="${x}" 
					y="${y}" 
					rx="${r}" 
					role="button"
					tabindex="0"
					style="--col-accent: ${key.colour};"
					class="piano-key piano-key-black" 
					width="${width}" height="${height}" 
					title="${key.noteName}" 
					aria-label="${key.noteName}"
                    data-key="${key.noteKey}" 
					data-note="${key.noteName}" 
					data-number="${key.noteNumber}" 
					data-frequency="${key.frequency}"
					data-octave="${key.octave}"
				>
				</rect>`
	}

	private createWhiteKey(
		key: KeyInfo,
		x: number,
		y: number,
		r: number = 1.5,
		width: number = 23,
		height: number = 120
	): string {
		return `<rect 
					x="${x}" 
					y="${y}" 
					rx="${r}" 
					role="button"
					tabindex="0"
					style="--col-accent: ${key.colour};"
					class="piano-key piano-key-white" 
					width="${width}" height="${height}" 
					title="${key.noteName}" 
					aria-label="${key.noteName}"
					data-key="${key.noteKey}" 
					data-note="${key.noteName}" 
					data-number="${key.noteNumber}" 
					data-frequency="${key.frequency}"
					data-octave="${key.octave}"
				>
				</rect>`
	}

	private createIndicator(key: KeyInfo, x: number, y: number, r: number = 5): string {
		return `<circle 
					cx="${x}" 
					cy="${y}" 
					r="${r}" 
					class="piano-note-indicator" 
					style="--col-accent: ${key.colour};"
					data-note="${key.noteName}" 
					data-number="${key.noteNumber}" 
					data-frequency="${key.frequency}"
					data-octave="${key.octave}"
				>
				</circle>`
	}

	private createKeyboard(
		keys: KeyInfo[],
		blackKeyWidth: number = 13,
		whiteKeyWidth: number = 23,
		indicatorWidth: number = 8,
		blackKeyScale: number = 0.5,
		whiteKeyHeight: number = 140,
		startX: number = 0,
		startY: number = 20
	): KeyboardResult {
		const curvedRadius = 6
		const halfBlackKeyWidth = blackKeyWidth / 2
		const halfIndicatorWidth = indicatorWidth / 2
		const indicatorRadius = halfIndicatorWidth
		const spaceBetweenIndicators = whiteKeyWidth - indicatorWidth
		const blackKeyHeight = whiteKeyHeight * blackKeyScale
		const totalHeight = whiteKeyHeight + startY

		let totalWidth = 0
		let x = startX
		let y = startY

		const whiteKeyElements: string[] = []
		const blackKeyElements: string[] = []

		const keyElements = keys.map((key) => {
			const isBlack = key.accidental ?? false

			x -= isBlack ? halfBlackKeyWidth : 0

			const keyElement = isBlack
				? this.createBlackKey(key, x, y, curvedRadius, blackKeyWidth, blackKeyHeight)
				: this.createWhiteKey(key, x, y, curvedRadius, whiteKeyWidth, whiteKeyHeight)

			if (isBlack) {
				blackKeyElements.push(keyElement)
			} else {
				whiteKeyElements.push(keyElement)
			}

			this.createKeyName(key, x, y, blackKeyWidth, blackKeyHeight)

			x += isBlack ? halfBlackKeyWidth : whiteKeyWidth

			totalWidth += isBlack ? 0 : whiteKeyWidth

			this.notes.push(key)

			return keyElement
		})

		x = 0
		y = 0

		const indicatorElements = keys.map((key) => {
			const indicator = this.createIndicator(key, x, y, indicatorRadius)
			x += spaceBetweenIndicators
			return indicator
		})

		const keyboard = `<g class="piano-key-notes piano-keys-white">${whiteKeyElements.join('')}</g>
						<g class="piano-key-notes piano-keys-black">${blackKeyElements.join('')}</g>`

		const indicators = `<g class="piano-key-indicators">${indicatorElements.join('')}</g>`

		const svg = `<svg 
					xmlns="http://www.w3.org/2000/svg" 
					class="piano-keys" 
					viewBox="0 0 ${totalWidth} ${totalHeight}" 
					preserveAspectRatio="none"
					aria-labelledby="${this.titleID} ${this.descriptionID}"
					draggable="false">
					<title id="${this.titleID}">Piano Keyboard with ${keys.length} keys</title>
					<desc id="${this.descriptionID}">Interactive Piano Keyboard with ${keys.length} keys</desc>
					${keyboard}
					${indicators}
				</svg>`

		return { svg, keyElements, whiteKeyElements, blackKeyElements }
	}

	/**
	 * Set a key as active (visually indicate it's playing)
	 * @param noteNumber - The MIDI note number
	 * @param colour - Optional colour to apply
	 */
	setKeyAsActive(noteNumber: number, colour?: string): void {
		const key = this.keyMap.get(noteNumber)

		if (key && key instanceof Element) {
			key.classList.toggle('active', true)
			if (colour) {
				key.setAttribute('style', `--col-accent: ${colour};`)
			}
		}
	}

	/**
	 * Set a key as inactive (visually indicate it's not playing)
	 * @param noteNumber - The MIDI note number
	 */
	setKeyAsInactive(noteNumber: number): void {
		const key = this.keyMap.get(noteNumber)

		if (key && key instanceof Element) {
			key.classList.toggle('active', false)
		}
	}

	destroy(): void {
		super.destroy()
		this.rangeController.abort()
		this.resizeObserver.disconnect()
		cancelAnimationFrame(this.layoutFrame)
		this.asElement.remove()
		this.notes = []
		this.keyElements = []
		this.keyMap.clear()
		this.noteMap.clear()
	}
}
