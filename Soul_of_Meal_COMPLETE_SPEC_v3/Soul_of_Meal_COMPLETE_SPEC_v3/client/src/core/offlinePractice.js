const PREFIX = 'soul-of-meal.practice.v1:';

globalThis.navigator?.serviceWorker?.addEventListener('message', event => {
  if (event.source?.scriptURL === new URL('offline-worker.js', new URL('./', location.href)).href
      && event.data?.type === 'som-offline-error') console.warn('Offline package installation failed:', event.data.message);
});

export async function inspectOfflinePractice(env = globalThis) {
  if (!env.isSecureContext || !env.navigator?.serviceWorker || !env.caches) return { supported: false };
  const scope = new URL('./', env.location.href).href;
  try {
    const response = await env.fetch(new URL('offline-manifest.json', scope), { cache: 'no-cache', credentials: 'omit' });
    if (!response.ok) return { supported: false };
    const manifest = await response.json();
    if (manifest.schema !== 1 || !/^[0-9a-f]{64}$/.test(manifest.build) || !Number.isFinite(manifest.bytes)) return { supported: false };
    const cacheName = PREFIX + scope + ':' + manifest.build;
    const cache = await env.caches.has(cacheName) ? await env.caches.open(cacheName) : null;
    const registration = await env.navigator.serviceWorker.getRegistration(scope);
    const ready = registration?.active?.scriptURL === new URL('offline-worker.js', scope).href
      && Boolean(await cache?.match(new URL('offline-manifest.json', scope).href));
    return { supported: true, ready, bytes: manifest.bytes, scope };
  } catch {
    return { supported: false };
  }
}

export async function enableOfflinePractice(env = globalThis) {
  const state = await inspectOfflinePractice(env);
  if (!state.supported) throw new Error('Gói ngoại tuyến chỉ có trên bản build HTTPS.');
  const workerURL = new URL('offline-worker.js', state.scope).href;
  let registration = await env.navigator.serviceWorker.getRegistration(state.scope);
  if (state.ready && registration?.active?.scriptURL === workerURL) return;
  if (registration?.active?.scriptURL === workerURL) {
    // Repair a package evicted by the browser, without deleting other releases.
    await registration.unregister();
  }
  registration = await env.navigator.serviceWorker.register(workerURL, { scope: state.scope, updateViaCache: 'none' });
  const worker = registration.installing ?? registration.waiting ?? registration.active;
  if (!worker) throw new Error('Trình duyệt chưa khởi tạo được gói ngoại tuyến.');
  const waiting = await new Promise((resolve, reject) => {
    const changed = () => {
      if (worker.state === 'activated' || (worker.state === 'installed' && registration.waiting)) {
        worker.removeEventListener('statechange', changed); resolve(worker.state === 'installed');
      }
      else if (worker.state === 'redundant') { worker.removeEventListener('statechange', changed); reject(new Error('Chưa tải đủ gói. Hãy kiểm tra kết nối, dung lượng và thử lại.')); }
    };
    worker.addEventListener('statechange', changed);
    changed();
  });
  if (waiting) return { waiting: true };
  const checked = await inspectOfflinePractice(env);
  if (!checked.ready) throw new Error('Gói chưa tải đủ. Hãy thử lại khi có mạng.');
}
