import type { IAudioOutput } from "./output-interface"
import type { IAudioCommand } from "../../audio-command-interface"
import type { AudioClockTick } from "../../timing/audio-clock-tick"
import type { HarmonicState } from "../harmony"
import { NOTE_ON, NOTE_OFF } from "../../commands"
import { action, devicePanel, numberControl } from "../device-controls"
import {
	TreeModel,
	TREE_TRUNK_LEAD,
	branchLimit,
	forkX,
	forkY,
	leafLength,
	type TreeBranch
} from "./tree-model"
import {
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_POINTER_CANCEL,
	EVENT_KEY_DOWN
} from "../../event-constants"
import { NOTE_NAMES } from "../harmony"
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
// One envelope per MIDI velocity keeps overlapping flashes bounded. A soft note
// can retrigger the tree without cutting short an earlier, stronger flash.
const FLASH_DURATIONS = Float64Array.from(
	{ length: 128 },
	(_, velocity) => 0.12 + 1.5 * (velocity / 127) ** 1.3
)

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
	private viewMode: "follow" | "fit" | "manual" = "follow"
	private zoom = 1
	private scale = 1
	private zoomLabel?: HTMLOutputElement
	private submittedBatch = false
	private flashTimes = new Float64Array(128).fill(-Infinity)
	private litColors = NOTE_COLORS.map((color) => [...color] as [number, number, number])
	private litBark: [number, number, number] = [...BARK]
	private selectedBranch?: TreeBranch
	private branchControl?: HTMLInputElement
	private branchDetails?: HTMLElement

	private focusBranch(index: number): void {
		const branches = this.model.branches
		if (!branches.length) {
			return
		}
		const selected = Math.max(0, Math.min(branches.length - 1, Math.round(index)))
		const branch = (this.selectedBranch = branches[selected])
		this.viewMode = "manual"
		this.zoom = Math.max(1, this.scale)
		this.cameraX = branch.targetX
		this.cameraY = (branch.origin.y + this.model.tipY(branch, this.now)) / 2
		if (this.branchControl) {
			this.branchControl.value = String(selected + 1)
		}
		this.draw(this.now)
	}

	private bindNavigation(canvas: HTMLCanvasElement): void {
		canvas.tabIndex = 0
		canvas.style.touchAction = "none"
		canvas.style.cursor = "grab"
		let drag: { id: number; x: number; y: number } | undefined
		canvas.addEventListener(EVENT_POINTER_DOWN, (event) => {
			if (event.button !== 0) {
				return
			}
			event.stopPropagation()
			canvas.focus()
			canvas.setPointerCapture(event.pointerId)
			drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
			this.viewMode = "manual"
			this.zoom = this.scale
			canvas.style.cursor = "grabbing"
		})
		canvas.addEventListener(EVENT_POINTER_MOVE, (event) => {
			if (!drag || drag.id !== event.pointerId) {
				return
			}
			event.stopPropagation()
			this.cameraX -= (event.clientX - drag.x) / this.scale
			this.cameraY += (event.clientY - drag.y) / this.scale
			drag.x = event.clientX
			drag.y = event.clientY
			this.draw(this.now)
		})
		const release = () => {
			drag = undefined
			canvas.style.cursor = "grab"
		}
		canvas.addEventListener(EVENT_POINTER_UP, release)
		canvas.addEventListener(EVENT_POINTER_CANCEL, release)
		canvas.addEventListener(EVENT_KEY_DOWN, (event) => {
			const direction = {
				ArrowLeft: [-1, 0],
				ArrowRight: [1, 0],
				ArrowUp: [0, 1],
				ArrowDown: [0, -1]
			}[event.key]
			if (!direction) {
				return
			}
			event.preventDefault()
			event.stopPropagation()
			this.viewMode = "manual"
			this.zoom = this.scale
			this.cameraX += (direction[0] * 40) / this.scale
			this.cameraY += (direction[1] * 40) / this.scale
			this.draw(this.now)
		})
	}

	private triggerNote(note: number, velocity: number, channel: number): void {
		const now = this.now
		this.model.noteOn(note, velocity, channel, now)
		if (
			Number.isInteger(note) &&
			note >= 0 &&
			note <= 127 &&
			Number.isFinite(velocity) &&
			velocity > 0
		) {
			this.flashTimes[Math.max(1, Math.min(127, Math.round(velocity)))] = now
		}
	}
	private updateFlash(now: number): void {
		let strength = 0
		for (let velocity = 1; velocity <= 127; velocity++) {
			const age = now - this.flashTimes[velocity]
			if (age >= 0 && age < FLASH_DURATIONS[velocity]) {
				const remaining = 1 - age / FLASH_DURATIONS[velocity]
				strength = Math.max(
					strength,
					(0.15 + (0.7 * velocity) / 127) * remaining * remaining
				)
			}
		}
		for (let channel = 0; channel < 3; channel++) {
			this.litBark[channel] = BARK[channel] + (1 - BARK[channel]) * strength
			for (let pitch = 0; pitch < 12; pitch++) {
				this.litColors[pitch][channel] =
					NOTE_COLORS[pitch][channel] + (1 - NOTE_COLORS[pitch][channel]) * strength
			}
		}
	}

	private zoomBy(factor: number): void {
		this.zoom = Math.min(8, Math.max(0.000001, this.scale * factor))
		if (this.viewMode === "fit") {
			this.viewMode = "manual"
		}
		this.draw(this.now)
	}
	private flush(): void {
		this.renderer!.draw(
			this.instances,
			this.count,
			this.width,
			this.height,
			this.submittedBatch
		)
		this.submittedBatch = true
		this.count = 0
	}

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
			this.triggerNote(command.number, command.velocity, command.channel)
		} else if (command.type === NOTE_OFF) {
			this.model.noteOff(command.number, command.channel, this.now)
		}
	}
	noteOn(note: number, velocity: number): void {
		if (this.connected) {
			this.triggerNote(note, velocity, 1)
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
			this.flush()
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
		this.submittedBatch = false
		this.updateFlash(now)
		const elapsed = now - (this.lastFrame || now)
		const dt = Math.max(0, Math.min(0.1, elapsed))
		this.lastFrame = now
		const growth = this.model.heightAt(now)
		const trunk = this.model.started === undefined ? 0 : growth + TREE_TRUNK_LEAD
		let top = trunk,
			minX = 0,
			maxX = 0
		for (const branch of this.model.held.values()) {
			minX = Math.min(minX, branch.targetX)
			maxX = Math.max(maxX, branch.targetX)
		}
		const topX = (minX + maxX) / 2
		const follow = elapsed > 0.5 ? 1 : 1 - Math.exp(-dt * 6)
		this.scale = this.zoom
		if (this.viewMode === "fit" && this.model.started !== undefined) {
			minX = -16
			maxX = 16
			for (const branch of this.model.branches) {
				minX = Math.min(minX, branch.targetX - 12)
				maxX = Math.max(maxX, branch.targetX + 12)
			}
			top += 8
			this.scale = Math.min(
				1,
				(this.width - 48) / (maxX - minX),
				(this.height - 48) / (top + 32)
			)
			this.cameraX = (minX + maxX) / 2
			this.cameraY = top / 2
		} else if (this.viewMode === "follow" || this.model.started === undefined) {
			this.cameraY +=
				(Math.max(
					(this.height * 0.34) / this.scale,
					top - (this.height * 0.18) / this.scale
				) -
					this.cameraY) *
				(dt ? follow : 1)
			this.cameraX += (topX - this.cameraX) * (dt ? follow : 1)
		}
		const scale = this.scale
		if (this.branchControl) {
			this.branchControl.max = String(Math.max(1, this.model.branches.length))
		}
		if (this.branchDetails) {
			const branch = this.selectedBranch
			this.branchDetails.textContent = branch
				? `${NOTE_NAMES[branch.note % 12]}${Math.floor(branch.note / 12) - 1} · channel ${branch.key.split(":")[0]} · velocity ${branch.velocity} · ${branch.end === undefined ? "held" : "released"}`
				: `${this.model.branches.length} branches · Drag or use arrow keys to pan; choose a branch to inspect it.`
		}
		if (this.zoomLabel) {
			const label = `${this.viewMode === "fit" ? "Whole song · " : ""}${(scale * 100).toFixed(scale < 0.01 ? 3 : 0)}%`
			if (this.zoomLabel.value !== label) {
				this.zoomLabel.value = label
			}
		}
		const center = this.width / 2 - this.cameraX * scale,
			ground = this.height / 2 + this.cameraY * scale
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
				Math.min(this.height + 10, ground - Math.min(6, trunk / 2) * scale),
				center,
				ground - trunk * scale,
				6 * scale,
				this.litBark
			)
			// A cubic flare meets the ground broadly and eases into the straight trunk.
			const flareHeight = Math.min(32, trunk),
				flareSteps = Math.max(1, Math.ceil(flareHeight * scale))
			if (ground >= -24 && ground - flareHeight * scale <= this.height + 24) {
				for (let step = 0; step < flareSteps; step++) {
					const t = (step + 0.5) / flareSteps
					const radius = (6 + 14 * (1 - t) ** 3) * scale
					const y = ground - t * flareHeight * scale
					this.segment(
						center - radius,
						y,
						center + radius,
						y,
						((flareHeight * scale) / flareSteps) * 0.65,
						this.litBark
					)
				}
			}
			// Cull outside the view and reduce curve detail at distant zoom levels.
			// Flush bounded batches rather than dropping older parts of the song.
			const low = (ground - this.height - 24) / scale,
				high = (ground + 24) / scale
			for (const branch of this.model.branches) {
				const limit = branchLimit(branch),
					tip = Math.min(limit, growth),
					origin = branch.origin
				if (tip <= origin.y || origin.y > high || tip + 24 < low) {
					continue
				}
				const color: Color =
						branch === this.selectedBranch
							? [1, 1, 1]
							: this.litColors[branch.note % 12],
					radius = 0.8 + (branch.velocity / 127) * 4
				// Start as wide as the parent and ease into the note's own width:
				// the fork fills in like the crotch of a real branch, not a butt joint.
				const collar = branch.parent ? 0.8 + (branch.parent.velocity / 127) * 4 : 6
				const reach = branch.targetX - origin.x,
					arcTop = origin.y + branch.arc
				let x = origin.x,
					y = origin.y
				if (branch.arc && arcTop >= low) {
					const steps = Math.max(
						4,
						Math.min(24, Math.ceil((Math.max(Math.abs(reach), branch.arc) * scale) / 3))
					)
					for (let step = 1; step <= steps && y < tip; step++) {
						const u = step / steps
						let nextX = origin.x + reach * forkX(u),
							nextY = origin.y + branch.arc * forkY(u)
						if (nextY > tip) {
							nextX = x + ((nextX - x) * (tip - y)) / (nextY - y)
							nextY = tip
						}
						this.segment(
							center + x * scale,
							ground - y * scale,
							center + nextX * scale,
							ground - nextY * scale,
							(radius + (collar - radius) * (1 - u) ** 2) * scale,
							color
						)
						x = nextX
						y = nextY
					}
				} else {
					x = branch.targetX
					y = arcTop
				}
				if (tip > arcTop) {
					x = branch.targetX
					this.segment(
						center + x * scale,
						ground - Math.max(arcTop, low) * scale,
						center + x * scale,
						ground - Math.min(tip, high) * scale,
						radius * scale,
						color
					)
				}
				// A released note unfurls a leaf at its tip. A stem carried onwards
				// by the next chord of a progression has no tip to put one on.
				if (branch.end !== undefined && !branch.continuedBy && tip >= limit) {
					const open = 1 - (1 - Math.max(0, Math.min(1, (now - branch.end) / 0.3))) ** 3
					const length = leafLength(branch) * open * scale
					if (length > 0.5) {
						const leafX = center + x * scale,
							leafY = ground - tip * scale
						this.segment(
							leafX,
							leafY,
							leafX + branch.side * length * 0.16,
							leafY - length,
							length * 0.3,
							color,
							true
						)
					}
				}
			}
		}
		this.flush()
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
					"Song tree: each note is a branch that arcs from the trunk and grows upwards, ending in a leaf. Drag or use arrow keys to pan. Use branch controls to inspect any note."
				)
				return canvas
			}, skip)
			if (generation !== this.generation || !this.gui) {
				result.renderer.destroy()
				return
			}
			this.canvas?.remove()
			this.canvas = result.canvas
			this.bindNavigation(this.canvas)
			this.renderer = result.renderer
			this.gui.prepend(this.canvas)
			this.observer?.disconnect()
			if (typeof ResizeObserver !== "undefined") {
				this.observer = new ResizeObserver(() => this.resize())
				this.observer.observe(this.canvas)
			}
			this.resize()
			if (this.status) {
				this.status.textContent = `Held notes grow · Released notes leaf · ${this.renderer.backend}`
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
		const controls = document.createElement("div")
		controls.style.cssText = "display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center"
		action(controls, "Zoom out", () => this.zoomBy(1 / 1.4))
		action(controls, "Zoom in", () => this.zoomBy(1.4))
		action(controls, "Fit whole song", () => {
			this.viewMode = "fit"
			this.draw(this.now)
		})
		action(controls, "Follow growth", () => {
			this.viewMode = "follow"
			this.zoom = 1
			this.lastFrame = 0
			this.draw(this.now)
		})
		this.zoomLabel = document.createElement("output")
		this.zoomLabel.setAttribute("aria-label", "Tree zoom")
		this.zoomLabel.value = "100%"
		controls.append(this.zoomLabel)
		panel.append(controls)
		const branchControls = document.createElement("div")
		branchControls.style.cssText = "display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center"
		this.branchControl = numberControl(
			branchControls,
			"Branch",
			1,
			1,
			Number.MAX_SAFE_INTEGER,
			(value) => this.focusBranch(value - 1)
		)
		action(branchControls, "Previous branch", () =>
			this.focusBranch(Number(this.branchControl?.value ?? 1) - 2)
		)
		action(branchControls, "Next branch", () =>
			this.focusBranch(Number(this.branchControl?.value ?? 0))
		)
		this.branchDetails = document.createElement("small")
		panel.append(branchControls, this.branchDetails)
		action(panel, "Plant a new tree", () => {
			this.model.reset()
			this.flashTimes.fill(-Infinity)
			this.cameraX = this.cameraY = 0
			this.lastFrame = 0
			this.viewMode = "follow"
			this.zoom = 1
			this.selectedBranch = undefined
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
		this.zoomLabel = undefined
		this.branchControl = undefined
		this.branchDetails = undefined
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