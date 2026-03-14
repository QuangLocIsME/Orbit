// import { apiUrl } from "../../../../config/api.js";

// /**
//  * GET /api/projects/priority
//  * @returns {Promise<Array<{ id: number, name: string, description: string, status: string, progress: number }>>}
//  */
// export async function getPriorityProjects() {
//   try {
//     const res = await fetch(apiUrl("/project-folder/priority"));
//     if (!res.ok) return [];
//     return res.json();
//   } catch {
//     return [];
//   }
// }

import { apiFetch } from "@/lib/api-client";

/**
 * GET /api/projects/priority
 */
export async function getPriorityProjects() {
  try {
    const res = await apiFetch("/project-folder/priority");

    if (!res.ok) return [];

    return res.json();
  } catch {
    return [];
  }
}