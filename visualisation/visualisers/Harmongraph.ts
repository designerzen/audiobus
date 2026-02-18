/**
 * Harmonic graph visualiser
 * Creates a Lissajous-like pattern based on harmonic ratios
 */
import { Visualiser } from './Visualiser.ts'

export class Harmongraph extends Visualiser {
  public xRatio: number = 3
  public xPhase: number = 0

  public yRatio: number = 2
  public yPhase: number = 0

  public zRatio: number = 3
  public zPhase: number = 0

  public amplitude: number = 150
  public decay: number = 2 / 10000

  // Appearance
  public opacity: number = 255
  public red: number = 55
  public green: number = 55
  public blue: number = 55

  public sectionLength: number = 20
  public deg2rad: number = Math.PI / 180

  constructor() {
    super('Harmongraph')
  }

  public update(spectrum: Uint8Array, time: number, bufferLength: number): void {
    const limit: number = bufferLength
    const quantity: number = limit * 8
    let x: number, y: number
    let a: number = this.amplitude
    let s: number = 0
    const alpha: number = this.opacity

    // Clear screen
    this.bitmapData = this.context.createImageData(this.bitmapData)

    for (let t = 0; t < quantity; ++t) {
      const peak: number = spectrum[t % limit] / 255
      const level: number = 0.5 + 2 * peak
      const sector: number = 1

      x =
        level * a * Math.sin(this.xRatio * t * this.deg2rad + this.xPhase) +
        a * Math.sin(this.zRatio * t * this.deg2rad + this.zPhase)
      y = level * a * Math.sin(this.yRatio * t * this.deg2rad + this.yPhase)

      a *= 1 - this.decay

      this.drawPixel(
        this.centreX + sector * x,
        this.centreY + sector * y,
        (1 - peak) * this.red,
        (1 - peak) * this.green,
        (1 - peak) * this.blue,
        alpha
      )

      s++

      if (s === this.sectionLength) {
        s = 0
      }
    }

    // Draw shapes to canvas
    this.context.putImageData(this.bitmapData, 0, 0)
    super.update(spectrum, time, bufferLength)
  }
}
