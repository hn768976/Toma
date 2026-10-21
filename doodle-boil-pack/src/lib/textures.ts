import { mulberry32 } from "./random";

// Grain textures, generated once per browser tab from fixed seeds and reused.
// Each is a white tile whose alpha is the mask. 1 tile pixel = 1 composition unit (4K pixel).

export const TILE = 1024;

const smooth = (t: number) => t * t * (3 - 2 * t);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Seamless value noise over the tile, lattice cell `cell` px, values 0..1. */
const valueNoise = (seed: number, cell: number): Float32Array => {
  const rng = mulberry32(seed);
  const g = Math.max(1, Math.round(TILE / cell));
  const lattice = new Float32Array(g * g).map(() => rng());
  const out = new Float32Array(TILE * TILE);
  const step = g / TILE;
  for (let y = 0; y < TILE; y++) {
    const fy = y * step;
    const iy = Math.floor(fy);
    const ty = smooth(fy - iy);
    const r0 = (iy % g) * g;
    const r1 = ((iy + 1) % g) * g;
    for (let x = 0; x < TILE; x++) {
      const fx = x * step;
      const ix = Math.floor(fx);
      const tx = smooth(fx - ix);
      const c0 = ix % g;
      const c1 = (ix + 1) % g;
      const a = lattice[r0 + c0] + (lattice[r0 + c1] - lattice[r0 + c0]) * tx;
      const b = lattice[r1 + c0] + (lattice[r1 + c1] - lattice[r1 + c0]) * tx;
      out[y * TILE + x] = a + (b - a) * ty;
    }
  }
  return out;
};

const fbm = (seed: number, cells: number[], weights: number[]): Float32Array => {
  const out = new Float32Array(TILE * TILE);
  const wsum = weights.reduce((a, b) => a + b, 0);
  cells.forEach((c, k) => {
    const n = valueNoise(seed + k * 7919, c);
    const w = weights[k] / wsum;
    for (let i = 0; i < out.length; i++) out[i] += n[i] * w;
  });
  return out;
};

/** White speckle, 1 in `density` pixels, used for hard pinholes. */
const speckle = (seed: number, density: number): Uint8Array => {
  const rng = mulberry32(seed);
  const out = new Uint8Array(TILE * TILE);
  for (let i = 0; i < out.length; i++) if (rng() < density) out[i] = 1;
  return out;
};

const toCanvas = (alpha: (i: number) => number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = TILE;
  c.height = TILE;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(TILE, TILE);
  for (let i = 0; i < TILE * TILE; i++) {
    img.data[i * 4] = 255;
    img.data[i * 4 + 1] = 255;
    img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, alpha(i))));
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

export type TextureName = "chalkCore" | "crayonCore" | "paperSpeckle";

const builders: Record<TextureName, () => HTMLCanvasElement> = {
  // Inside the stroke: tone, not transparency. Drawn as a slightly greyer colour on top of
  // a solid core, so nothing inside a stroke is see-through (no green inside after keying).
  chalkCore: () => {
    const n = fbm(202, [4, 9, 20], [0.4, 0.35, 0.25]);
    const pin = speckle(203, 0.012);
    return toCanvas((i) => (pin[i] ? 0.9 : 0.6 * (1 - smoothstep(0.25, 0.5, n[i]))));
  },
  crayonCore: () => {
    const a = fbm(401, [3, 6, 14], [0.35, 0.35, 0.3]);
    const pin = speckle(402, 0.006);
    return toCanvas((i) => (pin[i] ? 0.9 : 0.7 * (1 - smoothstep(0.28, 0.5, a[i]))));
  },
  // Faint paper grain for the cream fill: sparse darker flecks.
  paperSpeckle: () => {
    const a = fbm(601, [5, 12, 30], [0.4, 0.35, 0.25]);
    return toCanvas((i) => 0.55 * smoothstep(0.6, 0.74, a[i]));
  },
};

const cache = new Map<TextureName, HTMLCanvasElement>();

export type EdgeName = "chalk" | "crayon" | "brush";

// Raw noise (0..1) that decides where an edge bites in or bulges out.
const edgeBuilders: Record<EdgeName, () => Float32Array> = {
  chalk: () => fbm(101, [4, 10, 28], [0.35, 0.4, 0.25]),
  crayon: () => fbm(301, [5, 12, 32], [0.3, 0.4, 0.3]),
  brush: () => fbm(501, [3, 9, 30], [0.3, 0.35, 0.35]),
};
const edgeCache = new Map<EdgeName, Float32Array>();

export const edgeNoise = (name: EdgeName): Float32Array => {
  let n = edgeCache.get(name);
  if (!n) {
    n = edgeBuilders[name]();
    edgeCache.set(name, n);
  }
  return n;
};

export const texture = (name: TextureName): HTMLCanvasElement => {
  let c = cache.get(name);
  if (!c) {
    c = builders[name]();
    cache.set(name, c);
  }
  return c;
};
