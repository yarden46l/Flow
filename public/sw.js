const CACHE_NAME = "kaizenflow-cache-v1";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Guard: ignore non-HTTP(S) requests (e.g. chrome-extension://, moz-extension://).
  // The Cache API will throw a fatal TypeError for these schemes, which crashes
  // the Service Worker and blocks Firestore sync.
  if (!event.request.url.startsWith("http")) return;

  // Only handle GET requests
  if (event.request.method !== "GET") return;

  // Next.js Dev/Hot-Reload bypass
  if (event.request.url.includes("/_next/webpack-hmr")) return;

  // Use a Cache First, Network Fallback strategy for everything
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }
          // Clone the response because we want to cache it AND return it
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Network failed (offline), and not in cache
          // If it's a navigation request (HTML), return offline.html
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }
        });
    })
  );
});
