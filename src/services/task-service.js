import { apiUrl } from "../config/api.js";

export async function getUserTasks() {
  try {
    const res = await fetch(apiUrl("/tasks"));
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
