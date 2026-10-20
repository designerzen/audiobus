import type IOChainManager from '../../io/IO-chain-manager'
import type IOChain from '../../io/IO-chain'
import InputProfiledMidiDevice from '../../io/inputs/input-profiled-midi-device'
import InputWebMIDIDevice from '../../io/inputs/input-webmidi-device'
import { selectedMidiDevice } from '../../io/inputs/midi-input-controls'
import { deviceDefinition, configurationData } from '../../io/device-definition'
import { restoreDevice, type SavedDevice } from '../../io/workspace-devices'
import { matchMidiDeviceProfile, loadMidiProfilesForPorts, type MidiProfileTransport } from './device-profiles'
import { sharedWebMidi, type WebMidiDeviceChange } from '../shared-webmidi'
import { getNativeMidiBridge } from '../native-midi-bridge'
import { EVENT_DEVICE_LIST_CHANGED, EVENT_CHAINS_UPDATED, EVENT_DESTROYED } from '../../event-constants'

interface KnownPort { id: string; routingId: string; name: string; profileId?: string; transport: MidiProfileTransport }
interface DetachedInput { saved: SavedDevice; chains: string[]; reconnect: boolean }
export interface MidiDeviceLoss { id: string; name: string; chains: string[] }
interface DiscoveryOptions { onDeviceDisconnected?: (loss: MidiDeviceLoss) => void }
export interface MidiInputDiscovery { (): Promise<void>; refresh(): Promise<void> }

const sourceInput = (input: any) => input.midiInput ?? input
function binding(input: any): { id: string; transport: MidiProfileTransport } | undefined {
    if (input instanceof InputProfiledMidiDevice && input.options.deviceId) return { id: input.options.deviceId, transport: input.options.transport ?? 'webmidi' }
    const source = sourceInput(input)
    if (source instanceof InputWebMIDIDevice) {
        const id = selectedMidiDevice(source.options)
        if (id !== null) return { id, transport: 'webmidi' }
    }
}

// Hot-plug owns topology here; the shared WebMIDI service owns physical ports.
// A removed device leaves its chains, while its saved routing can be restored
// into those same chains when it returns. All-device listeners stay attached.
export async function startKnownMidiInputs(manager: IOChainManager, options: DiscoveryOptions = {}): Promise<MidiInputDiscovery> {
    let stopped = false
    let scanning: Promise<void> | undefined
    let rescan = false
    let web = false
    let releaseWeb: (() => void) | undefined
    const native = (globalThis as any).window?.electronAPI?.midi2 ? getNativeMidiBridge() : undefined
    const observed = new Map<string, { input: any; routingId: string; connected: boolean }>()
    const detached = new Map<string, DetachedInput[]>()
    const removed = new Map<string, Set<object>>()
    const managed = new Set<any>()
    const key = (transport: string, id: string) => JSON.stringify([transport, id])
    const notifyLoss = (id: string, name: string, active: Set<object>) => {
        const chains = new Set<string>()
        for (const entry of manager.devices) if (entry.direction === 'input' && active.has(sourceInput(entry.device))) {
            for (const chainId of entry.chains) {
                const chain = manager.getChain(chainId)
                if (chain?.isActive) chains.add(chain.options.name || chainId)
            }
        }
        if (chains.size) options.onDeviceDisconnected?.({ id, name, chains: [...chains] })
    }
    const detach = async (portKey: string, active = new Set<object>()) => {
        const matches = manager.devices.filter(entry => {
            const bound = entry.direction === 'input' ? binding(entry.device) : undefined
            return bound && key(bound.transport, bound.id) === portKey
        })
        const records = detached.get(portKey) ?? []
        for (const entry of matches) {
            const input = entry.device
            let definition
            try { definition = deviceDefinition(input) }
            catch { definition = { factory: 'input' as const, type: 'webmidi', options: configurationData(input.options) } }
            records.push({ saved: { id: entry.id, direction: 'input', definition }, chains: [...entry.chains],
                reconnect: !!(input.isEnabled || input.isConnected || active.has(sourceInput(input))) })
            // Flush held notes and sustain while the Input still has its routes.
            await input.disconnect?.()
            for (const chainId of entry.chains) manager.getChain(chainId)?.removeInput(input)
            managed.delete(input)
        }
        if (records.length) detached.set(portKey, records)
        observed.delete(portKey)
    }
    const reconcile = async () => {
        const nativePorts = !web && native ? await native.getUmpInputs() : []
        const physical = web ? sharedWebMidi.inputs : nativePorts
        const ports: KnownPort[] = physical.map((port: any) => ({
            id: web ? port.id : port.id ?? String(port.index), routingId: web ? port.id : String(port.index),
            name: port.name || port.id || String(port.index), transport: web ? 'webmidi' : 'midi2-native'
        }))
        const present = new Set(ports.map(port => key(port.transport, port.id)))
        if (stopped) return
        // Keep actual disconnect events, even when a rapid reconnect arrives
        // before an asynchronous profile lookup has finished.
        const losses = [...removed]
        removed.clear()
        for (const [id, active] of losses) await detach(id, active)
        for (const entry of manager.devices) {
            const bound = entry.direction === 'input' ? binding(entry.device) : undefined
            if (!bound || present.has(key(bound.transport, bound.id))) continue
            const id = key(bound.transport, bound.id)
            if (observed.has(id) && bound.transport === 'midi2-native') {
                const active = new Set(manager.devices.filter(item => item.device.isConnected && binding(item.device)?.id === bound.id).map(item => sourceInput(item.device)))
                notifyLoss(bound.id, entry.device.name, active)
            }
            await detach(id)
        }
        for (const id of observed.keys()) if (!present.has(id)) observed.delete(id)
        await loadMidiProfilesForPorts(physical)
        for (const port of ports) {
            if (stopped) return
            const id = key(port.transport, port.id)
            port.profileId = matchMidiDeviceProfile(physical.find((item: any) => (web ? item.id : item.id ?? String(item.index)) === port.id)!)
            if (!web && !port.profileId) continue
            // Restore every previous route/channel selection, including a device
            // shared across several chains, as one shared logical Input.
            if (detached.has(id)) {
                const records = detached.get(id)!
                detached.delete(id)
                for (const record of records) {
                    const chains = record.chains.map(chainId => manager.getChain(chainId)).filter((chain): chain is IOChain => !!chain && !chain.isDestroyed)
                    if (!chains.length) continue
                    const input = await restoreDevice(record.saved, { ...manager.deviceOptions, outputMixer: manager.outputMixer }, new Map())
                    if (stopped || chains.every(chain => chain.isDestroyed)) { await input.destroy?.(); continue }
                    for (const chain of chains) if (!chain.isDestroyed) manager.addDevice(chain, input, 'input')
                    managed.add(input)
                    if (record.reconnect) await input.connect?.()
                    observed.set(id, { input, routingId: port.routingId, connected: !record.reconnect || input.isConnected })
                }
                if (observed.has(id)) continue
            }
            const entries = manager.devices.filter(entry => entry.direction === 'input' && (() => {
                const bound = binding(entry.device)
                return bound && bound.transport === port.transport && bound.id === port.id
            })())
            const unbound = manager.devices.find(entry => entry.device instanceof InputProfiledMidiDevice
                && entry.device.options.profileId === port.profileId && !entry.device.options.deviceId)?.device
            let input = entries[0]?.device ?? unbound
            const previous = observed.get(id)
            // A user removal/disconnect is intentional until the next hot-plug.
            if (previous && !input) continue
            if (previous && input) {
                if (previous.routingId !== port.routingId) { await input.disconnect?.(); await input.connect?.(); previous.routingId = port.routingId; previous.connected = input.isConnected }
                else if (!previous.connected) { await input.connect?.(); previous.connected = input.isConnected }
                continue
            }
            if (!input) {
                const chain = manager.activeChain
                if (!chain) continue
                const { createInputById } = await import('../../io/input-factory')
                input = await createInputById(port.profileId ?? 'webmidi', { ...manager.deviceOptions,
                    autoManagedMidi: true, transport: port.transport, deviceId: port.id, selectedDevice: port.id,
                    listenToAllDevices: false, deviceName: port.name })
                if (stopped || chain.isDestroyed) { await input.destroy?.(); continue }
                manager.addDevice(chain, input, 'input')
            }
            if (input instanceof InputProfiledMidiDevice) { input.options.transport = port.transport; input.options.deviceId = port.id }
            managed.add(input)
            const record = { input, routingId: port.routingId, connected: false }
            observed.set(id, record)
            await input.connect?.()
            record.connected = input.isConnected
        }
    }
    const refresh = (): Promise<void> => {
        if (stopped) return Promise.resolve()
        rescan = true
        if (!scanning) scanning = (async () => {
            while (rescan && !stopped) { rescan = false; await reconcile() }
        })().catch(error => console.warn('MIDI device discovery failed', error)).finally(() => { scanning = undefined })
        return scanning
    }
    const portsChanged = (event: Event) => {
        const detail = (event as CustomEvent<WebMidiDeviceChange>).detail
        if (detail.disconnected && detail.device?.type === 'input') {
            removed.set(key('webmidi', detail.device.id), detail.activeInputs)
            notifyLoss(detail.device.id, detail.device.name || detail.device.id, detail.activeInputs)
        }
        void refresh()
    }
    try {
        if (typeof navigator !== 'undefined' && (navigator as any).requestMIDIAccess) {
            releaseWeb = await sharedWebMidi.acquire()
            web = true
            sharedWebMidi.addEventListener(EVENT_DEVICE_LIST_CHANGED, portsChanged)
        }
    } catch (error) { console.debug('WebMIDI discovery unavailable; trying native MIDI', error) }
    if (!web && !native) return Object.assign(async () => {}, { refresh: async () => {} })
    manager.addEventListener(EVENT_CHAINS_UPDATED, refresh)
    const interval = setInterval(() => { void refresh() }, 2000)
    await refresh()
    const stop = async () => {
        if (stopped) return
        stopped = true
        clearInterval(interval)
        manager.removeEventListener(EVENT_DESTROYED, stop)
        manager.removeEventListener(EVENT_CHAINS_UPDATED, refresh)
        sharedWebMidi.removeEventListener(EVENT_DEVICE_LIST_CHANGED, portsChanged)
        await scanning
        await Promise.allSettled([...managed].map(input => input.disconnect()))
        releaseWeb?.()
        detached.clear()
    }
    manager.addEventListener(EVENT_DESTROYED, stop, { once: true })
    return Object.assign(stop, { refresh })
}
