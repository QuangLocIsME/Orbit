import { apiFetch } from "@/lib/api-client";

/**
 * GET /api/user/sidebar
 * @returns {Promise<{ user: { name: string }, favorites: Array<{ id: number, name: string }>, shared: Array<{ id: number, name: string }>, privateProjects: Array<{ id: number, name: string }> }>}
 */
export async function getUserSidebarData() {
  try {
    const res = await apiFetch("/user/sidebar");
    if (!res.ok) return getDefaultSidebarData();
    return res.json();
  } catch {
    return getDefaultSidebarData();
  }
}

function getDefaultSidebarData() {
  return {
    user: { name: "" },
    favorites: [],               
    shared: [],
    privateProjects: [],
  };
}
