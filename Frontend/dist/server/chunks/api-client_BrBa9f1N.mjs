function dispatchAuthExpired() {
  window.dispatchEvent(new CustomEvent("orbit:auth-expired"));
}
function dispatchSignOut() {
  window.dispatchEvent(new CustomEvent("orbit:sign-out"));
}

let isRefreshing = false;
let waitQueue = [];
function drainQueue(error) {
  waitQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  waitQueue = [];
}
async function attemptRefresh() {
  const res = await fetch("/api/auth/refresh-token", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) throw new Error("Refresh failed");
}
async function apiFetch(input, init = {}) {
  const opts = { ...init, credentials: "include" };
  let response = await fetch(input, opts);
  if (response.status !== 401) return response;
  if (typeof window !== "undefined" && window.location.pathname === "/login") return response;
  if (isRefreshing) {
    await new Promise((resolve, reject) => {
      waitQueue.push({ resolve, reject });
    });
    return fetch(input, opts);
  }
  isRefreshing = true;
  try {
    await attemptRefresh();
    drainQueue(null);
    response = await fetch(input, opts);
  } catch (err) {
    drainQueue(err);
    localStorage.removeItem("orbit_user");
    dispatchAuthExpired();
  } finally {
    isRefreshing = false;
  }
  return response;
}

export { apiFetch as a, dispatchAuthExpired as b, dispatchSignOut as d };
