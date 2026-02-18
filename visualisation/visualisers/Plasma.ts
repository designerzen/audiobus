/**
 * Plasma visualiser
 * Creates an animated plasma effect using sine waves
 */
import { Visualiser } from './Visualiser.ts'

export class Plasma extends Visualiser {
  private palette: number[] = []
  private paletteReds: number[] = []
  private paletteGreens: number[] = []
  private paletteBlues: number[] = []
  private sineTable: number[] = []

  private pos1: number = 0
  private pos2: number = 0

  constructor() {
    super('Plasma')
    this.createTable()
  }

  private createTable(): void {
    // Initialize sine table
    for (let i = 0; i < 512; ++i) {
      const rad: number = i * 0.703125 * 0.0174532
      this.sineTable[i] = Math.sin(rad) * 1024
    }

    // Initialize color palette
    for (let i = 0; i < 64; ++i) {
      // Red section
      let r: number = i << 2
      let g: number = 255 - ((i << 2) + 1)
      let b: number = 0
      this.palette[i] = (r << 16) | (g << 8) | b
      this.paletteReds[i] = r
      this.paletteGreens[i] = g
      this.paletteBlues[i] = b

      // Red to Yellow section
      r = 255
      g = (i << 2) + 1
      this.palette[i + 64] = (r << 16) | (g << 8) | b
      this.paletteReds[i + 64] = r
      this.paletteGreens[i + 64] = g
      this.paletteBlues[i + 64] = b

      // Yellow to Green section
      r = 255 - ((i << 2) + 1)
      g = r
      b = 0
      this.palette[i + 128] = (r << 16) | (g << 8) | b
      this.paletteReds[i + 128] = r
      this.paletteGreens[i + 128] = g
      this.paletteBlues[i + 128] = b

      // Green section
      r = 0
      g = (i << 2) + 1
      b = 0
      this.palette[i + 192] = (r << 16) | (g << 8) | b
      this.paletteReds[i + 192] = r
      this.paletteGreens[i + 192] = g
      this.paletteBlues[i + 192] = b
    }
  }

  public update(spectrum: Uint8Array, time: number, bufferLength: number): void {
    let tp3: number = this.pos2

    for (let i = 0; i < 360; ++i) {
      let tp1: number = this.pos1 + 5
      let tp2: number = 3
      tp3 &= 511
      let tp4: number = 0
      tp4 &= 511

      for (let j = 0; j < 480; ++j) {
        tp1 &= 511
        tp2 &= 511

        const p: number =
          (128 +
            ((this.sineTable[tp1] +
              this.sineTable[tp2] +
              this.sineTable[tp3] +
              this.sineTable[tp4]) >>
              4)) &
          255

        this.drawPixel(
          j,
          i,
          this.paletteReds[p],
          this.paletteGreens[p],
          this.paletteBlues[p],
          255
        )

        tp1 += 5
        tp2 += 3
      }

      tp3++
      tp4 += 3
    }

    this.pos1 += 9
    this.pos2 += 8

    // Tile the pattern across the canvas
    let columnX: number = 0
    while (columnX < this.width) {
      let rowY: number = 0
      while (rowY < this.height) {
        this.context.putImageData(this.bitmapData, columnX, rowY)
        rowY += 360
      }
      columnX += 480
    }

    super.update(spectrum, time, bufferLength)
  }
}
