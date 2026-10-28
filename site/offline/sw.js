const CACHE = 'joitrip-offline-v1';
const ROOT = new URL(self.registration.scope).pathname;
const SHELL = [ROOT, `${ROOT}index.html`, `${ROOT}app.js`, `${ROOT}styles.css`, `${ROOT}manifest.webmanifest`, `${ROOT}icon.svg`];

self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => { if (event.data?.type === 'JOITRIP_OFFLINE_UPDATED') self.clients.matchAll().then((clients) => clients.forEach((client) => client.postMessage({ type: 'JOITRIP_OFFLINE_UPDATED' }))); });
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== location.origin || !url.pathname.startsWith(ROOT)) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok && request.method === 'GET') caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
    return response;
  }).catch(() => caches.match(`${ROOT}index.html`))));
});
