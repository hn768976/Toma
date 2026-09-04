import { mulberry32, smoothstep, type Rng } from "./prng";

/**
 * Seamlessly tiling value-noise fBm, baked once into an alpha texture.
 *
 * The fog is built from these rather than from a flat gradient — that internal
 * structure of wisps and density variation is the difference between fog and a
 * fog filter. Because the lattice wraps, the texture can be scrolled and drawn
 * twice to give an endlessly drifting plane with no seam.
 */

const lattice = (rng: Rng, gx: number, gy: number) => {
  const values = new Float32Array(gx * gy);
  for (let i = 0; i < values.length; i++) values[i] = rng();
  return values;
};

const sample = (
  values: Float32Array,
  gx: number,
  gy: number,
  u: number,
  v: number,
) => {
  const x = u * gx;
  const y = v * gy;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  // Wrapping lattice indices are what make the result tile.
  const xa = ((x0 % gx) + gx) % gx;
  const xb = (xa + 1) % gx;
  const ya = ((y0 % gy) + gy) % gy;
  const yb = (ya + 1) % gy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const v00 = values[ya * gx + xa];
  const v10 = values[ya * gx + xb];
  const v01 = values[yb * gx + xa];
  const v11 = values[yb * gx + xb];
  const top = v00 + (v10 - v00) * sx;
  const bottom = v01 + (v11 - v01) * sx;
  return top + (bottom - top) * sy;
};

export type FogTextureOptions = {
  seed: number;
  width: number;
  height: number;
  /** Base lattice cells across the texture. Lower = larger fog masses. */
  cellsX: number;
  cellsY: number;
  octaves: number;
  /** Contrast window applied to the summed noise. */
  lo: number;
  hi: number;
};

const fogCache = new Map<string, HTMLCanvasElement>();

export const makeFogTexture = (opts: FogTextureOptions): HTMLCanvasElement => {
  const cacheKey = JSON.stringify(opts);
  const hit = fogCache.get(cacheKey);
  if (hit) return hit;

  const { seed, width, height, cellsX, cellsY, octaves, lo, hi } = opts;
  const rng = mulberry32(seed);
  const layers: { values: Float32Array; gx: number; gy: number; amp: number }[] =
    [];
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const gx = cellsX * 2 ** o;
    const gy = Math.max(2, cellsY * 2 ** o);
    layers.push({ values: lattice(rng, gx, gy), gx, gy, amp });
    norm += amp;
    amp *= 0.52;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  const p = img.data;

  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      let n = 0;
      for (const l of layers) n += l.amp * sample(l.values, l.gx, l.gy, u, v);
      n /= norm;
      const a = smoothstep(lo, hi, n);
      const i = (y * width + x) * 4;
      p[i] = 255;
      p[i + 1] = 255;
      p[i + 2] = 255;
      p[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  fogCache.set(cacheKey, canvas);
  return canvas;
};

/**
 * Fine grain tiles. Large soft gradients in a dark frame are the worst case for
 * H.264 banding; a couple of percent of grain dithers the ramps apart. Six
 * tiles cycled per frame divides evenly into 900, so the grain loops too.
 */
export const GRAIN_TILES = 6;
export const GRAIN_SIZE = 512;

const grainCache: HTMLCanvasElement[] = [];

export const getGrainTiles = (): HTMLCanvasElement[] => {
  if (grainCache.length) return grainCache;
  for (let t = 0; t < GRAIN_TILES; t++) {
    const rng = mulberry32(9001 + t * 7717);
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_SIZE;
    canvas.height = GRAIN_SIZE;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(GRAIN_SIZE, GRAIN_SIZE);
    const p = img.data;
    for (let i = 0; i < p.length; i += 4) {
      const v = Math.round(rng() * 255);
      p[i] = v;
      p[i + 1] = v;
      p[i + 2] = v;
      p[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grainCache.push(canvas);
  }
  return grainCache;
};
