// Service Worker: Hybrid Real-Time & Asset Cache Strategy
// Enforces NetworkOnly for Google Sheets API, real-time product data, and dynamic query routes
const CACHE_NAME = 'munna-store-shell-v10';

// 1. Immediate activation on new deployments
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

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

// 2. Fetch routing with strict live rules for product data
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // A. BROWSER EXTENSIONS & NON-HTTP(S) - Ignore
  if (!url.protocol.startsWith('http')) return;

  // B. NON-GET REQUESTS - NetworkOnly
  if (request.method !== 'GET') {
    return;
  }

  // C. GOOGLE SHEETS API, APPS SCRIPT WEBHOOK, AND CACHE-BUSTED API CALLS
  // Always NetworkOnly with cache: 'no-store'
  const isGoogleApi =
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('sheets.googleapis.com');
  const isCacheBusted = url.searchParams.has('_t') || url.searchParams.has('_');
  const isApiAction = url.searchParams.has('action');
  const isDynamicProduct = url.searchParams.has('item') || url.searchParams.has('product');

  if (isGoogleApi || isCacheBusted || isApiAction) {
    // Zero-cache NetworkOnly
    event.respondWith(
      fetch(request, {
        cache: 'no-store'
      })
    );
    return;
  }

  // D. DYNAMIC PRODUCT DETAIL URLS (?item=...)
  // NetworkFirst: Always try network first to load live product prices & stock
  if (isDynamicProduct) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .catch(() => caches.match(request))
    );
    return;
  }

  // E. HTML DOCUMENTS & NAVIGATION REQUESTS (index.html, /*)
  // NetworkFirst: Fetch fresh HTML so new deployments update instantly
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // F. IMMUTABLE ASSETS (/assets/*, fonts, icons)
  // CacheFirst with Network Fallback
  if (
    url.pathname.startsWith('/assets/') ||
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // G. ALL OTHER REQUESTS: NetworkFirst
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
