import { ALL_MIDI_CHANNELS } from "../../midi/midi-channels"

/** Incoming channel selection is independent of output channel remapping. */
export function createMidiChannelFilter(options: Record<string, any>, changed: () => void) {
	const element = document.createElement("fieldset")
	const legend = document.createElement("legend")
	legend.textContent = "Incoming channels"
	element.append(legend)
	const boxes: HTMLInputElement[] = []
	const refresh = () => {
		for (const [index, box] of boxes.entries()) {
			box.checked = (options.acceptedChannels ?? ALL_MIDI_CHANNELS).includes(index + 1)
		}
	}
	const select = (channels: number[]) => {
		options.acceptedChannels = channels
		refresh()
		changed()
	}
	const all = document.createElement("button")
	all.type = "button"
	all.textContent = "All channels"
	all.onclick = () => select([...ALL_MIDI_CHANNELS])
	element.append(all)
	const solo = document.createElement("select")
	solo.setAttribute("aria-label", "Solo incoming channel")
	for (const channel of [0, ...ALL_MIDI_CHANNELS]) {
		const option = document.createElement("option")
		option.value = String(channel)
		option.textContent = channel ? `Solo channel ${channel}` : "Solo a channel…"
		solo.append(option)
	}
	solo.onchange = () => {
		if (Number(solo.value)) {
			select([Number(solo.value)])
		}
		solo.value = "0"
	}
	element.append(solo)
	const grid = document.createElement("div")
	grid.style.display = "grid"
	grid.style.gridTemplateColumns = "repeat(4, 1fr)"
	for (const channel of ALL_MIDI_CHANNELS) {
		const label = document.createElement("label")
		label.textContent = String(channel)
		const box = document.createElement("input")
		box.type = "checkbox"
		box.setAttribute("aria-label", `Pass incoming channel ${channel}`)
		box.onchange = () => select(ALL_MIDI_CHANNELS.filter((_, index) => boxes[index].checked))
		boxes.push(box)
		label.append(box)
		grid.append(label)
	}
	element.append(grid)
	refresh()
	return {
		element,
		refresh,
		destroy() {
			all.onclick = null
			solo.onchange = null
			for (const box of boxes) {
				box.onchange = null
			}
			element.remove()
		}
	}
}