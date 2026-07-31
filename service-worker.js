const CACHE_NAME = 'smash-cache-v6';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/members.html',
  '/programs.html',
  '/schedule.html',
  '/settings.html',
  '/coach.html',
  '/css/base.css',
  '/css/components.css',
  '/css/members.css',
  '/css/programs.css',
  '/css/dashboard.css',
  '/css/schedule.css',
  '/css/settings.css',
  '/css/coach.css',
  '/js/shared.js',
  '/js/dashboard.js',
  '/js/members.js',
  '/js/programs.js',
  '/js/schedule.js',
  '/js/settings.js',
  '/js/coach.js',
  '/logo.png'
];

// Install Event - Precaching App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching App Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event - Cleanup Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event - Network First Strategy for HTML/JS/CSS
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For Firebase API calls, let the network handle it (Firestore has its own offline persistence)
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If we got a valid response, clone it and put it in cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If network fails (offline), fall back to cache
        return caches.match(event.request);
      })
  );
});

// Listen for message to trigger skipWaiting (for updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
