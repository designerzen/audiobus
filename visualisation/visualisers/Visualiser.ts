/**
 * Base class for all visualisers
 * To view a visualiser, simply add the canvas element to the stage
 */
import type { IVisualiser } from './IVisualiser.ts'

export class Visualiser implements IVisualiser {
  public context!: CanvasRenderingContext2D
  public canvas!: HTMLCanvasElement
  public bitmapData!: ImageData

  public name: string = 'Visualiser'
  public width!: number
  public height!: number

  public centreX!: number
  public centreY!: number

  // Linked List
  public next?: Visualiser
  public previous?: Visualiser

  public master: boolean = false

  constructor(title: string) {
    this.name = title
  }

  public toString(): string {
    let vis: Visualiser = this
    let counter: number = 1
    let output: string = 'Visualisers\n'

    while (vis.previous) {
      vis = vis.previous
      output += `${counter++}. name: ${vis.name}\n`
    }

    vis = this
    output += `${counter++}. name: **${vis.name}**\n`

    while (vis.next) {
      vis = vis.next
      output += `${counter++}. name: ${vis.name}\n`
    }

    return output
  }

  public unlink(): Visualiser {
    if (this.previous && this.next) {
      this.previous.next = this.next
      this.next.previous = this.previous
    } else if (!this.previous && this.next) {
      this.next.previous = undefined
    } else if (this.previous && !this.next) {
      this.previous.next = undefined
    }
    return this
  }

  public createCanvas(width: number = 256, height: number = 256): void {
    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height

    document.body.appendChild(this.canvas)

    this.setCanvas(this.canvas)
  }

  public setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Could not get 2D context')
    this.context = ctx
    this.width = this.canvas.width
    this.height = this.canvas.height
    this.centreX = this.width / 2
    this.centreY = this.height / 2
    this.bitmapData = this.context.getImageData(0, 0, this.width, this.height)
  }

  public setAsMaster(): Visualiser {
    let vis: Visualiser = this
    let head: Visualiser = this
    let tail: Visualiser = this

    while (vis.previous) {
      vis = vis.previous
      vis.master = false
      vis.setCanvas(this.canvas)
      head = vis
    }

    vis = this

    while (vis.next) {
      vis = vis.next
      vis.master = false
      vis.setCanvas(this.canvas)
      tail = vis
    }

    this.master = true
    console.error(head, tail)
    return this
  }

  public appendSlave(slave: Visualiser): Visualiser {
    let vis: Visualiser = this
    while (vis.next) {
      vis = vis.next
    }
    vis.next = slave
    slave.previous = vis
    slave.setCanvas(this.canvas)
    console.error(vis)
    return this
  }

  public prependSlave(slave: Visualiser): Visualiser {
    let vis: Visualiser = this
    while (vis.previous) {
      vis = vis.previous
    }
    vis.previous = slave
    slave.next = vis
    slave.setCanvas(this.canvas)
    console.error('prependSlave', vis.previous)
    return this
  }

  public drawPixel(
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    alpha: number
  ): void {
    x = x >> 0
    y = y >> 0
    const i: number = (x + y * this.width) * 4
    this.bitmapData.data[i + 0] = r
    this.bitmapData.data[i + 1] = g
    this.bitmapData.data[i + 2] = b
    this.bitmapData.data[i + 3] = alpha
  }

  public clearScreen(): void {
    this.context.save()
    this.context.setTransform(1, 0, 0, 1, 0, 0)
    this.context.clearRect(0, 0, this.width, this.height)
    this.context.restore()
  }

  public update(spectrum: Uint8Array, time: number, bufferLength: number): void {
    if (this.next) {
      this.next.update(spectrum, time, bufferLength)
    }
  }
}
