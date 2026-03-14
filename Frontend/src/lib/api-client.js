import { apiUrl } from "../config/api";
import { refreshToken } from "/src/modules/auth/service/auth-service.js";

export async function apiFetch(path, options = {}) {

  const url =
    typeof window === "undefined"
      ? new URL(apiUrl(path), "http://localhost:4321").href
      : apiUrl(path);

  let res = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (res.status === 401) {
    try {
      await refreshToken();

      res = await fetch(url, {
        ...options,
        credentials: "include",
      });

    } catch (err) {
      console.error("Refresh token failed");

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }

  return res;
}