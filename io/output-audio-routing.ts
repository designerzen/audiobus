import type IOChain from "./IO-chain"
import type { IAudioOutput } from "./outputs/output-interface"
import { getAudioDestination } from "./audio-destination"
import { EVENT_CONNECTION_CHANGED } from "../events/event-constants"

/** Owns only audible routes; analyser taps and internal instrument wiring stay intact. */
export class OutputAudioRouting {
	private channels = new Map<
		IAudioOutput,
		{
			source: AudioNode
			gain: GainNode
			destinations: AudioNode[]
			targets: Set<AudioNode>
		}
	>()
	private listeners = new Map<IAudioOutput, () => void>()
	private chains: IOChain[] = []
	constructor(private mixer: AudioNode) {}
	getChannel(output: IAudioOutput): GainNode | undefined {
		return this.channels.get(output)?.gain
	}
	sync(chains: IOChain[]): void {
		this.chains = chains
		const outputs = new Set(chains.flatMap((chain) => chain.outputs))
		for (const [output, listener] of this.listeners) {
			if (!outputs.has(output)) {
				if (output instanceof EventTarget) {
					output.removeEventListener(EVENT_CONNECTION_CHANGED, listener)
				}
				this.listeners.delete(output)
			}
		}
		for (const output of outputs) {
			if (output instanceof EventTarget && !this.listeners.has(output)) {
				const listener = () => this.sync(this.chains)
				output.addEventListener(EVENT_CONNECTION_CHANGED, listener)
				this.listeners.set(output, listener)
			}
		}
		for (const [output, channel] of this.channels) {
			if (!outputs.has(output) || output.output !== channel.source) {
				try {
					channel.source.disconnect(channel.gain)
				} catch {
					/* Already disposed. */
				}
				channel.gain.disconnect()
				this.channels.delete(output)
			}
		}
		for (const output of outputs) {
			const source = output.output as AudioNode | undefined
			if (!source?.context?.createGain || source.context.state === "closed") {
				continue
			}
			let channel = this.channels.get(output)
			const destinations = new Set(channel?.destinations ?? [])
			for (const target of new Set([
				this.mixer,
				getAudioDestination(source.context),
				source.context.destination
			])) {
				if (target?.context !== source.context) {
					continue
				}
				try {
					source.disconnect(target)
					destinations.add(target)
				} catch {
					/* This Output does not use this destination. */
				}
			}
			if (!channel && (destinations.size || output.audioInput)) {
				const gain = source.context.createGain()
				channel = { source, gain, destinations: [], targets: new Set() }
				this.channels.set(output, channel)
			}
			if (channel) {
				channel.destinations = [...destinations]
				source.connect(channel.gain)
			}
		}
		const routes = new Map<IAudioOutput, Set<AudioNode>>()
		const processorsByInput = new Map(
			[...outputs]
				.filter((output) => output.audioInput)
				.map((output) => [output.audioInput!, output])
		)
		const reaches = (
			source: IAudioOutput,
			target: IAudioOutput,
			seen = new Set<IAudioOutput>()
		): boolean => {
			if (source === target) {
				return true
			}
			if (seen.has(source)) {
				return false
			}
			seen.add(source)
			return [...(routes.get(source) ?? [])].some((input) => {
				const next = processorsByInput.get(input)
				return next ? reaches(next, target, seen) : false
			})
		}
		const add = (output: IAudioOutput, targets: AudioNode[]) => {
			const next = routes.get(output) ?? new Set<AudioNode>()
			targets.forEach((target) => {
				const processor = processorsByInput.get(target)
				// Shared processors cannot run in opposite orders; bypass the conflicting
				// route rather than creating an audio feedback loop between chains.
				if (processor && reaches(processor, output)) {
					const destinations = this.channels.get(output)?.destinations ?? []
					;(destinations.length ? destinations : [this.mixer]).forEach((destination) =>
						next.add(destination)
					)
				} else {
					next.add(target)
				}
			})
			routes.set(output, next)
		}
		for (const chain of chains) {
			if (!chain.isActive) {
				continue
			}
			const enabled = chain.outputs.filter((output) => chain.outputManager.isEnabled(output))
			const processors = enabled.filter(
				(output) => output.audioInput && this.channels.has(output)
			)
			for (const output of enabled) {
				const channel = this.channels.get(output)
				if (!channel) {
					continue
				}
				const index = processors.indexOf(output)
				const next = processors[index + 1]
				add(
					output,
					next?.audioInput
						? [next.audioInput]
						: channel.destinations.length
							? channel.destinations
							: [this.mixer]
				)
			}
		}
		for (const [output, channel] of this.channels) {
			const targets = routes.get(output) ?? new Set<AudioNode>()
			for (const target of channel.targets) {
				if (!targets.has(target)) {
					channel.gain.disconnect(target)
				}
			}
			for (const target of targets) {
				if (target.context === channel.source.context && !channel.targets.has(target)) {
					channel.gain.connect(target)
				}
			}
			channel.targets = targets
		}
	}
}