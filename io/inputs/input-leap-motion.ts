/**
 * Leap Motion hand tracking input
 * Maps hand positions to MIDI notes and velocities
 */

import { NOTE_OFF, NOTE_ON } from '../../commands'
import AudioCommand from "../../audio-command.ts"
import AbstractInput from "./abstract-input.ts"
import type { IAudioInput } from "./input-interface.ts"

export const LEAP_MOTION_INPUT_ID = "LeapMotion"

export default class InputLeapMotion extends AbstractInput implements IAudioInput {

	#controller: any = null
	#handsTracked: Map<number, number> = new Map()

	// Position bounds for mapping
	#minX = -150
	#maxX = 150
	#minY = 0
	#maxY = 300
	#minNote = 36
	#maxNote = 96

	get name(): string {
		return LEAP_MOTION_INPUT_ID
	}

	get description(): string {
		return "Leap Motion Hand Tracking"
	}

	override hasMidiInput(): boolean {
		return true
	}

	constructor(options: Record<string, any> = {}) {
		super(options)
		this.onLeapFrame = this.onLeapFrame.bind(this)
		this.initLeapMotion()
	}

	private initLeapMotion(): void {
		if (typeof (window as any).Leap === "undefined") {
			console.warn("Leap Motion SDK not found")
			return
		}

		try {
			this.#controller = new (window as any).Leap.Controller()
			this.#controller.on("frame", this.onLeapFrame)
			this.#controller.on("connect", () => {
				this.setAsConnected()
				console.info("Leap Motion connected")
			})
			this.#controller.on("disconnect", () => {
				this.setAsDisconnected()
				console.info("Leap Motion disconnected")
			})
			this.#controller.connect()
		} catch (error) {
			console.error("Failed to initialize Leap Motion:", error)
		}
	}

	protected onLeapFrame(frame: any): void {
		if (!frame.hands || frame.hands.length === 0) {
			// Send NOTE_OFF for all tracked hands
			this.#handsTracked.forEach((note, handId) => {
				this.sendNoteOff(handId, note)
			})
			this.#handsTracked.clear()
			return
		}

		const trackedIds = new Set<number>()

		frame.hands.forEach((hand: any) => {
			trackedIds.add(hand.id)
			const [x, y, z] = hand.palmPosition
			
			const noteNumber = this.mapPositionToNote(x)
			const velocity = this.mapHeightToVelocity(y)

			const prevNote = this.#handsTracked.get(hand.id)

			// Send NOTE_OFF if note changed
			if (prevNote !== undefined && prevNote !== noteNumber) {
				this.sendNoteOff(hand.id, prevNote)
			}

			// Send NOTE_ON
			const cmd = new AudioCommand()
			cmd.type = NOTE_ON
			cmd.number = noteNumber
			cmd.value = noteNumber * 127
			cmd.velocity = Math.round(velocity)
			cmd.from = LEAP_MOTION_INPUT_ID + hand.id
			cmd.text = `Hand ${hand.id}`
			cmd.time = this.now
			cmd.startAt = this.now
			cmd.channel = hand.id % 16

			this.#handsTracked.set(hand.id, noteNumber)
			this.dispatch(cmd)
		})

		// Clean up removed hands
		this.#handsTracked.forEach((note, handId) => {
			if (!trackedIds.has(handId)) {
				this.sendNoteOff(handId, note)
				this.#handsTracked.delete(handId)
			}
		})
	}

	private sendNoteOff(handId: number, noteNumber: number): void {
		const cmd = new AudioCommand()
		cmd.type = NOTE_OFF
		cmd.number = noteNumber
		cmd.from = LEAP_MOTION_INPUT_ID + handId
		cmd.text = `Hand ${handId}`
		cmd.startAt = this.now
		cmd.time = this.now
		this.dispatch(cmd)
	}

	private mapPositionToNote(x: number): number {
		const normalized = (x - this.#minX) / (this.#maxX - this.#minX)
		const clamped = Math.max(0, Math.min(1, normalized))
		return Math.round(this.#minNote + (clamped * (this.#maxNote - this.#minNote)))
	}

	private mapHeightToVelocity(y: number): number {
		const normalized = (y - this.#minY) / (this.#maxY - this.#minY)
		const clamped = Math.max(0, Math.min(1, normalized))
		return 40 + (clamped * (127 - 40))
	}

	setPositionBounds(minX: number, maxX: number, minY: number, maxY: number): void {
		this.#minX = minX
		this.#maxX = maxX
		this.#minY = minY
		this.#maxY = maxY
	}

	setNoteRange(minNote: number, maxNote: number): void {
		this.#minNote = minNote
		this.#maxNote = maxNote
	}

	override destroy(): void {
		if (this.#controller) {
			this.#controller.off("frame", this.onLeapFrame)
			this.#controller.disconnect()
		}

		this.#handsTracked.forEach((note, handId) => {
			this.sendNoteOff(handId, note)
		})

		this.#handsTracked.clear()
		this.#controller = null
		this.setAsDisconnected()
	}
}




