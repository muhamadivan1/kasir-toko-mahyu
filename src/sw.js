/* Service worker: utamakan versi terbaru dari internet, pakai cache saat offline. */
const CACHE = 'kasir-mahyu-v17';
const FILES = ['./', './index.html', './pesan.html', './manifest.json', './icon.png', './icon-maskable.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // katalog.json?t=... disimpan dengan satu kunci saja (tanpa ?t=) supaya cache tidak menumpuk
  const key = url.pathname.endsWith('/katalog.json') ? new Request(url.origin + url.pathname) : req;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(key, copy));
        }
        return res;
      })
      .catch(() =>
        caches
          .match(key, { ignoreSearch: true })
          .then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
      )
  );
});
