import { apiFetch } from "@/lib/api-client";

/**
 * GET /api/folders
 * @returns {Promise<Array<{ id: number, name: string, projectCount: number }>>}
 */
export async function getFolders() {
  try {
    const res = await apiFetch("/project-folder/folder");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
