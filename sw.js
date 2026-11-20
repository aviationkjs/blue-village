// Service worker: offline after the first visit, and new versions apply on their own.
// Own files: network first (always the newest when online), cache when offline.
// CDN libraries and fonts: cache first, refreshed in the background.
const CACHE = 'blue-village-20261120071946';
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./js/cats.js",
  "./js/decorate.js",
  "./js/grid.js",
  "./js/house3d.js",
  "./js/main.js",
  "./js/models3d.js",
  "./js/photo.js",
  "./js/doan.js",
  "./js/pwa.js",
  "./js/roads.js",
  "./js/scene.js",
  "./js/sheet.js",
  "./js/spot.js",
  "./assets/sheet1.webp",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('blue-village-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

async function networkFirst(req, cache) {
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  }
}
async function cacheFirst(req, cache, e) {
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  if (hit) { e.waitUntil(net); return hit; }
  return (await net) || Response.error();
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === location.origin) e.respondWith(caches.open(CACHE).then(c => networkFirst(req, c)));
  else if (CDN.includes(u.hostname)) e.respondWith(caches.open(CACHE).then(c => cacheFirst(req, c, e)));
});
