const CACHE_NAME = 'coopchain-pwa-v3';
const urlsToCache = [
  '/',
  '/css/style.css',
  '/icon/seal.svg',
  '/icon/calendar-icon-192.svg',
  '/icon/calendar-icon-512.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const request = event.request;
  const requestUrl = new URL(request.url);

  // Bigmeet data changes immediately after create/update/delete operations.
  // Always use the network so cached API JSON cannot hide the latest values.
  if (requestUrl.origin === self.location.origin &&
      (requestUrl.pathname === '/bigmeet' || requestUrl.pathname.startsWith('/bigmeet/'))) {
    event.respondWith(fetch(request));
    return;
  }

  const isDocument = request.mode === 'navigate' || (request.destination === 'document');

  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return response;
        })
        .catch(() => caches.match('/'));
    })
  );
});
