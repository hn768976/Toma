/**
 * Procedural noise.
 *
 * Everything here is a pure function of its arguments — no photographic source
 * imagery is used anywhere in this project, and no state is kept between frames.
 *
 * Looping is achieved by keeping the *noise field itself* static and moving the
 * sampling window around a circle in the domain (see `orbit`). A circular path
 * returns exactly to its start, so any animation driven this way is periodic
 * over the composition's duration with no cross-fade seam.
 */
import { hash2 } from './rng';

const fade = (t: number) => t * t * (3 - 2 * t);

/** Value noise on a unit-spaced lattice, smoothstep-interpolated. */
export const noise2 = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = fade(x - xi);
  const yf = fade(y - yi);

  const n00 = hash2(xi, yi, seed);
  const n10 = hash2(xi + 1, yi, seed);
  const n01 = hash2(xi, yi + 1, seed);
  const n11 = hash2(xi + 1, yi + 1, seed);

  const a = n00 + (n10 - n00) * xf;
  const b = n01 + (n11 - n01) * xf;
  return a + (b - a) * yf;
};

/** Fractal Brownian motion — layered octaves of value noise, normalised to [0,1]. */
export const fbm = (x: number, y: number, seed: number, octaves = 4, lacunarity = 2, gain = 0.5) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(fx, fy, seed + i * 1013);
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
    fy *= lacunarity;
  }
  return sum / norm;
};

/**
 * Ridged noise — folds the field about its midpoint so the bright parts become
 * thin creases. This is what gives the nebulae their filament structure rather
 * than an even fog.
 */
export const ridge = (x: number, y: number, seed: number, octaves = 4) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2(fx, fy, seed + i * 7919) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    fx *= 2.1;
    fy *= 2.1;
  }
  return sum / norm;
};

/**
 * A point travelling once around a circle of the given radius as `t` goes from
 * 0 to 1. Offsetting a noise lookup by this makes the resulting animation
 * exactly periodic.
 */
export const orbit = (t: number, radius: number, phase = 0) => {
  const a = Math.PI * 2 * (t + phase);
  return { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
};
