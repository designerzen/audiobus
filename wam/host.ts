export const WAM_MIDI_EVENT = 'wam-midi'
export const WAM_AUTOMATION_EVENT = 'wam-automation'
const hosts = new WeakMap<AudioContext, Promise<string>>()
export async function initializeHost(context: AudioContext): Promise<string> {
    let host = hosts.get(context)
    if (!host) {
        host = (async () => {
            const url = 'https://cdn.jsdelivr.net/npm/@webaudiomodules/sdk@0.0.12/src/initializeWamHost.js'
            const { default: initialize } = await import(/* @vite-ignore */ url)
            const [groupId] = await initialize(context)
            return groupId
        })()
        hosts.set(context, host)
        host.catch(() => hosts.delete(context))
    }
    return host
}
