import type { InstrumentNote } from "../../interfaces/instrument.ts"

/** The site's SVGKeyboard artwork, without interaction, audio or DOM side effects. */
export function createKeyboardSVG(
    keys: readonly InstrumentNote[],
    options: {
        titleID?: string
        descriptionID?: string
        whiteKeyWidth?: number
        blackKeyWidth?: number
        whiteKeyHeight?: number
        blackKeyScale?: number
        indicatorWidth?: number
        x?: number
        y?: number
        orientation?: "horizontal" | "vertical"
    } = {},
) {
    const {
        titleID = "keyboard-title",
        descriptionID = "keyboard-desc",
        whiteKeyWidth = 23,
        blackKeyWidth = 13,
        whiteKeyHeight = 140,
        blackKeyScale = 0.5,
        indicatorWidth = 8,
        y = 20,
    } = options
    let x = options.x ?? 0
    let left = x,
        right = x
    const whiteKeyElements: string[] = [],
        blackKeyElements: string[] = [],
        keyElements: string[] = [],
        indicators: string[] = []
    for (const key of keys) {
        const black = [1, 3, 6, 8, 10].includes(key.noteNumber % 12)
        const keyX = black ? x - blackKeyWidth / 2 : x
        const width = black ? blackKeyWidth : whiteKeyWidth
        const height = black ? whiteKeyHeight * blackKeyScale : whiteKeyHeight
        const label = `${key.noteKey.replace("#", " sharp")}, octave ${key.octave}`
        const element = `<rect x="${keyX}" y="${y}" rx="6" width="${width}" height="${height}" role="button" tabindex="-1" aria-label="${label}" class="piano-key piano-key-${black ? "black" : "white"}" data-key="${key.noteKey}" data-note="${key.noteName}" data-number="${key.noteNumber}" data-frequency="${key.frequency}" data-octave="${key.octave}"></rect>`
        ;(black ? blackKeyElements : whiteKeyElements).push(element)
        keyElements.push(element)
        indicators.push(
            `<circle cx="${keyX + width / 2}" cy="${y - 10}" r="${indicatorWidth / 2}" class="piano-note-indicator" data-number="${key.noteNumber}" aria-hidden="true"></circle>`,
        )
        left = Math.min(left, keyX)
        right = Math.max(right, keyX + width)
        if (!black) x += whiteKeyWidth
    }
    // Include the first/last accidental, full key height, indicators and focus strokes.
    const width = Math.max(blackKeyWidth, right - left) + 8
    const height = y + whiteKeyHeight + 4
    const vertical = options.orientation === "vertical"
    const viewBox = vertical ? `0 0 ${height} ${width}` : `${left - 4} 0 ${width} ${height}`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="piano-keys" role="group" viewBox="${viewBox}" aria-labelledby="${titleID}" aria-describedby="${descriptionID}" draggable="false">
      <title id="${titleID}">Piano keyboard with ${keys.length} keys</title>
      <desc id="${descriptionID}">Use arrow keys to move between notes. Hold Enter or Space to play. Touch or drag keys to play.</desc>
      <g${vertical ? ` transform="matrix(0 -1 1 0 0 ${width + left - 4})"` : ""}>
      <g class="piano-key-notes piano-keys-white">${whiteKeyElements.join("")}</g>
      <g class="piano-key-notes piano-keys-black">${blackKeyElements.join("")}</g>
      <g class="piano-key-indicators" aria-hidden="true">${indicators.join("")}</g>
      </g>
    </svg>`
    return { svg, keyElements, whiteKeyElements, blackKeyElements, width }
}