import { defineMiddleware } from 'astro:middleware';

// Routes accessible without authentication
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/forget-password',
  '/landing',
]);

// Routes that authenticated users should not access
const GUEST_ONLY_PATHS = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/forget-password',
]);

const PUBLIC_PREFIXES = ['/auth/', '/api/', '/_astro/', '/favicon', '/_image'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const accessToken = context.cookies.get('accessToken')?.value;
  const refreshToken = context.cookies.get('refreshToken')?.value;

  // Static/public prefixes should always pass through
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return next();
  }

  // Guest-only pages: if valid auth cookie exists, redirect away
  if (GUEST_ONLY_PATHS.has(pathname)) {
    if (accessToken || refreshToken) {
      return context.redirect('/home');
    }
    return next();
  }

  // Other public pages still accessible for everyone
  if (PUBLIC_PATHS.has(pathname)) {
    return next();
  }

  // No tokens at all → redirect to login
  if (!accessToken && !refreshToken) {
    return context.redirect('/login');
  }

  // Access token present → pass through (API layer handles expiry / 401)
  if (accessToken) {
    return next();
  }

  // Only refreshToken present:
  // do NOT refresh on server middleware anymore.
  // Let client API layer perform refresh flow when first protected request gets 401.
  if (refreshToken) {
    return next();
  }

  return context.redirect('/login');
});
