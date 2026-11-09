// Offline support. Network first, so a new deploy shows up as soon as the
// phone is online; the cached copy is used when offline.
// Bump CACHE when the file list changes.

const CACHE = 'nutri-journal-v10';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/core/calc.js',
  './js/core/dates.js',
  './js/core/entry.js',
  './js/data/db.js',
  './js/data/store.js',
  './js/foods/label-parse.js',
  './js/foods/ocr.js',
  './js/foods/off.js',
  './js/i18n/i18n.js',
  './js/i18n/en.js',
  './js/ui/dom.js',
  './js/ui/state.js',
  './js/ui/daynav.js',
  './js/ui/dashboard.js',
  './js/ui/journal.js',
  './js/ui/entry-form.js',
  './js/ui/scanner.js',
  './js/ui/profile.js',
  './js/ui/targets-compare.js',
  './js/ui/ideas.js',
  './js/ui/tastes.js',
  './js/suggest/catalog.js',
  './js/foods/everyday.js',
  './js/foods/common.js',
  './js/suggest/templates.js',
  './js/suggest/engine.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // Only same-origin GETs; food database and AI calls go straight to the network.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    // no-cache: always check with the server, so a deploy never mixes old
    // and new files from the browser's HTTP cache
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html'))),
  );
});
