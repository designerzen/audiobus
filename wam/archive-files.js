export const WAM_ARCHIVE_CACHE = 'harmoneasy-wam-archives-v1'
export const WAM_ARCHIVE_DIRECTORY = 'wam-archives/'
export const EVENT_ARCHIVE_FETCH = 'fetch'

// Prepended to the existing isolation worker, so archive imports retain COOP/COEP.
export const wamArchiveWorkerSource = `
if (typeof window === 'undefined') {
    self.addEventListener('${EVENT_ARCHIVE_FETCH}', event => {
        const prefix = new URL('${WAM_ARCHIVE_DIRECTORY}', self.registration.scope).href;
        if (!event.request.url.startsWith(prefix)) return;
        event.stopImmediatePropagation();
        event.respondWith((async () => {
            const cache = await caches.open('${WAM_ARCHIVE_CACHE}');
            const url = new URL(event.request.url);
            url.search = '';
            return await cache.match(url.href) || new Response('WAM bundle asset not found', { status: 404 });
        })());
    });
}
`
