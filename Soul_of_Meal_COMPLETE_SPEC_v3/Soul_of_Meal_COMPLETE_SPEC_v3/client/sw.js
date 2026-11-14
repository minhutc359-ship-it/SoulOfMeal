importScripts("./offline-manifest.js");
const PREFIX = "soul-of-meal-v4-";
const CACHE = PREFIX + self.SOUL_OFFLINE.version;
self.addEventListener("install", (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // A failed precache fails installation; the previous complete version stays active.
      await cache.addAll(
        self.SOUL_OFFLINE.files.map(
          (file) => new URL(file, self.registration.scope).href,
        ),
      );
    })(),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    (async () => {
      const client = await self.clients.get(event.clientId);
      if (
        self.location.hostname === "127.0.0.1" &&
        client &&
        !new URL(client.url).searchParams.has("offline")
      )
        return fetch(event.request);
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch (error) {
        if (event.request.mode === "navigate")
          return (
            (await cache.match(
              new URL("./index.html", self.registration.scope).href,
            )) ?? Response.error()
          );
        throw error;
      }
    })(),
  );
});
