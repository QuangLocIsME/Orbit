// Auth utility functions for ORBIT

export interface User {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('orbit_auth_token');
  return !!token;
}

// Get current user
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

// Sign out
export function signOut(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('orbit_user');
  localStorage.removeItem('orbit_auth_token');
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
    window.location.href = '/';
  }
}
