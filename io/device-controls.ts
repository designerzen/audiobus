import { EVENT_CHANGE, EVENT_CLICK, EVENT_CONFIGURATION_CHANGED } from '../event-constants'

export function devicePanel(): HTMLDivElement {
    const panel = document.createElement('div')
    panel.className = 'nodrag nopan nowheel'
    panel.style.cssText = 'display:grid;gap:0.65rem;min-width:220px;max-width:100%'
    return panel
}

export function numberControl(panel: HTMLElement, title: string, value: number, min: number, max: number,
    change: (value: number) => void, step = 1): HTMLInputElement {
    const label = document.createElement('label'), input = document.createElement('input')
    input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = String(step)
    input.addEventListener(EVENT_CHANGE, () => {
        if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) { input.value = String(value); return }
        value = Math.min(max, Math.max(min, input.valueAsNumber))
        if (step === 1) value = Math.round(value)
        input.value = String(value); change(value)
    })
    label.append(`${title} `, input); panel.append(label)
    return input
}

export function action(panel: HTMLElement, title: string, run: () => void | Promise<void>, status?: HTMLElement): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'; button.textContent = title
    button.addEventListener(EVENT_CLICK, async () => {
        button.disabled = true
        try { await run() } catch (error) { if (status) status.textContent = error instanceof Error ? error.message : String(error) }
        finally { button.disabled = false }
    })
    panel.append(button)
    return button
}

export function changed(device: EventTarget): void { device.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED)) }

export function downloadJSON(value: unknown, name: string): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url; link.download = name; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function bounded(value: unknown, fallback: number, min: number, max: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
