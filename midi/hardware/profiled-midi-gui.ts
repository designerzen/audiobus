import { CONTROL_CHANGE, NOTE_OFF, NOTE_ON, PITCH_BEND, PROGRAM_CHANGE } from '../../commands'
import { CHANNEL_PRESSURE } from '../midi-command-conversion'
import type { IAudioCommand } from '../../audio-command-interface'
import { controlMessage, controlRange, type MidiDeviceProfile, type MidiGuiNode, type MidiProfileControl, type MidiProfileMessage } from './device-profile-schema'
import { EVENT_INPUT, EVENT_CHANGE, EVENT_CLICK, EVENT_POINTER_DOWN, EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE, EVENT_POINTER_MOVE, EVENT_KEY_DOWN, EVENT_KEY_UP, EVENT_BLUR } from '../../event-constants'

export function createProfiledMidiGui(profile: MidiDeviceProfile, options: Record<string, any>,
    perform: (message: MidiProfileMessage, value: number) => void, changed: () => void) {
    const element = document.createElement('div')
    element.className = 'profiled-midi-controls'
    element.dataset.deviceProfile = profile.id
    element.style.cssText = 'min-width:240px;max-width:520px;width:100%'
    const abort = new AbortController()
    const listen = (target: EventTarget, type: string, handler: (event: any) => void) => target.addEventListener(type, handler, { signal: abort.signal })
    const definitions = new Map(profile.controls.map(control => [control.id, control]))
    const values = new Map(profile.controls.map(control => [control.id, control.default ?? controlRange(control).min]))
    const updates = new Map<string, Set<(value: number) => void>>()
    const interactive = new Set<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>()
    const visibility: { element: HTMLElement; ids: string[] }[] = []
    const statuses: HTMLElement[] = [], noteDisplays: HTMLElement[] = []
    const channelSelects: HTMLSelectElement[] = []
    const observedChannels = new Set<number>()
    const activeNotes = new Map<string, number>()
    const heldNotes = new Map<string, MidiProfileMessage>()
    const releases = new Set<() => void>()
    const hiddenDisplays = new WeakMap<HTMLElement, string>()
    const setHidden = (node: HTMLElement, hidden: boolean) => {
        node.hidden = hidden
        if (hidden) {
            if (!hiddenDisplays.has(node)) hiddenDisplays.set(node, node.style.display)
            node.style.display = 'none'
        } else if (hiddenDisplays.has(node)) {
            node.style.display = hiddenDisplays.get(node)!
            hiddenDisplays.delete(node)
        }
    }
    let connected = false
    let mode: MidiDeviceProfile['modes'][number] | undefined = profile.modes.find(mode => mode.id === options.displayMode) ?? profile.modes[0]
    const watch = (id: string, update: (value: number) => void) => {
        const listeners = updates.get(id) ?? new Set()
        listeners.add(update); updates.set(id, listeners)
        update(values.get(id) ?? 0)
    }
    const setValue = (control: MidiProfileControl, value: number) => {
        values.set(control.id, value)
        updates.get(control.id)?.forEach(update => update(value))
    }
    const send = (message: MidiProfileMessage, value: number) => {
        if (!connected) return
        const bound = { ...message, channel: message.channel ?? (options.selectedChannel || 1) }
        if (bound.type === 'note') {
            const key = `${bound.channel}:${bound.number}`
            if (value) heldNotes.set(key, bound)
            else heldNotes.delete(key)
        }
        perform(bound, value)
    }
    const write = (control: MidiProfileControl, value: number) => {
        if (!connected || control.widget === 'meter') return
        const { min, max, step } = controlRange(control)
        const next = Math.max(min, Math.min(max, min + Math.round((value - min) / step) * step))
        setValue(control, next)
        for (const message of control.messages ?? [controlMessage(control)]) send(message, next)
    }
    const release = () => {
        releases.forEach(callback => callback())
        for (const message of heldNotes.values()) perform(message, 0)
        heldNotes.clear()
    }
    const renderNotes = () => noteDisplays.forEach(display => {
        display.textContent = activeNotes.size ? `Notes: ${[...activeNotes.values()].join(', ')}` : 'No notes held'
    })
    const refreshMode = () => visibility.forEach(item => {
        setHidden(item.element, !!mode && item.ids.some(id => {
            const message = controlMessage(definitions.get(id)!)
            return message.type === 'cc' && !mode!.cc.includes(message.number!)
        }))
    })
    const addOption = (select: HTMLSelectElement, value: string, text: string) => {
        const item = document.createElement('option'); item.value = value; item.textContent = text; select.append(item)
    }
    const addInteractive = <T extends HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(node: T): T => {
        interactive.add(node); node.disabled = !connected
        // These are MIDI sources with their own bindings. Making them learn
        // targets as well could feed generated messages back recursively.
        node.dataset.midiIgnore = ''
        return node
    }
    const controlView = (control: MidiProfileControl): HTMLElement => {
        const row = document.createElement('label')
        row.style.cssText = 'display:flex;flex-direction:column;gap:.3rem;min-width:0'
        const message = controlMessage(control)
        const label = `${control.label}${message.type === 'cc' ? ` · CC ${message.number}` : ''}`
        row.append(label)
        const output = document.createElement('output')
        output.textContent = '—'
        const { min, max, step } = controlRange(control)
        const widget = control.widget ?? 'slider'
        let input: HTMLElement
        if (widget === 'select') {
            const select = addInteractive(document.createElement('select'))
            control.options!.forEach(item => addOption(select, String(item.value), item.label))
            watch(control.id, value => { select.value = String(value) })
            listen(select, EVENT_CHANGE, () => write(control, Number(select.value)))
            input = select
        } else if (widget === 'toggle') {
            const toggle = addInteractive(document.createElement('input'))
            toggle.type = 'checkbox'
            watch(control.id, value => { toggle.checked = value > min })
            listen(toggle, EVENT_CHANGE, () => write(control, toggle.checked ? max : min))
            input = toggle
        } else if (widget === 'button') {
            const button = addInteractive(document.createElement('button'))
            button.type = 'button'; button.textContent = control.label
            let pressed = false
            let held: MidiProfileMessage[] = []
            const press = () => {
                if (pressed || !connected) return
                pressed = true
                held = (control.messages ?? [message]).map(message => ({ ...message, channel: message.channel ?? (options.selectedChannel || 1) }))
                setValue(control, max)
                held.forEach(message => send(message, max))
                button.setAttribute('aria-pressed', 'true')
            }
            const unpress = () => {
                if (!pressed) return
                pressed = false
                held.forEach(message => send(message, message.type === 'note' ? 0 : min))
                setValue(control, min)
                button.setAttribute('aria-pressed', 'false')
            }
            releases.add(unpress)
            const momentary = control.momentary ?? message.type === 'note'
            if (momentary) {
                listen(button, EVENT_POINTER_DOWN, (event: PointerEvent) => { if (event.button !== 0) return; event.preventDefault(); button.setPointerCapture?.(event.pointerId); press() })
                for (const event of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE, EVENT_BLUR]) listen(button, event, unpress)
                listen(button, EVENT_KEY_DOWN, (event: KeyboardEvent) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) press() } })
                listen(button, EVENT_KEY_UP, (event: KeyboardEvent) => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); unpress() } })
            } else listen(button, EVENT_CLICK, () => write(control, max))
            watch(control.id, value => button.setAttribute('aria-pressed', String(value > min)))
            input = button
        } else if (widget === 'meter') {
            const meter = document.createElement('meter')
            meter.min = min; meter.max = max
            watch(control.id, value => { meter.value = value })
            input = meter
        } else {
            const slider = addInteractive(document.createElement('input'))
            slider.type = 'range'; slider.min = String(min); slider.max = String(max); slider.step = String(step)
            slider.style.width = '100%'
            watch(control.id, value => { slider.value = String(value) })
            listen(slider, EVENT_INPUT, () => write(control, Number(slider.value)))
            input = slider
        }
        input.dataset.midiControl = control.id
        input.setAttribute('aria-label', label)
        watch(control.id, value => { output.value = String(value) })
        row.append(input, output)
        visibility.push({ element: row, ids: [control.id] })
        return row
    }
    const render = (node: MidiGuiNode): HTMLElement => {
        const host = document.createElement(node.type === 'section' ? 'fieldset' : 'div')
        host.dataset.guiType = node.type
        if (node.type === 'column' || node.type === 'row') host.style.cssText = `display:flex;flex-direction:${node.type};gap:${node.gap ?? '.65rem'};min-width:0`
        if (node.type === 'grid') host.style.cssText = `display:grid;grid-template-columns:repeat(${node.columns ?? 2},minmax(0,1fr));gap:${node.gap ?? '.65rem'}`
        if (node.type === 'overlay') host.style.cssText = 'position:relative'
        if (node.type === 'section') {
            host.style.cssText = 'min-width:0;border:1px solid currentColor;border-radius:.5rem;padding:.65rem'
            if (node.label) { const title = document.createElement('legend'); title.textContent = node.label; host.append(title) }
        }
        switch (node.type) {
            case 'status': host.setAttribute('role', 'status'); statuses.push(host); break
            case 'notes': noteDisplays.push(host); renderNotes(); break
            case 'text': host.textContent = node.text ?? ''; break
            case 'image': {
                const image = document.createElement('img')
                image.src = node.src!; image.alt = node.alt ?? ''; image.style.cssText = 'display:block;width:100%;height:auto;border-radius:.6rem'
                host.append(image); break
            }
            case 'channel': {
                const label = document.createElement('label'); label.textContent = node.label ?? 'MIDI channel '
                const select = document.createElement('select')
                select.dataset.midiControl = 'channel'
                channelSelects.push(select)
                addOption(select, '0', 'All incoming / channel 1 for controls')
                for (let i = 1; i <= 16; i++) addOption(select, String(i), `Channel ${i}`)
                select.value = String(options.selectedChannel ?? 0)
                listen(select, EVENT_CHANGE, () => { release(); options.selectedChannel = Number(select.value); changed() })
                label.append(select); host.append(label); break
            }
            case 'mode': {
                const label = document.createElement('label'); label.textContent = node.label ?? 'Display CC mode '
                const select = document.createElement('select'); select.dataset.midiIgnore = ''
                profile.modes.forEach(item => addOption(select, item.id, item.label))
                select.value = mode?.id ?? ''
                listen(select, EVENT_CHANGE, () => { mode = profile.modes.find(item => item.id === select.value); options.displayMode = mode?.id; refreshMode(); changed() })
                label.append(select); host.append(label); break
            }
            case 'control': host.append(controlView(definitions.get(node.control!)!)); break
            case 'controls': {
                host.style.display = 'contents'
                for (const id of node.controls ?? profile.controls.map(item => item.id)) host.append(controlView(definitions.get(id)!))
                break
            }
            case 'xy': {
                const x = definitions.get(node.x!)!, y = definitions.get(node.y!)!
                const pad = addInteractive(document.createElement('button'))
                pad.type = 'button'; pad.setAttribute('aria-label', node.label ?? `${x.label} / ${y.label}`)
                pad.style.cssText = 'position:relative;display:block;width:100%;aspect-ratio:1;touch-action:none;background:linear-gradient(0deg,transparent 49%,currentColor 50%,transparent 51%),linear-gradient(90deg,transparent 49%,currentColor 50%,transparent 51%);border:1px solid currentColor;border-radius:.5rem'
                const dot = document.createElement('span')
                dot.style.cssText = 'position:absolute;width:12px;height:12px;background:currentColor;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none'
                pad.append(dot)
                const xr = controlRange(x), yr = controlRange(y)
                watch(x.id, value => { dot.style.left = `${(value - xr.min) / (xr.max - xr.min || 1) * 100}%` })
                watch(y.id, value => { dot.style.top = `${100 - (value - yr.min) / (yr.max - yr.min || 1) * 100}%` })
                let pointer: number | undefined
                const move = (event: PointerEvent) => {
                    if (event.pointerId !== pointer) return
                    const bounds = pad.getBoundingClientRect()
                    if (!bounds.width || !bounds.height) return
                    write(x, xr.min + (event.clientX - bounds.left) / bounds.width * (xr.max - xr.min))
                    write(y, yr.max - (event.clientY - bounds.top) / bounds.height * (yr.max - yr.min))
                }
                listen(pad, EVENT_POINTER_DOWN, (event: PointerEvent) => { if (event.button !== 0) return; event.preventDefault(); pointer = event.pointerId; pad.setPointerCapture?.(pointer); move(event) })
                listen(pad, EVENT_POINTER_MOVE, move)
                for (const event of [EVENT_POINTER_UP, EVENT_POINTER_CANCEL, EVENT_LOST_POINTER_CAPTURE, EVENT_BLUR]) listen(pad, event, () => { pointer = undefined })
                listen(pad, EVENT_KEY_DOWN, (event: KeyboardEvent) => {
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
                    event.preventDefault()
                    const control = event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? x : y
                    write(control, values.get(control.id)! + controlRange(control).step * (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -1 : 1))
                })
                host.append(pad); visibility.push({ element: host, ids: [x.id, y.id] }); break
            }
            case 'guide': {
                const guide = document.createElement('details'); guide.dataset.midiIgnore = ''
                const summary = document.createElement('summary'); summary.textContent = node.label ?? 'Instrument controls and guide'
                const abilities = document.createElement('p'); abilities.textContent = profile.abilities.join(' · ')
                const physical = document.createElement('ul')
                for (const name of profile.hardwareControls) { const item = document.createElement('li'); item.textContent = name; physical.append(item) }
                const notice = document.createElement('p'); notice.textContent = profile.notice
                guide.append(summary, abilities, physical, notice)
                const sources = [
                    ...(profile.manufacturerUrl ? [{ title: profile.manufacturer || 'Manufacturer', url: profile.manufacturerUrl }] : []),
                    ...(profile.productUrl ? [{ title: `${profile.name} product page`, url: profile.productUrl }] : []),
                    ...profile.documentation
                ]
                for (const source of sources) {
                    const link = document.createElement('a'); link.textContent = source.title; link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'
                    const paragraph = document.createElement('p'); paragraph.append(link); guide.append(paragraph)
                }
                host.append(guide); break
            }
            case 'tabs': {
                const bar = document.createElement('div'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', node.label ?? 'Device controls')
                const panels: HTMLElement[] = [], tabs: HTMLButtonElement[] = []
                const choose = (index: number) => {
                    panels.forEach((panel, i) => setHidden(panel, i !== index))
                    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1 })
                }
                for (const [index, child] of (node.children ?? []).entries()) {
                    const panel = render(child); panel.id = `midi-panel-${crypto.randomUUID()}`; panel.setAttribute('role', 'tabpanel')
                    const button = document.createElement('button'); button.type = 'button'; button.textContent = child.label ?? `Page ${index + 1}`
                    button.id = `midi-tab-${crypto.randomUUID()}`; button.dataset.midiIgnore = ''; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', panel.id)
                    panel.setAttribute('aria-labelledby', button.id)
                    listen(button, EVENT_CLICK, () => choose(index))
                    listen(button, EVENT_KEY_DOWN, (event: KeyboardEvent) => {
                        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
                        if (next >= 0) { event.preventDefault(); choose(next); tabs[next].focus() }
                    })
                    panels.push(panel); tabs.push(button); bar.append(button)
                }
                host.append(bar, ...panels); choose(0); break
            }
        }
        if (node.type !== 'tabs') for (const child of node.children ?? []) host.append(render(child))
        if (node.style) Object.assign(host.style, node.style)
        if (node.position) {
            host.style.position = 'absolute'; host.style.left = `${node.position.x}%`; host.style.top = `${node.position.y}%`
            if (node.position.width !== undefined) host.style.width = `${node.position.width}%`
            if (node.position.height !== undefined) host.style.height = `${node.position.height}%`
        }
        return host
    }
    element.append(render(profile.gui))
    refreshMode()
    return {
        element, release,
        setConnected(value: boolean, port: string) {
            if (!value) release()
            connected = value
            statuses.forEach(status => { status.textContent = connected ? `Connected: ${port}` : `Waiting for ${profile.name}${port ? ` (${port})` : ''}` })
            interactive.forEach(input => { input.disabled = !connected })
            if (!connected) {
                activeNotes.clear(); renderNotes()
                profile.controls.forEach(control => setValue(control, control.default ?? controlRange(control).min))
            }
        },
        receive(command: IAudioCommand) {
            if (command.channel >= 1 && command.channel <= 16 && !observedChannels.has(command.channel)) {
                observedChannels.add(command.channel)
                for (const select of channelSelects) for (const option of Array.from(select.options)) {
                    const channel = Number(option.value)
                    if (channel > 0) option.textContent = `Channel ${channel}${observedChannels.has(channel) ? ' (activity detected)' : ''}`
                }
            }
            const key = `${command.channel}:${command.number}`
            if (command.type === NOTE_ON) activeNotes.set(key, command.number)
            if (command.type === NOTE_OFF) activeNotes.delete(key)
            if (command.type === NOTE_ON || command.type === NOTE_OFF) renderNotes()
            for (const control of profile.controls) {
                const message = controlMessage(control)
                if (message.channel && message.channel !== command.channel) continue
                let value: number | undefined
                if (message.type === 'cc' && command.type === CONTROL_CHANGE && message.number === command.number) value = command.value
                if (message.type === 'note' && message.number === command.number) {
                    if (command.type === NOTE_ON) value = command.velocity
                    if (command.type === NOTE_OFF) value = 0
                }
                if ((message.type === 'pitchBend' && command.type === PITCH_BEND) || (message.type === 'programChange' && command.type === PROGRAM_CHANGE)
                    || (message.type === 'channelPressure' && command.type === CHANNEL_PRESSURE)) value = command.value
                if (value !== undefined) setValue(control, value)
            }
        },
        destroy() { release(); abort.abort(); element.remove() }
    }
}
