/**
 * Bars visualiser
 * Displays spectrum as vertical bars with rainbow colouring
 */
import { Visualiser } from './Visualiser.ts'
import type { Colour } from '../colour/Colour.ts'
import { Rainbows } from '../colour/Rainbows.ts'

export class Bars extends Visualiser {
  // Appearance
  public opacity: number = 255
  public red: number = 55
  public green: number = 55
  public blue: number = 55
  public rainbow?: Colour[]

  constructor() {
    super('Bars')
  }

  public update(spectrum: Uint8Array, time: number, bufferLength: number): void {
    if (!this.rainbow) {
      this.rainbow = Rainbows.colour()
    }

    const barWidth: number = this.width / bufferLength
    let x: number = 0

    for (let i: number = 0; i < bufferLength; i++) {
      const percent: number = i / bufferLength
      const block: number = (percent * 255) >> 0
      const colour: Colour = this.rainbow[block]
      const barHeight: number = spectrum[i]

      this.context.fillStyle = colour.toRGBA(barHeight + 100)
      this.context.fillRect(x, this.height - barHeight, barWidth, barHeight)

      x += barWidth + 1
    }

    super.update(spectrum, time, bufferLength)
  }
}
