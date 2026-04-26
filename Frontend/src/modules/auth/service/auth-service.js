import { apiUrl } from "../../../config/api.js";

/**
 * POST /api/auth/login
 */
export async function login(email, password) {
  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Login failed");
  return data;
}

/**
 * POST /api/auth/register
 */
export async function register(form) {
  const res = await fetch(apiUrl("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(form),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Register failed");
  return data;
}

/**
 * POST /api/auth/refresh-token
 */
export async function refreshToken() {
  const res = await fetch(apiUrl("/auth/refresh-token"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Refresh token failed");
  return data;
}

/**
 * GET /api/auth/me — fetch current user info from backend (uses accessToken cookie)
 */
export async function getMe() {
  const res = await fetch(apiUrl("/auth/me"), {
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to get user");
  return data; // { success: true, data: { id, fullName, email, role, avatar, createdAt } }
}

/**
 * POST /api/auth/logout
 */
export async function logout() {
  await fetch(apiUrl("/auth/logout"), {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
}

/**
 * POST /api/auth/forgot-password — gui yeu cau dat lai mat khau
 */
export async function forgotPassword(email) {
  const res = await fetch(apiUrl("/auth/forgot-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to send reset email");
  return data;
}

/**
 * POST /api/auth/reset-password — dat lai mat khau bang token
 */
export async function resetPassword(token, newPassword, confirmPassword, email) {
  const res = await fetch(apiUrl("/auth/reset-password"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, newPassword, confirmPassword, email }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Failed to reset password");
  return data;
}
