/**
 * API base URL - dùng khi kết nối backend.
 * Set PUBLIC_API_URL trong .env để override (vd: https://api.example.com)
 */
export const API_BASE =
  (typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_API_URL) ||
  "/api";

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
