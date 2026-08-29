import {random} from 'remotion';

export const createBuffer = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export const ctx2d = (c: HTMLCanvasElement): CanvasRenderingContext2D => {
  const ctx = c.getContext('2d', {alpha: true});
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Every colour in this project starts life as a palette hex; this adds alpha. */
export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Seeded pick from a list. */
export const pick = <T,>(list: readonly T[], seed: string): T =>
  list[Math.floor(random(seed) * list.length) % list.length];

/** Seeded integer in [min, max]. */
export const randInt = (min: number, max: number, seed: string): number =>
  min + Math.floor(random(seed) * (max - min + 1));

/** Seeded float in [min, max). */
export const randRange = (min: number, max: number, seed: string): number =>
  min + random(seed) * (max - min);

/**
 * Manual letterspacing. ctx.letterSpacing is not dependable across the versions
 * of headless Chrome Remotion may pull, and drawing per glyph also lets the
 * chromatic fringe reuse the exact same advance positions.
 */
export const trackedWidth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number => {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return w - tracking;
};

export const drawTrackedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  left: number,
  baseline: number,
  tracking: number,
): void => {
  let x = left;
  for (const ch of text) {
    ctx.fillText(ch, x, baseline);
    x += ctx.measureText(ch).width + tracking;
  }
};

/**
 * Isolate one colour channel of a source region by multiplying it down. Used to
 * fringe torn slices: red pulled one way, blue the other, recombined additively.
 */
export const isolateChannel = (
  scratch: HTMLCanvasElement,
  source: CanvasImageSource,
  sx: number,
  sy: number,
  w: number,
  h: number,
  mask: 'r' | 'g' | 'b',
): HTMLCanvasElement => {
  const c = ctx2d(scratch);
  c.save();
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.clearRect(0, 0, scratch.width, scratch.height);
  c.drawImage(source, sx, sy, w, h, 0, 0, w, h);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = mask === 'r' ? 'rgb(255,0,0)' : mask === 'g' ? 'rgb(0,255,0)' : 'rgb(0,0,255)';
  c.fillRect(0, 0, w, h);
  c.restore();
  return scratch;
};

/**
 * Pre-rendered noise tiles. Generating 4K of per-pixel grain every frame is far
 * too slow, so a handful of tiles are built once and tiled with a seeded offset.
 */
export const buildGrainTiles = (count: number, size: number): HTMLCanvasElement[] => {
  const tiles: HTMLCanvasElement[] = [];
  for (let t = 0; t < count; t++) {
    const c = createBuffer(size, size);
    const ctx = ctx2d(c);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = random(`grain-${t}-${i}`);
      const level = v < 0.5 ? 0 : 255;
      img.data[i * 4] = level;
      img.data[i * 4 + 1] = level;
      img.data[i * 4 + 2] = level;
      img.data[i * 4 + 3] = Math.floor(random(`grain-a-${t}-${i}`) * 255);
    }
    ctx.putImageData(img, 0, 0);
    tiles.push(c);
  }
  return tiles;
};

/** Blend two palette hexes. Keeps colour decisions anchored to the variant. */
export const mixHex = (a: string, b: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = clamp01(t);
  return `rgb(${Math.round(lerp(r1, r2, m))},${Math.round(lerp(g1, g2, m))},${Math.round(
    lerp(b1, b2, m),
  )})`;
};
