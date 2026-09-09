import {
  BAND_ANGLE_DEG,
  BAND_BRIGHTNESS,
  BAND_FLOOR,
  BAND_OFFSET,
  BAND_SIGMA,
  CLUMP_PERIOD,
  CLUMP_STRENGTH,
  DESIGN_H,
  DESIGN_W,
  HERO_CORE_MAX,
  HERO_CORE_MIN,
  HERO_COUNT,
  HERO_RESPAWN_FADE,
  HERO_TWINKLE_DEPTH,
  PLANE_COUNTS,
  PLANE_RATES,
  RESPAWN_FADE,
  SPAWN_MARGIN,
  STAR_ALPHA_MAX,
  STAR_ALPHA_MIN,
  STAR_CORE_MAX,
  STAR_CORE_MIN,
  TWINKLE_DEPTH_MAX,
  TWINKLE_DEPTH_MIN,
  TWINKLE_PERIODS,
} from './constants';
import {makeFbm} from './noise';
import {makeRng, pickWeighted, range} from './rng';
import type {Palette} from './palettes';

export type Star = {
  x: number;
  y: number;
  /** Bright-core diameter in 4K px. */
  core: number;
  alpha: number;
  tint: number;
  /** Frames per twinkle cycle; always an exact divisor of 600. */
  period: number;
  phase: number;
  depth: number;
  /** Position in the 600-frame drift/respawn cycle at frame 0. */
  cycle: number;
  hero: boolean;
  /** Hero stars only: extra halo size multiplier. */
  boost: number;
};

export type Plane = {
  rate: number;
  points: Star[];
  heroes: Star[];
};

const SPAWN_W = DESIGN_W + SPAWN_MARGIN * 2;
const SPAWN_H = DESIGN_H + SPAWN_MARGIN * 2;

const bandAngle = (BAND_ANGLE_DEG * Math.PI) / 180;
// Normal of the band axis. Distance along it is what the Gaussian falls off on.
const BN_X = -Math.sin(bandAngle);
const BN_Y = Math.cos(bandAngle);

/**
 * Soft diagonal weighting, lower-left to upper-right. Nothing is drawn for the
 * band itself — it only biases where stars are allowed to spawn.
 */
export const bandWeight = (x: number, y: number): number => {
  const dx = x - DESIGN_W / 2;
  const dy = y - DESIGN_H / 2;
  const d = dx * BN_X + dy * BN_Y - BAND_OFFSET;
  return Math.exp(-((d / BAND_SIGMA) ** 2));
};

const makeStar = (
  rng: () => number,
  x: number,
  y: number,
  band: number,
  palette: Palette,
  hero: boolean,
): Star => {
  const weights = palette.stars.map((s) => s.weight);
  const core = hero
    ? range(rng, HERO_CORE_MIN, HERO_CORE_MAX)
    : STAR_CORE_MIN + rng() ** 2 * (STAR_CORE_MAX - STAR_CORE_MIN);

  // Stars inside the dust band read a touch brighter as well as denser.
  const alpha = hero
    ? range(rng, 0.55, 0.95)
    : Math.min(
        1,
        range(rng, STAR_ALPHA_MIN, STAR_ALPHA_MAX) * (1 + band * BAND_BRIGHTNESS),
      );

  return {
    x,
    y,
    core,
    alpha,
    tint: pickWeighted(rng, weights),
    period: TWINKLE_PERIODS[Math.floor(rng() * TWINKLE_PERIODS.length)],
    phase: rng() * Math.PI * 2,
    depth: hero
      ? HERO_TWINKLE_DEPTH
      : range(rng, TWINKLE_DEPTH_MIN, TWINKLE_DEPTH_MAX),
    cycle: rng(),
    hero,
    boost: 1,
  };
};

/**
 * Builds the four parallax planes.
 *
 * Star placement uses rejection sampling against the dust-band gradient times a
 * low-frequency fbm, so density — not just brightness — follows the band and
 * clumps the way a real sky does.
 */
export const buildPlanes = (palette: Palette, seed: number): Plane[] => {
  const rng = makeRng(`${palette.id}:${seed}:planes`);
  const clump = makeFbm(`${palette.id}:${seed}:clump`, CLUMP_PERIOD, 3);

  const planes: Plane[] = PLANE_COUNTS.map((count, planeIndex) => {
    const points: Star[] = [];
    // Back planes sit further from the band core, which softens its edges.
    const spread = 1 + planeIndex * 0.18;
    let guard = 0;
    while (points.length < count && guard < count * 200) {
      guard++;
      const x = -SPAWN_MARGIN + rng() * SPAWN_W;
      const y = -SPAWN_MARGIN + rng() * SPAWN_H;
      const band = bandWeight(x, y) ** (1 / spread);
      const c = clump((x + SPAWN_MARGIN) / SPAWN_W, (y + SPAWN_MARGIN) / SPAWN_H);
      const accept =
        (BAND_FLOOR + (1 - BAND_FLOOR) * band) *
        (1 - CLUMP_STRENGTH + CLUMP_STRENGTH * 2 * c);
      if (rng() > accept) continue;
      points.push(makeStar(rng, x, y, band, palette, false));
    }
    return {rate: PLANE_RATES[planeIndex], points, heroes: []};
  });

  // Hero stars live on the two front planes so their parallax reads.
  const heroRng = makeRng(`${palette.id}:${seed}:heroes`);
  for (let i = 0; i < HERO_COUNT; i++) {
    const planeIndex = i % 2;
    // Keep heroes off the extreme edges — a clipped halo looks like a mistake.
    const x = range(heroRng, DESIGN_W * 0.05, DESIGN_W * 0.95);
    const y = range(heroRng, DESIGN_H * 0.06, DESIGN_H * 0.94);
    const hero = makeStar(heroRng, x, y, bandWeight(x, y), palette, true);
    // Evenly stagger respawn phases so heroes never fade together.
    hero.cycle = (i + heroRng() * 0.4) / HERO_COUNT;
    if (i === 0) {
      hero.core = HERO_CORE_MAX;
      hero.alpha = 1;
      hero.boost = 1.35;
    } else if (i === 1) {
      hero.core = HERO_CORE_MAX * 0.92;
      hero.alpha = 1;
      hero.boost = 1.18;
    }
    planes[planeIndex].heroes.push(hero);
  }

  return planes;
};

/**
 * Per-star loop envelope. Zero at the instant the star's drift resets, one for
 * the ~90% of the cycle in between — so the reset is never visible and the
 * whole plane is bit-identical at frame 0 and frame 600.
 */
export const respawnEnvelope = (u: number, hero: boolean): number => {
  const f = hero ? HERO_RESPAWN_FADE : RESPAWN_FADE;
  const rise = Math.min(1, u / f);
  const fall = Math.min(1, (1 - u) / f);
  const t = Math.min(rise, fall);
  return t * t * (3 - 2 * t);
};
