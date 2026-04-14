import { a7 as defineMiddleware, ag as sequence } from './chunks/sequence_COHdm9JL.mjs';
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
const onRequest$1 = defineMiddleware(async (context, nextHandler) => {
  const { pathname } = context.url;
  const accessToken = context.cookies.get("accessToken")?.value;
  const refreshToken = context.cookies.get("refreshToken")?.value;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return nextHandler();
  }
  if (GUEST_ONLY_PATHS.has(pathname)) {
    if (accessToken) {
      return context.redirect("/home");
    }
    return nextHandler();
  }
  if (PUBLIC_PATHS.has(pathname)) {
    return nextHandler();
  }
  if (!accessToken && !refreshToken) {
    return context.redirect("/login");
  }
  if (accessToken) {
    return nextHandler();
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
      context.cookies.delete("accessToken", { path: "/" });
      context.cookies.delete("refreshToken", { path: "/" });
      return context.redirect("/login");
    }
    const isGuestOnlyPage = GUEST_ONLY_PATHS.has(pathname);
    const response = isGuestOnlyPage ? context.redirect("/home") : await nextHandler();
    const setCookie = refreshRes.headers.get("set-cookie");
    if (setCookie) {
      for (const cookie of setCookie.split(/,(?=\s*\w+=)/)) {
        response.headers.append("set-cookie", cookie.trim());
      }
    }
    return response;
  } catch {
    context.cookies.delete("accessToken", { path: "/" });
    context.cookies.delete("refreshToken", { path: "/" });
    return context.redirect("/login");
  }
});

const onRequest = sequence(
	
	onRequest$1
	
);

export { onRequest };
