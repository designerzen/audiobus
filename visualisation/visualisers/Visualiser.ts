import type { IVisualiser } from "./IVisualiser.ts"
import { RenderSurface, type VisualisationMode } from "../renderers/RenderSurface.ts"

/** A layer in an analyser-owned rendering chain. Rendering never advances the chain. */
export class Visualiser implements IVisualiser {
	public canvas!: HTMLCanvasElement
	public next?: Visualiser
	public previous?: Visualiser
	public master = false
	public red = 55
	public green = 55
	public blue = 55
	public opacity = 255
	public thickness = 2
	public readonly dataDomain: "frequency" | "time" = "frequency"
	protected surface?: RenderSurface
	private ownsSurface = false
	get width(): number {
		return this.canvas?.width ?? 0
	}
	get height(): number {
		return this.canvas?.height ?? 0
	}
	get centreX(): number {
		return this.width / 2
	}
	get centreY(): number {
		return this.height / 2
	}
	get ready(): Promise<void> {
		return this.surface?.ready ?? Promise.resolve()
	}
	get backend() {
		return this.surface?.backend ?? "pending"
	}
	constructor(public name = "Visualiser") {}
	toString(): string {
		return this.name
	}
	unlink(): Visualiser {
		if (this.previous) {
			this.previous.next = this.next
		}
		if (this.next) {
			this.next.previous = this.previous
		}
		this.next = this.previous = undefined
		return this
	}
	createCanvas(width = 256, height = 256): void {
		const canvas = document.createElement("canvas")
		canvas.width = width
		canvas.height = height
		canvas.setAttribute("role", "img")
		canvas.setAttribute("aria-label", this.name)
		document.body.appendChild(canvas)
		this.setCanvas(canvas)
	}
	setCanvas(canvas: HTMLCanvasElement, surface?: RenderSurface): void {
		if (this.canvas === canvas && (!surface || this.surface === surface)) {
			return
		}
		if (this.ownsSurface) {
			this.surface?.dispose()
		}
		this.canvas = canvas
		this.surface = surface ?? new RenderSurface(canvas)
		this.ownsSurface = !surface
	}
	setAsMaster(): Visualiser {
		this.master = true
		let head: Visualiser = this
		while (head.previous) {
			head = head.previous
		}
		for (let vis: Visualiser | undefined = head; vis; vis = vis.next) {
			if (vis !== this) {
				vis.master = false
			}
			vis.setCanvas(this.canvas, this.surface)
		}
		return this
	}
	appendSlave(slave: Visualiser): Visualiser {
		this.assertSeparate(slave)
		slave.unlink()
		let tail: Visualiser = this
		while (tail.next) {
			tail = tail.next
		}
		tail.next = slave
		slave.previous = tail
		if (this.canvas) {
			slave.setCanvas(this.canvas, this.surface)
		}
		return this
	}
	prependSlave(slave: Visualiser): Visualiser {
		this.assertSeparate(slave)
		slave.unlink()
		let head: Visualiser = this
		while (head.previous) {
			head = head.previous
		}
		head.previous = slave
		slave.next = head
		if (this.canvas) {
			slave.setCanvas(this.canvas, this.surface)
		}
		return this
	}
	private assertSeparate(slave: Visualiser): void {
		let head: Visualiser = this
		while (head.previous) {
			head = head.previous
		}
		for (let vis: Visualiser | undefined = head; vis; vis = vis.next) {
			if (vis === slave) {
				throw new Error("Visualiser already belongs to this chain")
			}
		}
	}
	protected render(
		mode: VisualisationMode,
		data: Uint8Array<ArrayBuffer>,
		time: number,
		amplitude = 150,
		decay = 0.0002,
		ratios = [3, 2, 3],
		phases = [0, 0, 0]
	): void {
		if (!this.surface) {
			return
		}
		if (this.ownsSurface) {
			this.surface.beginFrame()
		}
		this.surface.add({
			mode,
			data,
			time,
			colour: [
				this.red / 255,
				this.green / 255,
				this.blue / 255,
				Math.max(0, Math.min(1, this.opacity / 255))
			],
			thickness: this.thickness,
			amplitude,
			decay,
			ratios,
			phases
		})
		if (this.ownsSurface) {
			this.surface.endFrame()
		}
	}
	update(_spectrum: Uint8Array<ArrayBuffer>, _time: number, _bufferLength: number): void {}
	dispose(): void {
		this.unlink()
		if (this.ownsSurface) {
			this.surface?.dispose()
		}
		this.surface = undefined
	}
}