import { unzip, strFromU8 } from 'fflate'

export const MAX_MEDIA_BYTES = 64 * 1024 * 1024
const MAX_EXPANDED_BYTES = 256 * 1024 * 1024
const decoder = new TextDecoder()
export const isMidiFile = (file: Pick<File, 'name' | 'type'>) => /\.(mid|midi)$/i.test(file.name) || /midi/i.test(file.type)
export const isArchiveFile = (file: Pick<File, 'name'>) => /\.(zip|wam|wam2)$/i.test(file.name)
export interface ArchivedPlugin { name: string; path: string }
export interface MediaArchive { files: Record<string, Uint8Array>; plugins: ArchivedPlugin[]; midi: string[] }

export function safeArchivePath(path: string): string {
    if (!path || /[\\\x00?#%:]/.test(path) || path.startsWith('/') || path.split('/').some(part => part === '.' || part === '..')) {
        throw new Error(`Unsafe archive path: ${path}`)
    }
    return path
}

export async function inspectMediaArchive(bytes: Uint8Array): Promise<MediaArchive> {
    if (bytes.length > MAX_MEDIA_BYTES) throw new Error('Archive exceeds the 64 MB limit')
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('Expected a ZIP bundle. TAR, GZIP, RAR and 7z are not supported.')
    let size = 0, count = 0
    let invalid: Error | undefined
    const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => unzip(bytes, {
        filter: entry => {
            try {
                safeArchivePath(entry.name)
                size += entry.originalSize
                if (++count > 4096 || size > MAX_EXPANDED_BYTES) throw new Error('Archive has too many files or exceeds the 256 MB unpacked limit')
                return !entry.name.endsWith('/') && !entry.name.startsWith('__MACOSX/')
            } catch (error) { invalid = error as Error; return false }
        },
    }, (error, result) => error ? reject(error) : invalid ? reject(invalid) : resolve(result)))
    const plugins: ArchivedPlugin[] = []
    for (const [path, contents] of Object.entries(files)) {
        if (!/(^|\/)descriptor\.json$/i.test(path)) continue
        const descriptor = JSON.parse(strFromU8(contents))
        const entry = path.replace(/descriptor\.json$/i, 'index.js')
        if (descriptor.isInstrument !== true || !String(descriptor.apiVersion ?? descriptor.sdkVersion).startsWith('2')) continue
        if (!files[entry]) continue
        plugins.push({ name: String(descriptor.name || entry), path: entry })
    }
    const midi = Object.keys(files).filter(path => decoder.decode(files[path].subarray(0, 4)) === 'MThd')
    if (!plugins.length && !midi.length) throw new Error('No ready-to-run WAM2 instrument or MIDI file found. WAM2 bundles need descriptor.json (API 2) and index.js with all built assets. Legacy WAMs require a supported adapter.')
    return { files, plugins, midi }
}

/** Identify MIDI by content even when an OS supplies no useful MIME type. */
export async function hasMidiHeader(file: Blob): Promise<boolean> {
    return decoder.decode(await file.slice(0, 4).arrayBuffer()) === 'MThd'
}

/** URI lists contain comments; plain text is accepted only when it is a URL. */
export function droppedUrl(uriList: string, plainText = ''): string | undefined {
    const value = (uriList || plainText).split(/\r?\n/).map(line => line.trim()).find(line => line && !line.startsWith('#'))
    if (!value) return
    try {
        const url = new URL(value)
        if (['https:', 'http:'].includes(url.protocol)) return url.href
        if (['legacy:yoshimi', 'legacy:dx7'].includes(url.href)) return url.href
    } catch { /* Text and graph drags are not media URLs. */ }
}
