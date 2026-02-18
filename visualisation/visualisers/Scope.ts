/**
 * Scope visualiser
 * Displays audio waveform as an oscilloscope
 */
import { Visualiser } from './Visualiser.ts'

export class Scope extends Visualiser {
  // Appearance
  public opacity: number = 255
  public red: number = 55
  public green: number = 55
  public blue: number = 55
  public thickness: number = 3

  constructor() {
    super('Scope')
  }

  public update(spectrum: Uint8Array, time: number, bufferLength: number): void {
    this.context.lineWidth = this.thickness
    this.context.strokeStyle = `rgb(${this.red},${this.green},${this.blue})`
    this.context.beginPath()

    const sliceWidth: number = (this.width * 1.0) / bufferLength
    let x: number = 0

    for (let i: number = 0; i < bufferLength; i++) {
      const v: number = spectrum[i] / 128
      const y: number = v * this.centreY

      if (i === 0) {
        this.context.moveTo(x, y)
      } else {
        this.context.lineTo(x, y)
      }

      x += sliceWidth
    }

    this.context.lineTo(this.width, this.centreY)
    this.context.stroke()

    super.update(spectrum, time, bufferLength)
  }
}
