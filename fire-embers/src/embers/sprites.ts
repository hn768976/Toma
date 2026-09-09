/**
 * Cached sprites.
 *
 * Blurring 250–700 elements individually would be hopeless, so each shape is
 * rasterised once per (colour, softness) bucket and then scaled and rotated
 * per particle. Gradients are written pixel by pixel with a dither added to
 * the alpha, which is what keeps the large orbs from ringing once H.264 has
 * quantised them.
 */

import {
  bucketHeat,
  HEAT_BUCKETS,
  sampleHeat,
  type Palette,
} from "./palette";
import { hash1 } from "./random";
import { SOFTNESS_LEVELS } from "./field";

const ORB_SIZE = 256;
const BLOOM_SIZE = 128;
const STREAK_W = 256;
const STREAK_H = 64;

/** Length-to-width ratios the streak sprites are rasterised at. */
export const STRETCH_BUCKETS = [1.5, 1.9, 2.4] as const;

/**
 * Dither baked into every sprite's alpha. Sprites are usually drawn at less
 * than full opacity, so this has to start above one level to still be worth a
 * fraction of one by the time it lands on the frame.
 */
const DITHER = 4;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/**
 * Rasterise a shape from a normalised profile function. `profile` receives
 * pixel coordinates and returns coverage in [0, 1].
 */
const rasterise = (
  w: number,
  h: number,
  colour: { r: number; g: number; b: number },
  profile: (x: number, y: number) => number,
  ditherSalt: number,
): HTMLCanvasElement => {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const r = Math.round(colour.r);
  const g = Math.round(colour.g);
  const b = Math.round(colour.b);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = profile(x + 0.5, y + 0.5);
      if (a <= 0) continue;
      const noise = (hash1(((y * w + x) ^ ditherSalt) | 0) - 0.5) * DITHER;
      const alpha = Math.max(0, Math.min(255, a * 255 + noise));
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

/** Plateau radius of the defocused disc, per softness level. */
const ORB_PLATEAU = [0.34, 0.22, 0.11, 0.03];

const buildOrb = (
  colour: { r: number; g: number; b: number },
  softness: number,
  salt: number,
): HTMLCanvasElement => {
  const c = ORB_SIZE / 2;
  const plateau = ORB_PLATEAU[softness];
  return rasterise(
    ORB_SIZE,
    ORB_SIZE,
    colour,
    (x, y) => {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const r = Math.hypot(dx, dy);
      if (r >= 1) return 0;
      return Math.pow(1 - smoothstep(plateau, 1, r), 1.7);
    },
    salt,
  );
};

/** Bloom falloff exponents, per softness level: crisper cores get tighter glow. */
const BLOOM_TIGHT = [14, 11, 9, 7];

const buildBloom = (
  colour: { r: number; g: number; b: number },
  softness: number,
  salt: number,
): HTMLCanvasElement => {
  const c = BLOOM_SIZE / 2;
  const tight = BLOOM_TIGHT[softness];
  return rasterise(
    BLOOM_SIZE,
    BLOOM_SIZE,
    colour,
    (x, y) => {
      const dx = (x - c) / c;
      const dy = (y - c) / c;
      const r = Math.hypot(dx, dy);
      if (r >= 1) return 0;
      const k = 1 - r;
      return 0.5 * Math.pow(k, 3.2) + 0.5 * Math.pow(k, tight);
    },
    salt,
  );
};

/**
 * Streaks are solid capsules with a soft skirt, not peaked ridges: a bright
 * plateau out to `STREAK_CORE`, then a falloff. A purely peaked profile draws
 * a hairline down the middle and reads as a scratch rather than an ember.
 */
const STREAK_CORE = [0.62, 0.52, 0.42, 0.32];

const buildStreak = (
  colour: { r: number; g: number; b: number },
  softness: number,
  stretch: number,
  salt: number,
): HTMLCanvasElement => {
  // Rasterise at the true aspect ratio so the soft caps stay round once the
  // sprite is scaled to the particle's length.
  const h = STREAK_H;
  const w = Math.round(Math.min(STREAK_W, h * stretch));
  const halfW = h / 2;
  const cy = h / 2;
  const x0 = halfW;
  const x1 = w - halfW;
  const core = STREAK_CORE[softness];

  return rasterise(
    w,
    h,
    colour,
    (x, y) => {
      const px = Math.min(x1, Math.max(x0, x));
      const d = Math.hypot(x - px, y - cy) / halfW;
      if (d >= 1) return 0;
      // A hot centre inside a dimmer body inside a soft skirt — the same
      // three-part structure a real ember shows under motion blur.
      const hot = 1 - smoothstep(0, core * 0.9, d);
      const plateau = 1 - smoothstep(core, core + 0.28, d);
      const skirt = Math.pow(1 - d, 2.0);
      return Math.min(1, hot * 0.42 + plateau * 0.6 + skirt * 0.34);
    },
    salt,
  );
};

export type SpriteSet = {
  /** [softness][heatBucket] */
  readonly orbs: HTMLCanvasElement[][];
  readonly blooms: HTMLCanvasElement[][];
  /** [stretchBucket][softness][heatBucket] */
  readonly streaks: HTMLCanvasElement[][][];
  /** Pre-formatted fill styles for the crisp pinpoint cores. */
  readonly coreFill: string[];
};

const cache = new Map<string, SpriteSet>();

export const getSprites = (palette: Palette, key: string): SpriteSet => {
  const existing = cache.get(key);
  if (existing) return existing;

  const orbs: HTMLCanvasElement[][] = [];
  const blooms: HTMLCanvasElement[][] = [];
  const streaks: HTMLCanvasElement[][][] = [];
  const coreFill: string[] = [];

  for (let h = 0; h < HEAT_BUCKETS; h++) {
    const colour = sampleHeat(palette, bucketHeat(h));
    coreFill.push(
      `rgb(${Math.round(colour.r)},${Math.round(colour.g)},${Math.round(colour.b)})`,
    );
  }

  for (let s = 0; s < SOFTNESS_LEVELS; s++) {
    const orbRow: HTMLCanvasElement[] = [];
    const bloomRow: HTMLCanvasElement[] = [];
    for (let h = 0; h < HEAT_BUCKETS; h++) {
      const colour = sampleHeat(palette, bucketHeat(h));
      orbRow.push(buildOrb(colour, s, 0x1000 + s * 97 + h * 7717));
      bloomRow.push(buildBloom(colour, s, 0x2000 + s * 89 + h * 6301));
    }
    orbs.push(orbRow);
    blooms.push(bloomRow);
  }

  for (let k = 0; k < STRETCH_BUCKETS.length; k++) {
    const perSoftness: HTMLCanvasElement[][] = [];
    for (let s = 0; s < SOFTNESS_LEVELS; s++) {
      const row: HTMLCanvasElement[] = [];
      for (let h = 0; h < HEAT_BUCKETS; h++) {
        const colour = sampleHeat(palette, bucketHeat(h));
        row.push(
          buildStreak(
            colour,
            s,
            STRETCH_BUCKETS[k],
            0x3000 + k * 613 + s * 71 + h * 5119,
          ),
        );
      }
      perSoftness.push(row);
    }
    streaks.push(perSoftness);
  }

  const set: SpriteSet = { orbs, blooms, streaks, coreFill };
  cache.set(key, set);
  return set;
};

export const stretchBucket = (stretch: number): number => {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < STRETCH_BUCKETS.length; i++) {
    const d = Math.abs(STRETCH_BUCKETS[i] - stretch);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
};
