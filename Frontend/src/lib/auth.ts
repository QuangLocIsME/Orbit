// Auth utility functions for ORBIT

export interface User {
  id: string;
  fullName: string;
  email: string;
  role?: string;
  avatar?: string | null;
  createdAt: string;
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
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

// Attempt to refresh the access token using the httpOnly refreshToken cookie.
// Returns true on success, false on failure. On failure, signs the user out.
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return true;
    // Refresh failed — clear local state and redirect
    await signOut();
    return false;
  } catch {
    await signOut();
    return false;
  }
}

// fetch wrapper that automatically retries once after a 401 by refreshing tokens.
// All protected API calls should use this instead of raw fetch.
export async function fetchWithAuth(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: 'include' };
  const res = await fetch(url, opts);

  if (res.status !== 401) return res;

  // Access token expired — try to refresh
  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    // refreshAccessToken already called signOut()
    return res;
  }

  // Retry original request with new tokens
  return fetch(url, opts);
}

// Refresh user info from backend /api/auth/me and update localStorage
export async function syncCurrentUser(): Promise<User | null> {
  try {
    const res = await fetchWithAuth('/api/auth/me');
    if (!res.ok) return null;
    const { data } = await res.json();
    if (data) {
      localStorage.setItem('orbit_user', JSON.stringify(data));
      return data as User;
    }
    return null;
  } catch {
    return null;
  }
}

// Sign out — call backend to clear httpOnly cookies, then clear local state
export async function signOut(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore network errors
  }
  localStorage.removeItem('orbit_user');
  window.location.href = '/login';
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
