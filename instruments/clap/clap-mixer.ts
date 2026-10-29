// Only replace the links owned by this rack; analyser taps stay connected.
const racks = new WeakMap<AudioNode, { destination: AudioNode; nodes: AudioNode[] }>()

export function connectCLAPMixer(mixer: AudioNode, destination: AudioNode): void {
	if (racks.has(mixer)) {
		throw new Error("WebCLAP mixer is already connected")
	}
	racks.set(mixer, { destination, nodes: [] })
	mixer.connect(destination)
}

export function insertCLAPEffect(mixer: AudioNode, node: AudioNode): () => void {
	const rack = racks.get(mixer)
	if (!rack) {
		throw new Error("WebCLAP effects require a registered audio mixer")
	}
	const previous = rack.nodes.at(-1) ?? mixer
	previous.disconnect(rack.destination)
	previous.connect(node)
	node.connect(rack.destination)
	rack.nodes.push(node)
	return () => {
		const index = rack.nodes.indexOf(node)
		if (index < 0) {
			return
		}
		const before = rack.nodes[index - 1] ?? mixer
		const after = rack.nodes[index + 1] ?? rack.destination
		before.disconnect(node)
		node.disconnect(after)
		before.connect(after)
		rack.nodes.splice(index, 1)
	}
}