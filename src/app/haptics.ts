/**
 * Haptic feedback across platforms.
 *
 * - Android/Chrome: `navigator.vibrate` patterns.
 * - iOS Safari: no vibration API. The only remaining route (iOS ≥ 26.5) is a
 *   real `<input type="checkbox" switch>` that the user's finger actually
 *   taps, so CheckButton overlays one transparently. Nothing can be fired
 *   from script here; on iOS these calls are no-ops.
 * - A Capacitor shell could later map these kinds to UIImpactFeedbackGenerator.
 */
import { getPrefs } from "./data/prefs";

export type HapticKind = "check" | "uncheck" | "success" | "milestone" | "error";

const PATTERNS: Record<HapticKind, number | number[]> = {
  check: 12,
  uncheck: 6,
  success: [15, 60, 25],
  milestone: [20, 50, 20, 50, 40],
  error: [40, 40, 40],
};

export const supportsVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function haptic(kind: HapticKind) {
  if (!supportsVibrate || !getPrefs().vibrate) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some browsers throw without a prior user gesture; feedback is best-effort.
  }
}
