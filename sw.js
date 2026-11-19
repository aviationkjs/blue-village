// Service worker: works offline after the first visit. build-pwa.js fills in the version and the file list below.
const CACHE = 'blue-village-20261119212119';
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
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('blue-village-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// cache first, refresh in the background (stale-while-revalidate)
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin && !CDN.includes(u.hostname)) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req, { ignoreSearch: u.origin === location.origin });
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  }));
});
