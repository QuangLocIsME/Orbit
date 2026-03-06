import { apiUrl } from "../config/api.js";

/**
 * GET /api/folders/:id/projects
 * @returns {Promise<Array>}
 */
export async function getFolderProjects(folderId) {
  try {
    const res = await fetch(apiUrl(`/folders/${folderId}/projects`));
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
