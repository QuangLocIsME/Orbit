import { apiUrl } from "../config/api.js";

export async function getUpcomingEvents() {
  try {
    const res = await fetch(apiUrl("/events/upcoming"));
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
