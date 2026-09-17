const OFFLINE_CACHE = "canfes-offline-v1";
const OLD_CACHE_PREFIXES = [
  "workbox-",
  "start-url",
  "google-fonts-",
  "static-font-assets",
  "static-image-assets",
  "next-image",
  "static-audio-assets",
  "static-video-assets",
  "static-js-assets",
  "static-style-assets",
  "next-data",
  "static-data-assets",
  "apis",
  "others",
  "cross-origin",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.add("/offline.html").catch(() => undefined);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name !== OFFLINE_CACHE && OLD_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)))
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(fetch(request).catch(async () => {
    const offlinePage = await caches.match("/offline.html");
    return offlinePage ?? Response.error();
  }));
});
