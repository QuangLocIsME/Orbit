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

// Refresh user info from backend /api/auth/me and update localStorage
export async function syncCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const { data } = await res.json();
    if (data) {
      // Merge with existing to preserve any extra fields
      const existing = getCurrentUser();
      const merged = { ...existing, ...data };
      localStorage.setItem('orbit_user', JSON.stringify(merged));
      return merged as User;
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
