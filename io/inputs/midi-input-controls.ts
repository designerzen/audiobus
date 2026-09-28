export interface MidiInputDeviceOption {
    id: string
    name: string
}

export function acceptsMidiInput(options: Record<string, any>, deviceId: string, channel: number): boolean {
    const devices = options.listenToAllDevices === true ? []
        : options.selectedDevice != null && options.selectedDevice !== '' ? [options.selectedDevice]
        : options.devices ?? []
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
        if (selected && !devices.some(item => item.id === selected)) {
            addOption(device, selected, `${selected} (unavailable)`)
        }
        device.value = selected
        status.textContent = devices.length ? '' : `No MIDI ${direction} devices available. Connect a device to select it.`
    }
    device.onchange = () => {
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
