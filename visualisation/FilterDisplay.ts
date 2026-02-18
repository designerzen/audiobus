/**
 * Filter Display
 * Visualizes frequency response of a biquad filter
 */
export class FilterDisplay {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D

  private myFrequencyArray: Float32Array
  private magResponseOutput: Float32Array
  private phaseResponseOutput: Float32Array

  private resolution: number

  public get element(): HTMLCanvasElement {
    return this.canvas
  }

  constructor(width: number, height: number, bars: number = 100) {
    const canvas: HTMLCanvasElement = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')

    canvas.width = width
    canvas.height = height
    this.canvas = canvas
    this.context = ctx
    this.resolution = bars

    // Array containing all the frequencies we want to get response for
    this.myFrequencyArray = new Float32Array(bars)
    for (let i = 0; i < bars; ++i) {
      this.myFrequencyArray[i] = (2000 / bars) * (i + 1)
    }

    // We receive the result in these two arrays
    this.magResponseOutput = new Float32Array(bars)
    this.phaseResponseOutput = new Float32Array(bars)
  }

  private drawFrequencyResponse(mag: Float32Array, phase: Float32Array): void {
    const barWidth: number = this.canvas.width / this.resolution
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Magnitude response
    this.context.strokeStyle = 'white'
    this.context.beginPath()
    for (let frequencyStep = 0; frequencyStep < this.resolution; ++frequencyStep) {
      this.context.lineTo(
        frequencyStep * barWidth,
        this.canvas.height - mag[frequencyStep] * this.canvas.height
      )
    }
    this.context.stroke()

    // Phase response
    this.context.strokeStyle = 'red'
    this.context.beginPath()

    for (let frequencyStep = 0; frequencyStep < this.resolution; ++frequencyStep) {
      this.context.lineTo(
        frequencyStep * barWidth,
        this.canvas.height - ((phase[frequencyStep] * 90 + 300) / Math.PI)
      )
    }
    this.context.stroke()
  }

  public updateFrequencyResponse(filter: BiquadFilterNode): void {
    filter.getFrequencyResponse(this.myFrequencyArray, this.magResponseOutput, this.phaseResponseOutput)
    this.drawFrequencyResponse(this.magResponseOutput, this.phaseResponseOutput)
  }
}
