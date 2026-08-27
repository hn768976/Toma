import {random} from 'remotion';

/** Seeded float in [0,1). Never Math.random(). */
export const rnd = (seed: string): number => random(seed);

export const rndRange = (seed: string, lo: number, hi: number): number =>
  lo + random(seed) * (hi - lo);

export const rndInt = (seed: string, lo: number, hi: number): number =>
  Math.floor(lo + random(seed) * (hi - lo + 1 - 1e-9));

export const pick = <T,>(seed: string, arr: readonly T[]): T =>
  arr[Math.min(arr.length - 1, Math.floor(random(seed) * arr.length))];

/**
 * A value that re-rolls on a fixed cadence, derived purely from frame % 600.
 * `perSec` re-rolls per second at 30fps; 3-5 gives the flickering panel look.
 */
const DIVISORS = [4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30];

/** Nearest exact divisor of 600, so every re-roll cadence closes the loop. */
export const snapPeriod = (p: number): number =>
  DIVISORS.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));

export const rollValue = (
  seed: string,
  f: number,
  perSec: number,
  lo: number,
  hi: number,
): number => {
  const period = snapPeriod(30 / perSec);
  const bucket = Math.floor(f / period);
  return rndRange(`${seed}:${bucket}`, lo, hi);
};

/** 1 just after a re-roll, decaying to 0 - used to flick a value bright. */
export const rollFlick = (f: number, perSec: number, seed: string): number => {
  const period = snapPeriod(30 / perSec);
  const phase = f % period;
  return Math.max(0, 1 - phase / 4) * (rnd(`${seed}:fk`) * 0.5 + 0.5);
};

/** Stable digit soup used as texture rather than data. */
export const digits = (seed: string, n: number): string => {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(random(`${seed}#${i}`) * 10);
  return s;
};

export const hexish = (seed: string, n: number): string => {
  const gl = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < n; i++)
    s += gl[Math.floor(random(`${seed}~${i}`) * 16)];
  return s;
};

export const pad = (v: number, w: number, dp = 0): string => {
  const s = v.toFixed(dp);
  return s.length >= w ? s : '0'.repeat(w - s.length) + s;
};

/** Smooth 0->1 ease-out used for reveals and assembly. */
export const easeOut = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
};

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

/** Reveal ramp for the frames 0-25 draw-on, with a per-element stagger. */
export const reveal = (f: number, delay: number, dur: number): number =>
  easeOut((f - delay) / dur);
