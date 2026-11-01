import { clamp } from "../lib/random";

export type Key = [number, number];
/** Piecewise-linear interpolation with smoothstep easing between keys. */
export const track = (keys: Key[], f: number) => {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, v0] = keys[i];
    const [f1, v1] = keys[i + 1];
    if (f <= f1) {
      const t = clamp((f - f0) / (f1 - f0));
      const e = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * e;
    }
  }
  return keys[keys.length - 1][1];
};

export type Vec3Key = [number, number, number, number]; // frame, x, y, z
export const track3 = (keys: Vec3Key[], f: number): [number, number, number] => [
  track(keys.map((k) => [k[0], k[1]]), f),
  track(keys.map((k) => [k[0], k[2]]), f),
  track(keys.map((k) => [k[0], k[3]]), f),
];

/**
 * Light envelopes derived from the reference's per-frame luminance:
 * wave 1 builds from ~0.3 s, peaks ~2.8–3.3 s and cuts out by 3.6 s;
 * wave 2 rises from the bottom ~5.3 s, peaks ~6.0 s and decays to 7.6 s.
 */
export const WAVE1_ENERGY: Key[] = [
  [0, 0],
  [6, 0.25],
  [20, 0.55],
  [36, 0.85],
  [48, 0.72],
  [60, 0.82],
  [72, 0.95],
  [86, 1.05],
  [97, 1.0],
  [102, 0.62],
  [106, 0.15],
  [112, 0.0],
];
export const WAVE2_ENERGY: Key[] = [
  [130, 0],
  [150, 0.18],
  [163, 0.45],
  [174, 0.9],
  [181, 0.95],
  [190, 0.7],
  [200, 0.42],
  [212, 0.22],
  [224, 0.06],
  [236, 0.07],
  [246, 0.0],
];

// Swarm centre paths (camera looks down -z from the origin).
export const WAVE1_PATH: Vec3Key[] = [
  [0, -5.2, 3.6, -9.3],
  [24, -4.2, 1.4, -7.9],
  [50, -2.7, 0.2, -6.9],
  [80, -1.0, -0.4, -6.3],
  [100, 0.1, -0.1, -6.0],
  [125, 2.6, 1.0, -5.5],
  [165, 7.0, 2.4, -5.1],
];
export const WAVE2_PATH: Vec3Key[] = [
  [0, 0.6, -9.5, -8.3],
  [118, 0.6, -7.8, -8.3],
  [160, -0.6, -2.8, -7.1],
  [182, -0.9, -1.7, -6.5],
  [215, 0.2, -1.3, -6.1],
  [249, 1.6, -0.8, -5.7],
];
