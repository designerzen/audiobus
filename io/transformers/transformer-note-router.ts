import { PerformanceTransformer, numbers, routeKey, type Settings, type Voice } from './performance-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import { routeChannelMessage } from './channel-routing.ts'

export const ID_NOTE_ROUTER = 'Note-Router'
export class TransformerNoteRouter extends PerformanceTransformer {
    protected type = ID_NOTE_ROUTER
    category = 'Routing'
    private destinations = new Map<string, Set<number>>()
    get name() { return 'Note Router' }
    get description() { return 'Split notes between two MIDI channels by key or playing velocity, with separate transpositions.' }
    constructor(config: Settings = {}) {
        super({ source: 'key', split: 60, lowerChannel: 1, upperChannel: 2, lowerTranspose: 0, upperTranspose: 0, controllers: 'both' }, [
            { name: 'source', label: 'Split by', values: ['key', 'velocity'] },
            { name: 'split', label: 'Split point', values: numbers(1, 127), min: 1, max: 127, help: 'Values below this point use the lower channel. The split point itself uses the upper channel.' },
            { name: 'lowerChannel', label: 'Lower zone channel', values: numbers(1, 16), min: 1, max: 16 },
            { name: 'upperChannel', label: 'Upper zone channel', values: numbers(1, 16), min: 1, max: 16 },
            { name: 'lowerTranspose', label: 'Lower zone transposition', values: [-24, -12, -7, 0, 7, 12, 24], min: -48, max: 48 },
            { name: 'upperTranspose', label: 'Upper zone transposition', values: [-24, -12, -7, 0, 7, 12, 24], min: -48, max: 48 },
            { name: 'controllers', label: 'Route controllers', values: ['both', 'unchanged'], help: 'Both sends sustain, pitch bend and other channel controls to both destination channels, including channels with held notes.' },
        ], config)
    }
    protected noteOn(voice: Voice) {
        const value = this.options.source === 'velocity' ? voice.input.velocity : voice.input.number
        const lower = value < Number(this.options.split)
        const pitch = voice.input.number + Number(lower ? this.options.lowerTranspose : this.options.upperTranspose)
        if (pitch < 0 || pitch > 127) return []
        const command = this.start(voice, pitch)
        command.channel = Math.round(Number(lower ? this.options.lowerChannel : this.options.upperChannel))
        const route = routeKey(voice.input), channels = this.destinations.get(route) ?? new Set<number>()
        channels.add(command.channel)
        this.destinations.set(route, channels)
        return [command]
    }
    protected other(command: IAudioCommand) {
        if (this.options.controllers !== 'both') return [command]
        const channels = [Number(this.options.lowerChannel), Number(this.options.upperChannel),
            ...(this.destinations.get(routeKey(command)) ?? [])]
        return routeChannelMessage(command, channels)
    }
    protected panicControls(command: IAudioCommand) { return this.other(command) }
    protected clearState() { this.destinations?.clear() }
    protected clearRoute(route: string) { this.destinations.delete(route); return [] }
}
