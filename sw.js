/* Road to 40km — minimal service worker.
   Purpose: make the app installable and let the shell open offline.
   It deliberately ignores cross-origin requests, so Supabase sync,
   Strava, Google Fonts and the Supabase CDN always go straight to the
   network and are never cached or intercepted. */

const CACHE = 'road40-v1';           // bump this string to force an update
const SHELL = ['/', '/index.html', '/manifest.json',
               '/icon-192.png', '/icon-512.png', '/icon-512-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                 // never touch writes
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;        // leave Supabase/Strava/fonts alone

  // HTML navigations: network-first so a new deploy shows immediately,
  // fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
        .catch(() => caches.match(req).then(m => m || caches.match('/index.html')))
    );
    return;
  }

  // Same-origin static assets (icons, manifest): cache-first.
  e.respondWith(
    caches.match(req).then(m => m || fetch(req).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r;
    }))
  );
});
