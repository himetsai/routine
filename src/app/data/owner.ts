import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function readOwner(): boolean {
  return typeof document !== "undefined" && /(?:^|;\s*)routine_owner=1(?:;|$)/.test(document.cookie);
}

/** Re-check the cookie after login/logout. */
export function refreshOwner() {
  for (const l of listeners) l();
}

/**
 * Whether this browser holds the owner session, per the non-httpOnly flag
 * cookie. Purely for choosing what UI to render; the server enforces access.
 */
export function useOwner(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readOwner,
    () => false,
  );
}
