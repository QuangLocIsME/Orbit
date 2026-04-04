/**
 * API base URL - dùng khi kết nối backend.
 * Set PUBLIC_API_URL trong .env (phải kết thúc bằng `/api`, vd: http://localhost:3000/api).
 * Nếu chỉ ghi `http://localhost:3000`, các route Navisworks sẽ 404 vì Express mount tại `/api`.
 */
function normalizeApiBase(raw) {
  const fallback = "/api";
  if (raw == null || String(raw).trim() === "") return fallback;
  const trimmed = String(raw).trim().replace(/\/$/, "");
  if (trimmed === "/api" || trimmed.endsWith("/api")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return `${trimmed}/api`;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_API_URL
    ? normalizeApiBase(import.meta.env.PUBLIC_API_URL)
    : "/api";

export function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
