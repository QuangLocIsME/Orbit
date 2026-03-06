import { apiUrl } from "../config/api.js";

/**
 * POST /api/auth/login
 * @returns {Promise<{ token: string, user: { username: string } }>}
 */
export async function login(username, password) {
  const res = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
}

/**
 * POST /api/auth/register
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function register(data) {
  const res = await fetch(apiUrl("/auth/register"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Register failed");
  return res.json();
}
