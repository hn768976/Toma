import { mulberry32, seedOf } from "./rng";

// A fixed 256x256 tile of triangular-distributed noise in [-1, 1] (units of
// one 8-bit step). Added to the soft glow layers only, before rounding, so
// the gradients don't band. Flat backgrounds and pure black are never
// dithered (callers only add it where the glow is non-zero).
let tile: Float32Array | null = null;
export const ditherTile = () => {
  if (tile) return tile;
  const r = mulberry32(seedOf("dither-tile"));
  tile = new Float32Array(256 * 256);
  for (let i = 0; i < tile.length; i++) tile[i] = r() - r();
  return tile;
};

// Separable anisotropic gaussian blob, evaluated with precomputed row/column
// tables so a full-frame glow costs a few multiplies per pixel.
export type GlowBlob = {
  x: number; // design units
  y: number;
  rx: number; // sigma in design units
  ry: number;
  color: [number, number, number]; // 0..255
  a: number; // intensity
};

// Renders bg + additive glow blobs into an ImageData at device resolution.
// Returns the ImageData; ditherAmp is in 8-bit steps (1 = +/-1/255).
export const renderGlowField = (
  pw: number,
  ph: number,
  s: number,
  bg: [number, number, number],
  blobs: GlowBlob[],
  ditherAmp = 1,
): ImageData => {
  const img = new ImageData(pw, ph);
  const data = img.data;
  const tl = ditherTile();
  const cols = blobs.map((b) => {
    const gx = new Float32Array(pw);
    const sx = b.rx * s;
    const cx = b.x * s;
    for (let x = 0; x < pw; x++) {
      const d = (x + 0.5 - cx) / sx;
      gx[x] = Math.exp(-0.5 * d * d);
    }
    return gx;
  });
  const rows = blobs.map((b) => {
    const gy = new Float32Array(ph);
    const sy = b.ry * s;
    const cy = b.y * s;
    for (let y = 0; y < ph; y++) {
      const d = (y + 0.5 - cy) / sy;
      gy[y] = Math.exp(-0.5 * d * d);
    }
    return gy;
  });
  const n = blobs.length;
  const cr = blobs.map((b) => b.color[0] * b.a);
  const cg = blobs.map((b) => b.color[1] * b.a);
  const cb = blobs.map((b) => b.color[2] * b.a);
  for (let y = 0; y < ph; y++) {
    const trow = (y & 255) << 8;
    let i = y * pw * 4;
    for (let x = 0; x < pw; x++, i += 4) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < n; k++) {
        const w = cols[k][x] * rows[k][y];
        r += cr[k] * w;
        g += cg[k] * w;
        b += cb[k] * w;
      }
      const glow = r + g + b;
      if (glow < 0.5) {
        data[i] = bg[0];
        data[i + 1] = bg[1];
        data[i + 2] = bg[2];
      } else {
        // screen-ish soft add, then dither before quantizing
        const dz = tl[trow | (x & 255)] * ditherAmp;
        r = bg[0] + r * (1 - bg[0] / 255);
        g = bg[1] + g * (1 - bg[1] / 255);
        b = bg[2] + b * (1 - bg[2] / 255);
        data[i] = Math.round(r + dz);
        data[i + 1] = Math.round(g + dz);
        data[i + 2] = Math.round(b + dz);
      }
      data[i + 3] = 255;
    }
  }
  return img;
};
