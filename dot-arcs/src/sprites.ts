import {
  blurRadiusAt,
  bucketCenterT,
  brightnessAt,
  defocusAt,
  dotRadiusAt,
  FOCUS_T,
  N_BUCKETS,
} from './layout';
import { clamp, lerp, mulberry32, smoothstep, smootherstep } from './rng';
import type { Palette } from './palettes';

export type SpriteSet = {
  /** [bucket][colour] soft defocus discs, colour and layer brightness baked in. */
  disc: HTMLCanvasElement[][];
  /** Reference disc radius each bucket's sprite was rasterised for, in device px. */
  discRadiusPx: number[];
  /** Whether the bucket is inside the sharp band and should be path-filled. */
  sharp: boolean[];
  /** [colour] bloom halo, sharp band only. */
  bloom: HTMLCanvasElement[];
  bloomRadiusPx: number;
  grain: HTMLCanvasElement[];
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/**
 * A defocus disc is not a Gaussian blob: it has a near-flat core and a soft
 * edge whose width is the blur radius. Rasterising the profile analytically
 * gives a truer bokeh than blurring a small dot, and dithering the falloff
 * keeps the big near discs from ringing in H.264.
 */
const buildDisc = (
  radiusPx: number,
  core: number,
  rgb: [number, number, number],
  bright: number,
  seed: number,
) => {
  const ss = clamp(Math.round(28 / Math.max(1, radiusPx)), 1, 4);
  const r = Math.max(1, radiusPx * ss);
  const size = Math.ceil(r * 2) + 2;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const cx = size / 2;
  const cy = size / 2;
  const rand = mulberry32(seed);
  const rr = Math.round(rgb[0] * bright);
  const gg = Math.round(rgb[1] * bright);
  const bb = Math.round(rgb[2] * bright);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const rho = Math.sqrt(dx * dx + dy * dy) / r;
      let a = 1 - smootherstep(core, 1, rho);
      if (a > 0) {
        a += (rand() - 0.5) * (1.6 / 255);
        a = clamp(a, 0, 1);
      }
      const o = (y * size + x) * 4;
      d[o] = rr;
      d[o + 1] = gg;
      d[o + 2] = bb;
      d[o + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

const buildBloom = (radiusPx: number, rgb: [number, number, number]) => {
  const r = Math.max(4, radiusPx);
  const size = Math.ceil(r * 2) + 2;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const mid = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - mid;
      const dy = y + 0.5 - mid;
      const rho = Math.min(1, Math.sqrt(dx * dx + dy * dy) / r);
      const a = Math.pow(1 - rho, 2.8);
      const o = (y * size + x) * 4;
      d[o] = rgb[0];
      d[o + 1] = rgb[1];
      d[o + 2] = rgb[2];
      d[o + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/**
 * Zero-mean grain: half the pixels lift, half sink, so the mean level is
 * unchanged but the dark background and the bokeh gradients get dithered.
 */
const buildGrain = (size: number, seed: number, strength: number) => {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const rand = mulberry32(seed);
  for (let i = 0; i < size * size; i++) {
    const up = rand() < 0.5;
    const v = Math.round(rand() * strength * 255);
    const o = i * 4;
    d[o] = up ? 255 : 0;
    d[o + 1] = up ? 255 : 0;
    d[o + 2] = up ? 255 : 0;
    d[o + 3] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

const cache = new Map<string, SpriteSet>();

export const getSprites = (palette: Palette, heightPx: number): SpriteSet => {
  const key = `${palette.id}|${Math.round(heightPx)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const disc: HTMLCanvasElement[][] = [];
  const discRadiusPx: number[] = [];
  const sharp: boolean[] = [];

  for (let b = 0; b < N_BUCKETS; b++) {
    const t = bucketCenterT(b);
    const dot = dotRadiusAt(t);
    const blur = blurRadiusAt(t);
    const radiusPx = (dot + blur) * heightPx;
    // A real defocus disc keeps a broad flat body and a soft rim; letting the
    // falloff eat the whole radius turns it into a glow and inverts the depth.
    const core = clamp(
      lerp(0.95, 0.36, smoothstep(0.02, 0.65, defocusAt(t))),
      0.34,
      0.94,
    );
    discRadiusPx.push(radiusPx);
    sharp.push(blur * heightPx < 1.1);
    const row: HTMLCanvasElement[] = [];
    for (let ci = 0; ci < palette.dots.length; ci++) {
      row.push(
        buildDisc(
          radiusPx,
          core,
          palette.dots[ci],
          brightnessAt(t),
          0x9e11 + b * 131 + ci * 17,
        ),
      );
    }
    disc.push(row);
  }

  const bloomRadiusPx = dotRadiusAt(FOCUS_T) * 5.5 * heightPx;
  const bloom = palette.dots.map((rgb) => buildBloom(bloomRadiusPx, rgb));

  const grainSize = clamp(Math.round(heightPx / 5), 128, 512);
  const grain = [0, 1, 2, 3, 4, 5].map((i) =>
    buildGrain(grainSize, 0x61a17 + i * 977, 0.022),
  );

  const set: SpriteSet = {
    disc,
    discRadiusPx,
    sharp,
    bloom,
    bloomRadiusPx,
    grain,
  };
  cache.set(key, set);
  return set;
};
