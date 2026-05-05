/**
 * Orbit Service Worker — Advanced refresh + cache strategy.
 *
 * Goals:
 * 1. Instant UI: Return cached data immediately, refresh in background
 * 2. No jank: Background refresh via SW, postMessage delivers data to UI without re-fetching
 * 3. Broad coverage: Cache all list/CRUD API routes, not just projects/folders
 * 4. Reactive: UI subscribes to SW messages and patches state diff-style
 *
 * Message API (from page → SW):
 *   PREFETCH_API    { routes }     — prefetch specified routes
 *   REFRESH_API     { routes }     — fetch + cache + postMessage data to page
 *   CACHE_ROUTES    { routes }     — add routes to the live cache list
 *   GET_CACHED      { route }      — request cached data for a route (returns via GET_CACHED_RESPONSE)
 *   CLEAR_ROUTE     { route }       — invalidate single route cache
 *   CLEAR_API_CACHE                — clear all API cache
 *   CLEAR_ALL                       — clear all caches
 *
 * Message API (from SW → page):
 *   REFRESH_RESPONSE  { route, data, isStale }  — fresh data delivered to UI
 *   GET_CACHED_RESPONSE { route, data }         — requested cached data
 *   SYNC_SESSION     { key, data }              — sessionStorage sync (existing)
 *   CACHE_READY      { routes }                — announced after prefetch completes
 */

const CACHE_VERSION = 'v4';
const STATIC_CACHE = `orbit-static-${CACHE_VERSION}`;
const API_CACHE = `orbit-api-${CACHE_VERSION}`;
const API_CACHE_TTL_MS = 30 * 1000; // fallback only; API fetches are network-first

// Routes to always cache
const ALWAYS_CACHE_ROUTES = [
  '/api/projects/me',
  '/api/folders/me',
];

// Dynamic route list (expanded via CACHE_ROUTES message)
let cachedRoutes = new Set(ALWAYS_CACHE_ROUTES);

// Deduplicate concurrent fetches for the same URL
const inflightRequests = new Map();

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE));
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) return;

  // Skip localhost in dev
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(handleStaticRequest(request));
  }
});

// ── API Handler ───────────────────────────────────────────────────────────────
async function handleApiRequest(request) {
  {
  if (request.method !== 'GET') {
    return fetch(request);
  }

  const cache = await caches.open(API_CACHE);
  const cacheKey = request.url;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cacheResponse(cache, cacheKey, response.clone());
      const json = await response.clone().json().catch(() => null);
      if (json !== null) {
        deliverToClients({
          type: 'REFRESH_RESPONSE',
          payload: { route: request.url, data: json, isStale: false },
        });
      }
    }
    return response;
  } catch {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const cachedTime = cached.headers.get('x-cached-at');
      const isStale = cachedTime ? Date.now() - parseInt(cachedTime) > API_CACHE_TTL_MS : true;
      const json = await cached.clone().json().catch(() => null);
      if (json !== null) {
        deliverToClients({
          type: 'REFRESH_RESPONSE',
          payload: { route: request.url, data: json, isStale },
        });
      }
      return cached;
    }
  }

  return new Response(JSON.stringify({ success: false, message: 'Network unavailable' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
  }

  const cache = await caches.open(API_CACHE);
  const cacheKey = request.url;
  const cached = await cache.match(cacheKey);

  if (cached) {
    // Return cached immediately — no skeleton flicker
    const cachedTime = cached.headers.get('x-cached-at');
    const isStale = cachedTime ? Date.now() - parseInt(cachedTime) > API_CACHE_TTL_MS : true;

    // Deliver cached data to page via postMessage so UI can patch state
    deliverToClients({
      type: 'REFRESH_RESPONSE',
      payload: {
        route: request.url,
        data: cached.clone(),
        isStale,
      },
    });

    // Refresh in background if stale
    if (isStale) {
      refreshInBackground(request, cache);
    }

    return cached;
  }

  // No cache — must go to network
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cloned = response.clone();

      // Add timestamp header
      const headers = new Headers(cloned.headers);
      headers.set('x-cached-at', String(Date.now()));
      const timedResponse = new Response(await cloned.clone().text(), {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });

      cache.put(cacheKey, timedResponse).catch(() => {});
      deliverToClients({
        type: 'REFRESH_RESPONSE',
        payload: { route: request.url, data: cloned, isStale: false },
      });
    }
    return response;
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Network unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function refreshInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set('x-cached-at', String(Date.now()));
      const timedResponse = new Response(await cloned.clone().text(), {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      cache.put(request.url, timedResponse).catch(() => {});

      deliverToClients({
        type: 'REFRESH_RESPONSE',
        payload: { route: request.url, data: cloned, isStale: false },
      });
    }
  } catch {
    // silent — stale data already returned
  }
}

// ── Extract projectId from route ─────────────────────────────────────────────────
async function cacheResponse(cache, cacheKey, response) {
  const headers = new Headers(response.headers);
  headers.set('x-cached-at', String(Date.now()));
  const timedResponse = new Response(await response.clone().text(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await cache.put(cacheKey, timedResponse).catch(() => {});
}

function extractProjectId(url) {
  const match = String(url).match(/\/api\/projects\/([^/?#]+)/);
  return match ? match[1] : null;
}

// ── Deliver data to all clients via postMessage ────────────────────────────────
// Tries structured clone first (efficient), falls back to JSON for Response objects
async function deliverToClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    try {
      if (message.type === 'REFRESH_RESPONSE' && message.payload.data) {
        let data;
        let transferables = [];
        if (typeof message.payload.data === 'object' && message.payload.data !== null) {
          data = message.payload.data;
        } else {
          data = message.payload.data;
        }
        const projectId = extractProjectId(message.payload.route);
        client.postMessage(
          {
            type: 'REFRESH_RESPONSE',
            payload: {
              route: message.payload.route,
              data,
              isStale: message.payload.isStale,
              projectId,
            },
          },
          transferables
        );
      } else {
        client.postMessage(message);
      }
    } catch {
      // If structured clone fails, skip (e.g. non-serializable data)
    }
  }
}

// ── Sync to sessionStorage (legacy, kept for compatibility) ────────────────────
async function syncToSessionStorage(request, response, data) {
  try {
    const url = new URL(request.url);
    const route = url.pathname;

    if (!cachedRoutes.has(route) && !ALWAYS_CACHE_ROUTES.includes(route)) return;

    const key = 'orbit:' + route.replace('/api/', '');
    const payload = {
      data,
      expiresAt: Date.now() + API_CACHE_TTL_MS,
    };

    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SYNC_SESSION', payload: { key, data: payload } });
    }
  } catch {
    // ignore
  }
}

// ── Static Handler ────────────────────────────────────────────────────────────
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Message Handler ───────────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (!event.data) return;
  const { type, payload } = event.data;

  if (type === 'PREFETCH_API') {
    const routes = payload?.routes || ALWAYS_CACHE_ROUTES;
    prefetchApiRoutes(routes);
  }

  if (type === 'REFRESH_API') {
    // Explicit refresh: fetch, cache, deliver via postMessage
    const routes = payload?.routes || [];
    refreshApiRoutes(routes);
  }

  if (type === 'CACHE_ROUTES') {
    // Expand dynamic route coverage
    const routes = payload?.routes || [];
    routes.forEach((r) => cachedRoutes.add(r));
  }

  if (type === 'GET_CACHED') {
    // Return cached data for a route on demand
    const route = payload?.route;
    if (route) getCachedRoute(route);
  }

  if (type === 'CLEAR_ROUTE') {
    clearRouteCache(payload?.route);
  }

  if (type === 'CLEAR_API_CACHE') {
    clearApiCache();
  }

  if (type === 'CLEAR_ALL') {
    clearAllCaches();
  }
});

// ── Prefetch ─────────────────────────────────────────────────────────────────
async function prefetchApiRoutes(routes) {
  const cache = await caches.open(API_CACHE);
  const results = [];

  await Promise.allSettled(
    routes.map(async (route) => {
      try {
        const url = location.origin + route;
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
          const cloned = res.clone();
          const headers = new Headers(cloned.headers);
          headers.set('x-cached-at', String(Date.now()));
          const timedResponse = new Response(await cloned.clone().text(), {
            status: cloned.status,
            statusText: cloned.statusText,
            headers,
          });
          await cache.put(location.origin + route, timedResponse);
          const json = await cloned.json();
          await syncToSessionStorage(new Request(location.origin + route), cloned, json);
          results.push(route);
        }
      } catch {
        // silent
      }
    })
  );

  // Announce completion so UI knows prefetch is done
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'CACHE_READY', payload: { routes: results } });
  }
}

// ── Refresh: fetch + cache + postMessage to UI ────────────────────────────────
// This is the key to "no jank" — SW fetches in background, delivers data
// via postMessage, and UI patches state without triggering re-renders for loading
async function refreshApiRoutes(routes) {
  await Promise.allSettled(
    routes.map(async (route) => {
      const cache = await caches.open(API_CACHE);
      const cacheKey = location.origin + route;

      // Deduplicate concurrent requests
      if (inflightRequests.has(route)) {
        return inflightRequests.get(route);
      }

      const request = new Request(cacheKey, { credentials: 'include' });
      const promise = (async () => {
        try {
          const res = await fetch(request);
          if (res.ok) {
            const cloned = res.clone();
            const headers = new Headers(cloned.headers);
            headers.set('x-cached-at', String(Date.now()));
            const timedResponse = new Response(await cloned.clone().text(), {
              status: cloned.status,
              statusText: cloned.statusText,
              headers,
            });
            await cache.put(cacheKey, timedResponse);

            const json = await cloned.json();
            await syncToSessionStorage(new Request(cacheKey), cloned, json);

            // Deliver to UI
            deliverToClients({
              type: 'REFRESH_RESPONSE',
              payload: { route, data: json, isStale: false },
            });
          }
        } finally {
          inflightRequests.delete(route);
        }
      })();

      inflightRequests.set(route, promise);
      return promise;
    })
  );
}

// ── Get Cached Route ─────────────────────────────────────────────────────────
async function getCachedRoute(route) {
  try {
    const cache = await caches.open(API_CACHE);
    const cacheKey = location.origin + route;
    const match = await cache.match(cacheKey);
    if (match) {
      const json = await match.clone().json();
      const cachedTime = match.headers.get('x-cached-at');
      const isStale = cachedTime ? Date.now() - parseInt(cachedTime) > API_CACHE_TTL_MS : true;

      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.postMessage({
          type: 'GET_CACHED_RESPONSE',
          payload: { route, data: json, isStale },
        });
      }
    }
  } catch {
    // silent
  }
}

// ── Clear single route ────────────────────────────────────────────────────────
async function clearRouteCache(route) {
  if (!route) return;
  try {
    const cache = await caches.open(API_CACHE);
    await cache.delete(location.origin + route);
  } catch {
    // silent
  }
}

// ── Clear API cache ────────────────────────────────────────────────────────────
async function clearApiCache() {
  const cache = await caches.open(API_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.map((k) => cache.delete(k)));

  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'CLEAR_SESSION' });
  }
}

// ── Clear all caches ───────────────────────────────────────────────────────────
async function clearAllCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys.filter((k) => k.startsWith('orbit-')).map((k) => caches.delete(k))
  );
  inflightRequests.clear();

  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'CLEAR_SESSION' });
  }
}
