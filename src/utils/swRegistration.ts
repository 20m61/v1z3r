/**
 * Service Worker Registration Utility
 * Handles registration and updates for the enhanced service worker
 */

export async function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Only register in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw-enhanced.js', {
      scope: '/',
    });

    console.log('Service Worker registered successfully');

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          if (window.confirm('新しいバージョンが利用可能です。更新しますか？')) {
            newWorker.postMessage({ action: 'skipWaiting' });
            window.location.reload();
          }
        }
      });
    });

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000); // Every hour

  } catch (error) {
    console.error('Service Worker registration failed:', error);
  }
}

export async function unregisterServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
    }
    console.log('Service Worker unregistered successfully');
  } catch (error) {
    console.error('Service Worker unregistration failed:', error);
  }
}

export async function clearServiceWorkerCache() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage({ action: 'clearCache' });
  }
}