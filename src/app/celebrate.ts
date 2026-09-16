import confetti from "canvas-confetti";
import { haptic } from "./haptics";

const COLORS = ["#ff7777", "#ffb6c1", "#dda0dd", "#ffffff", "#ffccd5"];
let heart: confetti.Shape | null = null;

function reducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hearts(count: number, spread: number, origin: { x: number; y: number }, scalar = 2) {
  if (reducedMotion()) return;
  heart ??= confetti.shapeFromText({ text: "♥", scalar: 2, color: "#ff7777" });
  void confetti({
    particleCount: count,
    spread,
    origin,
    shapes: [heart],
    scalar,
    colors: COLORS,
    startVelocity: 38,
    gravity: 0.9,
    ticks: 220,
    disableForReducedMotion: true,
  });
}

/** A streak milestone: one full burst from the bottom. */
export function celebrateMilestone() {
  haptic("milestone");
  hearts(70, 80, { x: 0.5, y: 0.8 });
}

/** Every routine met for the week: two side cannons, then a shower. */
export function celebratePerfectWeek() {
  haptic("milestone");
  hearts(60, 55, { x: 0.1, y: 0.9 }, 2.4);
  hearts(60, 55, { x: 0.9, y: 0.9 }, 2.4);
  setTimeout(() => hearts(90, 120, { x: 0.5, y: 0.6 }), 350);
}

/** Perfect day: a small pop; the header already turns coral. */
export function celebratePerfectDay() {
  haptic("success");
  hearts(18, 60, { x: 0.5, y: 0.35 }, 1.6);
}
