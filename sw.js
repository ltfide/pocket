/**
 * meapp Pocket Companion - Offline Service Worker
 * Network-first for dynamic sync, Cache-first for static assets
 */
const CACHE_NAME = "pocket-v1";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Bypass cache for external APIs (e.g. GitHub Gist API)
  if (url.origin !== location.origin || url.pathname.includes("api.github.com")) {
    return;
  }

  // Stale-while-revalidate for local static assets
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networked = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => cached);

      return cached || networked;
    })
  );
});
