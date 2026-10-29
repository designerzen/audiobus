import { EVENT_CLOSE, EVENT_ERROR, EVENT_MESSAGE, EVENT_OPEN, EVENT_CHANGE } from '../event-constants'
import { oscPrefix, MAX_OSC_PACKET_BYTES } from './osc'

export class OscConnection {
    private socket?: WebSocket
    private pending?: Promise<void>
    private rejectPending?: (error: Error) => void
    get isConnected(): boolean { return this.socket?.readyState === WebSocket.OPEN }
    constructor(private receive: (bytes: Uint8Array) => void, private closed: () => void, private error: (message: string) => void) {}
    connect(value: string): Promise<void> {
        if (this.isConnected) return Promise.resolve()
        if (this.pending) return this.pending
        const url = new URL(value)
        if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a ws:// or wss:// OSC bridge URL')
        const socket = this.socket = new WebSocket(url.href); socket.binaryType = 'arraybuffer'
        this.pending = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => { reject(new Error('OSC bridge connection timed out')); this.disconnect() }, 10000)
            const fail = (error: Error) => { clearTimeout(timeout); reject(error) }; this.rejectPending = fail
            socket.addEventListener(EVENT_OPEN, () => { clearTimeout(timeout); this.rejectPending = undefined; resolve() }, { once: true })
            socket.addEventListener(EVENT_ERROR, () => { fail(new Error('Could not connect to the OSC bridge')); this.error('OSC bridge connection failed') })
            socket.addEventListener(EVENT_CLOSE, () => {
                fail(new Error('OSC bridge closed'))
                if (this.socket === socket) { this.socket = undefined; this.closed() }
            })
            socket.addEventListener(EVENT_MESSAGE, (event: MessageEvent) => {
                if (this.socket !== socket) return
                try {
                    if (!(event.data instanceof ArrayBuffer) || event.data.byteLength > MAX_OSC_PACKET_BYTES) throw new Error('The OSC bridge must send binary packets up to 64 KB')
                    this.receive(new Uint8Array(event.data))
                } catch (error) { this.error(error instanceof Error ? error.message : String(error)) }
            })
        }).finally(() => { this.pending = undefined })
        return this.pending
    }
    send(bytes: Uint8Array): void {
        if (!this.isConnected) return
        if (this.socket!.bufferedAmount > 262144) { this.error('OSC bridge is not keeping up; disconnected'); this.disconnect(); return }
        this.socket!.send(bytes)
    }
    disconnect(): void {
        this.rejectPending?.(new Error('OSC bridge disconnected')); this.rejectPending = undefined
        const socket = this.socket; this.socket = undefined; socket?.close(); this.closed()
    }
}

export function oscControls(panel: HTMLElement, options: Record<string, any>, change: () => void, status: HTMLElement): void {
    for (const [key, title, fallback] of [['url', 'WebSocket bridge', 'ws://127.0.0.1:8080'], ['prefix', 'OSC prefix', '/harmoneasy']]) {
        const label = document.createElement('label'), input = document.createElement('input')
        input.type = 'text'; input.value = options[key] ?? fallback
        input.addEventListener(EVENT_CHANGE, () => {
            try {
                const value = input.value.trim()
                if (key === 'prefix') options[key] = oscPrefix(value)
                else {
                    const url = new URL(value)
                    if (!['ws:', 'wss:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a ws:// or wss:// bridge URL')
                    options[key] = url.href
                }
                change(); status.textContent = 'Settings saved. Connect to the OSC bridge.'
            } catch (error) { input.value = options[key]; status.textContent = error instanceof Error ? error.message : String(error) }
        })
        label.append(`${title} `, input); panel.append(label)
    }
    const help = document.createElement('p')
    help.textContent = 'Binary OSC over WebSocket. Under the prefix: /note/on [note, velocity, channel], /note/off [note, channel], /cc [controller, value, channel], /pitch [0–16383, channel]. Channels are 1–16. Received bundles play on arrival.'
    panel.append(help, status)
}
