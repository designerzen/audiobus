import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { wamArchiveWorkerSource } from '../../wam/archive-files.js'

const require = createRequire(import.meta.url)
const files = new Map([
    ['opendaw/processors.js', require.resolve('@opendaw/studio-core/processors.js')],
    ['coi-serviceworker.js', require.resolve('coi-serviceworker/coi-serviceworker.js')],
])
const headers = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
}
const fileSource = (name, path) => name === 'coi-serviceworker.js'
    ? wamArchiveWorkerSource + readFileSync(path, 'utf8') : readFileSync(path)

/** Serve the prebundled SDK processor unchanged; its internal URLs are worklet-relative. */
export function opendawFilesPlugin() {
    let config
    const serve = server => {
        const prefix = config.base === './' ? '/' : config.base
        server.middlewares.use((request, response, next) => {
            for (const [key, value] of Object.entries(headers)) response.setHeader(key, value)
            const pathname = new URL(request.url, 'http://localhost').pathname
            const file = files.get(pathname.slice(prefix.length))
            if (!pathname.startsWith(prefix) || !file) return next()
            response.setHeader('Content-Type', 'text/javascript')
            response.setHeader('Cache-Control', 'no-cache')
            response.end(request.method === 'HEAD' ? undefined : fileSource(pathname.slice(prefix.length), file))
        })
    }
    return {
        name: 'opendaw-files',
        configResolved(resolved) { config = resolved },
        configureServer: serve,
        configurePreviewServer: serve,
        transformIndexHtml() {
            // GitHub Pages ignores _headers; the worker supplies isolation there.
            return [{ tag: 'script', attrs: { src: `${config.base}coi-serviceworker.js` }, injectTo: 'head-prepend' }]
        },
        generateBundle() {
            for (const [fileName, file] of files) this.emitFile({ type: 'asset', fileName, source: fileSource(fileName, file) })
        },
    }
}
