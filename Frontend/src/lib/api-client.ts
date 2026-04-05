/**
 * ORBIT API Client — fetch wrapper with automatic JWT refresh on 401.
 * Uses httpOnly cookies for auth tokens.
 */

import { dispatchAuthExpired } from './auth-helpers';

let isRefreshing = false;
let waitQueue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

function drainQueue(error: Error | null) {
  waitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  waitQueue = [];
}

async function attemptRefresh(): Promise<void> {
  const res = await fetch('/api/auth/refresh-token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('Refresh failed');
}

/**
 * Drop-in replacement for fetch() with auto-refresh on 401.
 *
 * Usage:
 *   const res = await apiFetch('/api/auth/me');
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: 'include' };

  let response = await fetch(input, opts);

  if (response.status !== 401) return response;

  // Already on the login page — don't trigger refresh → infinite redirect loop
  if (typeof window !== 'undefined' && window.location.pathname === '/login') return response;

  // ── 401 received — try to refresh the access token ──────────────────────
  if (isRefreshing) {
    // Another request is already refreshing — wait for it to finish, then retry
    await new Promise<void>((resolve, reject) => {
      waitQueue.push({ resolve, reject });
    });
    return fetch(input, opts);
  }

  isRefreshing = true;
  try {
    await attemptRefresh();
    drainQueue(null);
    response = await fetch(input, opts); // retry original request
  } catch (err) {
    drainQueue(err as Error);
    // Refresh failed — user must log in again.
    // Dispatch an event instead of window.location.href so Astro's ClientRouter
    // handles the redirect and the View Transitions pipeline stays intact.
    localStorage.removeItem('orbit_user');
    dispatchAuthExpired();
  } finally {
    isRefreshing = false;
  }

  return response;
}
