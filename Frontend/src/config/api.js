/**
 * API base URL - dùng khi kết nối backend.
 * Set PUBLIC_API_URL trong .env để override (vd: https://api.example.com)
 */
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_API_URL) ||
  "/api";

export const API_CONFIG_VERSION = "cloudflare-same-origin-20260505-2";

if (typeof globalThis !== "undefined") {
  globalThis.__ORBIT_API_CONFIG_VERSION__ = API_CONFIG_VERSION;
}

export function apiUrl(path) {
  void API_CONFIG_VERSION;
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
