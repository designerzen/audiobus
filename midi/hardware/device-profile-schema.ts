export interface MidiProfileMessage {
    type: 'cc' | 'note' | 'pitchBend' | 'programChange' | 'channelPressure' | 'sysex'
    number?: number
    channel?: number
    bytes?: (number | 'value')[]
}

export interface MidiProfileControl {
    id: string
    label: string
    widget?: 'slider' | 'toggle' | 'button' | 'select' | 'meter'
    momentary?: boolean
    cc?: number
    message?: MidiProfileMessage
    messages?: MidiProfileMessage[]
    min?: number
    max?: number
    step?: number
    default?: number
    options?: { label: string; value: number }[]
}

export interface MidiGuiNode {
    type: 'column' | 'row' | 'grid' | 'overlay' | 'section' | 'tabs' | 'text' | 'image'
        | 'status' | 'notes' | 'channel' | 'mode' | 'controls' | 'control' | 'xy' | 'guide'
    label?: string
    text?: string
    src?: string
    alt?: string
    control?: string
    controls?: string[]
    x?: string
    y?: string
    columns?: number
    gap?: string
    position?: { x: number; y: number; width?: number; height?: number }
    style?: Partial<Record<'background' | 'color' | 'padding' | 'borderRadius' | 'maxWidth' | 'minHeight' | 'aspectRatio' | 'fontSize', string>>
    children?: MidiGuiNode[]
}

export interface MidiSurfaceElement {
    id: string
    label: string
    kind: 'key' | 'pad' | 'button' | 'knob' | 'fader'
    position: { x: number; y: number; width: number; height: number }
    control?: string
    message?: MidiProfileMessage
    learnable?: boolean
    dark?: boolean
}

export interface MidiDeviceSurface {
    src: string
    width: number
    height: number
    elements: MidiSurfaceElement[]
}

export interface MidiDeviceProfile {
    id: string
    schemaVersion: 1
    name: string
    manufacturer: string
    manufacturerUrl?: string
    productUrl?: string
    description: string
    ids: string[]
    portNames: string[]
    icon?: string
    documentation: { title: string; url: string }[]
    abilities: string[]
    hardwareControls: string[]
    notice: string
    controls: MidiProfileControl[]
    modes: { id: string; label: string; cc: number[] }[]
    gui: MidiGuiNode
    surface?: MidiDeviceSurface
}

export const controlMessage = (control: MidiProfileControl): MidiProfileMessage => control.message ?? { type: 'cc', number: control.cc }
export const controlRange = (control: MidiProfileControl) => ({
    min: control.min ?? 0,
    max: control.max ?? (controlMessage(control).type === 'pitchBend' ? 16383 : 127),
    step: control.step ?? 1
})

function requireValue(condition: unknown, reason: string): asserts condition {
    if (!condition) throw new Error(reason)
}
const integer = (value: unknown, min: number, max: number) => Number.isInteger(value) && Number(value) >= min && Number(value) <= max
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0)
const relativeAsset = (value: unknown): value is string => typeof value === 'string' && /^[\w./ -]+\.(svg|png|jpe?g|webp|avif|gif)$/i.test(value)
    && !value.startsWith('/') && value.split('/').every(segment => segment !== '..' && segment !== '.' && !!segment)

// Validate each folder independently: a broken new device must not prevent
// existing instruments from loading. Assets cannot escape their device folder.
export function parseMidiDeviceProfile(id: string, raw: unknown, asset: (path: string) => string | undefined): MidiDeviceProfile {
    requireValue(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id), 'Invalid device folder ID')
    requireValue(raw && typeof raw === 'object' && !Array.isArray(raw), 'Expected a JSON object')
    requireValue(!('id' in raw) || raw.id === id, 'Device ID must match its folder and JSON filename')
    const profile = { manufacturer: '', description: '', ids: [id], portNames: [], documentation: [], abilities: [], hardwareControls: [], notice: '', controls: [], modes: [], ...raw, id } as unknown as MidiDeviceProfile
    requireValue(profile.schemaVersion === 1, 'Expected schemaVersion 1')
    requireValue(typeof profile.name === 'string' && profile.name.trim(), 'Device name is required')
    requireValue(strings(profile.ids) && profile.ids.length && strings(profile.portNames), 'Invalid MIDI IDs or port names')
    requireValue(strings(profile.abilities) && strings(profile.hardwareControls), 'Invalid device abilities or hardware controls')
    for (const key of ['manufacturer', 'description', 'notice'] as const) requireValue(typeof profile[key] === 'string', `Invalid ${key}`)
    for (const key of ['manufacturerUrl', 'productUrl'] as const) requireValue(profile[key] === undefined || /^https?:\/\//.test(profile[key]!), `Invalid ${key}`)
    requireValue(Array.isArray(profile.documentation) && profile.documentation.every(item => item && typeof item.title === 'string' && /^https?:\/\//.test(item.url)), 'Invalid documentation links')
    const resolveAsset = (path: string) => {
        requireValue(relativeAsset(path), `Invalid relative image path: ${path}`)
        const url = asset(path)
        requireValue(url, `Missing device image: ${path}`)
        return url
    }
    if (profile.icon) profile.icon = resolveAsset(profile.icon)
    const message = (item: MidiProfileMessage) => {
        requireValue(item && ['cc', 'note', 'pitchBend', 'programChange', 'channelPressure', 'sysex'].includes(item.type), 'Invalid MIDI message type')
        requireValue(item.channel === undefined || integer(item.channel, 1, 16), 'MIDI channels must be 1–16')
        if (item.type === 'cc' || item.type === 'note') requireValue(integer(item.number, 0, 127), 'MIDI controller/note numbers must be 0–127')
        if (item.type === 'sysex') requireValue(Array.isArray(item.bytes) && item.bytes.length >= 2 && item.bytes[0] === 240
            && item.bytes.at(-1) === 247 && item.bytes.slice(1, -1).every(byte => byte === 'value' || integer(byte, 0, 127)), 'Invalid SysEx byte template')
    }
    requireValue(Array.isArray(profile.controls), 'Controls must be an array')
    const controls = new Map<string, MidiProfileControl>()
    for (const control of profile.controls) {
        requireValue(control && typeof control.id === 'string' && !!control.id && !controls.has(control.id) && typeof control.label === 'string', 'Missing or duplicate control ID/label')
        requireValue(control.widget === undefined || ['slider', 'toggle', 'button', 'select', 'meter'].includes(control.widget), 'Invalid control widget')
        requireValue(control.momentary === undefined || typeof control.momentary === 'boolean', 'Invalid momentary setting')
        requireValue(!(control.message && control.cc !== undefined), 'Use either cc or message for a control')
        message(controlMessage(control))
        if (control.messages !== undefined) {
            requireValue(Array.isArray(control.messages) && control.messages.length > 0, 'Invalid control message list')
            control.messages.forEach(message)
        }
        const { min, max, step } = controlRange(control)
        const limit = controlMessage(control).type === 'pitchBend' ? 16383 : 127
        requireValue(integer(min, 0, limit) && integer(max, min, limit) && integer(step, 1, Math.max(1, max - min)), 'Invalid control range')
        requireValue(control.default === undefined || integer(control.default, min, max), 'Invalid control default')
        if (control.widget === 'select') requireValue(Array.isArray(control.options) && control.options.length && control.options.every(item => typeof item.label === 'string' && integer(item.value, min, max)), 'Invalid select choices')
        controls.set(control.id, control)
    }
    requireValue(Array.isArray(profile.modes) && profile.modes.every(mode => mode && typeof mode.id === 'string' && typeof mode.label === 'string'
        && Array.isArray(mode.cc) && mode.cc.every(cc => integer(cc, 0, 127))), 'Invalid CC display modes')
    const node = (item: MidiGuiNode, depth = 0): MidiGuiNode => {
        requireValue(depth < 32 && item && ['column', 'row', 'grid', 'overlay', 'section', 'tabs', 'text', 'image', 'status', 'notes', 'channel', 'mode', 'controls', 'control', 'xy', 'guide'].includes(item.type), 'Invalid GUI node or excessive nesting')
        for (const key of ['label', 'text', 'alt', 'gap'] as const) requireValue(item[key] === undefined || typeof item[key] === 'string', `Invalid GUI ${key}`)
        if (item.type === 'control') requireValue(controls.has(item.control ?? ''), `Unknown control: ${item.control}`)
        if (item.controls) requireValue(strings(item.controls) && item.controls.every(id => controls.has(id)), 'Unknown controls in GUI')
        if (item.type === 'xy') {
            requireValue(controls.has(item.x ?? '') && controls.has(item.y ?? '') && item.x !== item.y, 'XY pads require two different controls')
            for (const id of [item.x!, item.y!]) requireValue(['cc', 'pitchBend', 'channelPressure'].includes(controlMessage(controls.get(id)!).type), 'XY pads require continuous MIDI controls')
        }
        if (item.columns !== undefined) requireValue(integer(item.columns, 1, 12), 'Grid columns must be 1–12')
        if (item.position) {
            requireValue(item.position.x !== undefined && item.position.y !== undefined, 'Overlay positions require x and y')
            for (const coordinate of Object.values(item.position)) requireValue(typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= 0 && coordinate <= 100, 'Overlay coordinates must be percentages from 0–100')
        }
        if (item.style) {
            requireValue(typeof item.style === 'object' && !Array.isArray(item.style), 'Invalid GUI style')
            for (const [key, value] of Object.entries(item.style)) requireValue(['background', 'color', 'padding', 'borderRadius', 'maxWidth', 'minHeight', 'aspectRatio', 'fontSize'].includes(key) && typeof value === 'string', `Unsupported GUI style: ${key}`)
        }
        if (item.children !== undefined) requireValue(Array.isArray(item.children), 'GUI children must be an array')
        return { ...item, ...(item.type === 'image' ? { src: resolveAsset(item.src ?? '') } : {}), ...(item.children ? { children: item.children.map(child => node(child, depth + 1)) } : {}) }
    }
    profile.gui = node(profile.gui)
    if (profile.surface !== undefined) {
        const surface = profile.surface
        requireValue(surface && integer(surface.width, 1, 8192) && integer(surface.height, 1, 8192)
            && Array.isArray(surface.elements), 'Invalid hardware surface')
        const ids = new Set<string>()
        for (const item of surface.elements) {
            requireValue(item && typeof item.id === 'string' && !!item.id && !ids.has(item.id)
                && typeof item.label === 'string' && ['key', 'pad', 'button', 'knob', 'fader'].includes(item.kind), 'Invalid surface element')
            ids.add(item.id)
            requireValue(item.position && Object.values(item.position).length === 4
                && ['x', 'y', 'width', 'height'].every(key => {
                    const value = item.position[key as keyof typeof item.position]
                    return Number.isFinite(value) && value >= 0 && value <= 100
                }) && item.position.width > 0 && item.position.height > 0
                && item.position.x + item.position.width <= 100.01 && item.position.y + item.position.height <= 100.01, 'Invalid surface position')
            requireValue(!item.control || controls.has(item.control), 'Unknown surface control')
            requireValue(!(item.control && item.message), 'Surface element must reference a control or a message')
            if (item.message) message(item.message)
            requireValue(item.learnable === undefined || typeof item.learnable === 'boolean', 'Invalid surface learning flag')
            requireValue(item.dark === undefined || typeof item.dark === 'boolean', 'Invalid surface key style')
        }
        profile.surface = { ...surface, src: resolveAsset(surface.src) }
    }
    return profile
}

export function profileMessageBytes(message: MidiProfileMessage, value: number, channel: number): number[] {
    const selected = Math.max(1, Math.min(16, message.channel ?? channel)) - 1
    const max = message.type === 'pitchBend' ? 16383 : 127
    const amount = Math.max(0, Math.min(max, Math.round(value)))
    switch (message.type) {
        case 'cc': return [0xb0 | selected, message.number!, amount]
        case 'note': return [(amount ? 0x90 : 0x80) | selected, message.number!, amount]
        case 'programChange': return [0xc0 | selected, amount]
        case 'channelPressure': return [0xd0 | selected, amount]
        case 'pitchBend': return [0xe0 | selected, amount & 127, amount >> 7]
        case 'sysex': return message.bytes!.map(byte => byte === 'value' ? amount : byte)
    }
}
