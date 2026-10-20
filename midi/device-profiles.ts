import { parseMidiDeviceProfile, type MidiDeviceProfile } from './device-profile-schema'
export type { MidiDeviceProfile } from './device-profile-schema'

export function loadMidiDeviceProfiles(files: Record<string, unknown>, assets: Record<string, string>,
    report: (path: string, error: unknown) => void = (path, error) => console.warn(`MIDI device profile skipped: ${path}`, error)) {
    const profiles: Record<string, MidiDeviceProfile> = Object.create(null)
    for (const [path, json] of Object.entries(files)) {
        const match = /^\.\/devices\/([^/]+)\/([^/]+)\.json$/.exec(path)
        if (!match) continue
        const id = match[1]
        if (match[2] !== id) continue
        try { profiles[id] = parseMidiDeviceProfile(id, json, image => assets[`./devices/${id}/${image}`]) }
        catch (error) { report(path, error) }
    }
    return profiles
}
export const MIDI_DEVICE_PROFILES: Record<string, MidiDeviceProfile> = Object.create(null)
const listeners = new Set<() => void>()
export function onMidiDeviceProfilesChanged(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
let baseOverride: string | undefined
let fetchProfile: typeof fetch = (...args) => globalThis.fetch(...args)
export function setMidiDeviceProfileSource(baseUrl: string, fetcher: typeof fetch) {
    baseOverride = baseUrl
    fetchProfile = fetcher
    lastRefresh = 0
}
function registryUrl() {
    if (baseOverride) return baseOverride
    const documentUrl = globalThis.document?.baseURI ?? 'http://localhost/'
    if (documentUrl.startsWith('file:')) return 'midi-device://registry/'
    return new URL(`${import.meta.env.BASE_URL ?? '/'}midi-devices/`, /^https?:/.test(documentUrl) ? documentUrl : 'http://localhost/').href
}
const pendingProfiles = new Map<string, Promise<MidiDeviceProfile | undefined>>()
const failedProfiles = new Map<string, number>()
export async function ensureMidiDeviceProfile(id: string): Promise<MidiDeviceProfile | undefined> {
    if (MIDI_DEVICE_PROFILES[id]) return MIDI_DEVICE_PROFILES[id]
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || Date.now() - (failedProfiles.get(id) ?? -Infinity) < 5000) return
    if (pendingProfiles.has(id)) return pendingProfiles.get(id)
    const request = (async () => {
        try {
            const folder = new URL(`${id}/`, registryUrl())
            const response = await fetchProfile(new URL(`${id}.json`, folder).href, { cache: 'no-store' })
            if (!response.ok) { failedProfiles.set(id, Date.now()); return }
            const profile = parseMidiDeviceProfile(id, await response.json(), image => new URL(image, folder).href)
            MIDI_DEVICE_PROFILES[id] = profile
            failedProfiles.delete(id)
            listeners.forEach(listener => listener())
            return profile
        } catch (error) {
            failedProfiles.set(id, Date.now())
            console.debug(`MIDI device profile unavailable: ${id}`, error)
        }
    })().finally(() => pendingProfiles.delete(id))
    pendingProfiles.set(id, request)
    return request
}
let lastRefresh = 0
let pendingRefresh: Promise<void> | undefined
export function refreshMidiDeviceProfiles(force = false): Promise<void> {
    if (pendingRefresh) return pendingRefresh
    if (!force && Date.now() - lastRefresh < 5000) return Promise.resolve()
    lastRefresh = Date.now()
    pendingRefresh = (async () => {
        try {
            const response = await fetchProfile(registryUrl(), { cache: 'no-store' })
            if (!response.ok) return
            const ids: unknown = await response.json()
            if (Array.isArray(ids)) await Promise.all(ids.filter((id): id is string => typeof id === 'string').map(ensureMidiDeviceProfile))
        } catch { /* Static hosting may not expose directory listings; load by device ID instead. */ }
    })().finally(() => { pendingRefresh = undefined })
    return pendingRefresh
}
export async function loadMidiProfilesForPorts(ports: MidiPortIdentity[]) {
    await refreshMidiDeviceProfiles()
    const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const candidates = new Set<string>()
    for (const port of ports) if (!matchMidiDeviceProfile(port)) {
        for (const value of [port.id, port.name, [port.manufacturer, port.name].filter(Boolean).join(' ')]) if (value) candidates.add(slug(value))
    }
    await Promise.all([...candidates].map(ensureMidiDeviceProfile))
}
export interface MidiPortIdentity { id?: string; name?: string; manufacturer?: string }

const normalise = (value: string) => value.trim().toLowerCase()
export function matchMidiDeviceProfile(port: MidiPortIdentity): string | undefined {
    const id = normalise(port.id ?? '')
    const name = normalise(port.name ?? '')
    // IDs take precedence over optional port-name aliases. No loose substring
    // matching: an unrelated virtual port must not accidentally claim a device.
    return Object.entries(MIDI_DEVICE_PROFILES).find(([, profile]) => profile.ids.some(value => normalise(value) === id))?.[0]
        ?? Object.entries(MIDI_DEVICE_PROFILES).find(([, profile]) => profile.portNames.some(value => normalise(value) === name))?.[0]
}

export type MidiProfileTransport = 'webmidi' | 'midi2-native'
const claims = new Map<string, Set<object>>()
export function claimMidiProfilePort(transport: MidiProfileTransport, id: string, owner: object): () => void {
    const key = JSON.stringify([transport, id])
    const owners = claims.get(key) ?? new Set<object>()
    owners.add(owner)
    claims.set(key, owners)
    return () => {
        owners.delete(owner)
        if (!owners.size) claims.delete(key)
    }
}
export function isMidiProfilePortClaimed(transport: MidiProfileTransport, id: string): boolean {
    return !!claims.get(JSON.stringify([transport, id]))?.size
}
