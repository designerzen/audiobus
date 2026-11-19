/**
 * Device Motion input
 *
 * Plays notes from a phone or tablet's orientation, compass and accelerometer.
 *
 * MODE "tilt":     Roll left/right walks a scale; tilt toward you for louder notes.
 * MODE "strike":   Strike like a drumstick; the direction chooses kick, snare or hat.
 * MODE "compass":  Turn on the spot; each compass sector plays a chord of the key.
 * MODE "controls": No notes; movement streams MIDI CC for control surfaces and MIDI learn.
 *
 * Movement is also sent as CC in the note modes (when "sendControls" is on), so the same
 * input can play an instrument and move gadgets on a control surface at once:
 * ccBase+0 tilt left/right, +1 tilt forward/back, +2 compass turn, +3 movement energy
 * and +4 a shake pulse (127 then 0) that presses surface buttons and pads.
 *
 * Without sensors (desktop), dragging on the pad simulates tilting and tapping strikes.
 */
import NoteInput from "./note-input"
import { musicalCommand } from "../event-clip"
import { CONTROL_CHANGE } from "../../commands/commands"
import { noteNumberToName } from "../../conversion/note-to-name"
import { bounded, changed, devicePanel, numberControl } from "../device-controls"
import {
	EVENT_CHANGE,
	EVENT_CLICK,
	EVENT_DEVICE_MOTION,
	EVENT_DEVICE_ORIENTATION,
	EVENT_LOST_POINTER_CAPTURE,
	EVENT_POINTER_CANCEL,
	EVENT_POINTER_DOWN,
	EVENT_POINTER_MOVE,
	EVENT_POINTER_UP,
	EVENT_VISIBILITY_CHANGE
} from "../../events/event-constants"

export type MotionMode = "tilt" | "strike" | "compass" | "controls"
type SensorState = "needs-permission" | "waiting" | "live" | "denied" | "unsupported"

export const MOTION_MODES: Record<MotionMode, { label: string; steps: string[] }> = {
	tilt: {
		label: "Tilt melody",
		steps: [
			"Hold the phone flat in front of you and press Set level here.",
			"Keep a thumb on the pad, then roll the phone left and right to walk the scale.",
			"Tilt the top edge toward you to play louder, away to play softer.",
			"Lift your thumb to stop. Untick Hold the pad to play for hands-free drones."
		]
	},
	strike: {
		label: "Strike drums",
		steps: [
			"Grip the phone firmly like a drumstick, with the screen facing up.",
			"Strike downward for a kick drum.",
			"Flick sideways for a snare, or jab forward for a hi-hat.",
			"Hit harder for louder hits. Raise Strike threshold if it triggers too easily."
		]
	},
	compass: {
		label: "Compass chords",
		steps: [
			"Stand up, face your starting direction and press Set level here.",
			"Hold the pad and turn on the spot: each direction plays a chord of the key.",
			"Facing the start plays chord I; turn right to climb through the key.",
			"Tilt the top edge toward you to swell the chord."
		]
	},
	controls: {
		label: "Control surface",
		steps: [
			"Movement is sent as MIDI CC only, without notes.",
			"On a control surface, edit a gadget and choose Control (or Trigger for buttons).",
			"Press Send only… below, then Learn on the gadget and make that movement.",
			"Shake to press buttons and pads; tilt and turn to move dials, sliders and XY pads."
		]
	}
}

const SCALES: Record<string, number[]> = {
	major: [0, 2, 4, 5, 7, 9, 11],
	minor: [0, 2, 3, 5, 7, 8, 10],
	dorian: [0, 2, 3, 5, 7, 9, 10],
	pentatonic: [0, 2, 4, 7, 9],
	blues: [0, 3, 5, 6, 7, 10]
}

// Device axes: x across the screen, y up the screen, z out of the screen.
const DRUMS = [
	{ label: "Snare", hint: "Flick sideways", note: 38 },
	{ label: "Hat", hint: "Jab forward", note: 42 },
	{ label: "Kick", hint: "Strike down", note: 36 }
]

/** CC offsets from `ccBase`; "shake" is a momentary press for surface triggers. */
export const MOTION_CONTROLS = [
	{ id: "tiltX", label: "Tilt left/right" },
	{ id: "tiltY", label: "Tilt forward/back" },
	{ id: "heading", label: "Compass turn" },
	{ id: "energy", label: "Movement energy" },
	{ id: "shake", label: "Shake" }
] as const
type MotionControl = (typeof MOTION_CONTROLS)[number]["id"]

/** Degrees of tilt that reach either end of the range. */
const MAX_TILT = 40
/** Acceleration (m/s²) that reads as full movement energy. */
const FULL_ENERGY = 25
/** Fraction of a note cell or compass sector to cross before changing, to stop flicker. */
const HYSTERESIS = 0.2
const STRIKE_GAP_MS = 150
const PULSE_MS = 120
const SOLO_MS = 10000

const clamp = (value: number, min = -1, max = 1) => Math.min(max, Math.max(min, value))
const wrap = (value: number) => ((value % 1) + 1) % 1

export default class InputDeviceMotion extends NoteInput {
	/** Normalised: tilt -1..1, heading 0..1 clockwise from the level point, energy 0..1. */
	readonly reading = { tiltX: 0, tiltY: 0, heading: 0, energy: 0 }
	sensors: SensorState = "waiting"
	private raw = { roll: 0, pitch: 0, heading: 0 }
	private level = { roll: 0, pitch: 0, heading: 0 }
	private gravity = [0, 0, 0]
	private hasGravity = false
	private lastStrike = -Infinity
	private holding = false
	private tiltCell?: number
	private tiltNote?: number
	private sector?: number
	private chord: number[] = []
	private sent = new Map<MotionControl, number>()
	private solo?: { id: MotionControl; until: number }
	private hit?: { drum: number; at: number }
	private timers = new Set<ReturnType<typeof setTimeout>>()
	private sensorEvents?: AbortController
	private guiEvents?: AbortController
	private gui?: HTMLElement
	private canvas?: HTMLCanvasElement
	private steps?: HTMLOListElement
	private status?: HTMLElement
	private enable?: HTMLButtonElement
	private frame = 0

	get name() {
		return "Device Motion"
	}
	get description() {
		return "Tilt, strike and turn a phone to play notes and move control surfaces"
	}
	get mode(): MotionMode {
		return this.options.mode
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.options.mode = Object.hasOwn(MOTION_MODES, options.mode) ? options.mode : "tilt"
		this.options.scale = Object.hasOwn(SCALES, options.scale) ? options.scale : "major"
		this.options.root = Math.round(bounded(options.root, 60, 24, 96))
		this.options.octaves = Math.round(bounded(options.octaves, 2, 1, 3))
		this.options.channel = Math.round(bounded(options.channel, 1, 1, 16))
		this.options.ccBase = Math.round(bounded(options.ccBase, 16, 0, 123))
		this.options.threshold = bounded(options.threshold, 14, 4, 40)
		this.options.smoothing = bounded(options.smoothing, 0.6, 0, 0.95)
		this.options.holdToPlay = options.holdToPlay ?? true
		this.options.sendControls = options.sendControls ?? true
		void this.connect()
	}

	override async connect(): Promise<void> {
		await super.connect()
		const request = globalThis.DeviceOrientationEvent as unknown as
			| { requestPermission?: () => Promise<string> }
			| undefined
		if (typeof request?.requestPermission === "function") {
			// iOS only grants sensors from a tap, so the panel shows an Enable button.
			this.setSensors("needs-permission")
		} else {
			this.listen()
		}
	}

	override async disconnect(): Promise<void> {
		this.sensorEvents?.abort()
		this.sensorEvents = undefined
		this.release()
		await super.disconnect()
	}

	override destroy(): void {
		void this.disconnect()
		void this.destroyGui()
		super.destroy()
	}

	/** Ask for sensor access; must run inside a tap on iOS. */
	async enableSensors(): Promise<void> {
		const ask = async (target: unknown) => {
			const request = (target as { requestPermission?: () => Promise<string> } | undefined)
				?.requestPermission
			return typeof request !== "function" || (await request.call(target)) === "granted"
		}
		try {
			const orientation = await ask(globalThis.DeviceOrientationEvent)
			const motion = await ask(globalThis.DeviceMotionEvent)
			if (!orientation && !motion) {
				this.setSensors("denied")
				return
			}
			this.listen()
		} catch {
			this.setSensors("denied")
		}
	}

	/** Treat the current position as level and facing the start. */
	setLevel(): void {
		this.level = { ...this.raw }
		this.processOrientation(this.raw.roll, this.raw.pitch, this.raw.heading, true)
	}

	/** Gate for "hold to play"; the pad drives this from pointers. */
	setHolding(holding: boolean): void {
		this.holding = holding
		this.update()
	}

	/** Roll and pitch in degrees, compass heading in degrees clockwise from north. */
	processOrientation(roll: number, pitch: number, heading?: number, immediate = false): void {
		this.raw = { roll, pitch, heading: heading ?? this.raw.heading }
		const follow = immediate ? 1 : 1 - this.options.smoothing
		const r = this.reading
		r.tiltX += (clamp((roll - this.level.roll) / MAX_TILT) - r.tiltX) * follow
		r.tiltY += (clamp((pitch - this.level.pitch) / MAX_TILT) - r.tiltY) * follow
		if (heading !== undefined) {
			const target = wrap((heading - this.level.heading) / 360)
			// Smooth along the shorter way round so north does not spin through south.
			r.heading = wrap(r.heading + (wrap(target - r.heading + 0.5) - 0.5) * follow)
		}
		this.update()
	}

	/** Acceleration in m/s² on the device axes; with gravity included it is filtered out. */
	processMotion(x: number, y: number, z: number, includesGravity = false): void {
		let a = [x, y, z]
		if (includesGravity) {
			this.gravity = this.hasGravity
				? this.gravity.map((g, i) => g + (a[i] - g) * 0.1)
				: [...a]
			this.hasGravity = true
			a = a.map((value, i) => value - this.gravity[i])
		}
		const magnitude = Math.hypot(a[0], a[1], a[2])
		this.reading.energy = Math.max(
			clamp(magnitude / FULL_ENERGY, 0, 1),
			this.reading.energy * 0.85
		)
		const now = this.now * 1000
		if (magnitude >= this.options.threshold && now - this.lastStrike > STRIKE_GAP_MS) {
			this.lastStrike = now
			const axis = a.map(Math.abs).reduce((best, v, i, all) => (v > all[best] ? i : best), 0)
			this.strike(axis, magnitude)
		}
		this.update()
	}

	/** Briefly send only one movement so MIDI learn and surface Learn pick it up. */
	soloControl(id: MotionControl): void {
		this.solo = { id, until: performance.now() + SOLO_MS }
		this.sent.delete(id)
		this.update()
		this.later(() => {
			if (this.solo?.id === id && performance.now() >= this.solo.until) {
				this.solo = undefined
				this.showStatus()
			}
		}, SOLO_MS)
	}

	private strike(axis: number, magnitude: number): void {
		const threshold = this.options.threshold
		const velocity = 50 + clamp((magnitude - threshold) / (threshold * 2), 0, 1) * 77
		this.hit = { drum: axis, at: performance.now() }
		if (this.mode === "strike" && !this.solo) {
			this.pulse(DRUMS[axis].note, velocity, PULSE_MS, this.options.channel)
		}
		if (this.sendsControls()) {
			this.control("shake", 127)
			this.later(() => this.control("shake", 0), PULSE_MS)
		}
	}

	private update(): void {
		if (!this.isConnected) {
			return
		}
		if (this.sendsControls()) {
			const r = this.reading
			this.control("tiltX", (r.tiltX + 1) / 2)
			this.control("tiltY", (r.tiltY + 1) / 2)
			this.control("heading", r.heading)
			this.control("energy", r.energy)
		}
		const gate = !this.solo && (!this.options.holdToPlay || this.holding)
		if (this.mode === "tilt") {
			this.playTilt(gate)
		} else if (this.mode === "compass") {
			this.playCompass(gate)
		}
		this.draw()
	}

	private playTilt(gate: boolean): void {
		const notes = this.scaleNotes()
		const position = ((this.reading.tiltX + 1) / 2) * notes.length
		const cell = this.tiltCell
		if (cell === undefined || Math.abs(position - cell - 0.5) > 0.5 + HYSTERESIS) {
			this.tiltCell = Math.min(notes.length - 1, Math.floor(position))
		}
		const note = notes[this.tiltCell!]
		if (!gate) {
			this.releaseTilt()
		} else if (note !== this.tiltNote) {
			this.releaseTilt()
			this.tiltNote = note
			this.noteOn(note, this.velocity(), this.options.channel)
		}
	}

	private playCompass(gate: boolean): void {
		const count = SCALES[this.options.scale].length
		const position = this.reading.heading * count
		const current = this.sector
		// Sectors are centred on their direction, so facing the start plays chord I.
		const distance =
			current === undefined
				? Infinity
				: Math.abs(wrap((position - current) / count + 0.5) - 0.5) * count
		if (distance > 0.5 + HYSTERESIS) {
			this.sector = Math.round(position) % count
		}
		if (!gate) {
			this.releaseChord()
			return
		}
		const chord = this.chordNotes(this.sector!)
		if (chord.join() !== this.chord.join()) {
			this.releaseChord()
			this.chord = chord
			const velocity = this.velocity()
			for (const note of chord) {
				this.noteOn(note, velocity, this.options.channel)
			}
		}
	}

	private velocity(): number {
		return 40 + ((this.reading.tiltY + 1) / 2) * 87
	}

	private scaleNotes(): number[] {
		const scale = SCALES[this.options.scale]
		const notes: number[] = []
		for (let octave = 0; octave < this.options.octaves; octave++) {
			notes.push(...scale.map((step) => this.options.root + octave * 12 + step))
		}
		notes.push(this.options.root + this.options.octaves * 12)
		return notes.filter((note) => note <= 127)
	}

	/** Triad stacked in thirds from a scale degree, wrapping into the next octave. */
	private chordNotes(degree: number): number[] {
		const scale = SCALES[this.options.scale]
		return [0, 2, 4].map((third) => {
			const index = degree + third
			return (
				this.options.root +
				scale[index % scale.length] +
				Math.floor(index / scale.length) * 12
			)
		})
	}

	private chordName(degree: number): string {
		const [root, third, fifth] = this.chordNotes(degree)
		const name = noteNumberToName(root).replace(/-?\d+$/, "")
		return name + (third - root === 3 ? (fifth - root === 6 ? "°" : "m") : "")
	}

	private sendsControls(): boolean {
		return this.mode === "controls" || !!this.options.sendControls
	}

	private control(id: MotionControl, position: number): void {
		const value = Math.round(clamp(position, 0, 1) * 127)
		if ((this.solo && this.solo.id !== id) || this.sent.get(id) === value) {
			return
		}
		this.sent.set(id, value)
		this.dispatch(
			musicalCommand({
				type: CONTROL_CHANGE,
				number: this.options.ccBase + MOTION_CONTROLS.findIndex((c) => c.id === id),
				value,
				channel: this.options.channel,
				from: this.uuid,
				startAt: this.now,
				time: this.now
			})
		)
	}

	private releaseTilt(): void {
		if (this.tiltNote !== undefined) {
			this.noteOff(this.tiltNote, this.options.channel)
			this.tiltNote = undefined
		}
	}

	private releaseChord(): void {
		for (const note of this.chord) {
			this.noteOff(note, this.options.channel)
		}
		this.chord = []
	}

	private release(): void {
		this.holding = false
		this.releaseTilt()
		this.releaseChord()
		this.allNotesOff()
		this.tiltCell = undefined
		this.sector = undefined
	}

	private later(callback: () => void, ms: number): void {
		const timer = setTimeout(() => {
			this.timers.delete(timer)
			callback()
		}, ms)
		this.timers.add(timer)
	}

	private listen(): void {
		if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
			this.setSensors("unsupported")
			return
		}
		this.sensorEvents?.abort()
		this.sensorEvents = new AbortController()
		const { signal } = this.sensorEvents
		this.setSensors("waiting")
		window.addEventListener(
			EVENT_DEVICE_ORIENTATION,
			(event) => {
				if (event.beta == null || event.gamma == null) {
					return
				}
				const compass = (
					event as DeviceOrientationEvent & { webkitCompassHeading?: number }
				).webkitCompassHeading
				const heading =
					typeof compass === "number"
						? compass
						: event.alpha == null
							? undefined
							: 360 - event.alpha
				// Keep "left/right" relative to the screen when the phone is held sideways.
				const angle = globalThis.screen?.orientation?.angle ?? 0
				const [roll, pitch] =
					angle === 90
						? [event.beta, -event.gamma]
						: angle === 180
							? [-event.gamma, -event.beta]
							: angle === 270
								? [-event.beta, event.gamma]
								: [event.gamma, event.beta]
				this.setSensors("live")
				this.processOrientation(roll, pitch, heading)
			},
			{ signal }
		)
		window.addEventListener(
			EVENT_DEVICE_MOTION,
			(event) => {
				const a = event.acceleration
				if (a?.x != null && a.y != null && a.z != null) {
					this.processMotion(a.x, a.y, a.z)
					return
				}
				const g = event.accelerationIncludingGravity
				if (g?.x != null && g.y != null && g.z != null) {
					this.processMotion(g.x, g.y, g.z, true)
				}
			},
			{ signal }
		)
		document.addEventListener(
			EVENT_VISIBILITY_CHANGE,
			() => {
				if (document.hidden) {
					this.release()
				}
			},
			{ signal }
		)
	}

	private setSensors(state: SensorState): void {
		if (this.sensors !== state) {
			this.sensors = state
			this.showStatus()
		}
	}

	private showStatus(): void {
		if (this.enable) {
			this.enable.hidden = this.sensors !== "needs-permission" && this.sensors !== "denied"
		}
		if (!this.status) {
			return
		}
		const simulate = "Drag on the pad to tilt, and tap it to strike."
		const solo = this.solo
			? ` Sending only ${MOTION_CONTROLS.find((c) => c.id === this.solo!.id)!.label} (CC ${
					this.options.ccBase + MOTION_CONTROLS.findIndex((c) => c.id === this.solo!.id)
				}) for 10 seconds: choose Learn now.`
			: ""
		this.status.textContent =
			{
				"needs-permission": "Tap Enable motion sensors to start.",
				waiting:
					typeof isSecureContext !== "undefined" && !isSecureContext
						? `Motion sensors need HTTPS. ${simulate}`
						: `No motion sensors yet; on a computer, ${simulate.toLowerCase()}`,
				live: "Motion sensors are on.",
				denied: `Motion access was refused. Allow it in browser settings, or ${simulate.toLowerCase()}`,
				unsupported: `This browser has no motion sensors. ${simulate}`
			}[this.sensors] + solo
	}

	async createGui(): Promise<HTMLElement> {
		if (this.gui) {
			return this.gui
		}
		this.guiEvents = new AbortController()
		const { signal } = this.guiEvents
		const panel = devicePanel()
		panel.classList.add("device-motion")

		const select = (
			title: string,
			value: string,
			choices: [string, string][],
			change: (value: string) => void
		) => {
			const label = document.createElement("label"),
				input = document.createElement("select")
			for (const [id, text] of choices) {
				const option = document.createElement("option")
				option.value = id
				option.textContent = text
				input.append(option)
			}
			input.value = value
			input.addEventListener(EVENT_CHANGE, () => change(input.value), {
				signal
			})
			label.append(title, " ", input)
			panel.append(label)
		}
		const checkbox = (title: string, key: string) => {
			const label = document.createElement("label"),
				input = document.createElement("input")
			input.type = "checkbox"
			input.checked = !!this.options[key]
			input.addEventListener(
				EVENT_CHANGE,
				() => {
					this.options[key] = input.checked
					this.release()
					this.update()
					changed(this)
				},
				{ signal }
			)
			label.append(input, " ", title)
			panel.append(label)
		}
		const button = (title: string, action: () => void) => {
			const element = document.createElement("button")
			element.type = "button"
			element.textContent = title
			element.addEventListener(EVENT_CLICK, action, { signal })
			return element
		}
		const settings = (key: string) => (value: number) => {
			this.release()
			this.options[key] = value
			this.sent.clear()
			this.update()
			changed(this)
		}

		select(
			"Mode",
			this.mode,
			Object.entries(MOTION_MODES).map(([id, mode]) => [id, mode.label]),
			(value) => {
				this.release()
				this.options.mode = value
				this.showSteps()
				this.update()
				changed(this)
			}
		)

		this.status = document.createElement("p")
		this.status.setAttribute("role", "status")
		this.status.style.margin = "0"
		this.enable = button("Enable motion sensors", () => void this.enableSensors())
		const actions = document.createElement("div")
		actions.style.cssText = "display:flex;flex-wrap:wrap;gap:0.5rem"
		actions.append(
			this.enable,
			button("Set level here", () => this.setLevel())
		)
		panel.append(this.status, actions)

		this.canvas = document.createElement("canvas")
		this.canvas.width = 640
		this.canvas.height = 360
		this.canvas.setAttribute("role", "img")
		this.canvas.setAttribute("aria-label", "Motion pad: hold to play, drag to simulate tilting")
		this.canvas.style.cssText =
			"width:100%;aspect-ratio:16/9;touch-action:none;border-radius:8px;cursor:crosshair;background:#10141c"
		this.bindPad(this.canvas, signal)
		panel.append(this.canvas)

		const guide = document.createElement("details")
		guide.open = true
		const summary = document.createElement("summary")
		summary.textContent = "How to play"
		this.steps = document.createElement("ol")
		this.steps.style.cssText = "margin:0.4rem 0 0;padding-left:1.2rem"
		guide.append(summary, this.steps)
		panel.append(guide)

		select(
			"Scale",
			this.options.scale,
			Object.keys(SCALES).map((id) => [id, id]),
			(value) => {
				this.release()
				this.options.scale = value
				this.update()
				changed(this)
			}
		)
		numberControl(panel, "Root note", this.options.root, 24, 96, settings("root"))
		numberControl(panel, "Octaves", this.options.octaves, 1, 3, settings("octaves"))
		numberControl(panel, "Channel", this.options.channel, 1, 16, settings("channel"))
		numberControl(
			panel,
			"Strike threshold",
			this.options.threshold,
			4,
			40,
			settings("threshold")
		)
		checkbox("Hold the pad to play", "holdToPlay")
		checkbox("Send movement as MIDI CC", "sendControls")

		const assign = document.createElement("details")
		const assignSummary = document.createElement("summary")
		assignSummary.textContent = "Assign to a control surface"
		const help = document.createElement("p")
		help.textContent =
			"Each movement is a MIDI CC. Press Send only… to send just that movement for 10 seconds, then choose Learn on a gadget or MIDI control and move the phone."
		assign.append(assignSummary, help)
		numberControl(assign, "First CC", this.options.ccBase, 0, 123, settings("ccBase"))
		const solos = document.createElement("div")
		solos.style.cssText = "display:flex;flex-wrap:wrap;gap:0.5rem"
		for (const [index, control] of MOTION_CONTROLS.entries()) {
			const solo = button(`Send only ${control.label}`, () => {
				this.soloControl(control.id)
				this.showStatus()
			})
			solo.title = `CC ${this.options.ccBase + index}`
			solos.append(solo)
		}
		assign.append(solos)
		panel.append(assign)

		this.showSteps()
		this.showStatus()
		this.draw()
		return (this.gui = panel)
	}

	async destroyGui(): Promise<void> {
		this.guiEvents?.abort()
		this.guiEvents = undefined
		this.setHolding(false)
		if (this.frame) {
			cancelAnimationFrame(this.frame)
			this.frame = 0
		}
		this.gui?.remove()
		this.gui = this.canvas = this.steps = this.status = this.enable = undefined
	}

	private showSteps(): void {
		this.steps?.replaceChildren(
			...MOTION_MODES[this.mode].steps.map((step) => {
				const item = document.createElement("li")
				item.textContent = step
				return item
			})
		)
	}

	/** Pointers gate notes; without live sensors they also stand in for movement. */
	private bindPad(canvas: HTMLCanvasElement, signal: AbortSignal): void {
		const simulate = (event: PointerEvent, down: boolean) => {
			if (this.sensors === "live") {
				return
			}
			const rect = canvas.getBoundingClientRect()
			const x = clamp((event.clientX - rect.left) / (rect.width || 1), 0, 1)
			const y = clamp((event.clientY - rect.top) / (rect.height || 1), 0, 1)
			if (this.mode === "strike") {
				if (down) {
					// Strike zones match the pad's three columns.
					const zone = Math.min(2, Math.floor(x * 3))
					const a = [0, 0, 0]
					a[[0, 2, 1][zone]] = this.options.threshold * (1.2 + (1 - y) * 1.8)
					this.processMotion(a[0], a[1], a[2])
				}
				return
			}
			const heading = (Math.atan2(x - 0.5, 0.5 - y) * 180) / Math.PI + this.level.heading
			this.processOrientation(
				this.level.roll + (x * 2 - 1) * MAX_TILT,
				this.level.pitch + (1 - y * 2) * MAX_TILT,
				this.mode === "compass" ? heading : undefined,
				true
			)
		}
		canvas.addEventListener(
			EVENT_POINTER_DOWN,
			(event) => {
				canvas.setPointerCapture?.(event.pointerId)
				event.preventDefault()
				this.holding = true
				simulate(event, true)
				this.update()
			},
			{ signal }
		)
		canvas.addEventListener(
			EVENT_POINTER_MOVE,
			(event) => {
				if (this.holding) {
					simulate(event, false)
				}
			},
			{ signal }
		)
		for (const type of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE]) {
			canvas.addEventListener(type, () => this.setHolding(false), { signal })
		}
	}

	private draw(): void {
		if (!this.canvas || this.frame || typeof requestAnimationFrame === "undefined") {
			return
		}
		this.frame = requestAnimationFrame(() => {
			this.frame = 0
			this.paint()
			// Strike flashes fade out over a few frames.
			if (this.hit && performance.now() - this.hit.at < 400) {
				this.draw()
			}
		})
	}

	private paint(): void {
		const context = this.canvas?.getContext("2d")
		if (!context || !this.canvas) {
			return
		}
		const { width, height } = this.canvas
		const r = this.reading
		const accent = "#5ad1ff",
			dim = "#2a3342",
			text = "#e6edf5"
		context.clearRect(0, 0, width, height)
		context.font = "20px sans-serif"
		context.textAlign = "center"
		context.textBaseline = "middle"

		// The phone tilts and foreshortens with the reading so players can see what it hears.
		context.save()
		context.translate(90, height / 2)
		context.rotate(r.tiltX * 0.6)
		context.scale(1, 0.55 + Math.cos(r.tiltY * 0.9) * 0.45)
		context.strokeStyle = accent
		context.lineWidth = 4
		context.beginPath()
		context.roundRect(-34, -64, 68, 128, 12)
		context.stroke()
		context.restore()
		context.fillStyle = text
		context.fillText(
			this.holding
				? "Playing"
				: this.options.holdToPlay && this.mode !== "strike" && this.mode !== "controls"
					? "Hold pad"
					: "",
			90,
			height - 28
		)

		const left = 190,
			right = width - 20,
			span = right - left
		if (this.mode === "tilt") {
			const notes = this.scaleNotes()
			const cell = span / notes.length
			notes.forEach((note, i) => {
				context.fillStyle =
					i === this.tiltCell ? (this.tiltNote === undefined ? "#3d6b85" : accent) : dim
				context.fillRect(left + i * cell + 1, 110, cell - 2, 140)
				context.fillStyle = text
				context.font = `${Math.min(20, cell * 0.45)}px sans-serif`
				context.fillText(noteNumberToName(note), left + (i + 0.5) * cell, 180)
			})
			context.fillStyle = "#fff"
			context.fillRect(left + ((r.tiltX + 1) / 2) * span - 2, 96, 4, 168)
			context.fillStyle = text
			context.font = "18px sans-serif"
			context.fillText("◀ roll left        roll right ▶", left + span / 2, 70)
			context.fillText(
				`velocity ${Math.round(this.velocity())} (tilt toward you)`,
				left + span / 2,
				300
			)
		} else if (this.mode === "compass") {
			const count = SCALES[this.options.scale].length
			const cx = left + span / 2,
				cy = height / 2,
				radius = Math.min(span, height) / 2 - 20
			for (let i = 0; i < count; i++) {
				const start = ((i - 0.5) / count) * Math.PI * 2 - Math.PI / 2
				context.beginPath()
				context.moveTo(cx, cy)
				context.arc(cx, cy, radius, start, start + (Math.PI * 2) / count)
				context.closePath()
				context.fillStyle =
					i === this.sector ? (this.chord.length ? accent : "#3d6b85") : dim
				context.fill()
				context.strokeStyle = "#10141c"
				context.lineWidth = 3
				context.stroke()
				const angle = (i / count) * Math.PI * 2 - Math.PI / 2
				context.fillStyle = text
				context.fillText(
					this.chordName(i),
					cx + Math.cos(angle) * radius * 0.68,
					cy + Math.sin(angle) * radius * 0.68
				)
			}
			const needle = r.heading * Math.PI * 2 - Math.PI / 2
			context.strokeStyle = "#fff"
			context.lineWidth = 4
			context.beginPath()
			context.moveTo(cx, cy)
			context.lineTo(cx + Math.cos(needle) * radius, cy + Math.sin(needle) * radius)
			context.stroke()
		} else if (this.mode === "strike") {
			const zone = span / 3
			const fade = this.hit ? clamp(1 - (performance.now() - this.hit.at) / 400, 0, 1) : 0
			// Zone order matches the simulated taps: sideways, down, forward.
			;[0, 2, 1].forEach((drum, i) => {
				context.globalAlpha = 1
				context.fillStyle = dim
				context.fillRect(left + i * zone + 4, 60, zone - 8, 240)
				if (this.hit?.drum === drum && fade) {
					context.globalAlpha = fade
					context.fillStyle = accent
					context.fillRect(left + i * zone + 4, 60, zone - 8, 240)
				}
				context.globalAlpha = 1
				context.fillStyle = text
				context.font = "24px sans-serif"
				context.fillText(DRUMS[drum].label, left + (i + 0.5) * zone, 150)
				context.font = "16px sans-serif"
				context.fillText(DRUMS[drum].hint, left + (i + 0.5) * zone, 190)
			})
			context.fillStyle = accent
			context.fillRect(left, 320, span * r.energy, 10)
		} else {
			const values = [
				(r.tiltX + 1) / 2,
				(r.tiltY + 1) / 2,
				r.heading,
				r.energy,
				this.sent.get("shake") ? 1 : 0
			]
			const row = 280 / MOTION_CONTROLS.length
			MOTION_CONTROLS.forEach((control, i) => {
				const y = 40 + i * row
				const muted = !!this.solo && this.solo.id !== control.id
				context.fillStyle = dim
				context.fillRect(left, y, span, row - 14)
				context.fillStyle = muted ? "#3a4250" : accent
				context.fillRect(left, y, span * values[i], row - 14)
				context.fillStyle = text
				context.textAlign = "left"
				context.font = "16px sans-serif"
				context.fillText(
					`CC ${this.options.ccBase + i}  ${control.label}`,
					left + 8,
					y + (row - 14) / 2
				)
				context.textAlign = "center"
			})
		}
	}
}