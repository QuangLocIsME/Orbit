import { apiFetch } from "@/lib/api-client";

export async function getRecentProjects() {
  try {
    const res = await apiFetch("/dashboard/recent");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
