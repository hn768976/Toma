import { interpolate } from "remotion";
import { hash } from "./random";

// HUD "boot" visibility: hidden before `start`, flickers for a few frames,
// then stays on. Optional `end` fades the element out over `fade` frames.
export const boot = (frame: number, start: number, end = Infinity, fade = 20) => {
  if (frame < start) return 0;
  const f = frame - start;
  let v = 1;
  if (f < 6) {
    // quick ramp-in with a single soft flicker (no on/off strobing)
    const pattern = [0.25, 0.6, 0.85, 0.55, 0.9, 1];
    v = pattern[f];
  }
  if (frame > end - fade) {
    v *= interpolate(frame, [end - fade, end], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }
  return v;
};

// occasional single-frame dropouts that make the interface feel "live"
export const glitch = (frame: number, seed: number, p = 0.015) =>
  hash(seed, frame) < p ? 0.35 : 1;

// smooth deterministic 1D value noise in [0,1]
export const vnoise = (x: number, seed: number) => {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(seed, i) * (1 - u) + hash(seed, i + 1) * u;
};

const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const code = (seed: number, len: number, step = 0) => {
  let s = "";
  for (let i = 0; i < len; i++) s += CH[Math.floor(hash(seed, i, step) * CH.length)];
  return s;
};
export const digits = (seed: number, len: number, step = 0) => {
  let s = "";
  for (let i = 0; i < len; i++) s += Math.floor(hash(seed, i, step) * 10);
  return s;
};
