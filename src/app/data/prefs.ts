import { useSyncExternalStore } from "react";

/** Device-local preferences (not synced; they describe this phone, not you). */
export interface Prefs {
  vibrate: boolean;
}

const KEY = "routine:prefs";
const DEFAULTS: Prefs = { vibrate: true };
const listeners = new Set<() => void>();
let cache: Prefs | null = null;

function read(): Prefs {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") } as Prefs;
  } catch {
    cache = DEFAULTS;
  }
  return cache ?? DEFAULTS;
}

export function getPrefs(): Prefs {
  return typeof localStorage === "undefined" ? DEFAULTS : read();
}

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...read(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(cache));
  for (const l of listeners) l();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getPrefs,
    () => DEFAULTS,
  );
}
