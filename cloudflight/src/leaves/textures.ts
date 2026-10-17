import { mulberry32 } from "../lib/random";

/**
 * Leaf silhouettes and light shapes drawn once on Canvas2D. Leaves are
 * pre-blurred at four strengths (one per depth layer). All shapes are white
 * so sprites can be tinted.
 */

export const LEAF_TEX = 384; // texture size (px) incl. padding
export const BLURS = [0.09, 0.12, 0.16, 0.22]; // blur radius as a fraction of LEAF_TEX

type Shape = (ctx: CanvasRenderingContext2D, s: number) => void;

// Broadleaf: pointed oval, slightly asymmetric.
const leafA: Shape = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(0, -0.5 * s);
  ctx.bezierCurveTo(0.34 * s, -0.3 * s, 0.32 * s, 0.25 * s, 0, 0.5 * s);
  ctx.bezierCurveTo(-0.3 * s, 0.22 * s, -0.36 * s, -0.28 * s, 0, -0.5 * s);
  ctx.fill();
};
// Rounder leaf.
const leafB: Shape = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(0, -0.46 * s);
  ctx.bezierCurveTo(0.44 * s, -0.36 * s, 0.4 * s, 0.32 * s, 0, 0.46 * s);
  ctx.bezierCurveTo(-0.42 * s, 0.3 * s, -0.42 * s, -0.36 * s, 0, -0.46 * s);
  ctx.fill();
};
// Narrow leaf.
const leafC: Shape = (ctx, s) => {
  ctx.beginPath();
  ctx.moveTo(0, -0.5 * s);
  ctx.bezierCurveTo(0.2 * s, -0.25 * s, 0.2 * s, 0.3 * s, 0, 0.5 * s);
  ctx.bezierCurveTo(-0.2 * s, 0.3 * s, -0.22 * s, -0.25 * s, 0, -0.5 * s);
  ctx.fill();
};
// Cluster of three small leaves.
const leafD: Shape = (ctx, s) => {
  for (const [x, y, r, k] of [
    [-0.16, 0.06, -0.6, 0.55],
    [0.14, 0.02, 0.5, 0.55],
    [0, -0.14, 0.05, 0.62],
  ]) {
    ctx.save();
    ctx.translate(x * s, y * s);
    ctx.rotate(r);
    leafA(ctx, s * k);
    ctx.restore();
  }
};

export const LEAF_SHAPES = [leafA, leafB, leafC, leafD];

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** leafCanvases[shape][blurLevel] */
export const makeLeafCanvases = () =>
  LEAF_SHAPES.map((shape) =>
    BLURS.map((b) => {
      const c = canvas(LEAF_TEX, LEAF_TEX);
      const ctx = c.getContext("2d")!;
      const blur = b * LEAF_TEX;
      const leafSize = LEAF_TEX - 2 * blur * 2.2;
      ctx.filter = `blur(${blur.toFixed(2)}px)`;
      ctx.fillStyle = "#ffffff";
      ctx.translate(LEAF_TEX / 2, LEAF_TEX / 2);
      shape(ctx, leafSize);
      return c;
    }),
  );

/** Soft radial falloff (gaussian-ish). */
export const makeRadial = (size = 256, falloff = 2.2) => {
  const c = canvas(size, size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const v = r >= 1 ? 0 : Math.exp(-falloff * falloff * r * r) * (1 - r * r);
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Bokeh disc: flat with a slightly brighter rim, soft edge. */
export const makeBokeh = (size = 128, soft = 0.16) => {
  const c = canvas(size, size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const edge = 1 - Math.min(1, Math.max(0, (r - (0.98 - soft)) / soft));
      const rim = 0.75 + 0.25 * Math.exp(-Math.pow((r - 0.85) / 0.08, 2));
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(edge * rim * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Light ray: long and thin, soft across, fading along its length. */
export const makeRay = (w = 512, h = 64) => {
  const c = canvas(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w; // along
      const v = ((y + 0.5) / h - 0.5) * 2; // across
      const widen = 0.35 + 0.65 * u;
      const across = Math.exp(-Math.pow(v / widen, 2) * 3.0);
      const along = Math.pow(1 - u, 1.6) * Math.min(1, u * 12);
      const o = (y * w + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(across * along * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Small soft six-point star for the lens-flare ghost. */
export const makeStar = (size = 128) => {
  const c = canvas(size, size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.atan2(dy, dx);
      const spikes = Math.pow(Math.abs(Math.cos(a * 3)), 18);
      const core = Math.exp(-r * r * 30);
      const v = Math.min(1, core + spikes * Math.exp(-r * 4.5) * 0.7) * (r < 1 ? 1 : 0);
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Seeded leaf layout, built once per row. */
export type Leaf = {
  layer: number;
  shape: number;
  x: number; // in frame heights, x from 0 at left
  y: number;
  size: number; // in frame heights
  rot: number;
  alpha: number;
  colorIndex: number;
  colorJitter: number;
  phase: number;
  phase2: number;
  amp: number;
};

export const LAYERS = [
  { count: 130, size: [0.13, 0.21], alpha: [0.75, 0.95], amp: 0.004, blur: 1 },
  { count: 150, size: [0.18, 0.3], alpha: [0.8, 0.98], amp: 0.007, blur: 2 },
  { count: 105, size: [0.26, 0.42], alpha: [0.8, 0.95], amp: 0.011, blur: 3 },
  { count: 115, size: [0.34, 0.56], alpha: [0.6, 0.85], amp: 0.018, blur: 3 },
];

export const makeLayout = (seed: number, aspect: number, nColors: number): Leaf[] => {
  const rng = mulberry32(seed);
  const leaves: Leaf[] = [];
  LAYERS.forEach((L, layer) => {
    for (let i = 0; i < L.count; i++) {
      leaves.push({
        layer,
        shape: Math.floor(rng() * 4),
        x: -0.15 + rng() * (aspect + 0.3),
        y: -0.15 + rng() * 1.3,
        size: L.size[0] + rng() * (L.size[1] - L.size[0]),
        rot: rng() * Math.PI * 2,
        alpha: L.alpha[0] + rng() * (L.alpha[1] - L.alpha[0]),
        colorIndex: Math.floor(rng() * nColors),
        colorJitter: rng(),
        phase: rng() * Math.PI * 2,
        phase2: rng() * Math.PI * 2,
        amp: L.amp * (0.6 + 0.8 * rng()),
      });
    }
  });
  return leaves;
};
