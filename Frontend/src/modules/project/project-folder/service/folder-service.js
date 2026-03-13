import { apiUrl } from "../../../../config/api.js";

/**
 * GET /api/folders
 * @returns {Promise<Array<{ id: number, name: string, projectCount: number }>>}
 */
export async function getFolders() {
  try {
    const res = await fetch(apiUrl("/project-folder/folder"));
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
