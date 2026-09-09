import { clamp, smoothstep } from "./math";
import { Palette } from "./palette";
import { hash01 } from "./random";

/**
 * Scratch canvases are cached per size so the post chain does not reallocate
 * on every frame. Keyed by dimensions, since a single render only ever uses
 * one composition size.
 */
const scratch = new Map<string, HTMLCanvasElement>();

const getScratch = (key: string, w: number, h: number) => {
  const id = `${key}:${w}x${h}`;
  let c = scratch.get(id);
  if (!c) {
    c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    scratch.set(id, c);
  }
  return c;
};

const ctx2d = (c: HTMLCanvasElement) => c.getContext("2d", { willReadFrequently: true })!;

export const BLOOM_THRESHOLD = 0.55;
export const BLOOM_STRENGTH = 1.1;

/**
 * Threshold-and-blur bloom. Done at 1/4 and 1/8 scale and composited back
 * additively, which is what gives the "wide radius" without a full-res blur.
 */
export const applyBloom = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
) => {
  const bw = Math.max(2, Math.round(width / 4));
  const bh = Math.max(2, Math.round(height / 4));
  const sw = Math.max(2, Math.round(bw / 2));
  const sh = Math.max(2, Math.round(bh / 2));

  const down = getScratch("bloomDown", bw, bh);
  const dctx = ctx2d(down);
  dctx.globalCompositeOperation = "source-over";
  dctx.filter = "none";
  dctx.clearRect(0, 0, bw, bh);
  dctx.drawImage(source, 0, 0, bw, bh);

  // Soft-knee threshold.
  const img = dctx.getImageData(0, 0, bw, bh);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    const k = smoothstep(BLOOM_THRESHOLD, BLOOM_THRESHOLD + 0.28, lum);
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
    d[i + 3] = 255;
  }
  dctx.putImageData(img, 0, 0);

  // Narrow tap.
  const blurA = getScratch("bloomA", bw, bh);
  const actx = ctx2d(blurA);
  actx.globalCompositeOperation = "source-over";
  actx.clearRect(0, 0, bw, bh);
  actx.filter = `blur(${Math.max(2, bw * 0.005).toFixed(2)}px)`;
  actx.drawImage(down, 0, 0);
  actx.filter = "none";

  // Wide tap, at half again the resolution.
  const blurB = getScratch("bloomB", sw, sh);
  const bctx = ctx2d(blurB);
  bctx.globalCompositeOperation = "source-over";
  bctx.clearRect(0, 0, sw, sh);
  bctx.filter = `blur(${Math.max(3, sw * 0.014).toFixed(2)}px)`;
  bctx.drawImage(down, 0, 0, sw, sh);
  bctx.filter = "none";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.globalAlpha = BLOOM_STRENGTH * 0.55;
  ctx.drawImage(blurA, 0, 0, width, height);
  ctx.globalAlpha = BLOOM_STRENGTH * 0.45;
  ctx.drawImage(blurB, 0, 0, width, height);
  ctx.restore();
};

/**
 * One subtle horizontal anamorphic streak across the centre. Gated hard on
 * speed so it only shows up in the fastest stretch of the arc; in loop mode
 * the speed is pinned at 1, so it sits at a constant low level and stays
 * seamless.
 */
export const FLARE_MAX_OPACITY = 0.24;

export const applyAnamorphicFlare = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: Palette,
  speedNormValue: number,
) => {
  const amount = smoothstep(0.9, 1, speedNormValue);
  if (amount <= 0.001) return;
  const a = FLARE_MAX_OPACITY * amount;

  const cx = width / 2;
  const cy = height / 2;
  const [mr, mg, mb] = palette.mid;
  const [ir, ig, ib] = palette.inner;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.translate(cx, cy);
  ctx.scale(width * 0.6, height * 0.011);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  g.addColorStop(0, `rgba(${ir},${ig},${ib},${a})`);
  g.addColorStop(0.22, `rgba(${mr},${mg},${mb},${a * 0.45})`);
  g.addColorStop(0.6, `rgba(${mr},${mg},${mb},${a * 0.12})`);
  g.addColorStop(1, `rgba(${mr},${mg},${mb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

export const applyVignette = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.hypot(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, r * 0.42, cx, cy, r);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(0.72, "rgba(0,0,0,0.16)");
  g.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

/**
 * Fine grain. The tiles are built once and cycled by frame; 12 of them divides
 * the 600-frame loop exactly, so the grain lands back on tile 0 at the seam.
 */
export const GRAIN_TILES = 12;
export const GRAIN_STRENGTH = 0.015;
const GRAIN_TILE_SIZE = 1024;

let grainTiles: HTMLCanvasElement[] | null = null;

const getGrainTiles = () => {
  if (grainTiles) return grainTiles;
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < GRAIN_TILES; t++) {
    const c = document.createElement("canvas");
    c.width = GRAIN_TILE_SIZE;
    c.height = GRAIN_TILE_SIZE;
    const cx = c.getContext("2d")!;
    const img = cx.createImageData(GRAIN_TILE_SIZE, GRAIN_TILE_SIZE);
    const d = img.data;
    // Deterministic noise: a plain LCG walked over the tile, seeded per tile.
    let s = (t * 0x9e3779b1 + 0x1234567) | 0;
    for (let i = 0; i < d.length; i += 4) {
      s = (Math.imul(s, 1664525) + 1013904223) | 0;
      const v = ((s >>> 8) & 0xff);
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = v;
    }
    cx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  grainTiles = tiles;
  return tiles;
};

export const applyGrain = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
) => {
  const tiles = getGrainTiles();
  const idx = ((frame % GRAIN_TILES) + GRAIN_TILES) % GRAIN_TILES;
  const tile = tiles[idx];
  // Deterministic per-frame offset so the tile seams never sit still.
  const ox = -Math.floor(hash01(idx, 11) * GRAIN_TILE_SIZE);
  const oy = -Math.floor(hash01(idx, 29) * GRAIN_TILE_SIZE);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = clamp(GRAIN_STRENGTH * 1.6, 0, 1);
  ctx.imageSmoothingEnabled = false;
  for (let y = oy; y < height; y += GRAIN_TILE_SIZE) {
    for (let x = ox; x < width; x += GRAIN_TILE_SIZE) {
      ctx.drawImage(tile, x, y);
    }
  }
  ctx.restore();
};
