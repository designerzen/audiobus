export interface CLAPParameter {
    id: number
    name: string
    min: number
    max: number
    default: number
    flags: { stepped?: boolean; readonly?: boolean; hidden?: boolean }
    value: { value: number; text: string }
}

export interface CLAPNode extends AudioWorkletNode {
    descriptor: { name: string; features: string[] }
    events: Record<string, (...args: any[]) => void>
    sendMidi(bytes: number[]): Promise<void>
    pause(): Promise<void>
    destroy(): Promise<void>
    getParams(): Promise<CLAPParameter[]>
    getParam(id: number): Promise<CLAPParameter['value']>
    setParam(id: number, value: number): Promise<CLAPParameter['value']>
    getFile(path: string): Promise<ArrayBuffer | undefined>
    getResource(path: string): Promise<Blob | null>
    openInterface?(options: { filePrefix: string; resourcePrefix: string }): HTMLIFrameElement
    closeInterface?(): void
}

export const webclapUrl = (path: string): string => `${import.meta.env.BASE_URL ?? '/'}webclap/${path}`

export async function createCLAPNode(context: AudioContext, url: string, pluginId?: string): Promise<CLAPNode> {
    // An absolute URL keeps Vite's dev import query off the untransformed runtime.
    const hostUrl = new URL(webclapUrl('clap-audionode.mjs'), document.baseURI).href
    const { default: Host } = await import(/* @vite-ignore */ hostUrl)
    const host = new Host(url)
    return host.createNode(context, pluginId ?? null, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2] })
}
