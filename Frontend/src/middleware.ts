import { defineMiddleware } from 'astro:middleware';

// Routes accessible without authentication
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/landing',
]);

const PUBLIC_PREFIXES = ['/auth/', '/api/', '/_astro/', '/favicon', '/_image'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Always allow public paths and prefixes (assets, API proxy, etc.)
  if (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return next();
  }

  const accessToken = context.cookies.get('accessToken')?.value;
  const refreshToken = context.cookies.get('refreshToken')?.value;

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

    // Forward the new Set-Cookie headers so the browser gets the new tokens
    const response = await next();
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
