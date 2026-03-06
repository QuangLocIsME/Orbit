/**
 * Server-side fetch - dùng trong Astro frontmatter.
 * Cần full URL vì chạy trên server.
 */
export async function fetchSidebarData(origin) {
  try {
    const url = new URL("/api/user/sidebar", origin).href;
    const res = await fetch(url);
    if (!res.ok) return getEmptySidebarData();
    return res.json();
  } catch {
    return getEmptySidebarData();
  }
}

function getEmptySidebarData() {
  return {
    user: { name: "" },
    favorites: [],
    shared: [],
    privateProjects: [],
  };
}
