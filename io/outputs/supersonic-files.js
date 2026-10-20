import { readFile, cp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve, sep, extname } from 'node:path'

const require = createRequire(import.meta.url)
const bundleRequire = createRequire(require.resolve('supersonic-scsynth-bundle'))
const engine = dirname(bundleRequire.resolve('supersonic-scsynth'))
const core = dirname(bundleRequire.resolve('supersonic-scsynth-core'))
const synthdefs = dirname(bundleRequire.resolve('supersonic-scsynth-synthdefs'))
const directories = [
    [resolve(engine, 'workers'), 'workers'],
    [resolve(core, 'workers'), 'workers'],
    [resolve(core, 'wasm'), 'wasm'],
    [resolve(synthdefs, 'synthdefs'), 'synthdefs'],
]
const mime = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.scsyndef': 'application/octet-stream' }

export function supersonicFilesPlugin() {
    let config
    return {
        name: 'supersonic-files',
        configResolved(resolved) { config = resolved },
        configureServer(server) {
            const prefix = `${config.base === './' ? '/' : config.base}supersonic/`
            server.middlewares.use(async (request, response, next) => {
                let pathname
                try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname) } catch { return next() }
                if (!pathname.startsWith(prefix)) return next()
                if (request.method !== 'GET' && request.method !== 'HEAD') { response.statusCode = 405; response.end(); return }
                const relative = pathname.slice(prefix.length)
                for (const [root, directory] of directories) {
                    if (!relative.startsWith(directory + '/')) continue
                    const file = resolve(root, relative.slice(directory.length + 1))
                    if (!file.startsWith(root + sep)) continue
                    try {
                        const bytes = await readFile(file)
                        response.setHeader('Content-Type', mime[extname(file)] || 'application/octet-stream')
                        response.end(request.method === 'HEAD' ? undefined : bytes)
                        return
                    } catch (error) { if (error.code !== 'ENOENT' && error.code !== 'EISDIR') return next(error) }
                }
                response.statusCode = 404
                response.end('SuperSonic asset not found')
            })
        },
        async writeBundle() {
            for (const [root, directory] of directories) {
                await cp(root, resolve(config.root, config.build.outDir, 'supersonic', directory), { recursive: true })
            }
        },
    }
}
