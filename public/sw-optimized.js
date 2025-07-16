/**
 * Optimized Service Worker for v1z3r
 * Advanced caching strategies and performance optimization
 */

const CACHE_NAME = 'v1z3r-v3.0.0';
const STATIC_CACHE = 'v1z3r-static-v3.0.0';
const DYNAMIC_CACHE = 'v1z3r-dynamic-v3.0.0';
const SHADER_CACHE = 'v1z3r-shaders-v3.0.0';

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
  NETWORK_ONLY: 'network-only',
  CACHE_ONLY: 'cache-only'
};

// Resource patterns and their strategies
const CACHE_PATTERNS = [
  {
    pattern: /\/_next\/static\//,
    strategy: CACHE_STRATEGIES.CACHE_FIRST,
    cache: STATIC_CACHE,
    maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
  {
    pattern: /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico)$/,
    strategy: CACHE_STRATEGIES.CACHE_FIRST,
    cache: STATIC_CACHE,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  {
    pattern: /\.wgsl$/,
    strategy: CACHE_STRATEGIES.CACHE_FIRST,
    cache: SHADER_CACHE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  {
    pattern: /\/api\//,
    strategy: CACHE_STRATEGIES.NETWORK_FIRST,
    cache: DYNAMIC_CACHE,
    maxAge: 5 * 60 * 1000, // 5 minutes
  },
  {
    pattern: /\/(performance-test|visualizer)$/,
    strategy: CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    cache: DYNAMIC_CACHE,
    maxAge: 60 * 60 * 1000, // 1 hour
  }
];

// Install event
self.addEventListener('install', event => {
  console.log('[SW] Install event');
  
  event.waitUntil(
    Promise.all([
      // Pre-cache critical resources
      caches.open(STATIC_CACHE).then(cache => {
        return cache.addAll([
          '/',
          '/manifest.json',
          '/favicon.ico',
          // Add critical CSS and JS files
        ]);
      }),
      // Pre-cache WebGPU shaders
      caches.open(SHADER_CACHE).then(cache => {
        return cache.addAll([
          '/shaders/particleCompute.wgsl',
          // Add other shader files
        ]);
      })
    ]).then(() => {
      // Force activation
      return self.skipWaiting();
    })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  
  event.waitUntil(
    Promise.all([
      // Clean old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE &&
                cacheName !== SHADER_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ])
  );
});

// Fetch event with intelligent caching
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Find matching cache pattern
  const pattern = CACHE_PATTERNS.find(p => p.pattern.test(request.url));
  
  if (pattern) {
    event.respondWith(handleRequest(request, pattern));
  } else {
    // Default to network first for unknown resources
    event.respondWith(
      handleRequest(request, {
        strategy: CACHE_STRATEGIES.NETWORK_FIRST,
        cache: DYNAMIC_CACHE,
        maxAge: 60 * 60 * 1000 // 1 hour
      })
    );
  }
});

// Handle request based on strategy
async function handleRequest(request, config) {
  const { strategy, cache: cacheName, maxAge } = config;
  
  switch (strategy) {
    case CACHE_STRATEGIES.CACHE_FIRST:
      return cacheFirst(request, cacheName, maxAge);
    
    case CACHE_STRATEGIES.NETWORK_FIRST:
      return networkFirst(request, cacheName, maxAge);
    
    case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request, cacheName, maxAge);
    
    case CACHE_STRATEGIES.NETWORK_ONLY:
      return fetch(request);
    
    case CACHE_STRATEGIES.CACHE_ONLY:
      return caches.match(request);
    
    default:
      return networkFirst(request, cacheName, maxAge);
  }
}

// Cache first strategy
async function cacheFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached && !isExpired(cached, maxAge)) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    // Return stale cache if network fails
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// Network first strategy
async function networkFirst(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached && !isExpired(cached, maxAge)) {
      return cached;
    }
    throw error;
  }
}

// Stale while revalidate strategy
async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  // Background fetch to update cache
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }
    return response;
  }).catch(() => {
    // Ignore fetch errors in background
  });
  
  // Return cached version immediately if available
  if (cached) {
    // Don't await the fetch promise
    fetchPromise;
    return cached;
  }
  
  // If no cache, wait for network
  return fetchPromise;
}

// Check if cached response is expired
function isExpired(response, maxAge) {
  if (!maxAge) return false;
  
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return false;
  
  const date = new Date(dateHeader);
  const age = Date.now() - date.getTime();
  
  return age > maxAge;
}

// Background sync for performance data
self.addEventListener('sync', event => {
  if (event.tag === 'performance-sync') {
    event.waitUntil(syncPerformanceData());
  }
});

async function syncPerformanceData() {
  try {
    // Sync performance metrics when online
    const data = await getStoredPerformanceData();
    if (data && data.length > 0) {
      await fetch('/api/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      // Clear synced data
      await clearStoredPerformanceData();
    }
  } catch (error) {
    console.log('[SW] Performance sync failed:', error);
  }
}

// Utility functions for performance data storage
async function getStoredPerformanceData() {
  // Implementation would use IndexedDB
  return [];
}

async function clearStoredPerformanceData() {
  // Implementation would clear IndexedDB
}

// Push notifications for performance alerts
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    if (data.type === 'performance-alert') {
      const options = {
        body: data.message,
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        data: data.url,
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View Details'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      };
      
      event.waitUntil(
        self.registration.showNotification('v1z3r Performance Alert', options)
      );
    }
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data || '/')
    );
  }
});

// Periodic background sync for cache cleanup
self.addEventListener('periodicsync', event => {
  if (event.tag === 'cache-cleanup') {
    event.waitUntil(cleanupOldCaches());
  }
});

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    name.includes('v1z3r') && 
    !name.includes('v3.0.0')
  );
  
  await Promise.all(
    oldCaches.map(name => caches.delete(name))
  );
}

console.log('[SW] Service Worker loaded successfully');