import { apiFetch } from "@/lib/api-client";

export async function getUpcomingEvents() {
  try {
    const res = await apiFetch("/dashboard/upcoming");
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
