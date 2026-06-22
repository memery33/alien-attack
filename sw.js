/* sw.js — minimal offline cache so SUBSTRATA runs from the Home Screen
   without a network connection. Bump CACHE when assets change. */

const CACHE = 'substrata-v7';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './manifest.json',
  './js/util.js',
  './js/assets.js',
  './js/data.js',
  './js/save.js',
  './js/audio.js',
  './js/input.js',
  './js/entities.js',
  './js/story.js',
  './js/base.js',
  './js/mission.js',
  './js/main.js',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
