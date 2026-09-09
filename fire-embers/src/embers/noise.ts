/**
 * A turbulence field that is exactly periodic in time.
 *
 * The trick is to walk a *circle* through two extra noise dimensions rather
 * than a line: sampling at (cos t, sin t) returns to its starting value after
 * one revolution, so a field built on 4D noise repeats perfectly over the
 * composition's frame count with no cross-fade seam.
 *
 * Displacement is taken as the curl of a scalar potential, which makes the
 * field divergence-free — embers curl and weave around each other instead of
 * piling into sinks, which is what real convection looks like.
 */

import { hash1 } from "./random";

/** Quintic fade — C2 continuous, so the curl (a first derivative) stays smooth. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const HASH_X = 374761393;
const HASH_Y = 668265263;
const HASH_Z = 2147483647;
const HASH_W = 1103515245;

const cornerValue = (
  x: number,
  y: number,
  z: number,
  w: number,
  seed: number,
): number =>
  hash1(
    (Math.imul(x, HASH_X) ^
      Math.imul(y, HASH_Y) ^
      Math.imul(z, HASH_Z) ^
      Math.imul(w, HASH_W) ^
      seed) |
      0,
  );

/** 4D value noise in [-1, 1]. */
export const noise4 = (
  x: number,
  y: number,
  z: number,
  w: number,
  seed: number,
): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const wi = Math.floor(w);
  const fx = fade(x - xi);
  const fy = fade(y - yi);
  const fz = fade(z - zi);
  const fw = fade(w - wi);

  let acc = 0;
  for (let dw = 0; dw < 2; dw++) {
    const ww = dw === 0 ? 1 - fw : fw;
    for (let dz = 0; dz < 2; dz++) {
      const wz = ww * (dz === 0 ? 1 - fz : fz);
      const y0 = lerp(
        lerp(
          cornerValue(xi, yi, zi + dz, wi + dw, seed),
          cornerValue(xi + 1, yi, zi + dz, wi + dw, seed),
          fx,
        ),
        lerp(
          cornerValue(xi, yi + 1, zi + dz, wi + dw, seed),
          cornerValue(xi + 1, yi + 1, zi + dz, wi + dw, seed),
          fx,
        ),
        fy,
      );
      acc += wz * y0;
    }
  }
  return acc * 2 - 1;
};

/** Radius of the circle traced through the two time dimensions. */
const TIME_RADIUS = 2.2;

/**
 * Two octaves of potential, sampled on the time circle. `phase` is the
 * position around the loop in turns (0 → 1 covers exactly one video cycle).
 */
const potential = (x: number, y: number, phase: number, seed: number): number => {
  const theta = phase * Math.PI * 2;
  const cz = Math.cos(theta) * TIME_RADIUS;
  const sw = Math.sin(theta) * TIME_RADIUS;
  return (
    noise4(x, y, cz, sw, seed) +
    0.45 * noise4(x * 2.7, y * 2.7, cz * 2.7, sw * 2.7, seed ^ 0x51ed) +
    0.2 * noise4(x * 6.1, y * 6.1, cz * 6.1, sw * 6.1, seed ^ 0x2f9b)
  );
};

const EPS = 0.035;

export type Curl = { x: number; y: number };

/**
 * Curl of the potential at (x, y) — a divergence-free 2D displacement,
 * periodic in `phase` with period 1.
 */
export const curlNoise = (
  x: number,
  y: number,
  phase: number,
  seed: number,
): Curl => {
  const dPsiDy =
    (potential(x, y + EPS, phase, seed) - potential(x, y - EPS, phase, seed)) /
    (2 * EPS);
  const dPsiDx =
    (potential(x + EPS, y, phase, seed) - potential(x - EPS, y, phase, seed)) /
    (2 * EPS);
  return { x: dPsiDy, y: -dPsiDx };
};
