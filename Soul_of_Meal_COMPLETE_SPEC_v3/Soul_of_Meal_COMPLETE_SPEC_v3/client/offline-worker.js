/* OFFLINE_PACKAGE is injected by the build. Public practice assets only. */
const scope = self.registration.scope;
const prefix = 'soul-of-meal.practice.v1:' + scope + ':';
const cacheName = prefix + OFFLINE_PACKAGE.build;
const entries = new Map(OFFLINE_PACKAGE.entries.map(entry => [new URL(entry.url, scope).href, entry]));
const manifestURL = new URL('offline-manifest.json', scope).href;
const indexURL = new URL('index.html', scope).href;

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  const pending = [...entries.entries()];
  const controller = new AbortController();
  // Bound concurrent downloads, verify every file and discard partial packages.
  const results = await Promise.allSettled(Array.from({ length: 6 }, async () => {
    while (pending.length && !controller.signal.aborted) {
      const [url, entry] = pending.shift();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(new Request(url, { cache: 'no-store', credentials: 'omit',
          redirect: 'error', integrity: entry.integrity, signal: controller.signal }));
        if (!response.ok) throw new Error('Offline asset unavailable: ' + url);
        await cache.put(url, response);
      } catch (error) {
        controller.abort();
        error.offlineFile = entry.url;
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  }));
  if (results.some(result => result.status === 'rejected')) {
    await caches.delete(cacheName);
    const failure = results.find(result => result.status === 'rejected' && result.reason.name !== 'AbortError')
      ?? results.find(result => result.status === 'rejected');
    for (const client of await self.clients.matchAll?.({ includeUncontrolled: true }) ?? []) {
      client.postMessage({ type: 'som-offline-error', message: `${failure.reason.offlineFile}: ${failure.reason.message}` });
    }
    throw new Error('Offline package incomplete. The previous release is retained.');
  }
  // The marker is written last: its presence means every checked asset is ready.
  try {
    await cache.put(manifestURL, new Response(JSON.stringify(OFFLINE_PACKAGE), { headers: { 'Content-Type': 'application/json' } }));
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  // Only remove caches from this exact scope. Immutable releases can coexist.
  for (const name of await caches.keys()) if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== new URL(scope).origin) return;
  url.search = '';
  url.hash = '';
  let key = url.href;
  if (event.request.mode === 'navigate' && (key === scope || key === indexURL)) key = indexURL;
  // API, authentication, release pointers, POSTs and unknown routes always use
  // the network. A failed API request can never become a cached HTML response.
  if (!entries.has(key) && key !== manifestURL) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(key) ?? fetch(event.request);
  })());
});
