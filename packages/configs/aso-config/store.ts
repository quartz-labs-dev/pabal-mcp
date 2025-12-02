import type { StoreType } from "./types";

export type StoreTargets = {
  /** Normalized store value (defaults to "both") */
  store: StoreType;
  includeAppStore: boolean;
  includeGooglePlay: boolean;
};

/**
 * Normalize store selection and expose booleans for per-store handling.
 */
export function getStoreTargets(store?: StoreType): StoreTargets {
  const normalizedStore: StoreType = store ?? "both";

  return {
    store: normalizedStore,
    includeAppStore:
      normalizedStore === "appStore" || normalizedStore === "both",
    includeGooglePlay:
      normalizedStore === "googlePlay" || normalizedStore === "both",
  };
}
