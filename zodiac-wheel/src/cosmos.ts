/**
 * Procedural cosmos: nebula texture, starfield and constellations.
 * Everything here is generated once from a seeded PRNG and cached at module
 * level, so all 900 frames share the same universe and the render stays fast.
 * No photographic source material is involved anywhere.
 */

import type { Palette } from "./config";
import { makeRng } from "./rng";
import { clamp01, fbm, makeNoise2D, smoothstep, warpedFbm } from "./noise";

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

const mix = (
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export type NebulaSpec = {
  seed: number;
  width: number;
  height: number;
  /** Noise frequency; higher means finer structure. */
  freq: number;
  /** Anisotropy -- values below 1 stretch the clouds horizontally. */
  stretchY: number;
  octaves: number;
  warp: number;
  /** Soft elliptical masses the cloud is confined to, in 0..1 frame space. */
  masses: { x: number; y: number; rx: number; ry: number; gain: number }[];
  maxAlpha: number;
  /** How strongly the dark dust lanes bite into the cloud. */
  dust: number;
  /** Chance of the cool accent colour showing through. */
  accent: number;
  /** Overrides the palette's nebula ramp -- used for the cool accent clouds. */
  colors?: [string, string, string];
};

const nebulaCache = new Map<string, HTMLCanvasElement>();

export const buildNebula = (
  key: string,
  palette: Palette,
  spec: NebulaSpec,
): HTMLCanvasElement => {
  const cached = nebulaCache.get(key);
  if (cached) return cached;

  const { width: w, height: h } = spec;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const data = img.data;

  const cloud = makeNoise2D(spec.seed);
  const lanes = makeNoise2D(spec.seed + 977);
  const hue = makeNoise2D(spec.seed + 1913);

  const ramp = spec.colors ?? palette.nebula;
  const c0 = hexToRgb(ramp[0]);
  const c1 = hexToRgb(ramp[1]);
  const c2 = hexToRgb(ramp[2]);
  const cAcc = hexToRgb(palette.nebulaAccent);

  const aspect = w / h;

  for (let py = 0; py < h; py++) {
    const v = py / h;
    for (let px = 0; px < w; px++) {
      const u = px / w;

      // Soft masses decide where the cloud is allowed to exist at all.
      let mask = 0;
      for (const m of spec.masses) {
        const dx = (u - m.x) / m.rx;
        const dy = (v - m.y) / m.ry;
        const d = Math.sqrt(dx * dx + dy * dy);
        mask += m.gain * (1 - smoothstep(0.25, 1, d));
      }
      mask = clamp01(mask);
      const i = (py * w + px) * 4;
      if (mask <= 0.002) {
        data[i + 3] = 0;
        continue;
      }

      const nx = u * aspect * spec.freq;
      const ny = v * spec.freq * spec.stretchY;

      const raw = warpedFbm(cloud, nx, ny, spec.octaves, spec.warp);
      // Density and brightness are ramped separately: thin gas stays dim but
      // keeps its colour, and the bright cores never clip to white.
      const density = Math.pow(smoothstep(-0.24, 0.3, raw), 1.45) * mask;

      // Ridged noise carves the dark dust lanes -- thresholded high so the
      // lanes read as a few filaments, not as holes punched everywhere.
      const ridge = 1 - Math.abs(fbm(lanes, nx * 1.5 + 31.7, ny * 1.5 - 12.4, 4));
      const t = density * (1 - spec.dust * smoothstep(0.9, 1, ridge));

      if (t <= 0.004) {
        data[i + 3] = 0;
        continue;
      }

      // Colour rises faster than opacity, so the wisps read warm rather than grey.
      const shade = Math.pow(t, 0.72);
      let rgb = shade < 0.55 ? mix(c0, c1, shade / 0.55) : mix(c1, c2, (shade - 0.55) / 0.45);

      if (spec.accent > 0) {
        // The cool patches live at the cloud's thin edges, as in the reference.
        const a = smoothstep(0.02, 0.4, fbm(hue, nx * 0.75 + 5.5, ny * 0.75 + 8.1, 3));
        const edge = smoothstep(0.04, 0.3, t) * (1 - smoothstep(0.4, 0.78, t));
        rgb = mix(rgb, cAcc, a * edge * spec.accent);
      }

      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = Math.round(clamp01(t) * spec.maxAlpha * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  nebulaCache.set(key, canvas);
  return canvas;
};

/* ------------------------------------------------------------------ stars */

export type Star = {
  x: number; // 0..1 of frame
  y: number;
  r: number; // radius in frame-height fractions
  base: number; // base brightness 0..1
  amp: number; // twinkle amplitude
  period: number; // frames -- always a divisor of the loop length
  phase: number;
  cross: boolean;
  warm: number; // 0 faint colour .. 1 brilliant colour
};

/** Periods that divide 900 exactly, so every twinkle closes the loop. */
const TWINKLE_PERIODS = [60, 75, 90, 100, 150, 180, 225, 300];

const starCache = new Map<string, Star[]>();

export const buildStars = (key: string, seed: number, count: number): Star[] => {
  const cached = starCache.get(key);
  if (cached) return cached;
  const rng = makeRng(seed);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const brilliance = Math.pow(rng.next(), 3.1); // mostly faint
    stars.push({
      x: rng.next(),
      y: rng.next(),
      r: (0.00035 + brilliance * 0.0016) * (0.7 + rng.next() * 0.6),
      base: 0.16 + brilliance * 0.84,
      amp: 0.1 + rng.next() * 0.34,
      period: rng.pick(TWINKLE_PERIODS),
      phase: rng.next() * Math.PI * 2,
      cross: brilliance > 0.82 && rng.next() > 0.45,
      warm: brilliance,
    });
  }
  starCache.set(key, stars);
  return stars;
};

/* --------------------------------------------------------- constellations */

export type Constellation = {
  pts: { x: number; y: number; r: number }[];
  links: [number, number][];
  period: number;
  phase: number;
};

const constellationCache = new Map<string, Constellation[]>();

export const buildConstellations = (
  key: string,
  seed: number,
  count: number,
  /** Reject clusters landing inside the wheel's busy interior. */
  keepOut: (x: number, y: number) => boolean,
): Constellation[] => {
  const cached = constellationCache.get(key);
  if (cached) return cached;
  const rng = makeRng(seed);
  const out: Constellation[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 200) {
    const cx = rng.range(-0.02, 1.02);
    const cy = rng.range(-0.02, 1.02);
    if (!keepOut(cx, cy)) continue;
    const n = rng.int(4, 8);
    const spread = rng.range(0.045, 0.12);
    const pts: { x: number; y: number; r: number }[] = [];
    for (let i = 0; i < n; i++) {
      pts.push({
        x: cx + rng.range(-spread, spread),
        y: cy + rng.range(-spread, spread) * 0.62,
        r: rng.range(0.0009, 0.0022),
      });
    }
    // Chain the points nearest-neighbour first, then add one cross link.
    const links: [number, number][] = [];
    const used = new Set<number>([0]);
    let cur = 0;
    while (used.size < n) {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        if (used.has(i)) continue;
        const d = (pts[i].x - pts[cur].x) ** 2 + (pts[i].y - pts[cur].y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      links.push([cur, best]);
      used.add(best);
      cur = best;
    }
    if (n > 4) links.push([rng.int(0, n - 1), rng.int(0, n - 1)]);
    out.push({
      pts,
      links: links.filter(([a, b]) => a !== b),
      period: rng.pick([180, 225, 300, 450]),
      phase: rng.next() * Math.PI * 2,
    });
  }
  constellationCache.set(key, out);
  return out;
};

/* ----------------------------------------------------------------- grain */

const grainCache = new Map<string, HTMLCanvasElement[]>();

/**
 * A handful of pre-rolled grain tiles, cycled by frame. Six tiles divide the
 * 900-frame loop exactly, so the grain never jumps at the loop point.
 */
export const buildGrainTiles = (
  key: string,
  seed: number,
  size: number,
  tiles: number,
  amplitude: number,
): HTMLCanvasElement[] => {
  const cached = grainCache.get(key);
  if (cached) return cached;
  const rng = makeRng(seed);
  const out: HTMLCanvasElement[] = [];
  for (let t = 0; t < tiles; t++) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let i = 0; i < size * size; i++) {
      const n = 128 + Math.round((rng.next() * 2 - 1) * amplitude);
      d[i * 4] = n;
      d[i * 4 + 1] = n;
      d[i * 4 + 2] = n;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    out.push(c);
  }
  grainCache.set(key, out);
  return out;
};

export { hexToRgb };
