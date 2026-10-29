import { afterEach, describe, expect, it, vi } from "vitest"
import GamePad, { GamePadManager } from "./gamepad"

afterEach(() => vi.unstubAllGlobals())

describe("gamepad polling", () => {
	it("uses current pad state and reports numeric hold durations", () => {
		const initial = {
			index: 0,
			id: "pad",
			connected: true,
			mapping: "standard",
			axes: [0, 0, 0, 0],
			buttons: []
		} as unknown as Gamepad
		let current = initial
		vi.stubGlobal("navigator", { getGamepads: () => [current] })
		const pad = new GamePad()
		pad.connect({ gamepad: initial } as GamepadEvent)
		const listener = vi.fn()
		pad.on(listener)
		current = { ...initial, buttons: [{ pressed: true } as GamepadButton] }
		pad.update()
		expect(listener).toHaveBeenCalledWith("b", true, -1)
		current = initial
		pad.update()
		const release = listener.mock.calls.find(([key, value]) => key === "b" && value === false)
		expect(typeof release?.[2]).toBe("number")
		expect(Number.isFinite(release?.[2])).toBe(true)
	})
	it("registers preconnected pads and cancels polling on destroy", () => {
		const device = {
			index: 0,
			id: "pad",
			connected: true,
			mapping: "standard",
			axes: [],
			buttons: []
		} as unknown as Gamepad
		vi.stubGlobal("window", new EventTarget())
		vi.stubGlobal("navigator", { getGamepads: () => [device] })
		vi.stubGlobal(
			"requestAnimationFrame",
			vi.fn(() => 12)
		)
		const cancel = vi.fn()
		vi.stubGlobal("cancelAnimationFrame", cancel)
		const manager = new GamePadManager()
		expect(manager.controllers.size).toBe(1)
		manager.destroy()
		expect(cancel).toHaveBeenCalledWith(12)
		expect(manager.controllers.size).toBe(0)
	})
})