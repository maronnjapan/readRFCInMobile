// Service Worker: アプリ本体はネットワーク優先 + キャッシュフォールバック、
// RFC 本文 (不変) はキャッシュ優先で保存し、オフラインでも再読できるようにする。
const VERSION = 'v2';
const SHELL_CACHE = `rfcreader-shell-${VERSION}`;
const TEXT_CACHE = 'rfcreader-texts';
// pdf.js (vendor/) は PDF を初めて開いたときに取得し、下のネットワーク優先の処理でキャッシュする
const SHELL = ['./', './index.html', './styles.css', './manifest.webmanifest', './src/app.js', './src/rfc-parser.js', './src/render.js', './src/pdf-reader.js', './src/pdf-extract.js', './src/pdf-layout.js', './icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rfcreader-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isRfcText = (url) => /\/rfc\d{1,5}\.txt$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isRfcText(url)) {
    event.respondWith(
      caches.open(TEXT_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(req);
          if (hit) return hit;
          if (req.mode === 'navigate') return caches.match('./index.html');
          throw new Error('offline');
        }),
    );
  }
});
