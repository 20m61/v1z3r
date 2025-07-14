// Enhanced Service Worker for v1z3r
const CACHE_NAME = 'vj-app-v1';
const STATIC_CACHE_NAME = 'vj-static-v1';
const DYNAMIC_CACHE_NAME = 'vj-dynamic-v1';

// Critical assets to cache immediately
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/_next/static/css/app-layout.css',
  '/fonts/inter-var.woff2',
];

// Static assets pattern
const STATIC_ASSETS_PATTERN = /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|avif)$/;

// Cache strategies
const CACHE_STRATEGIES = {
  // Network first, fall back to cache
  networkFirst: async (request) => {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse.ok) {
        const cache = await caches.open(DYNAMIC_CACHE_NAME);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
      throw error;
    }
  },
  
  // Cache first, fall back to network
  cacheFirst: async (request) => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  },
  
  // Stale while revalidate
  staleWhileRevalidate: async (request) => {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then(networkResponse => {
      if (networkResponse.ok) {
        const cache = caches.open(DYNAMIC_CACHE_NAME);
        cache.then(cache => cache.put(request, networkResponse.clone()));
      }
      return networkResponse;
    });
    
    return cachedResponse || fetchPromise;
  }
};

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CRITICAL_ASSETS)
        .catch(err => {
          console.warn('Failed to cache some critical assets:', err);
        });
    })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('vj-') && 
                         name !== CACHE_NAME && 
                         name !== STATIC_CACHE_NAME && 
                         name !== DYNAMIC_CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// Fetch event - apply caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip API requests - always use network
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Static assets - cache first
  if (STATIC_ASSETS_PATTERN.test(url.pathname) || 
      url.pathname.includes('/_next/static/')) {
    event.respondWith(CACHE_STRATEGIES.cacheFirst(request));
    return;
  }
  
  // HTML pages - stale while revalidate
  if (request.mode === 'navigate' || 
      request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(CACHE_STRATEGIES.staleWhileRevalidate(request));
    return;
  }
  
  // Everything else - network first
  event.respondWith(CACHE_STRATEGIES.networkFirst(request));
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-presets') {
    event.waitUntil(syncPresets());
  }
});

// Sync presets when back online
async function syncPresets() {
  try {
    const cache = await caches.open('vj-pending-sync');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request.clone());
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (error) {
        console.error('Failed to sync request:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}

// Message handler for cache management
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});