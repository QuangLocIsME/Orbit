import { apiUrl } from "../config/api.js";

/**
 * GET /api/projects/priority
 * @returns {Promise<Array<{ id: number, name: string, description: string, status: string, progress: number }>>}
 */
export async function getPriorityProjects() {
  try {
    const res = await fetch(apiUrl("/projects/priority"));
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
