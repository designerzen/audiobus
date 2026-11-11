import { EVENT_CHANGE, EVENT_CONFIGURATION_CHANGED } from "../../events/event-constants"
import type { IAudioCommand } from "../../commands/audio-command-interface"
import type { IAudioOutput } from "./output-interface"

const filters = new WeakMap<object, number[]>()
const installed = new WeakSet<object>()
export function outputReceiveChannels(output: object): number[] | undefined {
	return (
		filters.get(output) ??
		(output as { options?: { receiveChannels?: number[] } }).options?.receiveChannels
	)
}
export function acceptsOutputChannel(output: object, command: IAudioCommand): boolean {
	const channels = outputReceiveChannels(output)
	// Realtime/system messages are channel-less; legacy commands default to channel one.
	if (
		(command.raw?.[0] ?? 0) >= 0xf0 ||
		(command.ump && ![2, 4].includes(command.ump[0] >>> 28))
	) {
		return true
	}
	return !channels?.length || channels.includes(command.channel >= 1 ? command.channel : 1)
}
export function installOutputChannelFilter(output: IAudioOutput, initial?: number[]): void {
	if (installed.has(output)) {
		return
	}
	installed.add(output)
	if (initial) {
		filters.set(output, [...initial])
	}
	const create = output.createGui?.bind(output)
	output.createGui = async () => {
		const root = create ? await create() : document.createElement("div")
		if (root.querySelector("[data-output-channel-filter]")) {
			return root
		}
		const label = document.createElement("label")
		label.dataset.outputChannelFilter = "true"
		label.textContent = "Receive song channels (blank = all)"
		const input = document.createElement("input")
		input.value = outputReceiveChannels(output)?.join(", ") ?? ""
		input.placeholder = "e.g. 1, 3, 10"
		input.setAttribute("aria-label", "Receive song channels")
		input.addEventListener(EVENT_CHANGE, () => {
			const channels = input.value.trim()
				? [...new Set(input.value.split(",").map((s) => Number(s.trim())))]
				: []
			if (channels.some((n) => !Number.isInteger(n) || n < 1 || n > 16)) {
				input.setCustomValidity("Enter MIDI channels 1–16 separated by commas.")
				input.reportValidity()
				return
			}
			input.setCustomValidity("")
			output.allNotesOff()
			filters.set(output, channels)
			if (output instanceof EventTarget) {
				output.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
			}
		})
		label.append(input)
		root.prepend(label)
		return root
	}
}