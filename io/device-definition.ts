export interface DeviceDefinition {
    factory: 'input' | 'output' | 'instrument' | 'keyboard-input' | 'keyboard-output' | 'polyphonic' | 'external'
    type?: string
    options?: Record<string, any>
    inputId?: string
}

const definitions = new WeakMap<object, DeviceDefinition>()
const ids = new WeakMap<object, string>()

export function deviceId(device: object): string {
    let id = ids.get(device)
    if (!id) ids.set(device, id = crypto.randomUUID())
    return id
}

// Runtime resources (audio contexts, DOM nodes, callbacks) are supplied by the
// host when restoring. Only JSON data belongs in a saved device configuration.
export function configurationData(value: any): any {
    if (value === null || ['string', 'boolean', 'number'].includes(typeof value)) return value
    if (Array.isArray(value)) return value.map(configurationData)
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.fromEntries(Object.entries(value)
            .map(([key, item]) => [key, configurationData(item)])
            .filter(([, item]) => item !== undefined))
    }
    return undefined
}

export function defineDevice<T extends object>(device: T, definition: DeviceDefinition, id?: string): T {
    definitions.set(device, { ...definition, options: configurationData(definition.options) })
    if (id) ids.set(device, id)
    return device
}

export function deviceDefinition(device: object): DeviceDefinition {
    const definition = definitions.get(device)
    if (!definition) throw new Error('Device has no persistence definition; register it as an external device')
    return { ...definition, options: { ...definition.options, ...configurationData((device as any).options) } }
}
