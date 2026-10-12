const CACHE = 'evoluz-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((k) => Promise.all(k.filter((x) => x !== CACHE).map((x) => caches.delete(x)))).then(() => self.clients.claim())
  );
});
// network-first; the cache is the offline fallback
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const c = r.clone();
        caches.open(CACHE).then((x) => x.put(e.request, c));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
