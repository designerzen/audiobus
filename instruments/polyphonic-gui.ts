import type PolySynth from './polyphonic.ts'
import { POLYSYNTH_PARAMETERS, POLYSYNTH_WAVEFORMS, type PolySynthSettings } from './polyphonic-settings.ts'
import { EVENT_CHANGE, EVENT_CLICK, EVENT_CONFIGURATION_CHANGED, EVENT_INPUT } from '../event-constants.ts'

export function createPolySynthGui(device: PolySynth) {
    const events = new AbortController()
    const element = document.createElement('section')
    element.className = 'polysynth-gui'
    element.setAttribute('aria-label', 'PolySynth controls')
    Object.assign(element.style, { display: 'grid', gap: '0.75rem', padding: '0.75rem', maxWidth: '640px', boxSizing: 'border-box', width: '100%' })
    const title = document.createElement('h3')
    title.textContent = 'PolySynth'
    title.style.margin = '0'
    const info = document.createElement('small')
    info.textContent = `${device.options.maxPolyphony} voices · Changes apply to every voice`
    element.append(title, info)

    const controls = new Map<keyof PolySynthSettings, HTMLInputElement | HTMLSelectElement>()
    const outputs = new Map<string, HTMLOutputElement>()
    const group = (name: string) => {
        const fieldset = document.createElement('fieldset')
        Object.assign(fieldset.style, { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.65rem', minWidth: '0', margin: '0', padding: '0.65rem', border: '1px solid currentColor', borderRadius: '6px' })
        const legend = document.createElement('legend')
        legend.textContent = name
        fieldset.append(legend)
        element.append(fieldset)
        return fieldset
    }
    const label = (name: string, control: HTMLElement, parent: HTMLElement) => {
        Object.assign(control.style, { boxSizing: 'border-box', width: '100%', minWidth: '0', maxWidth: '100%', margin: '0' })
        const row = document.createElement('label')
        Object.assign(row.style, { display: 'grid', gap: '0.25rem', minWidth: '0' })
        const caption = document.createElement('span')
        caption.textContent = name
        row.append(caption, control)
        parent.append(row)
        return row
    }
    const oscillator = group('Oscillator')
    const waveform = document.createElement('select')
    waveform.name = 'shape'
    waveform.setAttribute('aria-label', 'Waveform')
    for (const shape of POLYSYNTH_WAVEFORMS) {
        const option = document.createElement('option')
        option.value = shape
        option.textContent = shape[0].toUpperCase() + shape.slice(1)
        waveform.append(option)
    }
    waveform.addEventListener(EVENT_CHANGE, () => device.configure({ shape: waveform.value as PolySynthSettings['shape'] }), { signal: events.signal })
    controls.set('shape', waveform)
    label('Waveform', waveform, oscillator)
    const envelope = group('Amplitude envelope')
    const filter = group('Low-pass filter')
    for (const [key, parameter] of Object.entries(POLYSYNTH_PARAMETERS)) {
        const input = document.createElement('input')
        input.type = 'range'
        input.name = key
        input.min = String(parameter.min)
        input.max = String(parameter.max)
        input.step = String(parameter.step)
        input.setAttribute('aria-label', parameter.label)
        Object.assign(input.style, { padding: '0', minHeight: '44px' })
        input.addEventListener(EVENT_INPUT, () => device.configure({ [key]: input.valueAsNumber }), { signal: events.signal })
        const parent = key === 'volume' ? oscillator : key.startsWith('filter') ? filter : envelope
        const row = label(parameter.label, input, parent)
        const output = document.createElement('output')
        input.id = `${device.uuid}-${key}`
        output.htmlFor = input.id
        row.append(output)
        controls.set(key as keyof PolySynthSettings, input)
        outputs.set(key, output)
    }
    const actions = document.createElement('div')
    Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' })
    for (const [name, action] of [
        ['Random waveform', () => device.setRandomTimbre()],
        ['All notes off', () => device.allNotesOff()],
    ] as const) {
        const button = document.createElement('button')
        button.type = 'button'
        button.textContent = name
        button.addEventListener(EVENT_CLICK, action, { signal: events.signal })
        actions.append(button)
    }
    element.append(actions)
    const sync = () => {
        for (const [key, control] of controls) {
            control.value = String(device.options[key])
            if (key === 'shape') continue
            const value = device.options[key]
            const unit = POLYSYNTH_PARAMETERS[key].unit
            const text = unit === '%' ? `${Math.round(value * 100)}%`
                : unit === 'Hz' ? `${Math.round(value)} Hz`
                : `${value.toFixed(unit === 's' ? 2 : 1)} ${unit}`
            outputs.get(key)!.textContent = text
            control.setAttribute('aria-valuetext', text)
        }
    }
    device.addEventListener(EVENT_CONFIGURATION_CHANGED, sync, { signal: events.signal })
    sync()
    return { element, dispose() { events.abort(); element.remove() } }
}
