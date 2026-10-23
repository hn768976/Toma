import { fbm, mulberry32, range } from "./random";
import { MicrobePalette } from "./palettes";
import { DESIGN_H, DESIGN_W } from "./worms";

// Expensive one-off bitmaps, cached per browser tab and reused for every
// frame that tab renders.
const cache = new Map<string, HTMLCanvasElement>();

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// Low-frequency mottling of the slide. Rendered small and upscaled with
// bilinear filtering, which is all a soft cloud needs.
export const cloudTexture = (p: MicrobePalette) => {
  const key = `cloud-${p.id}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const w = 520;
  const h = 300;
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(x / 48, y / 48, 11, 5);
      const v = Math.min(1, Math.max(0, (n - 0.5) * 1.7 + 0.5));
      const i = (y * w + x) * 4;
      img.data[i] = p.cloudDark[0] + (p.cloudLight[0] - p.cloudDark[0]) * v;
      img.data[i + 1] = p.cloudDark[1] + (p.cloudLight[1] - p.cloudDark[1]) * v;
      img.data[i + 2] = p.cloudDark[2] + (p.cloudLight[2] - p.cloudDark[2]) * v;
      img.data[i + 3] = 255 * p.cloudAlpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
};

export const grainTile = () => {
  const hit = cache.get("grain");
  if (hit) return hit;
  const size = 512;
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const rng = mulberry32(99);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rng() - 0.5) * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cache.set("grain", c);
  return c;
};

export type Speck = { x: number; y: number; r: number; a: number; soft: boolean };

let specks: Speck[] | null = null;

// Fine debris on the slide plus a few large out-of-focus dust motes.
export const getSpecks = (): Speck[] => {
  if (specks) return specks;
  const rng = mulberry32(4242);
  const out: Speck[] = [];
  for (let i = 0; i < 700; i++) {
    out.push({
      x: range(rng, -60, DESIGN_W + 60),
      y: range(rng, -60, DESIGN_H + 60),
      r: rng() < 0.85 ? range(rng, 0.8, 1.8) : range(rng, 1.8, 3.2),
      a: range(rng, 0.25, 0.75),
      soft: false,
    });
  }
  for (let i = 0; i < 14; i++) {
    out.push({
      x: range(rng, 0, DESIGN_W),
      y: range(rng, 0, DESIGN_H),
      r: range(rng, 9, 18),
      a: range(rng, 0.12, 0.22),
      soft: true,
    });
  }
  specks = out;
  return out;
};

export const scratchCanvas = (key: string, w: number, h: number) => {
  const k = `scratch-${key}-${w}x${h}`;
  let c = cache.get(k);
  if (!c) {
    c = makeCanvas(w, h);
    cache.set(k, c);
  }
  return c;
};
