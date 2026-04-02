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

  // Only refreshToken present → try server-side token refresh
  const backendUrl = import.meta.env.BACKEND_URL ?? 'http://localhost:3000';
  try {
    const refreshRes = await fetch(`${backendUrl}/api/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `refreshToken=${refreshToken}`,
      },
    });

    if (!refreshRes.ok) {
      return context.redirect('/login');
    }

    const isGuestOnlyPage = GUEST_ONLY_PATHS.has(pathname);
    const response = isGuestOnlyPage ? context.redirect('/home') : await next();

    // Forward the new Set-Cookie headers so the browser gets the new tokens
    const setCookie = refreshRes.headers.get('set-cookie');
    if (setCookie) {
      // set-cookie may have multiple values joined; split on ", " only between directives
      for (const cookie of setCookie.split(/,(?=\s*\w+=)/)) {
        response.headers.append('set-cookie', cookie.trim());
      }
    }
    return response;
  } catch {
    // Network error reaching the backend → redirect to login
    return context.redirect('/login');
  }
});
