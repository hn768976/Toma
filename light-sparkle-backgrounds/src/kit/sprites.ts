import { CanvasSource, Texture } from "pixi.js";
import { mulberry32 } from "./random";

// Sprite textures are prebaked once in Canvas 2D. RGB holds additive light
// intensity (alpha is opaque), so faint halos keep full 8-bit precision and
// every sprite layer blends with ONE,ONE into a half-float target.

export const SPRITE_SIZE = 512;

type Pixel = (u: number, v: number) => [number, number, number];

const bake = (w: number, h: number, fn: Pixel): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // u,v in [-1,1], pixel centres
      const u = ((x + 0.5) / w) * 2 - 1;
      const v = ((y + 0.5) / h) * 2 - 1;
      const [r, g, b] = fn(u, v);
      const o = (y * w + x) * 4;
      img.data[o] = Math.round(Math.min(1, Math.max(0, r)) * 255);
      img.data[o + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
      img.data[o + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

const toTexture = (canvas: HTMLCanvasElement, label: string) => {
  const source = new CanvasSource({
    resource: canvas,
    autoGenerateMipmaps: true,
    scaleMode: "linear",
    mipmapFilter: "linear",
    addressMode: "clamp-to-edge",
    label,
  });
  return new Texture({ source, label });
};

// Window that takes any profile smoothly to exactly 0 at the sprite edge.
const edge = (r: number) => {
  const t = Math.max(0, 1 - r * r);
  return t * t;
};
// Tight window: 1 inside, falls to 0 only over the outer few percent.
const rim = (r: number) => 1 - smooth(0.93, 1.0, r);

const dotProfile = (r: number) => {
  const core = Math.exp(-(r * r) / (2 * 0.07 * 0.07));
  const halo = 0.22 * Math.exp(-r / 0.16);
  return (core + halo) * edge(r);
};

// One streak arm pair along the u axis. width: gaussian sigma in v (uv units).
const streak = (along: number, across: number, width: number, falloff: number) => {
  const a = Math.abs(along);
  if (a >= 1) return 0;
  const len = Math.pow(1 - a, falloff);
  const w = width * (0.35 + 0.65 * (1 - a)); // taper towards the tip
  return len * Math.exp(-(across * across) / (2 * w * w));
};

const flareFn =
  (arms: number, diagonals: boolean, chroma: number): Pixel =>
  (u, v) => {
    const r = Math.hypot(u, v);
    const base = dotProfile(r * 1.6) * 0.9 + 0.35 * Math.exp(-r / 0.09) * edge(r);
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let i = 0; i < arms; i++) {
      const ang = (Math.PI * i) / arms;
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const along = u * ca + v * sa;
      const across = -u * sa + v * ca;
      const w = 0.012;
      const g = streak(along, across, w, 2.2);
      // Lateral chromatic fringe: red pushed to one edge, blue to the other.
      const off = chroma * w * 2.6;
      const rr = chroma > 0 ? streak(along, across - off, w * 1.25, 2.2) : g;
      const bb = chroma > 0 ? streak(along, across + off, w * 1.25, 2.2) : g;
      sr += rr;
      sg += g;
      sb += bb;
    }
    if (diagonals) {
      for (const ang of [Math.PI / 4, (3 * Math.PI) / 4]) {
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const along = (u * ca + v * sa) * 1.9;
        const across = -u * sa + v * ca;
        const g = 0.35 * streak(along, across, 0.009, 2.5);
        sr += g;
        sg += g;
        sb += g;
      }
    }
    return [base + sr, base + sg, base + sb];
  };

const valueNoise = (seed: number, cells: number) => {
  const rng = mulberry32(seed);
  const grid = new Float32Array((cells + 1) * (cells + 1)).map(() => rng());
  return (u: number, v: number) => {
    const x = ((u + 1) / 2) * cells;
    const y = ((v + 1) / 2) * cells;
    const xi = Math.min(cells - 1, Math.floor(x));
    const yi = Math.min(cells - 1, Math.floor(y));
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const g = (i: number, j: number) => grid[j * (cells + 1) + i];
    const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * sx;
    const b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * sx;
    return a + (b - a) * sy;
  };
};

const bokehNoise = valueNoise(7, 6);

const bokehFn =
  (hex: boolean, softness: number): Pixel =>
  (u, v) => {
    let d: number;
    if (hex) {
      // Slightly rounded hexagon: blend hex distance with circle distance.
      const ax = Math.abs(u);
      const ay = Math.abs(v);
      const hd = Math.max(ax * 0.8660254 + ay * 0.5, ay);
      d = hd * 0.55 + Math.hypot(u, v) * 0.45;
    } else {
      d = Math.hypot(u, v);
    }
    const R = 0.86;
    const s = softness;
    const inside = 1 - smooth(R - s, R + s, d);
    const ring = 0.32 * Math.exp(-((d - (R - s * 0.6)) ** 2) / (2 * (0.035 + s * 0.4) ** 2));
    const n = bokehNoise(u * 0.9, v * 0.9);
    const tex = 0.88 + 0.12 * n + 0.06 * (1 - d / R);
    const val = (inside * 0.72 * tex + ring * inside) * rim(Math.hypot(u, v));
    return [val, val, val];
  };

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export type SpriteKit = {
  dot: Texture;
  flare4: Texture;
  flare4Chroma: Texture;
  flare6: Texture;
  streak: Texture;
  streakChroma: Texture;
  bokehRound: Texture;
  bokehSoft: Texture;
  bokehHex: Texture;
  ring: Texture;
};

let cached: SpriteKit | null = null;

export const bakeSpriteKit = (): SpriteKit => {
  if (cached) return cached;
  const S = SPRITE_SIZE;
  const streakFn =
    (chroma: number): Pixel =>
    (u, v) => {
      const along = Math.pow(1 - Math.min(1, Math.abs(u)), 1.8) * edge(Math.abs(u));
      const g = Math.exp(-(v * v) / (2 * 0.16 * 0.16));
      const off = chroma * 0.2;
      const r = chroma > 0 ? Math.exp(-((v - off) ** 2) / (2 * 0.2 * 0.2)) : g;
      const b = chroma > 0 ? Math.exp(-((v + off) ** 2) / (2 * 0.2 * 0.2)) : g;
      const vEdge = edge(Math.abs(v));
      return [along * r * vEdge, along * g * vEdge, along * b * vEdge];
    };
  cached = {
    dot: toTexture(bake(S, S, (u, v) => {
      const p = dotProfile(Math.hypot(u, v));
      return [p, p, p];
    }), "dot"),
    flare4: toTexture(bake(S, S, flareFn(2, true, 0)), "flare4"),
    flare4Chroma: toTexture(bake(S, S, flareFn(2, true, 1)), "flare4Chroma"),
    flare6: toTexture(bake(S, S, flareFn(3, false, 0)), "flare6"),
    streak: toTexture(bake(S, 64, streakFn(0)), "streak"),
    streakChroma: toTexture(bake(S, 64, streakFn(1)), "streakChroma"),
    bokehRound: toTexture(bake(S, S, bokehFn(false, 0.02)), "bokehRound"),
    bokehSoft: toTexture(bake(S, S, bokehFn(false, 0.09)), "bokehSoft"),
    bokehHex: toTexture(bake(S, S, bokehFn(true, 0.025)), "bokehHex"),
    ring: toTexture(bake(S, S, (u, v) => {
      const r = Math.hypot(u, v);
      const val = (Math.exp(-((r - 0.8) ** 2) / (2 * 0.04 * 0.04)) + 0.12 * (1 - smooth(0.7, 0.82, r))) * rim(r);
      return [val, val, val];
    }), "ring"),
  };
  return cached;
};
