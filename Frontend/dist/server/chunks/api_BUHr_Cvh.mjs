const __vite_import_meta_env__ = {"ASSETS_PREFIX": undefined, "BASE_URL": "/", "DEV": false, "MODE": "production", "PROD": true, "SITE": undefined, "SSR": true};
const API_BASE = typeof import.meta !== "undefined" && Object.assign(__vite_import_meta_env__, { PUBLIC: "C:\\Users\\Public" })?.PUBLIC_API_URL || "/api";
function apiUrl(path) {
  const base = API_BASE.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export { apiUrl as a };
