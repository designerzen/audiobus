/**
 * Spectrum Analyzer
 * Analyzes audio frequency data and manages visualizer chain
 */
import type { IVisualiser } from './visualisers/IVisualiser.ts'
import { Visualiser } from './visualisers/Visualiser.ts'
import { TimeNow } from '../timing/TimeNow.ts'

export class SpectrumAnalyzer {
  private audioContext: AudioContext
  public analyser: AnalyserNode
  public frequencyData: Uint8Array

  private visualContext!: CanvasRenderingContext2D
  public canvas!: HTMLCanvasElement

  private running: boolean = false
  private sampleRate: number
  private type: string

  public head?: Visualiser
  public tail?: Visualiser

  public onanalysis: ((data: Uint8Array) => void) | null = null

  public static readonly TYPE_FREQUENCY: string = 'frequency'
  public static readonly TYPE_TIME_DOMAIN: string = 'fft'

  constructor(
    audioContext: AudioContext,
    type: string = SpectrumAnalyzer.TYPE_FREQUENCY,
    fftSize: number = 1024
  ) {
    this.type = type
    this.audioContext = audioContext
    this.analyser = audioContext.createAnalyser()
    this.analyser.smoothingTimeConstant = 0.85

    this.sampleRate = audioContext.sampleRate

    // Store initial data
    this.setFidelity(fftSize)
  }

  public setFidelity(fftSize: number): void {
    switch (this.type) {
      case SpectrumAnalyzer.TYPE_FREQUENCY:
        this.analyser.fftSize = fftSize
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
        this.analyser.getByteFrequencyData(this.frequencyData)
        break

      case SpectrumAnalyzer.TYPE_TIME_DOMAIN:
        this.analyser.fftSize = fftSize
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount)
        this.analyser.getByteTimeDomainData(this.frequencyData)
        break
    }
  }

  public connect(outputTo: AudioNode, source?: AudioNode): void {
    if (source) {
      source.connect(this.analyser)
    }
    this.analyser.connect(outputTo)
  }

  public createCanvas(
    width: number = 256,
    height: number = 256,
    id: string = 'audiobus-visualiser'
  ): HTMLCanvasElement {
    if (!this.checkCanvasExists(id)) {
      this.canvas = document.createElement('canvas')
      this.canvas.id = id
      this.canvas.className = 'audiobus-visualisation'
      document.body.appendChild(this.canvas)
    } else {
      this.canvas = document.getElementById(id) as HTMLCanvasElement
    }

    this.canvas.width = width
    this.canvas.height = height

    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.visualContext = ctx
    return this.canvas
  }

  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.visualContext = ctx
  }

  public checkCanvasExists(id: string): boolean {
    const element = document.getElementById(id)
    return element != null
  }

  public setSize(width: number = 256, height: number = 256): void {
    this.canvas.width = width
    this.canvas.height = height
  }

  public solo(slave: Visualiser): void {
    this.tail = this.head = slave
    slave.setCanvas(this.canvas)
  }

  public append(slave: Visualiser): void {
    if (!this.tail) {
      this.tail = this.head = slave
      slave.setCanvas(this.canvas)
      return
    }

    this.tail.next = slave
    slave.previous = this.tail
    this.tail = slave

    slave.setCanvas(this.canvas)
    console.error(slave)
  }

  public prepend(slave: Visualiser): void {
    if (!this.head) {
      this.tail = this.head = slave
      slave.setCanvas(this.canvas)
      return
    }

    this.head.previous = slave
    slave.next = this.head
    this.head = slave
    slave.setCanvas(this.canvas)
    console.error('prependSlave', slave)
  }

  public start(): void {
    this.running = true
    this.update()
  }

  public stop(): void {
    this.running = false
  }

  private update(): void {
    if (this.running) {
      // Get frequency data
      if (this.type === SpectrumAnalyzer.TYPE_FREQUENCY) {
        this.analyser.getByteFrequencyData(this.frequencyData)
      } else {
        this.analyser.getByteTimeDomainData(this.frequencyData)
      }

      // Update visualizers
      let vis = this.head
      if (vis) {
        this.visualContext.fillStyle = 'rgb(0, 0, 0)'
        this.visualContext.fillRect(0, 0, vis.width, vis.height)

        while (vis) {
          vis.update(this.frequencyData, TimeNow(), this.analyser.frequencyBinCount)
          vis = vis.next
        }
      }

      // Send out analysis data
      if (this.onanalysis) {
        this.onanalysis(this.frequencyData)
      }

      requestAnimationFrame(() => this.update())
    }
  }
  }
