import type { IAudioOutput } from "./output-interface"
import type { IAudioCommand } from "../../audio-command-interface"
import type { AudioClockTick } from "../../timing/audio-clock-tick"
import type { HarmonicState } from "../harmony"
import { NOTE_ON, NOTE_OFF } from "../../commands"
import { action, devicePanel } from "../device-controls"
import { TreeModel, TREE_SPEED, branchPoint } from "./tree-model"
import { createTreeRenderer, TREE_INSTANCE_CAPACITY, type TreeRenderer } from "./tree-renderer"

type Color = readonly [number, number, number]
// Pitch-class hue follows the application's note colour wheel; velocity controls geometry.
const NOTE_COLORS: Color[] = Array.from({ length: 12 }, (_, note) => {
	const hue = note / 2
	const x = 1 - Math.abs((hue % 2) - 1)
	const rgb = [
		[1, x, 0],
		[x, 1, 0],
		[0, 1, x],
		[0, x, 1],
		[x, 0, 1],
		[1, 0, x]
	][Math.floor(hue)]
	return rgb.map((value) => 0.24 + value * 0.68) as [number, number, number]
})
const BARK: Color = [0.64, 0.48, 0.31]
const WATER: Color = [0.4, 0.8, 0.98]

interface TreeOptions {
	audioContext?: Pick<AudioContext, "currentTime">
	now?: () => number
}

export default class OutputSongTree implements IAudioOutput {
	readonly uuid = `Output-SongTree-${crypto.randomUUID()}`
	readonly name = "Song Tree"
	readonly description = "Grow a living tree from notes, chords, velocity and the transport beat"
	readonly isHidden = false
	readonly requiresConnectionControl = false
	readonly configurationAffectsNoteRouting = false
	readonly model = new TreeModel()
	private connected = true
	private gui?: HTMLElement
	private canvas?: HTMLCanvasElement
	private status?: HTMLElement
	private renderer?: TreeRenderer
	private observer?: ResizeObserver
	private frame = 0
	private generation = 0
	private recovering = false
	private width = 480
	private height = 420
	private instances = new Float32Array(TREE_INSTANCE_CAPACITY * 12)
	private count = 0
	private beatPeriod = 0.5
	private beatAnchor: number
	private cameraX = 0
	private cameraY = 0
	private lastFrame = 0

	constructor(private readonly options: TreeOptions = {}) {
		this.beatAnchor = this.now
	}
	private get now(): number {
		return this.options.now?.() ?? performance.now() / 1000
	}
	get isConnected(): boolean {
		return this.connected
	}
	hasAudioOutput(): boolean {
		return false
	}
	hasMidiOutput(): boolean {
		return false
	}
	getNoteKey(command: IAudioCommand): string {
		return `${command.channel}:${command.number}`
	}
	sendCommand(command: IAudioCommand): void {
		if (!this.connected) {
			return
		}
		if (command.type === NOTE_ON) {
			this.model.noteOn(command.number, command.velocity, command.channel, this.now)
		} else if (command.type === NOTE_OFF) {
			this.model.noteOff(command.number, command.channel, this.now)
		}
	}
	noteOn(note: number, velocity: number): void {
		if (this.connected) {
			this.model.noteOn(note, velocity, 1, this.now)
		}
	}
	noteOff(note: number): void {
		this.model.noteOff(note, 1, this.now)
	}
	allNotesOff(): void {
		this.model.allNotesOff(this.now)
	}
	setHarmony(harmony: HarmonicState): void {
		this.model.harmony = { ...harmony }
	}
	onClockTick(tick: Readonly<AudioClockTick>): void {
		if (
			!this.connected ||
			!Number.isFinite(tick.stepDuration) ||
			tick.stepDuration <= 0 ||
			!Number.isFinite(tick.triggerAt)
		) {
			return
		}
		this.beatPeriod = tick.stepDuration * 4
		// Clock events arrive ahead of the audible beat. Translate audio time to the
		// animation clock instead of landing the droplet when the callback arrives.
		const ahead = this.options.audioContext
			? tick.triggerAt - this.options.audioContext.currentTime
			: 0
		this.beatAnchor = this.now + ahead - (tick.step % 4) * tick.stepDuration
	}
	stopClock(): void {
		this.beatAnchor = this.now
	}

	private segment(
		ax: number,
		ay: number,
		bx: number,
		by: number,
		radius: number,
		color: Color,
		leaf = false
	): void {
		if (this.count >= TREE_INSTANCE_CAPACITY) {
			return
		}
		const i = this.count++ * 12,
			data = this.instances
		data[i] = ax
		data[i + 1] = ay
		data[i + 2] = bx
		data[i + 3] = by
		data[i + 4] = radius
		data[i + 5] = color[0]
		data[i + 6] = color[1]
		data[i + 7] = color[2]
		data[i + 8] = Number(leaf)
	}

	private draw(now: number): void {
		if (!this.renderer || !this.canvas) {
			return
		}
		this.count = 0
		const elapsed = now - (this.lastFrame || now)
		const dt = Math.max(0, Math.min(0.1, elapsed))
		this.lastFrame = now
		const trunk =
			this.model.started === undefined
				? 0
				: Math.max(2, (now - this.model.started) * TREE_SPEED)
		let top = trunk,
			topX = 0
		for (const branch of this.model.held.values()) {
			const tip = branchPoint(branch, now)
			if (tip.y > top) {
				top = tip.y
				topX = tip.x
			}
		}
		const follow = elapsed > 0.5 ? 1 : 1 - Math.exp(-dt * 6)
		this.cameraY += (Math.max(0, top - this.height * 0.52) - this.cameraY) * (dt ? follow : 1)
		this.cameraX += (topX - this.cameraX) * (dt ? follow : 1)
		const center = this.width / 2 - this.cameraX,
			ground = this.height * 0.84 + this.cameraY
		this.segment(0, ground, this.width, ground, 1, [0.18, 0.29, 0.26])
		if (this.model.started === undefined) {
			const phase =
				((((now - this.beatAnchor) % this.beatPeriod) + this.beatPeriod) %
					this.beatPeriod) /
				this.beatPeriod
			const y = 20 + (ground - 20) * phase * phase
			this.segment(center, y - 11, center, y, 4, WATER, true)
			if (phase < 0.22) {
				const size = (phase / 0.22) * 32 + 2
				this.segment(center - size, ground - 1, center + size, ground - 1, 1, WATER)
			}
		} else {
			this.segment(
				center,
				Math.min(this.height + 10, ground),
				center,
				ground - trunk,
				5,
				BARK
			)
			// Newest growth gets the budget first. Offscreen geometry is never submitted.
			for (let index = this.model.branches.length - 1; index >= 0; index--) {
				if (this.count >= TREE_INSTANCE_CAPACITY - 65) {
					break
				}
				const branch = this.model.branches[index],
					end = branch.end ?? now
				const growthStart = branch.forkAt ?? branch.start
				const tip = branchPoint(branch, end)
				if (ground - tip.y > this.height + 24 || ground - branch.origin.y < -24) {
					continue
				}
				const color = NOTE_COLORS[branch.note % 12],
					radius = 0.8 + (branch.velocity / 127) * 4
				const first = Math.max(
					growthStart,
					growthStart + (ground - this.height - 24 - branch.origin.y) / TREE_SPEED
				)
				const last = Math.min(
					end,
					growthStart + (ground + 24 - branch.origin.y) / TREE_SPEED
				)
				const steps = Math.max(1, Math.min(64, Math.ceil((last - first) * 14)))
				let previous = branchPoint(branch, first)
				for (let step = 1; last >= first && step <= steps; step++) {
					const point = branchPoint(branch, first + ((last - first) * step) / steps)
					this.segment(
						center + previous.x,
						ground - previous.y,
						center + point.x,
						ground - point.y,
						radius,
						color
					)
					previous = point
				}
				if (branch.end !== undefined) {
					const size = 4 + (branch.velocity / 127) * 12,
						x = center + tip.x,
						y = ground - tip.y
					this.segment(
						x - branch.side * size * 0.35,
						y + size * 0.7,
						x + branch.side * size * 0.35,
						y - size * 0.7,
						size * 0.42,
						color,
						true
					)
				}
			}
		}
		this.renderer.draw(this.instances, this.count, this.width, this.height)
	}

	private resize(): void {
		if (!this.canvas) {
			return
		}
		const bounds = this.canvas.getBoundingClientRect()
		this.width = Math.max(240, bounds.width || 480)
		this.height = Math.max(240, bounds.height || 420)
		const ratio = Math.min(2, globalThis.devicePixelRatio || 1)
		this.canvas.width = Math.round(this.width * ratio)
		this.canvas.height = Math.round(this.height * ratio)
	}
	private animate = (): void => {
		this.frame = 0
		if (!this.gui || !this.connected || this.recovering) {
			return
		}
		if (!document.hidden && this.canvas?.isConnected) {
			try {
				this.draw(this.now)
			} catch {
				void this.startRenderer(
					this.renderer?.backend === "WebGPU"
						? 1
						: this.renderer?.backend === "WebGL2"
							? 2
							: 3
				)
				return
			}
		}
		this.frame = requestAnimationFrame(this.animate)
	}
	private async startRenderer(skip = 0): Promise<void> {
		const generation = ++this.generation
		this.recovering = true
		this.renderer?.destroy()
		this.renderer = undefined
		try {
			const result = await createTreeRenderer(() => {
				const canvas = document.createElement("canvas")
				canvas.style.cssText =
					"display:block;width:100%;height:420px;border-radius:12px;background:#060e13"
				canvas.setAttribute("role", "img")
				canvas.setAttribute(
					"aria-label",
					"Song tree: curved coloured branches grow with held notes; leaves mark released notes. A falling droplet follows the beat before playing."
				)
				return canvas
			}, skip)
			if (generation !== this.generation || !this.gui) {
				result.renderer.destroy()
				return
			}
			this.canvas?.remove()
			this.canvas = result.canvas
			this.renderer = result.renderer
			this.gui.prepend(this.canvas)
			this.observer?.disconnect()
			if (typeof ResizeObserver !== "undefined") {
				this.observer = new ResizeObserver(() => this.resize())
				this.observer.observe(this.canvas)
			}
			this.resize()
			if (this.status) {
				this.status.textContent = `Notes grow branches · Release to leaf · ${this.renderer.backend}`
			}
		} catch {
			if (generation === this.generation && this.status) {
				this.status.textContent = "Tree rendering is unavailable in this browser."
			}
		} finally {
			if (generation === this.generation) {
				this.recovering = false
				if (this.renderer && !this.frame) {
					this.frame = requestAnimationFrame(this.animate)
				}
			}
		}
	}
	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		const panel = (this.gui = devicePanel())
		panel.style.cssText += ";width:min(560px,75vw);min-width:260px"
		this.status = document.createElement("small")
		this.status.textContent = "Preparing song tree…"
		this.status.setAttribute("role", "status")
		panel.append(this.status)
		action(panel, "Plant a new tree", () => {
			this.model.reset()
			this.cameraX = this.cameraY = 0
			this.lastFrame = 0
		})
		await this.startRenderer()
		return panel
	}
	async destroyGui(): Promise<void> {
		++this.generation
		cancelAnimationFrame(this.frame)
		this.frame = 0
		this.observer?.disconnect()
		this.observer = undefined
		this.renderer?.destroy()
		this.renderer = undefined
		this.gui?.remove()
		this.gui = undefined
		this.canvas = undefined
		this.status = undefined
		this.recovering = false
	}
	async disconnect(): Promise<void> {
		this.allNotesOff()
		this.connected = false
		cancelAnimationFrame(this.frame)
		this.frame = 0
	}
	async connect(): Promise<void> {
		this.connected = true
		if (this.renderer && !this.frame) {
			this.frame = requestAnimationFrame(this.animate)
		}
	}
	destroy(): void {
		void this.disconnect()
		void this.destroyGui()
		this.model.reset()
	}
}