/**
 * Orbit App Shell Service Worker
 *
 * Strategy: Cache-first for static assets, network-first for API data.
 * On successful API response, cache it AND send data back to page via postMessage
 * so the page can write it to sessionStorage for instant hydration.
 *
 * Flow:
 *   1. SW intercepts API request
 *   2. Check cache — if hit, return cached + send data to page via postMessage
 *   3. If miss, fetch from network → cache it → send data to page
 *
 * This ensures ProjectsManager always has data from sessionStorage on mount,
 * eliminating skeleton flicker on subsequent visits.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `orbit-static-${CACHE_VERSION}`;
const API_CACHE = `orbit-api-${CACHE_VERSION}`;

// Static assets to precache
const STATIC_ASSETS = [
  '/',
];

// ── Install: cache static assets immediately ─────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // ignore failure — SW still activates
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('orbit-') && k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: decide strategy ─────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  /**
   * Dev / localhost: do not intercept fetches.
   * Cache-first scripts + Vite HMR/changing hashes cause stale bundles → blank white React islands.
   */
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    return;
  }

  // API routes → cache-first with background update
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Static assets → cache-first
  if (request.destination === 'document' || request.destination === 'script' || request.destination === 'style' || request.destination === 'image') {
    event.respondWith(handleStaticRequest(request));
  }
});

// ── API: Cache-first, refresh in background, sync to sessionStorage ─────────────
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Return cached immediately (no skeleton!)
    // But first sync to sessionStorage so page can read it synchronously
    syncToSessionStorage(request, cached);

    // Refresh in background silently
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          cache.put(request, clone).catch(() => {});
          syncToSessionStorage(request, clone);
        }
        return response;
      })
      .catch(() => null);

    return cached;
  }

  // No cache — must go to network
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      cache.put(request, clone).catch(() => {});
      syncToSessionStorage(request, clone);
    }
    return response;
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Network unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// ── Sync cached API data to sessionStorage so React can read on mount ──────────
async function syncToSessionStorage(request, response) {
  try {
    const url = new URL(request.url);
    // Only sync the critical routes we care about
    if (url.pathname !== '/api/projects/me' && url.pathname !== '/api/folders/me') return;

    const data = await response.clone().json();
    const key = 'orbit:' + url.pathname.replace('/api/', '');
    const payload = {
      data,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min TTL matching appStore
    };

    // Try to write to all clients' sessionStorage
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_SESSION',
        payload: { key, data: payload },
      });
    }
  } catch {
    // ignore serialization errors
  }
}

// ── Static: Cache-first ─────────────────────────────────────────────────────
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      cache.put(request, clone).catch(() => {});
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Message: trigger prefetch from app ─────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, payload } = event.data;

  if (type === 'PREFETCH_API') {
    prefetchApiRoutes(payload?.routes || ['/api/projects/me', '/api/folders/me', '/api/auth/me']);
  }

  if (type === 'CLEAR_API_CACHE') {
    clearApiCache();
  }

  if (type === 'CLEAR_ALL') {
    clearAllCaches();
  }
});

async function prefetchApiRoutes(routes) {
  const cache = await caches.open(API_CACHE);
  await Promise.allSettled(
    routes.map(async (route) => {
      try {
        const url = location.origin + route;
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          await cache.put(route, res.clone());
          syncToSessionStorage(new Request(route), res);
        }
      } catch {
        // ignore network errors during prefetch
      }
    })
  );
}

async function clearApiCache() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.map((k) => cache.delete(k)));
}

async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((k) => k.startsWith('orbit-')).map((k) => caches.delete(k))
  );
}
