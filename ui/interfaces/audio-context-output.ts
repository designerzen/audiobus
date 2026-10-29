/** Web Audio cannot read AudioDestinationNode. Engines publish their final output once. */
const outputs = new WeakMap<BaseAudioContext, AudioNode>()
const listeners = new WeakMap<BaseAudioContext, Set<(source: AudioNode) => void>>()

export function registerAudioContextOutput(context: BaseAudioContext, source: AudioNode) {
	if (source.context && source.context !== context) {
		throw new Error("Audio output must belong to the supplied context")
	}
	if (outputs.get(context) === source) {
		return
	}
	outputs.set(context, source)
	for (const listener of listeners.get(context) ?? []) {
		listener(source)
	}
}

/** Subscribe before or after engine initialization, without changing its speaker routing. */
export function observeAudioContextOutput(
	context: BaseAudioContext,
	listener: (source: AudioNode) => void
) {
	let subscribers = listeners.get(context)
	if (!subscribers) {
		listeners.set(context, (subscribers = new Set()))
	}
	subscribers.add(listener)
	const source = outputs.get(context)
	if (source) {
		listener(source)
	}
	return () => {
		subscribers.delete(listener)
	}
}