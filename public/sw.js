// Minimal install-only service worker: no offline caching so live audio, SSE, and auth always stay fresh.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
