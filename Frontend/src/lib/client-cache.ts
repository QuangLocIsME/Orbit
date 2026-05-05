const LOCAL_STORAGE_PREFIXES = ['orbit:', 'orbit-open-projects'];
const SESSION_STORAGE_PREFIXES = ['orbit:'];
const SESSION_STORAGE_KEYS = ['projectActiveTab', 'orbit_guest_access'];

function removeMatchingStorageKeys(storage: Storage, prefixes: string[], exactKeys: string[] = []) {
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    if (exactKeys.includes(key) || prefixes.some((prefix) => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => storage.removeItem(key));
}

export async function clearClientAuthState() {
  if (typeof window === 'undefined') return;

  try {
    removeMatchingStorageKeys(localStorage, LOCAL_STORAGE_PREFIXES, ['orbit_user']);
  } catch {
    // ignore unavailable storage
  }

  try {
    removeMatchingStorageKeys(sessionStorage, SESSION_STORAGE_PREFIXES, SESSION_STORAGE_KEYS);
  } catch {
    // ignore unavailable storage
  }

  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_ALL' });
  } catch {
    // ignore service worker messaging failures
  }

  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith('orbit-')).map((key) => caches.delete(key)));
    } catch {
      // ignore cache API failures
    }
  }
}
