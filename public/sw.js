// v1z3r Service Worker
// Advanced caching strategy for VJ Application

const CACHE_NAME = 'v1z3r-cache-v1.0.0';
const STATIC_CACHE = 'v1z3r-static-v1.0.0';
const DYNAMIC_CACHE = 'v1z3r-dynamic-v1.0.0';

// Static assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/vj-app',
  '/manifest.json',
  '/_next/static/css/',
  '/_next/static/js/',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Assets to cache dynamically
const DYNAMIC_ASSETS_PATTERNS = [
  /\/_next\/static\//,
  /\/api\/presets\//,
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
  /\.(?:js|css|woff2?)$/
];

// Assets that should always be fetched from network
const NETWORK_FIRST_PATTERNS = [
  /\/api\/websocket/,
  /\/api\/sync/,
  /\/api\/realtime/,
  /\.(?:mp3|wav|ogg|m4a)$/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(STATIC_CACHE);
        
        // Cache core static assets
        const cachePromises = STATIC_ASSETS.map(async (url) => {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await staticCache.put(url, response);
              console.log(`[SW] Cached: ${url}`);
            }
          } catch (error) {
            console.warn(`[SW] Failed to cache ${url}:`, error);
          }
        });
        
        await Promise.allSettled(cachePromises);
        console.log('[SW] Static assets cached successfully');
        
        // Skip waiting to activate immediately
        self.skipWaiting();
      } catch (error) {
        console.error('[SW] Install failed:', error);
      }
    })()
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name => 
          name !== STATIC_CACHE && 
          name !== DYNAMIC_CACHE &&
          name.startsWith('v1z3r-')
        );
        
        // Delete old caches
        await Promise.all(
          oldCaches.map(cacheName => {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
        
        // Take control of all clients
        await self.clients.claim();
        console.log('[SW] Service worker activated and claimed clients');
      } catch (error) {
        console.error('[SW] Activation failed:', error);
      }
    })()
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Skip WebSocket requests
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  try {
    // Network-first strategy for real-time APIs
    if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await networkFirst(request);
    }
    
    // Cache-first strategy for static assets
    if (DYNAMIC_ASSETS_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      return await cacheFirst(request);
    }
    
    // Stale-while-revalidate for HTML pages
    if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
      return await staleWhileRevalidate(request);
    }
    
    // Default: network-first with cache fallback
    return await networkFirst(request);
    
  } catch (error) {
    console.error('[SW] Fetch handler error:', error);
    return await cacheFirst(request);
  }
}

// Cache-first strategy
async function cacheFirst(request) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log(`[SW] Cache hit: ${request.url}`);
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
      console.log(`[SW] Cached from network: ${request.url}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.warn(`[SW] Cache-first failed for ${request.url}:`, error);
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, networkResponse.clone());
      console.log(`[SW] Network response cached: ${request.url}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.warn(`[SW] Network failed for ${request.url}, trying cache...`);
    
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      console.log(`[SW] Fallback to cache: ${request.url}`);
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return new Response(getOfflineHTML(), {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    throw error;
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(error => {
    console.warn(`[SW] Background fetch failed for ${request.url}:`, error);
    return cachedResponse;
  });
  
  return cachedResponse || await fetchPromise;
}

// Offline HTML fallback
function getOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>v1z3r - Offline</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #000428 0%, #004e92 100%);
          color: white;
          margin: 0;
          padding: 2rem;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .offline-content {
          max-width: 400px;
        }
        .logo {
          font-size: 3rem;
          font-weight: bold;
          color: #00ccff;
          margin-bottom: 1rem;
        }
        .message {
          font-size: 1.2rem;
          margin-bottom: 2rem;
          opacity: 0.9;
        }
        .retry-btn {
          background: #00ccff;
          color: #000;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .retry-btn:hover {
          background: #0099cc;
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="offline-content">
        <div class="logo">v1z3r</div>
        <div class="message">
          You're currently offline.<br>
          Please check your internet connection.
        </div>
        <button class="retry-btn" onclick="window.location.reload()">
          Retry Connection
        </button>
      </div>
    </body>
    </html>
  `;
}

// Background sync for preset synchronization
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'preset-sync') {
    event.waitUntil(syncPresets());
  }
});

async function syncPresets() {
  try {
    // Get pending presets from IndexedDB
    const response = await fetch('/api/presets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.ok) {
      console.log('[SW] Presets synchronized successfully');
    }
  } catch (error) {
    console.error('[SW] Preset sync failed:', error);
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: 'v1z3r VJ Application',
    icon: '/icon-192x192.png',
    badge: '/icon-72x72.png',
    data: event.data ? event.data.json() : {},
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('v1z3r', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      self.clients.openWindow('/vj-app')
    );
  }
});

console.log('[SW] Service worker script loaded successfully');