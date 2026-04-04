import { d as defineMiddleware, s as sequence } from './prerender_BEYUTXqu.mjs';
import 'piccolore';
import 'clsx';

const PUBLIC_PATHS = /* @__PURE__ */ new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/forget-password",
  "/landing"
]);
const GUEST_ONLY_PATHS = /* @__PURE__ */ new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/forget-password"
]);
const PUBLIC_PREFIXES = ["/auth/", "/api/", "/_astro/", "/favicon", "/_image"];
const onRequest$1 = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const accessToken = context.cookies.get("accessToken")?.value;
  const refreshToken = context.cookies.get("refreshToken")?.value;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return next();
  }
  if (GUEST_ONLY_PATHS.has(pathname)) {
    if (accessToken || refreshToken) {
      return context.redirect("/home");
    }
    return next();
  }
  if (PUBLIC_PATHS.has(pathname)) {
    return next();
  }
  if (!accessToken && !refreshToken) {
    return context.redirect("/login");
  }
  if (accessToken) {
    return next();
  }
  const backendUrl = "http://localhost:3000";
  try {
    const refreshRes = await fetch(`${backendUrl}/api/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshToken}`
      }
    });
    if (!refreshRes.ok) {
      return context.redirect("/login");
    }
    const isGuestOnlyPage = GUEST_ONLY_PATHS.has(pathname);
    const response = isGuestOnlyPage ? context.redirect("/home") : await next();
    const setCookie = refreshRes.headers.get("set-cookie");
    if (setCookie) {
      for (const cookie of setCookie.split(/,(?=\s*\w+=)/)) {
        response.headers.append("set-cookie", cookie.trim());
      }
    }
    return response;
  } catch {
    return context.redirect("/login");
  }
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
