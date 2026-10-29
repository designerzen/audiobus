import { PerformanceTransformer, clamp, copyCommand, numbers, type Settings, type Voice } from './performance-transformer.ts'
import type { IAudioCommand } from '../../audio-command-interface.ts'
import { CONTROL_CHANGE } from '../../commands'

export const ID_CC_MAPPER = 'CC-Mapper'
export class TransformerCCMapper extends PerformanceTransformer {
    protected type = ID_CC_MAPPER
    category = 'Routing'
    get name() { return 'CC Mapper' }
    get description() { return 'Reassign a MIDI controller, scale or invert its range, or filter it out.' }
    constructor(config: Settings = {}) {
        super({ input: 1, output: 11, minimum: 0, maximum: 127, channel: 0, thru: 0, block: 0 }, [
            { name: 'input', label: 'Input CC', values: numbers(0, 119), min: 0, max: 119 },
            { name: 'output', label: 'Output CC', values: numbers(0, 119), min: 0, max: 119 },
            { name: 'minimum', label: 'Output at input 0', values: numbers(0, 127), min: 0, max: 127 },
            { name: 'maximum', label: 'Output at input 127', values: numbers(0, 127), min: 0, max: 127 },
            { name: 'channel', label: 'Output channel', values: [{ name: 'Follow input', value: 0 }, ...numbers(1, 16)], min: 0, max: 16 },
            { name: 'thru', label: 'Keep original CC', values: [0, 1], min: 0, max: 1 },
            { name: 'block', label: 'Block selected CC', values: [0, 1], min: 0, max: 1 },
        ], config)
    }
    protected noteOn(voice: Voice) { return [this.start(voice)] }
    protected other(command: IAudioCommand) {
        if (command.type !== CONTROL_CHANGE || command.number !== Number(this.options.input)) return [command]
        if (this.options.block) return []
        const value = Math.round(Number(this.options.minimum) + clamp(command.value, 0, 127) / 127 * (Number(this.options.maximum) - Number(this.options.minimum)))
        const mapped = copyCommand(command, { number: Number(this.options.output), value, channel: Number(this.options.channel) || command.channel })
        return this.options.thru ? [command, mapped] : [mapped]
    }
}
