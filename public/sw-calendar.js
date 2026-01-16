const CACHE_NAME = 'gitgum-calendar-v1';
const urlsToCache = [
  '/gitgum/mobile',
  '/manifest-calendar.json'
];

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(() => {
        // ไม่ต้องกังวลถ้า cache URL บางตัวไม่สำเร็จ
      });
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // ถ้า fetch สำเร็จ ให้ save ลง cache
        if (!response || response.status !== 200) {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // ถ้า fetch ล้มเหลว ให้ใช้ cache
        return caches.match(event.request).then(response => {
          return response || new Response('ไม่สามารถโหลดข้อมูลได้ - กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' })
          });
        });
      })
  );
});
