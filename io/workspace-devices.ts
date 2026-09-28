import AbstractInput from './inputs/abstract-input'
import { defineDevice, type DeviceDefinition } from './device-definition'

export interface SavedDevice {
    id: string
    direction: 'input' | 'output'
    definition: DeviceDefinition
}

export class UnavailableDevice extends AbstractInput {
    readonly isUnavailable = true
    constructor(readonly definition: DeviceDefinition, readonly reason: string) { super(definition.options) }
    get name() { return `${this.definition?.type ?? this.definition?.factory ?? 'Device'} (unavailable)` }
    get description() { return this.reason }
    noteOn() {}
    noteOff() {}
    allNotesOff() {}
    destroy() {}
}

export async function restoreDevice(saved: SavedDevice, options: {
    audioContext?: AudioContext
    outputMixer: GainNode
    now: () => number
    externalDevices?: Record<string, object>
}, devices: Map<string, any>): Promise<any> {
    const { definition, id } = saved
    const creationOptions = { ...definition.options, audioContext: options.audioContext, mixer: options.outputMixer, now: options.now }
    let device: any
    switch (definition.factory) {
        case 'input':
            device = await (await import('./input-factory')).createInputById(definition.type!, creationOptions)
            break
        case 'output':
            device = await (await import('./output-factory')).createOutputById(definition.type!, creationOptions)
            break
        case 'instrument':
            device = await (await import('../instruments/instrument-factory-ui')).createInstrumentById(options.audioContext!, definition.type!, creationOptions)
            break
        case 'keyboard-input':
            device = new (await import('./inputs/input-onscreen-keyboard')).default(creationOptions)
            break
        case 'keyboard-output': {
            const input = devices.get(definition.inputId!)
            if (!input?.keyboard) throw new Error('Onscreen keyboard input is unavailable')
            device = new (await import('./outputs/output-onscreen-keyboard')).default(input.keyboard)
            break
        }
        case 'polyphonic':
            device = new (await import('../instruments/polyphonic')).default(options.audioContext!, creationOptions)
            device.output.connect(options.outputMixer)
            break
        case 'external':
            device = options.externalDevices?.[definition.type!]
            if (!device) throw new Error(`External device unavailable: ${definition.type}`)
            break
        default: throw new Error('Invalid device factory')
    }
    return defineDevice(device, definition, id)
}
