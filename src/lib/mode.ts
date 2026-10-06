export type AppMode = "demo" | "owner";

const KEY = "alfred:mode";
const DEVICE_KEY = "alfred:owner-device";

export function readStoredMode(): AppMode {
  try {
    return localStorage.getItem(KEY) === "owner" ? "owner" : "demo";
  } catch {
    return "demo";
  }
}

export function storeMode(mode: AppMode) {
  try {
    if (mode === "owner") {
      localStorage.setItem(KEY, "owner");
      // Remember this device so the owner can hop back from the demo without re-unlocking.
      localStorage.setItem(DEVICE_KEY, "1");
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    /* storage unavailable: mode lasts for this page only */
  }
}

export function isOwnerDevice(): boolean {
  try {
    return localStorage.getItem(DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

export const DB_NAME: Record<AppMode, string> = {
  demo: "alfred-demo",
  owner: "alfred-owner",
};
