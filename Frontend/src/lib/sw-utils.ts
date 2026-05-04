/**
 * Service Worker utilities for Orbit app.
 *
 * Provides SW registration, prefetch, reactive refresh, and cache invalidation.
 *
 * Key improvement over v1:
 * - REFRESH_API: SW fetches in background, delivers data via postMessage.
 *   UI receives data and patches state without triggering re-fetches,
 *   eliminating the "loading flicker" that happens when socket events
 *   trigger loadXxx() calls that go through the full fetch → setState cycle.
 *
 * - CACHE_ROUTES: Extend SW cache coverage to any route dynamically.
 *   Call this before triggering a list load so SW can intercept and cache it.
 *
 * - GET_CACHED: Request cached data on-demand. Returns via GET_CACHED_RESPONSE
 *   message to the SW message listener registered in the app.
 */

const SW_URL = '/orbit-sw.js';
const DEFAULT_ROUTES = ['/api/projects/me', '/api/folders/me'];

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
export function prefetchApiCache(routes = DEFAULT_ROUTES): void {
  if (typeof window === 'undefined') return;
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'PREFETCH_API',
    payload: { routes },
  });
}

/**
 * Trigger background refresh for specified routes.
 *
 * The SW fetches fresh data in the background (not blocking UI), then
 * delivers it to all open tabs via postMessage (REFRESH_RESPONSE).
 *
 * Components should listen for REFRESH_RESPONSE messages (e.g. via the
 * swMessageListener in appStore or DashboardLayout) and patch their state
 * directly instead of calling loadXxx() which triggers full re-fetches.
 *
 * @param routes - API routes to refresh (e.g. ['/api/projects/me', '/api/change-requests/me'])
 * @param options.signal - AbortSignal to cancel in-flight refresh
 */
export function refreshApiCache(
  routes: string[],
  options?: { signal?: AbortSignal }
): void {
  if (typeof window === 'undefined') return;
  if (options?.signal?.aborted) return;
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'REFRESH_API',
    payload: { routes },
  });
}

/**
 * Request cached data for a route on-demand.
 * Returns data via GET_CACHED_RESPONSE message.
 *
 * @param route - API route path (e.g. '/api/projects/me')
 */
export function getCachedRoute(route: string): void {
  if (typeof window === 'undefined') return;
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'GET_CACHED',
    payload: { route },
  });
}

/**
 * Extend SW cache coverage to include dynamic routes.
 * Call this before loading a list so the SW can intercept, cache, and
 * deliver data reactively.
 *
 * @param routes - Routes to add to SW cache coverage
 */
export function cacheRoutes(routes: string[]): void {
  if (typeof window === 'undefined') return;
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'CACHE_ROUTES',
    payload: { routes },
  });
}

/**
 * Invalidate SW cache for a single route.
 * Use this after a CRUD operation to force the next load to fetch fresh data.
 *
 * @param route - Route to invalidate (e.g. '/api/projects/me')
 */
export function invalidateRoute(route: string): void {
  if (typeof window === 'undefined') return;
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'CLEAR_ROUTE',
    payload: { route },
  });
}

/**
 * Clear the API cache (e.g. on logout or cache invalidation signal).
 */
export function clearApiCache(): void {
  if (typeof window === 'undefined') return;
  if (!navigator.serviceWorker?.controller) return;

  navigator.serviceWorker.controller.postMessage({
    type: 'CLEAR_API_CACHE',
  });
}

/**
 * Clear all SW caches (e.g. on hard logout).
 */
export function clearAllCache(): void {
  if (typeof window === 'undefined') return;
  if (!navigator.serviceWorker?.controller) return;

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
    const cache = await caches.open('orbit-api-v2');
    const key = new Request(location.origin + route);
    const match = await cache.match(key);
    return !!match;
  } catch {
    return false;
  }
}

// ── Message listener factory ───────────────────────────────────────────────────

export type SwMessageHandler = (data: SwMessage) => void;

export interface SwMessage {
  type:
    | 'REFRESH_RESPONSE'
    | 'GET_CACHED_RESPONSE'
    | 'SYNC_SESSION'
    | 'CACHE_READY'
    | 'CLEAR_SESSION';
  payload?: Record<string, unknown>;
}

/**
 * Install a SW message listener and return a cleanup function.
 *
 * Usage:
 *   const cleanup = listenToSwMessages((msg) => {
 *     if (msg.type === 'REFRESH_RESPONSE') {
 *       const { route, data } = msg.payload;
 *       if (route.includes('/api/projects/me')) setProjects(data);
 *     }
 *   });
 *   // cleanup() in useEffect return
 */
export function listenToSwMessages(handler: SwMessageHandler): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  const listener = (event: MessageEvent) => {
    if (!event.data?.type) return;
    handler(event.data as SwMessage);
  };

  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
}
