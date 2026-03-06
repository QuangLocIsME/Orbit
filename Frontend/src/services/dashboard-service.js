import { apiUrl } from "../config/api.js";

export async function getRecentProjects() {
  try {
    const res = await fetch(apiUrl("/dashboard/projects/recent"));
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
