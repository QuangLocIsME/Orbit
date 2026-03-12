import { apiUrl } from "../config/api.js";

/**
 * GET /api/folders/:id/projects
 */
export async function getFolderProjects(folderId) {
  try {
    const res = await fetch(apiUrl(`/folders/${folderId}/projects`));

    if (!res.ok) {
      throw new Error(`Failed to fetch projects of folder ${folderId}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error(err);
    return [];
  }
}