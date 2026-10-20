// Direct outputs join the final mix without passing through instrument effects.
const destinations = new WeakMap<BaseAudioContext, AudioNode>()

export function setAudioDestination(context: BaseAudioContext, destination: AudioNode): void {
    destinations.set(context, destination)
}

export function getAudioDestination(context: BaseAudioContext): AudioNode {
    return destinations.get(context) ?? context.destination
}
