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

// rare, subtle single-frame dips that make the interface feel "live"
// (kept shallow so they never read as flicker)
export const glitch = (frame: number, seed: number, p = 0.015) =>
  hash(seed, frame) < p * 0.5 ? 0.75 : 1;

// slow drift + periodic relocation for floating annotations: each element
// lives in ~6 s slots, fades out/in at slot boundaries and reappears offset.
export const roam = (t: number, seed: number, period = 6) => {
  const ph = (hash(seed, 99) * period) % period;
  const slot = Math.floor((t + ph) / period);
  const local = (t + ph) / period - slot; // 0..1 within the slot
  const dx = (hash(seed, slot, 1) - 0.5) * 220 + Math.sin(t * 0.25 + seed) * 18;
  const dy = (hash(seed, slot, 2) - 0.5) * 120 + local * 14;
  const edge = Math.min(local, 1 - local) * period; // seconds to nearest boundary
  const o = Math.min(1, edge / 0.35);
  return { dx: slot === Math.floor(ph / period) ? Math.sin(t * 0.25 + seed) * 18 : dx, dy: slot === Math.floor(ph / period) ? local * 14 : dy, o, slot };
};

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
