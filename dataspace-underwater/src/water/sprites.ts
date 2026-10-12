import { mulberry32 } from "../lib/random";
// Prebaked bubble / speck sprite atlas, built once at startup.
//
// Pixels are stored PREMULTIPLIED with "emission": rgb may exceed alpha, so a
// single normal (ONE, ONE_MINUS_SRC_ALPHA) blend gives both the bright silver
// rim (adds light) and the faint see-through occlusion of the middle and the
// dark edge on the side away from the light. That is how air in water reads.

export const CELL = 128;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
export const ATLAS_W = CELL * ATLAS_COLS;
export const ATLAS_H = CELL * ATLAS_ROWS;

/** Diameter (px inside a 128 cell) of the drawn shape, for scale maths. */
export const SHARP_D = 92;
export const BLUR_D = 64;

export const Sprite = {
  Round: 0,
  Oblate: 1,
  Wobbly: 2,
  Cap: 3,
  CapWide: 4,
  RoundBlur: 5,
  OblateBlur: 6,
  CapBlur: 7,
  Speck: 8,
  SpeckBokeh: 9,
  Tiny: 10,
} as const;
export type Sprite = number;

/** Seeded irregular large-bubble shapes (sharp), and blurred copies for the near layer. */
export const IRREG_BASE = 11;
export const IRREG_COUNT = 13;
export const IRREG_BLUR_BASE = IRREG_BASE + IRREG_COUNT; // 24
export const IRREG_BLUR_COUNT = 6;

type Shape = (u: number, v: number) => number; // signed distance, radius units, v down

const len = (x: number, y: number) => Math.sqrt(x * x + y * y);

const shapes: Record<string, Shape> = {
  round: (u, v) => len(u, v) - 1,
  oblate: (u, v) => (len(u, v / 0.78) - 1) * 0.85,
  wobbly: (u, v) => {
    const a = Math.atan2(v, u);
    const e = (len(u, (v + 0.05) / 0.7) - 1) * 0.8 + 0.035 * Math.sin(3 * a + 0.7) + 0.02 * Math.sin(5 * a + 2.0);
    return Math.max(e, v - 0.5 - 0.15 * u * u);
  },
  cap: (u, v) => {
    const dome = (len(u, (v + 0.25) / 0.85) - 1) * 0.9;
    // Flat bottom whose edges hang down a little (mushroom skirt).
    const bottom = v - (0.18 + 0.22 * u * u);
    return Math.max(dome, bottom);
  },
  capWide: (u, v) => {
    const dome = (len(u, (v + 0.35) / 0.72) - 1) * 0.85;
    const bottom = v - (0.05 + 0.3 * u * u * u * u) - 0.04 * Math.sin(u * 7.0);
    return Math.max(dome, bottom);
  },
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

type Px = [number, number, number, number]; // premultiplied r,g,b (emission) + a

/** Shade one bubble pixel. (u,v) in radius units, v down; rpx = radius in px. */
const shadeBubble = (
  shape: Shape,
  u: number,
  v: number,
  rpx: number,
  cap: boolean,
  rimMod: (u: number, v: number) => number = () => 1,
  glints: [number, number, number][] = [],
): Px => {
  const d = shape(u, v);
  const aa = 1 / rpx;
  const cov = Math.min(1, Math.max(0, 0.5 - d / aa));
  const t = Math.max(0, -d); // depth inside the edge
  const rimW = cap ? 0.24 : 0.22;
  const rim = Math.exp(-((t / rimW) ** 2)) * cov;
  // Light comes from above: top of the rim slightly brighter.
  const lt = 0.78 + 0.22 * Math.max(-1, Math.min(1, -v));
  // Inner caustic crescent near the bottom (light focused through the bubble).
  const cres = 0.32 * Math.exp(-(((t - 0.22) / 0.1) ** 2)) * smooth(0.05, 0.85, v) * cov;
  // Small specular dot toward the top.
  // The sun is straight above: highlight near the top centre, slightly elongated.
  const sx = (u + 0.12) / 1.5;
  const sy = v + (cap ? 0.45 : 0.58);
  const spec = 1.2 * Math.exp(-(sx * sx + sy * sy) / 0.012) * cov;
  // Refracted, inverted image of the bright surface: the lower half of the
  // bubble's interior is lit, the upper half sees the dark depths.
  const refr = 0.55 * smooth(-0.35, 0.7, v) * smooth(0.0, 0.3, t) * cov + 0.12 * cov;
  // Rim is thicker / brighter at the bottom where light exits.
  const rimB = Math.exp(-((t / (rimW * (1 + 0.6 * smooth(0, 1, v)))) ** 2)) * cov;
  let g = 0;
  for (const [gx, gy, gr] of glints) g += 0.9 * Math.exp(-((u - gx) ** 2 + (v - gy) ** 2) / (gr * gr)) * cov;
  let e = Math.max(rim, rimB) * 0.95 * lt * rimMod(u, v) + cres + spec + refr + 0.12 * cov + g;
  // Faint dark edge outside, on the side away from the light (bottom).
  const outside = Math.max(0, d);
  const dark = 0.32 * Math.exp(-(((outside - 0.04) / 0.05) ** 2)) * smooth(0.0, 0.9, v) * (d > -0.02 ? 1 : 0);
  // Darker inner band just inside the rim at the bottom (air bends light away).
  const innerDark = 0.1 * Math.exp(-(((t - 0.16) / 0.07) ** 2)) * smooth(-0.2, 0.9, v) * cov;
  let a = cov * (0.07 + 0.45 * Math.exp(-((t / rimW) ** 2))) + dark + innerDark;
  e = Math.min(1, e);
  a = Math.min(1, a);
  return [e, e, e, a];
};

const shadeSpeck = (u: number, v: number): Px => {
  const g = Math.exp(-(u * u + v * v) / (2 * 0.3 * 0.3));
  return [0.9 * g, 0.9 * g, 0.9 * g, 0.55 * g];
};

const shadeTiny = (u: number, v: number): Px => {
  const r = len(u, v);
  const g = Math.exp(-((r / 0.75) ** 4));
  const e = Math.min(1, g * (0.85 + 0.15 * Math.exp(-((r - 0.6) ** 2) / 0.03)));
  return [e, e, e, 0.3 * g];
};

const shadeBokeh = (u: number, v: number, rpx: number): Px => {
  const r = len(u, v);
  const cov = Math.min(1, Math.max(0, 0.5 - (r - 1) * rpx * 0.25));
  const rim = Math.exp(-(((1 - r) / 0.18) ** 2)) * cov;
  const e = 0.4 * cov + 0.35 * rim;
  return [e, e, e, 0.25 * cov];
};

const gaussianBlur = (buf: Float32Array, w: number, h: number, sigma: number) => {
  const r = Math.ceil(sigma * 3);
  const k: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v);
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(buf.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let acc = 0;
        for (let i = -r; i <= r; i++) {
          const xx = Math.min(w - 1, Math.max(0, x + i));
          acc += buf[(y * w + xx) * 4 + c] * k[i + r];
        }
        tmp[(y * w + x) * 4 + c] = acc;
      }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 4; c++) {
        let acc = 0;
        for (let i = -r; i <= r; i++) {
          const yy = Math.min(h - 1, Math.max(0, y + i));
          acc += tmp[(yy * w + x) * 4 + c] * k[i + r];
        }
        buf[(y * w + x) * 4 + c] = acc;
      }
};

const renderCell = (fn: (u: number, v: number, rpx: number) => Px, diameter: number, blurSigma: number) => {
  const buf = new Float32Array(CELL * CELL * 4);
  const rpx = diameter / 2;
  const SS = 3; // supersampling
  for (let y = 0; y < CELL; y++)
    for (let x = 0; x < CELL; x++) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS - CELL / 2) / rpx;
          const v = (y + (sy + 0.5) / SS - CELL / 2) / rpx;
          const p = fn(u, v, rpx);
          for (let c = 0; c < 4; c++) acc[c] += p[c];
        }
      for (let c = 0; c < 4; c++) buf[(y * CELL + x) * 4 + c] = acc[c] / (SS * SS);
    }
  if (blurSigma > 0) gaussianBlur(buf, CELL, CELL, blurSigma);
  return buf;
};

// Irregular large bubble: polar harmonic outline, squashed, sometimes with a
// flat or skirted bottom, a broken rim and a few extra glints. Seeded.
const irregular = (seed: number) => {
  const rng = mulberry32(0x1bb0 + seed * 7919);
  const harm: [number, number, number][] = [];
  for (let k = 2; k <= 7; k++) harm.push([k, (rng() * 0.11) / Math.sqrt(k - 1), rng() * TAU_]);
  const asp = 0.55 + rng() * 0.35;
  const kind = rng(); // <0.35 flat bottom, <0.6 skirted cap, else free blob
  const tilt = (rng() - 0.5) * 0.25;
  const shape: Shape = (u0, v0) => {
    const u = u0 + tilt * v0;
    const v = v0 / asp;
    const r = len(u, v);
    const phi = Math.atan2(v, u);
    let R = 1;
    for (const [k, a, p] of harm) R += a * Math.cos(k * phi + p);
    let d = (r - R) * asp * 0.95;
    if (kind < 0.35) d = Math.max(d, v0 - asp * (0.35 + 0.25 * rng0(seed)) - 0.1 * u0 * u0);
    else if (kind < 0.6) d = Math.max(d, v0 - asp * 0.15 - 0.3 * u0 * u0 * u0 * u0 + 0.05 * Math.sin(u0 * 9 + seed));
    return d;
  };
  const m1 = 2 + Math.floor(rng() * 4);
  const p1 = rng() * TAU_;
  const m2 = 5 + Math.floor(rng() * 5);
  const p2 = rng() * TAU_;
  const rimMod = (u: number, v: number) => {
    const phi = Math.atan2(v, u);
    return 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(m1 * phi + p1), 0.6) * (0.7 + 0.3 * Math.sin(m2 * phi + p2));
  };
  const glints: [number, number, number][] = [];
  const ng = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < ng; i++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 2.2;
    glints.push([Math.cos(a) * 0.75, Math.sin(a) * 0.75 * asp, 0.05 + rng() * 0.07]);
  }
  return (u: number, v: number, rpx: number) => shadeBubble(shape, u, v, rpx, kind < 0.6, rimMod, glints);
};
const TAU_ = Math.PI * 2;
const rng0 = (seed: number) => (Math.sin(seed * 12.9898) * 43758.5453) % 1;

const bubble = (shape: Shape, cap: boolean) => (u: number, v: number, rpx: number) =>
  shadeBubble(shape, u, v, rpx, cap);

let atlasCache: Uint8Array | null = null;

/** RGBA8 premultiplied atlas data (ATLAS_W × ATLAS_H). */
export const getSpriteAtlas = (): Uint8Array => {
  if (atlasCache) return atlasCache;
  const cells: [Sprite, Float32Array][] = [
    [Sprite.Round, renderCell(bubble(shapes.round, false), SHARP_D, 0)],
    [Sprite.Oblate, renderCell(bubble(shapes.oblate, false), SHARP_D, 0)],
    [Sprite.Wobbly, renderCell(bubble(shapes.wobbly, false), SHARP_D, 0)],
    [Sprite.Cap, renderCell(bubble(shapes.cap, true), SHARP_D, 0)],
    [Sprite.CapWide, renderCell(bubble(shapes.capWide, true), SHARP_D, 0)],
    [Sprite.RoundBlur, renderCell(bubble(shapes.round, false), BLUR_D, 8)],
    [Sprite.OblateBlur, renderCell(bubble(shapes.oblate, false), BLUR_D, 8)],
    [Sprite.CapBlur, renderCell(bubble(shapes.cap, true), BLUR_D, 8)],
    [Sprite.Speck, renderCell((u, v) => shadeSpeck(u, v), SHARP_D, 0)],
    [Sprite.SpeckBokeh, renderCell(shadeBokeh, BLUR_D, 3)],
    // Small bubbles: a thicker rim so it survives minification as a ring-ish dot.
    // At 1–3 px a bubble is just a glint: a bright solid dot with a soft edge.
    [Sprite.Tiny, renderCell((u, v) => shadeTiny(u, v), SHARP_D, 0)],
  ];
  for (let i = 0; i < IRREG_COUNT; i++) cells.push([IRREG_BASE + i, renderCell(irregular(i), SHARP_D, 0)]);
  for (let i = 0; i < IRREG_BLUR_COUNT; i++)
    cells.push([IRREG_BLUR_BASE + i, renderCell(irregular(i * 2 + 1), BLUR_D, 7 + (i % 3) * 2)]);
  const out = new Uint8Array(ATLAS_W * ATLAS_H * 4);
  for (const [idx, buf] of cells) {
    const cx = (idx % ATLAS_COLS) * CELL;
    const cy = Math.floor(idx / ATLAS_COLS) * CELL;
    for (let y = 0; y < CELL; y++)
      for (let x = 0; x < CELL; x++)
        for (let c = 0; c < 4; c++) {
          const v = buf[(y * CELL + x) * 4 + c];
          out[((cy + y) * ATLAS_W + cx + x) * 4 + c] = Math.max(0, Math.min(255, Math.round(v * 255)));
        }
  }
  atlasCache = out;
  return out;
};

export const spriteFrame = (s: Sprite) => ({
  x: (s % ATLAS_COLS) * CELL,
  y: Math.floor(s / ATLAS_COLS) * CELL,
  w: CELL,
  h: CELL,
});
