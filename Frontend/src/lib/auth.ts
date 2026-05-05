// Auth utility functions for ORBIT

import { dispatchAuthExpired, dispatchSignOut } from './auth-helpers';
import { clearClientAuthState } from './client-cache';

export interface User {
  id: string;
  publicId: string;
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
    publicId: typeof candidate.publicId === 'string' ? candidate.publicId : '',
    fullName: candidate.fullName,
    email: candidate.email,
    avatar: typeof candidate.avatar === 'string' || candidate.avatar === null
      ? (candidate.avatar as string | null)
      : null,
  };
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('orbit_user');
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem('orbit_user');
  if (!userStr) return null;
  try {
    const parsed = JSON.parse(userStr);
    const sanitized = sanitizeStoredUser(parsed);
    if (!sanitized) return null;
    localStorage.setItem('orbit_user', JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return null;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return true;

    await clearClientAuthState();
    dispatchAuthExpired();
    return false;
  } catch {
    await clearClientAuthState();
    dispatchAuthExpired();
    return false;
  }
}

export async function fetchWithAuth(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: 'include' };
  const res = await fetch(url, opts);

  if (res.status !== 401) return res;

  const refreshed = await refreshAccessToken();
  if (!refreshed) return res;

  return fetch(url, opts);
}

export async function syncCurrentUser(): Promise<User | null> {
  try {
    const res = await fetchWithAuth('/api/auth/me');
    if (!res.ok) return null;
    const { data } = await res.json();
    if (!data) return null;

    const sanitized = sanitizeStoredUser(data);
    if (!sanitized) return null;
    localStorage.setItem('orbit_user', JSON.stringify(sanitized));
    return sanitized;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore network errors
  }

  await clearClientAuthState();
  dispatchSignOut();
}

export function requireAuth(): void {
  if (typeof window === 'undefined') return;
  if (!isAuthenticated()) {
    window.location.href = '/login';
  }
}

export function redirectIfAuthenticated(): void {
  if (typeof window === 'undefined') return;
  if (isAuthenticated()) {
    window.location.href = '/home';
  }
}
