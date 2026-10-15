// Tileable fbm value-noise textures, generated deterministically in JS once.
// Shaders sample these instead of evaluating hash noise per pixel, which is
// far cheaper on software GL (SwiftShader) and identical on real GPUs.
import { BufferImageSource, Texture } from "pixi.js";
import { mulberry32 } from "./rand";

const valueNoisePeriodic = (size: number, cells: number, seed: number) => {
  const r = mulberry32(seed);
  const g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const iy = Math.floor(fy);
    let ty = fy - iy;
    ty = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
    const y0 = iy % cells, y1 = (iy + 1) % cells;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const ix = Math.floor(fx);
      let tx = fx - ix;
      tx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
      const x0 = ix % cells, x1 = (ix + 1) % cells;
      const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1];
      out[y * size + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
};

/** fbm with `octaves`, base `cells` per tile; normalised to roughly [0,1]. */
export const fbmPeriodic = (size: number, cells: number, octaves: number, seed: number) => {
  const acc = new Float32Array(size * size);
  let amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const c = cells << o;
    if (c > size) break;
    const n = valueNoisePeriodic(size, c, seed + o * 7919);
    for (let i = 0; i < acc.length; i++) acc[i] += n[i] * amp;
    norm += amp;
    amp *= 0.5;
  }
  // Stretch contrast to use the range (fbm clusters around 0.5).
  for (let i = 0; i < acc.length; i++) acc[i] = Math.min(1, Math.max(0, (acc[i] / norm - 0.5) * 1.9 + 0.5));
  return acc;
};

/** RGBA float texture; each channel an independent fbm (cells, octaves). */
export const noiseTexture = (size: number, channels: [number, number][], seed: number) => {
  const data = new Float32Array(size * size * 4);
  channels.forEach(([cells, oct], ch) => {
    const n = fbmPeriodic(size, cells, oct, seed + ch * 1013);
    for (let i = 0; i < n.length; i++) data[i * 4 + ch] = n[i];
  });
  for (let ch = channels.length; ch < 4; ch++) for (let i = 0; i < size * size; i++) data[i * 4 + ch] = 1;
  const t = new Texture({ source: new BufferImageSource({ resource: data, width: size, height: size, format: "rgba32float" }) });
  t.source.style.addressMode = "repeat";
  t.source.style.scaleMode = "linear";
  return t;
};
