const CACHE_NAME = 'zipl-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/manifest.webmanifest',
  '/assets/app.css',
  '/assets/app.js',
  '/assets/favicon.svg',
  '/assets/favicon-96x96.png',
  '/assets/apple-touch-icon.png',
  '/assets/fonts/jakarta-latin.woff2',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-192.png',
  '/assets/icons/icon-maskable-512.png'
];

// 安裝 Service Worker 並快取 Static App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// 清除舊版本快取並立即接管控制
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 攔截網路請求
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 非 GET 請求（如建立短網址 POST、刪除短網址 DELETE）直接走網路
  if (event.request.method !== 'GET') {
    return;
  }

  // API 請求與動態短網址轉向不快取，強制走向網路
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 靜態資源：Stale-While-Revalidate 策略（優先顯示快取，背景更新）
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 離線且無快取時回傳 App Shell / index.html
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });

      return cachedResponse || fetchPromise;
    })
  );
});
