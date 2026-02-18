/**
 * Example Visualiser
 * Demonstrates different visualisation modes
 */
import { SpectrumAnalyzer } from './SpectrumAnalyzer.ts'

import { Bars } from './visualisers/Bars.ts'
import { Harmongraph } from './visualisers/Harmongraph.ts'
import { Scope } from './visualisers/Scope.ts'
import { Plasma } from './visualisers/Plasma.ts'
import { Visualiser } from './visualisers/Visualiser.ts'

import type { Colour } from './colour/Colour.ts'
import { Rainbows } from './colour/Rainbows.ts'

export class ExampleVisualiser {
  private analyser: SpectrumAnalyzer

  private harmongraph: Harmongraph
  private bars: Bars
  private scope: Scope
  private plasma: Plasma

  private visualisers: Visualiser[] = []
  private activeVisualiser: Visualiser

  private counter: number = 0
  private count: number = 1

  private rainbow: Colour[]

  private visualiserCanvas: HTMLCanvasElement

  public get canvas(): HTMLCanvasElement {
    return this.visualiserCanvas
  }

  constructor(
    audioContext: AudioContext,
    source: GainNode,
    type: string = SpectrumAnalyzer.TYPE_FREQUENCY,
    fftSize: number = 1024
  ) {
    this.analyser = new SpectrumAnalyzer(audioContext, type)

    this.visualiserCanvas = this.analyser.createCanvas(
      window.innerWidth,
      window.innerHeight,
      'visualiser'
    )
    this.rainbow = Rainbows.colour()

    this.analyser.connect(audioContext.destination, source)
    this.analyser.setFidelity(fftSize)

    // Add visualisers
    this.harmongraph = new Harmongraph()
    this.harmongraph.red = 0
    this.harmongraph.green = 255
    this.harmongraph.blue = 120
    this.analyser.append(this.harmongraph)
    this.visualisers.push(this.harmongraph)

    this.bars = new Bars()
    this.visualisers.push(this.bars)

    this.scope = new Scope()
    this.visualisers.push(this.scope)

    this.plasma = new Plasma()
    this.visualisers.push(this.plasma)

    this.counter = 0
    this.activeVisualiser = this.visualisers[this.counter]
  }

  public start(): void {
    this.analyser.onanalysis = (spectrum: Uint8Array) => {
      this.update(spectrum)
    }
    this.analyser.start()
  }

  public update(spectrum: Uint8Array): void {
    switch (this.activeVisualiser) {
      case this.harmongraph:
        const index: number = Math.round(this.count * 0.0005) % 255
        const colour: Colour = this.rainbow[index]

        this.harmongraph.red = colour.red
        this.harmongraph.green = colour.green
        this.harmongraph.blue = colour.blue

        this.harmongraph.zRatio = 1 + ((this.count++ / 1208) % 1200)
        this.harmongraph.xPhase += 0.0003
        this.harmongraph.yPhase += 0.0002
        this.harmongraph.zPhase += 0.0001
        break

      case this.bars:
      case this.scope:
        break
    }
  }

  public next(): void {
    this.counter = (this.counter + 1) % this.visualisers.length
    this.activeVisualiser = this.visualisers[this.counter]
    this.analyser.solo(this.activeVisualiser)
    console.log(
      `${this.counter}/${this.visualisers.length}. activeVisualiser`,
      this.activeVisualiser
    )
  }
}
