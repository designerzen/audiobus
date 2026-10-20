export interface MidiInputDeviceOption {
    id: string
    name: string
    activeChannels?: number[]
}

export const UNAVAILABLE_MIDI_DEVICE = '__midi_device_unavailable__'
export function selectedMidiDevice(options: Record<string, any>): string | null {
    if (options.listenToAllDevices === true) return null
    const selected = options.selectedDevice ?? options.devices?.[0]
    return selected === undefined || selected === null || selected === '' ? null : String(selected)
}

export function acceptsMidiInput(options: Record<string, any>, deviceId: string, channel: number): boolean {
    const devices = options.listenToAllDevices === true ? []
        : options.selectedDevice != null && options.selectedDevice !== '' ? [options.selectedDevice]
        : options.devices?.length ? [options.devices[0]] : []
    const channels = options.selectedChannel ?? options.channels
    return (!devices.length || devices.some((id: string | number) => String(id) === deviceId)) &&
        (channel === 0 || channels == null || channels === 0 || (Array.isArray(channels) ? channels.includes(channel) : Number(channels) === channel))
}

export function createMidiInputControls(
    options: Record<string, any>,
    getDevices: () => MidiInputDeviceOption[],
    onChange: () => void = () => {},
    direction: 'input' | 'output' = 'input'
) {
    const element = document.createElement('div')
    element.className = `midi-${direction}-controls`
    element.style.display = 'grid'
    element.style.gap = '0.5rem'

    const addSelect = (text: string) => {
        const label = document.createElement('label')
        label.textContent = text
        const select = document.createElement('select')
        select.style.width = '100%'
        label.append(select)
        element.append(label)
        return select
    }
    const device = addSelect('MIDI device')
    const channel = addSelect('MIDI channel')
    const addOption = (select: HTMLSelectElement, value: string, text: string) => {
        const option = document.createElement('option')
        option.value = value
        option.textContent = text
        select.append(option)
    }
    if (direction === 'output') addOption(channel, '-1', 'Keep incoming channel')
    addOption(channel, '0', 'All channels')
    for (let i = 1; i <= 16; i++) addOption(channel, String(i), `Channel ${i}`)
    const channels = options.selectedChannel ?? options.channels
    channel.value = String(Array.isArray(channels) ? (channels.length === 1 ? channels[0] : 0) : channels ?? (direction === 'output' ? -1 : 0))
    const status = document.createElement('small')
    element.append(status)
    const refresh = () => {
        const channels = options.selectedChannel ?? options.channels
        channel.value = String(Array.isArray(channels) ? (channels.length === 1 ? channels[0] : 0) : channels ?? (direction === 'output' ? -1 : 0))
        const devices = getDevices()
        const selected = (direction === 'output' ? options.sendToAllDevices : options.listenToAllDevices) === true ? '' : String(options.selectedDevice ?? options.devices?.[0] ?? '')
        device.replaceChildren()
        addOption(device, '', 'All devices')
        for (const item of devices) addOption(device, item.id, item.name)
        const missing = selected && !devices.some(item => item.id === selected)
        if (missing && direction === 'output') {
            addOption(device, selected, `${selected} (unavailable)`)
        } else if (missing) {
            addOption(device, UNAVAILABLE_MIDI_DEVICE, 'Selected device disconnected — choose a device')
            ;(device.lastElementChild as HTMLOptionElement | null)?.setAttribute('disabled', '')
        }
        device.value = missing && direction === 'input' ? UNAVAILABLE_MIDI_DEVICE : selected
        const observed = [...new Set(devices.filter(item => !selected || item.id === selected).flatMap(item => item.activeChannels ?? []))].sort((a, b) => a - b)
        for (const option of Array.from(channel.options ?? [])) {
            const number = Number(option.value)
            if (number > 0) option.textContent = `Channel ${number}${observed.includes(number) ? ' (activity detected)' : ''}`
        }
        status.textContent = missing && direction === 'input' ? 'The selected MIDI device is disconnected. Reconnect it or choose another device.'
            : !devices.length ? `No MIDI ${direction} devices available. Connect a device to select it.`
            : direction === 'input' ? `Channels 1–16 available.${observed.length ? ` Activity detected on: ${observed.join(', ')}.` : ' No channel activity detected yet.'}` : ''
    }
    device.onchange = () => {
        if (device.value === UNAVAILABLE_MIDI_DEVICE) return
        options.selectedDevice = device.value
        options[direction === 'output' ? 'sendToAllDevices' : 'listenToAllDevices'] = device.value === ''
        options.devices = device.value ? [device.value] : []
        onChange()
    }
    channel.onchange = () => {
        options.selectedChannel = Number(channel.value)
        options.channels = channel.value === '0' ? Array.from({ length: 16 }, (_, i) => i + 1) : [Number(channel.value)]
        onChange()
    }
    refresh()
    return { element, refresh, destroy: () => {
        device.onchange = null
        channel.onchange = null
        element.remove()
    } }
}
