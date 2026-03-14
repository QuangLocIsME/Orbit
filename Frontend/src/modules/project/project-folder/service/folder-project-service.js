import { apiFetch } from "@/lib/api-client";

/**
 * GET /api/folders/:id/projects
 */
export async function getFolderProjects(folderId) {
  try {
    const res = await apiFetch(`/project-folder/folders/${folderId}/projects`);

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