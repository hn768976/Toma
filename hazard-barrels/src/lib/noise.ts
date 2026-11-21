import { mulberry32 } from "./random";

/**
 * Tileable 2D value noise on a lattice, built from the seeded PRNG.
 * `periodX` / `periodY` are lattice periods, so the result wraps cleanly
 * (needed for textures that wrap around a cylinder).
 */
export const makeValueNoise = (seed: number, periodX: number, periodY: number) => {
  const rnd = mulberry32(seed);
  const grid = new Float32Array(periodX * periodY);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const at = (x: number, y: number) =>
    grid[(((y % periodY) + periodY) % periodY) * periodX + (((x % periodX) + periodX) % periodX)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
};

/**
 * Fractal (multi-octave) tileable noise rendered into a greyscale canvas.
 * u wraps after `width` pixels. Values are 0..1 mapped to 0..255.
 */
export const noiseCanvas = (
  width: number,
  height: number,
  seed: number,
  baseCellsX: number,
  baseCellsY: number,
  octaves: number,
  gain = 0.5,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(width, height);
  const layers = Array.from({ length: octaves }, (_, o) => ({
    f: makeValueNoise(seed + o * 101, baseCellsX << o, baseCellsY << o),
    cx: baseCellsX << o,
    cy: baseCellsY << o,
    amp: Math.pow(gain, o),
  }));
  const norm = layers.reduce((s, l) => s + l.amp, 0);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0;
      for (const l of layers) v += l.amp * l.f((x / width) * l.cx, (y / height) * l.cy);
      const g = Math.max(0, Math.min(255, Math.round((v / norm) * 255)));
      const i = (y * width + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};
