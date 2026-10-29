import {
	PerformanceTransformer,
	numbers,
	routeKey,
	type Settings,
	type Voice
} from "./performance-transformer.ts"
import type { IAudioCommand } from "../../audio-command-interface.ts"
import { routeChannelMessage } from "./channel-routing.ts"

export const ID_CHANNEL_ALLOCATOR = "Channel-Allocator"
export class TransformerChannelAllocator extends PerformanceTransformer {
	type = ID_CHANNEL_ALLOCATOR
	category = "Routing"
	private nextChannel = 0
	private destinations = new Map<string, Set<number>>()
	get name() {
		return "Channel Allocator"
	}
	get description() {
		return "Distribute polyphonic notes across a MIDI channel pool, stealing the oldest voice when full."
	}
	get instructions() {
		return "Connect a multitimbral instrument or several mono synth voices listening on the chosen channels. This assigns ordinary MIDI channels; configure pitch-bend ranges separately on your instruments."
	}
	constructor(config: Settings = {}) {
		super(
			{ first: 2, last: 5, mode: "round-robin", controllers: "pool" },
			[
				{ name: "first", label: "First channel", values: numbers(1, 16), min: 1, max: 16 },
				{ name: "last", label: "Last channel", values: numbers(1, 16), min: 1, max: 16 },
				{ name: "mode", label: "Allocation", values: ["round-robin", "lowest-free"] },
				{
					name: "controllers",
					label: "Route channel controls",
					values: ["pool", "unchanged"],
					help: "Pool broadcasts channel controls to the selected channels and any destinations with held notes."
				}
			],
			config
		)
	}
	private channels() {
		return numbers(
			Math.round(Math.min(Number(this.options.first), Number(this.options.last))),
			Math.round(Math.max(Number(this.options.first), Number(this.options.last)))
		)
	}
	protected noteOn(voice: Voice) {
		const channels = this.channels()
		const active = [...this.voices].filter(
			(candidate) =>
				candidate !== voice &&
				candidate.targets.some((target) => channels.includes(target.channel))
		)
		const busy = new Set(
			active.flatMap((candidate) => candidate.targets.map((target) => target.channel))
		)
		const ordered =
			this.options.mode === "lowest-free"
				? channels
				: [
						...channels.filter((channel) => channel >= this.nextChannel),
						...channels.filter((channel) => channel < this.nextChannel)
					]
		let channel = ordered.find((channel) => !busy.has(channel))
		const result = []
		if (channel === undefined) {
			const oldest = active[0]
			channel = oldest.targets[0].channel
			result.push(...this.release(oldest))
		}
		this.nextChannel = channel + 1
		const on = this.start(voice)
		on.channel = channel
		const route = routeKey(voice.input),
			destinations = this.destinations.get(route) ?? new Set<number>()
		destinations.add(channel)
		this.destinations.set(route, destinations)
		return [...result, on]
	}
	protected other(command: IAudioCommand) {
		return this.options.controllers === "pool"
			? routeChannelMessage(command, [
					...this.channels(),
					...(this.destinations.get(routeKey(command)) ?? [])
				])
			: [command]
	}
	protected panicControls(command: IAudioCommand) {
		return this.other(command)
	}
	protected clearState() {
		this.nextChannel = 0
		this.destinations?.clear()
	}
	protected clearRoute(route: string) {
		this.destinations.delete(route)
		return []
	}
}