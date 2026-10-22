import { Easing, interpolate } from "remotion";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** 0→1 over [start, end] frames, clamped, with optional easing. */
export const ramp = (
  frame: number,
  start: number,
  end: number,
  easing: (t: number) => number = (t) => t,
) =>
  interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);
export const easeIn = Easing.in(Easing.cubic);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic hash → [0,1). */
export const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
};

/** Deterministic PRNG (mulberry32). */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** HUD-style flicker-in: returns 0/1 toggling briefly after `start`. */
export const flickerIn = (frame: number, start: number, seed = 0) => {
  const t = frame - start;
  if (t < 0) return 0;
  if (t > 6) return 1;
  return hash(Math.floor(t) * 13.7 + seed) > 0.4 ? 1 : 0.15;
};

/** Typed-on substring for terminal style text. */
export const typed = (text: string, frame: number, start: number, cps = 40) => {
  const n = Math.floor(((frame - start) / 30) * cps);
  if (n <= 0) return "";
  return text.slice(0, n);
};
