import { EVENT_CONNECTED, EVENT_DISCONNECTED, EVENT_PATCH_LOADED, EVENT_CONFIGURATION_CHANGED } from '../../event-constants'
import { NOTE_ON, NOTE_OFF } from '../../commands'
import { commandToMidi } from '../../midi/midi-command-conversion'
import type { IAudioCommand } from '../../audio-command-interface'
import type { IAudioOutput } from '../../io/outputs/output-interface'
import type { CLAPPatch } from './clap-types'
import { clapRegistry, initializeCLAPRegistry } from './clap-registry'
import { createCLAPNode, webclapUrl, type CLAPNode } from './clap-host'
import { openCLAPInterface } from './clap-ui'
import { insertCLAPEffect } from './clap-mixer'

export default class CLAPInstrument extends EventTarget implements IAudioOutput {
    readonly uuid = `CLAP-Instrument-${crypto.randomUUID()}`
    readonly output: GainNode
    readonly options: { defaultPatchId?: string; parameters?: Record<string, number>; mixer?: GainNode; routeAudio?: boolean }
    private node?: CLAPNode
    private connected = false
    private connecting?: Promise<void>
    private generation = 0
    private patch: CLAPPatch | null = null
    private patches: CLAPPatch[] = []
    private gui?: HTMLElement
    private closeInterface?: () => void
    private removeEffect?: () => void
    private notes = new Map<string, number[]>()

    constructor(private context: AudioContext, defaultPatchId: string | null = null, options: CLAPInstrument['options'] = {}) {
        super()
        this.options = { ...options, defaultPatchId: defaultPatchId ?? options.defaultPatchId }
        this.output = context.createGain()
        if (options.routeAudio) this.output.connect(options.mixer ?? context.destination)
    }
    get name() { return this.patch ? `WebCLAP: ${this.patch.name}` : 'WebCLAP' }
    get description() { return this.patch?.description ?? 'WebCLAP instruments and audio effects' }
    get isConnected() { return this.connected }
    get isHidden() { return false }
    get currentPatch() { return this.patch }
    get availablePatches() { return this.patches }

    async connect(): Promise<void> {
        if (this.connected) return
        if (this.connecting) return this.connecting
        const generation = this.generation
        this.connecting = (async () => {
            await initializeCLAPRegistry()
            if (generation !== this.generation) return
            this.patches = clapRegistry.getPatches()
            const patch = this.options.defaultPatchId ? clapRegistry.getPatch(this.options.defaultPatchId) : clapRegistry.getPatch('com.plinken.piano') ?? this.patches.find(item => item.features?.includes('instrument'))
            if (!patch) throw new Error(`WebCLAP plugin not found: ${this.options.defaultPatchId ?? 'default'}`)
            await this.loadPatchFromUrl(patch)
        })().finally(() => { this.connecting = undefined })
        return this.connecting
    }
    async loadPatch(id: string): Promise<void> {
        const patch = clapRegistry.getPatch(id)
        if (!patch) throw new Error(`WebCLAP plugin not found: ${id}`)
        await this.loadPatchFromUrl(patch)
    }
    async loadPatchFromUrl(patch: CLAPPatch): Promise<void> {
        const generation = ++this.generation
        const url = patch.url.startsWith('/webclap/') ? webclapUrl(patch.url.slice('/webclap/'.length)) : patch.url
        const next = await createCLAPNode(this.context, url, patch.factory ?? patch.id)
        if (generation !== this.generation) { await next.destroy(); next.port.close(); return }
        let remove: (() => void) | undefined
        try {
            if (patch.id === this.options.defaultPatchId) {
                for (const [id, value] of Object.entries(this.options.parameters ?? {})) await next.setParam(Number(id), value)
            }
            if (generation !== this.generation) { await next.destroy(); next.port.close(); return }
            const isEffect = !next.descriptor.features.includes('instrument')
            if (isEffect && !this.options.mixer) throw new Error('WebCLAP effects require the audio mixer')
            remove = isEffect ? insertCLAPEffect(this.options.mixer!, next) : undefined
            await this.releaseNode()
            this.node = next
            this.removeEffect = remove
            if (!isEffect) next.connect(this.output)
            this.patch = patch
            this.connected = true
            if (patch.id !== this.options.defaultPatchId) this.options.parameters = {}
            this.options.defaultPatchId = patch.id
            next.events.params_rescan = () => { void this.refreshParameters().catch(console.error) }
            next.events.state_mark_dirty = () => { void this.captureParameters().catch(console.error) }
            this.dispatchEvent(new Event(EVENT_CONNECTED))
            this.dispatchEvent(new CustomEvent(EVENT_PATCH_LOADED, { detail: { patch } }))
            this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
        } catch (error) { remove?.(); next.disconnect(); await next.destroy(); next.port.close(); throw error }
        if (this.gui) await this.renderGui()
    }
    private async captureParameters(): Promise<void> {
        const node = this.node
        if (!node) return
        const params = await node.getParams()
        if (node !== this.node) return
        this.options.parameters = Object.fromEntries(params.filter(param => !param.flags.readonly).map(param => [param.id, param.value.value]))
        this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
        await this.refreshParameters()
    }
    getNoteKey(command: IAudioCommand): string { return `${command.channel || 1}:${command.number}` }
    async sendCommand(command: IAudioCommand): Promise<void> {
        if (!this.connected || !this.node) return
        const bytes = commandToMidi(command)
        if (!bytes || bytes[0] >= 0xf0) return
        await this.node.sendMidi(bytes)
        const key = this.getNoteKey(command)
        if ((bytes[0] & 0xf0) === 0x90 && bytes[2]) this.notes.set(key, [0x80 | (bytes[0] & 15), bytes[1], 0])
        else if ((bytes[0] & 0xf0) === 0x80 || ((bytes[0] & 0xf0) === 0x90 && !bytes[2])) this.notes.delete(key)
    }
    noteOn(number: number, velocity: number): Promise<void> { return this.sendCommand({ type: NOTE_ON, number, velocity, channel: 1 } as IAudioCommand) }
    noteOff(number: number): void { void this.sendCommand({ type: NOTE_OFF, number, velocity: 0, channel: 1 } as IAudioCommand).catch(console.error) }
    allNotesOff(): void { void this.releaseNotes().catch(console.error) }
    private async releaseNotes(): Promise<void> {
        const node = this.node
        if (!node) return
        const notes = [...this.notes.values()]
        this.notes.clear()
        for (const bytes of notes) await node.sendMidi(bytes)
        for (let channel = 0; channel < 16; channel++) {
            await node.sendMidi([0xb0 | channel, 64, 0])
            await node.sendMidi([0xb0 | channel, 123, 0])
        }
    }
    private async releaseNode(): Promise<void> {
        await this.releaseNotes()
        this.closeInterface?.(); this.closeInterface = undefined
        this.removeEffect?.(); this.removeEffect = undefined
        const node = this.node
        this.node = undefined
        if (node) { node.disconnect(); await node.destroy(); node.port.close() }
        this.connected = false
    }
    async disconnect(): Promise<void> {
        ++this.generation
        await this.releaseNode()
        if (this.gui) this.gui.replaceChildren(Object.assign(document.createElement('p'), { textContent: 'WebCLAP disconnected. Connect to open controls.' }))
        this.dispatchEvent(new Event(EVENT_DISCONNECTED))
    }
    dispose(): void { void this.disconnect().then(() => this.output.disconnect()).catch(console.error) }

    async createGui(): Promise<HTMLElement> {
        if (this.gui) return this.gui
        this.gui = document.createElement('div')
        this.gui.className = 'webclap-gui nodrag nopan nowheel'
        this.gui.style.cssText = 'width:560px;max-width:100%;min-width:260px;overflow:auto;padding:12px;'
        try { await this.connect(); if (!this.gui.childElementCount) await this.renderGui() }
        catch (error) { this.gui.textContent = `WebCLAP could not load: ${String(error)}` }
        return this.gui
    }
    private async renderGui(): Promise<void> {
        const gui = this.gui, node = this.node
        if (!gui || !node) return
        this.closeInterface?.(); this.closeInterface = undefined
        gui.replaceChildren()
        const patch = this.patch
        if (patch) {
            const heading = document.createElement('h3')
            heading.textContent = patch.title ?? patch.name
            const description = document.createElement('p')
            description.textContent = patch.description ?? this.description
            const classification = document.createElement('p')
            classification.setAttribute('aria-label', 'Plugin classification')
            classification.textContent = [`Category: ${patch.category ?? 'WebCLAP'}`, `Type: ${patch.type ?? 'audio'}`, `Subtype: ${patch.subtype ?? 'effect'}`].join(' · ')
            gui.append(heading, description, classification)
            if (patch.attribution) {
                const credits = document.createElement('details')
                credits.className = 'webclap-attribution'
                credits.append(Object.assign(document.createElement('summary'), { textContent: 'Attribution & licenses' }))
                credits.append(Object.assign(document.createElement('p'), { textContent: `By ${patch.attribution.author} · ${patch.attribution.license}` }))
                const links = document.createElement('ul')
                const addLink = (title: string, url: string) => {
                    const row = document.createElement('li'), link = document.createElement('a')
                    link.textContent = title
                    link.href = url.startsWith('/webclap/') ? webclapUrl(url.slice('/webclap/'.length)) : url
                    link.target = '_blank'
                    link.rel = 'noopener noreferrer'
                    row.append(link); links.append(row)
                }
                addLink(`${patch.attribution.author} — plugin source`, patch.attribution.sourceUrl)
                patch.attribution.licenseUrls.forEach((url, index) => addLink(`Plugin license${patch.attribution!.licenseUrls.length > 1 ? ` ${index + 1}` : ''} (${patch.attribution!.license})`, url))
                addLink('WebCLAP browser host — source', 'https://github.com/WebCLAP/browser-test-host')
                addLink('WASI runtime — MIT license', '/webclap/wasi.wasm-LICENSE.txt')
                credits.append(links)
                gui.append(credits)
            }
        }
        const label = document.createElement('label')
        label.textContent = 'WebCLAP plugin '
        const select = document.createElement('select')
        select.setAttribute('aria-label', 'WebCLAP plugin')
        for (const patch of this.patches) {
            const option = document.createElement('option')
            option.textContent = `${patch.author ?? 'WebCLAP'} — ${patch.name}`
            option.value = patch.id
            option.selected = patch.id === this.patch?.id
            select.append(option)
        }
        select.value = this.patch?.id ?? ''
        const status = document.createElement('p')
        status.setAttribute('role', 'status')
        status.textContent = this.patch?.id === 'com.plinken.pulze' ? 'Load a sample into a pad to play Pulze. MIDI → drum pads → mixer'
            : node.descriptor.features.includes('instrument') ? 'MIDI → instrument → mixer' : 'Mix → WebCLAP effect → master output'
        select.addEventListener('change', async () => {
            select.disabled = true
            try { await this.loadPatch(select.value) }
            catch (error) { status.textContent = `Could not load plugin: ${String(error)}`; select.value = this.patch?.id ?? '' }
            finally { select.disabled = false }
        })
        label.append(select)
        gui.append(label, status)
        const controls = document.createElement('details')
        controls.open = !node.openInterface
        controls.append(Object.assign(document.createElement('summary'), { textContent: 'Parameters' }))
        const parameters = document.createElement('div')
        parameters.dataset.clapParameters = ''
        controls.append(parameters)
        gui.append(controls)
        await this.refreshParameters()
        if (this.gui !== gui || this.node !== node) return
        if (node.openInterface) {
            try {
                const ui = await openCLAPInterface(node)
                if (this.node !== node || this.gui !== gui) { ui.close(); return }
                this.closeInterface = ui.close
                gui.insertBefore(ui.frame, controls)
            } catch (error) { controls.open = true; status.textContent = `Plugin interface unavailable; use parameters. ${String(error)}` }
        }
    }
    private async refreshParameters(): Promise<void> {
        const node = this.node, container = this.gui?.querySelector<HTMLElement>('[data-clap-parameters]')
        if (!node || !container) return
        const params = await node.getParams()
        if (this.node !== node || !this.gui?.contains(container)) return
        container.replaceChildren()
        for (const param of params.filter(param => !param.flags.hidden)) {
            const label = document.createElement('label')
            label.style.cssText = 'display:grid;grid-template-columns:1fr 2fr 1fr;gap:8px;align-items:center;'
            const input = document.createElement('input')
            input.type = 'range'; input.min = String(param.min); input.max = String(param.max)
            input.step = param.flags.stepped ? '1' : 'any'; input.value = String(param.value.value); input.disabled = !!param.flags.readonly
            input.setAttribute('aria-label', param.name)
            const value = document.createElement('output')
            value.textContent = param.value.text
            input.addEventListener('input', async () => {
                try {
                    const result = await node.setParam(param.id, Number(input.value))
                    value.textContent = result.text
                    this.options.parameters = { ...this.options.parameters, [param.id]: result.value }
                    this.dispatchEvent(new Event(EVENT_CONFIGURATION_CHANGED))
                } catch (error) { value.textContent = String(error) }
            })
            label.append(document.createTextNode(param.name), input, value)
            container.append(label)
        }
        if (!params.length) container.textContent = 'This plugin has no adjustable parameters.'
    }
    async destroyGui(): Promise<void> { this.closeInterface?.(); this.closeInterface = undefined; this.gui?.remove(); this.gui = undefined }
    hasAudioOutput() { return true }
    hasMidiOutput() { return false }
    hasAutomationOutput() { return true }
    hasMpeOutput() { return false }
    hasOscOutput() { return false }
    hasSysexOutput() { return false }
}
