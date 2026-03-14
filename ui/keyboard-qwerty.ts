import AbstractInteractive from './abstract-interactive.ts'

interface QwertyKeyInfo {
	keyCode: string
	display: string
	row: number
	col: number
	width?: number
	special?: boolean
	[key: string]: any
}

const QWERTY_LAYOUT: QwertyKeyInfo[] = [
	// Number row
	{ keyCode: '`', display: '`', row: 0, col: 0, width: 1 },
	{ keyCode: '1', display: '1', row: 0, col: 1, width: 1 },
	{ keyCode: '2', display: '2', row: 0, col: 2, width: 1 },
	{ keyCode: '3', display: '3', row: 0, col: 3, width: 1 },
	{ keyCode: '4', display: '4', row: 0, col: 4, width: 1 },
	{ keyCode: '5', display: '5', row: 0, col: 5, width: 1 },
	{ keyCode: '6', display: '6', row: 0, col: 6, width: 1 },
	{ keyCode: '7', display: '7', row: 0, col: 7, width: 1 },
	{ keyCode: '8', display: '8', row: 0, col: 8, width: 1 },
	{ keyCode: '9', display: '9', row: 0, col: 9, width: 1 },
	{ keyCode: '0', display: '0', row: 0, col: 10, width: 1 },
	{ keyCode: '-', display: '-', row: 0, col: 11, width: 1 },
	{ keyCode: '=', display: '=', row: 0, col: 12, width: 1 },
	{ keyCode: 'Backspace', display: 'Backspace', row: 0, col: 13, width: 2, special: true },

	// QWERTY row
	{ keyCode: 'Tab', display: 'Tab', row: 1, col: 0, width: 1.5, special: true },
	{ keyCode: 'q', display: 'Q', row: 1, col: 1.5, width: 1 },
	{ keyCode: 'w', display: 'W', row: 1, col: 2.5, width: 1 },
	{ keyCode: 'e', display: 'E', row: 1, col: 3.5, width: 1 },
	{ keyCode: 'r', display: 'R', row: 1, col: 4.5, width: 1 },
	{ keyCode: 't', display: 'T', row: 1, col: 5.5, width: 1 },
	{ keyCode: 'y', display: 'Y', row: 1, col: 6.5, width: 1 },
	{ keyCode: 'u', display: 'U', row: 1, col: 7.5, width: 1 },
	{ keyCode: 'i', display: 'I', row: 1, col: 8.5, width: 1 },
	{ keyCode: 'o', display: 'O', row: 1, col: 9.5, width: 1 },
	{ keyCode: 'p', display: 'P', row: 1, col: 10.5, width: 1 },
	{ keyCode: '[', display: '[', row: 1, col: 11.5, width: 1 },
	{ keyCode: ']', display: ']', row: 1, col: 12.5, width: 1 },
	{ keyCode: '\\', display: '\\', row: 1, col: 13.5, width: 1.5, special: true },

	// ASDF row
	{ keyCode: 'CapsLock', display: 'Caps', row: 2, col: 0, width: 1.8, special: true },
	{ keyCode: 'a', display: 'A', row: 2, col: 1.8, width: 1 },
	{ keyCode: 's', display: 'S', row: 2, col: 2.8, width: 1 },
	{ keyCode: 'd', display: 'D', row: 2, col: 3.8, width: 1 },
	{ keyCode: 'f', display: 'F', row: 2, col: 4.8, width: 1 },
	{ keyCode: 'g', display: 'G', row: 2, col: 5.8, width: 1 },
	{ keyCode: 'h', display: 'H', row: 2, col: 6.8, width: 1 },
	{ keyCode: 'j', display: 'J', row: 2, col: 7.8, width: 1 },
	{ keyCode: 'k', display: 'K', row: 2, col: 8.8, width: 1 },
	{ keyCode: 'l', display: 'L', row: 2, col: 9.8, width: 1 },
	{ keyCode: ';', display: ';', row: 2, col: 10.8, width: 1 },
	{ keyCode: "'", display: "'", row: 2, col: 11.8, width: 1 },
	{ keyCode: 'Enter', display: 'Enter', row: 2, col: 12.8, width: 2.2, special: true },

	// ZXCV row
	{ keyCode: 'Shift', display: 'Shift', row: 3, col: 0, width: 2.3, special: true },
	{ keyCode: 'z', display: 'Z', row: 3, col: 2.3, width: 1 },
	{ keyCode: 'x', display: 'X', row: 3, col: 3.3, width: 1 },
	{ keyCode: 'c', display: 'C', row: 3, col: 4.3, width: 1 },
	{ keyCode: 'v', display: 'V', row: 3, col: 5.3, width: 1 },
	{ keyCode: 'b', display: 'B', row: 3, col: 6.3, width: 1 },
	{ keyCode: 'n', display: 'N', row: 3, col: 7.3, width: 1 },
	{ keyCode: 'm', display: 'M', row: 3, col: 8.3, width: 1 },
	{ keyCode: ',', display: ',', row: 3, col: 9.3, width: 1 },
	{ keyCode: '.', display: '.', row: 3, col: 10.3, width: 1 },
	{ keyCode: '/', display: '/', row: 3, col: 11.3, width: 1 },
	{ keyCode: 'Shift', display: 'Shift', row: 3, col: 12.3, width: 2.7, special: true },

	// Space row
	{ keyCode: 'Control', display: 'Ctrl', row: 4, col: 0, width: 1.2, special: true },
	{ keyCode: 'Alt', display: 'Alt', row: 4, col: 1.2, width: 1.2, special: true },
	{ keyCode: ' ', display: 'Space', row: 4, col: 2.4, width: 5.2 },
	{ keyCode: 'Alt', display: 'Alt', row: 4, col: 7.6, width: 1.2, special: true },
	{ keyCode: 'Control', display: 'Ctrl', row: 4, col: 8.8, width: 1.2, special: true },
]

export default class QwertyKeyboard extends AbstractInteractive {
	static uniqueID: number = 0

	keyMap: Map<string, Element> = new Map()
	htmlElement!: DocumentFragment
	svgString!: string
	keyElements: Element[] = []

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
		return 'QWERTY Keyboard'
	}

	constructor() {
		super()
		const unique = `qwerty-keyboard-${QwertyKeyboard.uniqueID++}`
		const { svg } = this.createKeyboard()

		this.htmlElement = document.createDocumentFragment()
		const keyboardElement = this.htmlElement.appendChild(document.createElement('div'))
		keyboardElement.className = 'qwerty-keyboard'
		keyboardElement.setAttribute('data-keyboard', 'qwerty')
		keyboardElement.innerHTML = svg
		this.keyElements = Array.from(keyboardElement.querySelectorAll('.qwerty-key'))

		this.keyMap = new Map()
		this.keyElements.forEach((value) => {
			const keyCode = value.getAttribute('data-key-code')
			if (keyCode) {
				this.keyMap.set(keyCode, value)
			}
		})

		this.svgString = svg
	}

	private createKeyboard(keySize: number = 40, keySpacing: number = 2, rowSpacing: number = 8): { svg: string } {
		const rows: { [key: number]: QwertyKeyInfo[] } = {}

		// Group keys by row
		QWERTY_LAYOUT.forEach((key) => {
			if (!rows[key.row]) {
				rows[key.row] = []
			}
			rows[key.row].push(key)
		})

		let maxCol = 0
		QWERTY_LAYOUT.forEach((key) => {
			const endCol = key.col + (key.width || 1)
			if (endCol > maxCol) {
				maxCol = endCol
			}
		})

		const totalWidth = maxCol * keySize + (maxCol - 1) * keySpacing + 20
		const totalHeight = 5 * keySize + 4 * rowSpacing + 20

		const keyElements: string[] = []

		QWERTY_LAYOUT.forEach((key) => {
			const x = 10 + key.col * (keySize + keySpacing)
			const y = 10 + key.row * (keySize + rowSpacing)
			const width = (key.width || 1) * keySize + (key.width ? (key.width - 1) * keySpacing : 0)

			const isSpecial = key.special || false
			const normalizedKeyCode = this.normalizeKeyCode(key.keyCode)

			keyElements.push(this.createKey(key, x, y, width, keySize, normalizedKeyCode))
		})

		const svg = `<svg 
					xmlns="http://www.w3.org/2000/svg" 
					class="qwerty-keys" 
					viewBox="0 0 ${totalWidth} ${totalHeight}" 
					draggable="false">
					<defs>
						<style>
							.qwerty-key { transition: fill 0.05s, box-shadow 0.05s; }
							.qwerty-key.active { fill: #4CAF50; }
						</style>
					</defs>
					${keyElements.join('')}
				</svg>`

		return { svg }
	}

	private normalizeKeyCode(keyCode: string): string {
		// Normalize key codes for matching
		const lowerCode = keyCode.toLowerCase()
		if (lowerCode === ' ') return ' '
		if (lowerCode === 'control') return 'Control'
		if (lowerCode === 'alt') return 'Alt'
		if (lowerCode === 'shift') return 'Shift'
		return lowerCode
	}

	private createKey(key: QwertyKeyInfo, x: number, y: number, width: number, height: number, normalizedKeyCode: string): string {
		const isSpecial = key.special || false
		const fillColor = isSpecial ? '#555' : '#ccc'
		const textColor = isSpecial ? '#fff' : '#000'

		return `<g class="qwerty-key-group" data-key-code="${key.keyCode}">
					<rect 
						x="${x}" 
						y="${y}" 
						width="${width}" 
						height="${height}" 
						rx="4"
						class="qwerty-key"
						data-key-code="${key.keyCode}"
						fill="${fillColor}"
						stroke="#999"
						stroke-width="1"
						style="cursor: pointer; user-select: none;"
					/>
					<text 
						x="${x + width / 2}" 
						y="${y + height / 2 + 5}" 
						text-anchor="middle"
						dominant-baseline="middle"
						class="qwerty-key-label"
						font-size="12"
						font-family="Arial, sans-serif"
						fill="${textColor}"
						pointer-events="none"
					>${key.display}</text>
				</g>`
	}

	/**
	 * Set a key as active (visually indicate it's pressed)
	 * @param keyCode - The keyboard key code
	 */
	setKeyAsActive(keyCode: string): void {
		const normalizedKeyCode = this.normalizeKeyCode(keyCode)
		const key = this.keyMap.get(normalizedKeyCode)

		if (key) {
			const rect = key instanceof SVGElement ? key : (key as any).querySelector('.qwerty-key')
			if (rect && rect instanceof Element) {
				rect.classList.add('active')
			}
		}
	}

	/**
	 * Set a key as inactive (visually indicate it's released)
	 * @param keyCode - The keyboard key code
	 */
	setKeyAsInactive(keyCode: string): void {
		const normalizedKeyCode = this.normalizeKeyCode(keyCode)
		const key = this.keyMap.get(normalizedKeyCode)

		if (key) {
			const rect = key instanceof SVGElement ? key : (key as any).querySelector('.qwerty-key')
			if (rect && rect instanceof Element) {
				rect.classList.remove('active')
			}
		}
	}

	/**
	 * Clear all active keys
	 */
	clearAllKeys(): void {
		this.keyElements.forEach((element) => {
			const rect = element instanceof SVGElement ? element : (element as any).querySelector('.qwerty-key')
			if (rect) {
				rect.classList.remove('active')
			}
		})
	}

	destroy(): void {
		this.keyElements = []
		this.keyMap.clear()
	}
}
