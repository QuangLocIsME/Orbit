/**
 * Service Worker utilities for Orbit app.
 * Provides SW registration, prefetch triggering, and cache invalidation.
 */

const SW_URL = '/orbit-sw.js';
const API_ROUTES = ['/api/projects/me', '/api/folders/me'];

/**
 * Register the Orbit service worker.
 * Call this early in the app lifecycle (e.g. BaseLayout or auth check).
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
    // Wait for the SW to be activated
    if (reg.active) {
      // SW already active
    } else {
      await new Promise<void>((resolve) => {
        if (reg.installing) {
          reg.installing.addEventListener('statechange', (e) => {
            if ((e.target as ServiceWorker).state === 'activated') resolve();
          });
        }
        if (reg.active) resolve();
      });
    }
    return reg;
  } catch (err) {
    console.warn('[SW] Registration failed:', err);
    return null;
  }
}

/**
 * Prefetch critical API routes into SW cache.
 * Call this after login, on app mount, or proactively.
 */
export function prefetchApiCache(routes = API_ROUTES): void {
  if (typeof window === 'undefined' || !navigator.serviceWorker.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'PREFETCH_API',
    payload: { routes },
  });
}

/**
 * Clear the API cache (e.g. on logout or cache invalidation signal).
 */
export function clearApiCache(): void {
  if (typeof window === 'undefined' || !navigator.serviceWorker.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'CLEAR_API_CACHE',
  });
}

/**
 * Clear all SW caches (e.g. on hard logout).
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined' || !navigator.serviceWorker.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'CLEAR_ALL',
  });
}

/**
 * Check if SW cache has data for a given API route.
 * Useful for UI to know if data is available before rendering.
 */
export async function hasSwCache(route: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;

  try {
    const cache = await caches.open('orbit-api-v1');
    const key = new Request(location.origin + route);
    const match = await cache.match(key);
    return !!match;
  } catch {
    return false;
  }
}
