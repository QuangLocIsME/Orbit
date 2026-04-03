// Auth utility functions for ORBIT

import { dispatchAuthExpired, dispatchSignOut } from './auth-helpers';

// ── Shared refresh lock (prevents concurrent refresh race condition) ───────────
let isRefreshing = false;
let waitQueue: Array<{ resolve: () => void; reject: (e: Error) => void }> = [];

function drainQueue(error: Error | null) {
  waitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  waitQueue = [];
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  avatar?: string | null;
}

function sanitizeStoredUser(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.fullName !== 'string' ||
    typeof candidate.email !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    fullName: candidate.fullName,
    email: candidate.email,
    avatar: typeof candidate.avatar === 'string' || candidate.avatar === null
      ? (candidate.avatar as string | null)
      : null,
  };
}

// Check if user is authenticated (token lives in httpOnly cookie — check user data in localStorage)
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('orbit_user');
}

// Get current user synchronously from localStorage
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('orbit_user');
  if (!userStr) return null;
  try {
    const parsed = JSON.parse(userStr);
    const sanitized = sanitizeStoredUser(parsed);
    if (!sanitized) return null;
    // self-heal older payloads that still contain extra fields
    localStorage.setItem('orbit_user', JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return null;
  }
}

// Attempt to refresh the access token using the httpOnly refreshToken cookie.
// Returns true on success, false on failure. On failure, dispatches an auth-expired event.
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return true;
    // Refresh failed — clear local state and dispatch auth-expired event
    localStorage.removeItem('orbit_user');
    dispatchAuthExpired();
    return false;
  } catch {
    localStorage.removeItem('orbit_user');
    dispatchAuthExpired();
    return false;
  }
}

// fetch wrapper that automatically retries once after a 401 by refreshing tokens.
// All protected API calls should use this instead of raw fetch.
// Uses a shared refresh lock to prevent concurrent 401s from firing multiple simultaneous
// refresh requests (which would cause all but the first to get 401 on the now-revoked token).
export async function fetchWithAuth(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: 'include' };
  let response = await fetch(url, opts);

  if (response.status !== 401) return response;

  // 401 — try to refresh. If another request is already refreshing, wait for it.
  if (isRefreshing) {
    await new Promise<void>((resolve, reject) => { waitQueue.push({ resolve, reject }); });
    return fetch(url, opts);
  }

  isRefreshing = true;
  try {
    const refreshed = await refreshAccessToken();
    drainQueue(refreshed ? null : new Error('refresh failed'));
    if (!refreshed) {
      // refreshAccessToken already called signOut()
      return response;
    }
    return fetch(url, opts);
  } catch (err) {
    drainQueue(err as Error);
    return response;
  } finally {
    isRefreshing = false;
  }
}

// Refresh user info from backend /api/auth/me and update localStorage
export async function syncCurrentUser(): Promise<User | null> {
  try {
    const res = await fetchWithAuth('/api/auth/me');
    if (!res.ok) return null;
    const { data } = await res.json();
    if (data) {
      const sanitized = sanitizeStoredUser(data);
      if (!sanitized) return null;
      localStorage.setItem('orbit_user', JSON.stringify(sanitized));
      return sanitized;
    }
    return null;
  } catch {
    return null;
  }
}

// Sign out — call backend to clear httpOnly cookies, then clear local state.
// Navigation to /login is handled by DashboardLayout listening for 'orbit:sign-out'.
export async function signOut(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore network errors
  }
  localStorage.removeItem('orbit_user');
  dispatchSignOut();
}

// Redirect to login if not authenticated
export function requireAuth(): void {
  if (typeof window === 'undefined') return;
  if (!isAuthenticated()) {
    window.location.href = '/login';
  }
}

// Redirect to dashboard if already authenticated
export function redirectIfAuthenticated(): void {
  if (typeof window === 'undefined') return;
  if (isAuthenticated()) {
    window.location.href = '/home';
  }
}
