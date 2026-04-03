/**
 * Centralised auth-event dispatchers.
 *
 * Instead of calling `window.location.href = '/login'` directly (which bypasses
 * Astro's View Transitions / ClientRouter and causes navigation bugs), we
 * dispatch custom DOM events.  DashboardLayout listens for these and calls
 * `navigate()` from `astro:transitions/client`, keeping navigation inside the
 * soft-navigation pipeline.
 */

export function dispatchAuthExpired(): void {
  window.dispatchEvent(new CustomEvent('orbit:auth-expired'));
}

export function dispatchSignOut(): void {
  window.dispatchEvent(new CustomEvent('orbit:sign-out'));
}
