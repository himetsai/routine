import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; onClick: () => void };
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** `ms = 0` keeps the toast until dismissed. */
export function toast(message: string, tone: Toast["tone"] = "info", opts: { ms?: number; action?: Toast["action"] } = {}) {
  const id = ++seq;
  toasts = [...toasts, { id, message, tone, action: opts.action }];
  emit();
  const ms = opts.ms ?? 3500;
  if (ms > 0) setTimeout(() => dismiss(id), ms);
  return id;
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
}
