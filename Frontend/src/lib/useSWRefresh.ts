/**
 * useSWRefresh — React hook for reactive, jank-free list refresh via Service Worker.
 *
 * Problem it solves:
 * When socket events (cr:created, package:updated, etc.) trigger refresh, the
 * component calls loadXxx() which does a full fetch + setState cycle. On a slow
 * device or slow network, this causes visible UI jank: the list re-renders
 * with a loading state, then again with data, causing layout shifts and flicker.
 *
 * Solution:
 * The hook registers a SW message listener once. When SW delivers fresh data
 * via REFRESH_RESPONSE, the hook patches the provided state directly — no
 * extra fetch, no loading state, no layout shift. The data just "appears"
 * up-to-date.
 *
 * Usage:
 *   const { triggerRefresh, patchFromSW, swData, registerRoute } = useSWRefresh({
 *     routes: ['/api/projects/me'],
 *     onData: (route, data) => { setProjects(data); },
 *   });
 *
 * The `registerRoute` function tells SW to also cache additional routes,
 * so CR lists, package lists, etc. are all covered by SW caching.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { listenToSwMessages, type SwMessage } from './sw-utils';

export interface UseSWRefreshOptions<T = unknown> {
  /** Routes this hook should listen for (exact path matches) */
  routes?: string[];
  /** Called when SW delivers fresh data for a registered route */
  onData?: (route: string, data: T) => void;
  /** Called when SW delivers stale data (still useful for initial render) */
  onStaleData?: (route: string, data: T) => void;
  /** Called when all prefetch routes are ready */
  onReady?: (routes: string[]) => void;
  /** Abort signal for cleanup */
  signal?: AbortSignal;
}

export interface UseSWRefreshReturn {
  /**
   * Manually trigger background refresh for registered routes.
   * Returns immediately — data arrives via the onData callback.
   */
  triggerRefresh: () => void;
  /**
   * Register additional routes to listen for.
   * Also expands SW cache coverage for those routes.
   */
  registerRoutes: (routes: string[]) => void;
  /** Current data received from SW (route → data map) */
  swData: Record<string, unknown>;
  /** Whether SW has delivered fresh data for all registered routes */
  isReady: boolean;
  /** Route that SW last delivered data for */
  lastRoute: string | null;
}

/**
 * Hook for jank-free list refresh via Service Worker.
 *
 * @param options.routes - Initial routes to listen for
 * @param options.onData - Callback when fresh data arrives from SW
 * @param options.onStaleData - Callback when stale cached data arrives (optional)
 * @param options.onReady - Callback when all prefetch routes are ready
 * @param options.signal - AbortSignal for cleanup
 */
export function useSWRefresh<T = unknown>(
  options: UseSWRefreshOptions<T> = {}
): UseSWRefreshReturn {
  const {
    routes: initialRoutes = [],
    onData,
    onStaleData,
    onReady,
    signal,
  } = options;

  const [swData, setSwData] = useState<Record<string, unknown>>({});
  const [isReady, setIsReady] = useState(false);
  const [lastRoute, setLastRoute] = useState<string | null>(null);

  // Stable refs so callbacks don't need to be in deps
  const onDataRef = useRef(onData);
  const onStaleDataRef = useRef(onStaleData);
  const onReadyRef = useRef(onReady);
  const registeredRoutesRef = useRef<Set<string>>(new Set(initialRoutes));
  const readyRoutesRef = useRef<Set<string>>(new Set());

  // Keep refs current
  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    onStaleDataRef.current = onStaleData;
  }, [onStaleData]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Register initial routes
  useEffect(() => {
    initialRoutes.forEach((r) => registeredRoutesRef.current.add(r));
  }, [initialRoutes]);

  // SW message listener — lives for the component's lifetime
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cleanup = listenToSwMessages((msg: SwMessage) => {
      const { type, payload } = msg;

      // ── Fresh data delivered from SW (background refresh complete) ──
      if (type === 'REFRESH_RESPONSE') {
        const route = payload?.route as string | undefined;
        if (!route) return;

        // Only process routes we're registered for
        const routeKey = registeredRoutesRef.current.has(route)
          ? route
          : Array.from(registeredRoutesRef.current).find((r) => route.endsWith(r) || route.includes(r)) || '';

        if (!routeKey && registeredRoutesRef.current.size > 0) return;

        const data = payload?.data as T | undefined;
        const isStale = payload?.isStale as boolean | undefined;

        if (isStale) {
          onStaleDataRef.current?.(routeKey || route, data as T);
        }

        if (data !== undefined) {
          // Patch state with fresh data — no re-fetch needed
          setSwData((prev) => ({ ...prev, [routeKey || route]: data }));
          setLastRoute(routeKey || route);

          // Mark route as ready
          if (routeKey) {
            readyRoutesRef.current.add(routeKey);
            // Mark ready when all registered routes have delivered at least once
            if (readyRoutesRef.current.size >= registeredRoutesRef.current.size && registeredRoutesRef.current.size > 0) {
              setIsReady(true);
            }
          }

          // Deliver to consumer
          onDataRef.current?.(routeKey || route, data);
        }
        return;
      }

      // ── On-demand cached data returned from SW ──
      if (type === 'GET_CACHED_RESPONSE') {
        const route = payload?.route as string | undefined;
        const data = payload?.data as T | undefined;
        if (route && data !== undefined) {
          setSwData((prev) => ({ ...prev, [route]: data }));
          onDataRef.current?.(route, data);
        }
        return;
      }

      // ── Prefetch complete ──
      if (type === 'CACHE_READY') {
        const routes = payload?.routes as string[] | undefined;
        if (routes) {
          setIsReady(true);
          onReadyRef.current?.(routes);
        }
        return;
      }
    });

    return cleanup;
  }, []); // intentionally empty — listener is stable

  // Abort signal support
  useEffect(() => {
    if (!signal) return;
    const handleAbort = () => {
      readyRoutesRef.current.clear();
      setIsReady(false);
    };
    signal.addEventListener('abort', handleAbort);
    return () => signal.removeEventListener('abort', handleAbort);
  }, [signal]);

  /**
   * Trigger background refresh for all registered routes.
   * SW fetches fresh data and delivers via onData callback.
   */
  const triggerRefresh = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.serviceWorker.controller) return;
    if (registeredRoutesRef.current.size === 0) return;

    navigator.serviceWorker.controller.postMessage({
      type: 'REFRESH_API',
      payload: { routes: Array.from(registeredRoutesRef.current) },
    });
  }, []);

  /**
   * Register additional routes to listen for and expand SW cache coverage.
   * Safe to call multiple times.
   */
  const registerRoutes = useCallback((routes: string[]) => {
    routes.forEach((r) => registeredRoutesRef.current.add(r));

    // Tell SW to also cache these routes
    if (typeof window !== 'undefined' && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_ROUTES',
        payload: { routes },
      });
    }
  }, []);

  return {
    triggerRefresh,
    registerRoutes,
    swData,
    isReady,
    lastRoute,
  };
}

/**
 * Lightweight version — just listen for SW data for a specific route
 * and merge it into existing state. Useful for inline refreshes.
 *
 * Usage:
 *   const sw = useSWData('/api/change-requests/me');
 *   sw.data // the data from SW (if available)
 *   sw.isStale // whether SW considers it stale
 */
export function useSWData<T = unknown>(route: string) {
  const [data, setData] = useState<T | null>(null);
  const [isStale, setIsStale] = useState(true);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cleanup = listenToSwMessages((msg: SwMessage) => {
      if (msg.type === 'REFRESH_RESPONSE' || msg.type === 'GET_CACHED_RESPONSE') {
        const msgRoute = msg.payload?.route as string | undefined;
        if (!msgRoute || !msgRoute.includes(route)) return;

        const d = msg.payload?.data as T | undefined;
        const stale = msg.payload?.isStale as boolean | undefined;

        if (d !== undefined) {
          setData(d);
          setIsStale(stale ?? false);
          setHasData(true);
        }
      }
    });

    // Request cached data on mount if available
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'GET_CACHED',
        payload: { route },
      });
    }

    return cleanup;
  }, [route]);

  return { data, isStale, hasData };
}
