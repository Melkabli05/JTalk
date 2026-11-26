// Jtalk PWA Service Worker
// Caches static shell & brand assets while strictly bypassing /api/*, SSE, Auth0, and LiveKit.

const CACHE_NAME = 'jtalk-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/brand/jtalk-mark.svg',
  '/brand/jtalk-mark-dark.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

const STATIC_EXT_PATTERN = /\.(?:js|css|svg|png|jpg|jpeg|webp|ico|woff2?|webmanifest)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls, SSE streams, or auth callbacks.
  if (url.pathname.startsWith('/api/')) return;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/event-stream')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOffline = await caches.match(OFFLINE_URL);
        return cachedOffline || new Response('Offline', { status: 503, statusText: 'Offline' });
      }),
    );
    return;
  }

  if (STATIC_EXT_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok && response.type === 'basic') {
              void cache.put(request, response.clone());
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkPromise;
      }),
    );
  }
});
