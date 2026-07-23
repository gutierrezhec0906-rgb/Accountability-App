// Accountability App service worker.
// Network-first so a new deploy is always picked up; falls back to the last
// cached shell only when offline. Hashed Vite assets are cached on demand.
const CACHE = 'accountability-v1';
const SHELL = '/index.html';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Only handle same-origin requests; let Firebase/Firestore/Google traffic pass through.
  if (url.origin !== self.location.origin) return;

  // App navigations: network-first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((c) => c.put(SHELL, res.clone())).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL))
    );
    return;
  }

  // Static assets: cache-first with background refresh.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
