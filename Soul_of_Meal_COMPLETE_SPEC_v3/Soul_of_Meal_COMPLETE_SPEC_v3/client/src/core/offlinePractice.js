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
    const hdReady = ready && Boolean(await cache?.match(new URL('offline-hd-marker.json', scope).href));
    return { supported: true, ready, build: manifest.build, bytes: manifest.bytes, scope, hdReady, hdBytes: manifest.hdBytes ?? 0 };
  } catch {
    return { supported: false };
  }
}

export async function enableOfflineHD(env = globalThis, report = () => {}) {
  const state = await inspectOfflinePractice(env);
  if (!state.ready) throw new Error('Tải gói ngoại tuyến trước khi tải minh họa HD.');
  if (state.hdReady) return;
  const response = await env.fetch(new URL('offline-manifest.json', state.scope), { cache: 'no-cache', credentials: 'omit' });
  if (!response.ok) throw new Error('Chưa đọc được gói minh họa HD.');
  const manifest = await response.json();
  if (manifest.schema !== 1 || manifest.build !== state.build || !Array.isArray(manifest.entries) || !Array.isArray(manifest.hdEntries)) {
    throw new Error('Gói ngoại tuyến đã thay đổi. Mở lại game và tải gói hiện tại trước khi tải minh họa HD.');
  }
  const prefix = new URL('assets/splash/', state.scope).href;
  const core = new Set(manifest.entries.map(entry => new URL(entry.url, state.scope).href));
  const files = manifest.hdEntries.map(entry => ({ ...entry, url: new URL(entry.url, state.scope).href }));
  if (files.some(entry => !entry.url.startsWith(prefix) || core.has(entry.url) || !/^sha256-[A-Za-z0-9+/]+=*$/.test(entry.integrity))) throw new Error('Đường dẫn minh họa HD không hợp lệ.');
  const cache = await env.caches.open(PREFIX + state.scope + ':' + manifest.build);
  const pending = [...files], controller = new AbortController();
  let completed = 0;
  try {
    const work = await Promise.allSettled(Array.from({ length: 4 }, async () => {
      while (pending.length && !controller.signal.aborted) {
        const entry = pending.shift();
        const timeout = setTimeout(() => controller.abort(), 45000);
        try {
          const result = await env.fetch(new Request(entry.url, { integrity: entry.integrity, credentials: 'omit', cache: 'no-store', redirect: 'error', signal: controller.signal }));
          if (!result.ok) throw new Error('HD download incomplete');
          await cache.put(entry.url, result);
          report(++completed, files.length);
        } catch (error) { controller.abort(); throw error; }
        finally { clearTimeout(timeout); }
      }
    }));
    if (work.some(result => result.status === 'rejected')) throw new Error('HD download incomplete');
    await cache.put(new URL('offline-hd-marker.json', state.scope).href, Response.json({ build: manifest.build }));
  } catch {
    await Promise.all(files.map(entry => cache.delete(entry.url)));
    throw new Error('Chưa tải đủ ảnh HD. Gói chơi ngoại tuyến vẫn được giữ; hãy thử lại khi có mạng và đủ dung lượng.');
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
