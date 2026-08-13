export function readSessionOrLocal(key: string): string {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function hasLocalValue(key: string): boolean {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false;
  }
}

export function saveSecret(key: string, value: string, remember: boolean): void {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
    if (value) (remember ? localStorage : sessionStorage).setItem(key, value);
  } catch {
    // Private browsing can disable storage. The value remains in memory.
  }
}

export function clearStoredValue(key: string): void {
  try {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}
