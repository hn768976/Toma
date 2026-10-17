import * as THREE from "three";
import { mulberry32, Rng } from "../lib/random";

/**
 * Tileable 3D noise volumes for the cloud raymarcher, built once from fixed
 * seeds (Schneider / Horizon Zero Dawn layout):
 *  - base   128^3 RGBA: R = Perlin-Worley, GBA = Worley fBm at 4 / 8 / 16
 *  - detail  32^3 RGBA: RGB = Worley fBm at 2 / 4 / 8
 *  - curl    32^3 RGBA: RGB = curl of a tileable Perlin vector potential
 */

const fract = (x: number) => x - Math.floor(x);

/** Tileable gradient noise with integer lattice period `period`. */
const makePerlin = (rng: Rng, period: number) => {
  const n = period * period * period;
  const g = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    // Uniform direction on the sphere.
    const z = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    g[i * 3] = r * Math.cos(a);
    g[i * 3 + 1] = r * Math.sin(a);
    g[i * 3 + 2] = z;
  }
  const idx = (x: number, y: number, z: number) =>
    ((((z % period) + period) % period) * period + (((y % period) + period) % period)) * period +
    (((x % period) + period) % period);
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  // x,y,z in lattice units (0..period tiles)
  return (x: number, y: number, z: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const xf = x - xi;
    const yf = y - yi;
    const zf = z - zi;
    let res = 0;
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);
    for (let c = 0; c < 8; c++) {
      const dx = c & 1;
      const dy = (c >> 1) & 1;
      const dz = (c >> 2) & 1;
      const k = idx(xi + dx, yi + dy, zi + dz) * 3;
      const d = g[k] * (xf - dx) + g[k + 1] * (yf - dy) + g[k + 2] * (zf - dz);
      res += d * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
    }
    return res; // ~[-0.9, 0.9]
  };
};

/** Tileable Worley (cellular) noise, `cells` per tile. Returns 1 - F1. */
const makeWorley = (rng: Rng, cells: number) => {
  const n = cells * cells * cells;
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) pts[i] = rng();
  // u,v,w in tile units [0,1)
  return (u: number, v: number, w: number) => {
    const x = u * cells;
    const y = v * cells;
    const z = w * cells;
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    let best = 1e9;
    for (let dz = -1; dz <= 1; dz++) {
      const cz = zi + dz;
      const wz = ((cz % cells) + cells) % cells;
      for (let dy = -1; dy <= 1; dy++) {
        const cy = yi + dy;
        const wy = ((cy % cells) + cells) % cells;
        for (let dx = -1; dx <= 1; dx++) {
          const cx = xi + dx;
          const wx = ((cx % cells) + cells) % cells;
          const k = ((wz * cells + wy) * cells + wx) * 3;
          const px = cx + pts[k] - x;
          const py = cy + pts[k + 1] - y;
          const pz = cz + pts[k + 2] - z;
          const d = px * px + py * py + pz * pz;
          if (d < best) best = d;
        }
      }
    }
    return 1 - Math.min(1, Math.sqrt(best));
  };
};

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const remap = (v: number, l0: number, h0: number, l1: number, h1: number) =>
  l1 + ((v - l0) * (h1 - l1)) / (h0 - l0);

const toTexture = (data: Uint8Array, size: number) => {
  const t = new THREE.Data3DTexture(data, size, size, size);
  t.format = THREE.RGBAFormat;
  t.type = THREE.UnsignedByteType;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.wrapR = THREE.RepeatWrapping;
  t.generateMipmaps = false;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
};

const buildBase = (size = 128) => {
  const rng = mulberry32(0xc10d0001);
  const perlin = [4, 8, 16, 32].map((p) => ({ p, f: makePerlin(rng, p) }));
  const worley = [4, 8, 16, 32, 64].map((c) => makeWorley(rng, c));
  const data = new Uint8Array(size * size * size * 4);
  let o = 0;
  for (let z = 0; z < size; z++) {
    const w = (z + 0.5) / size;
    for (let y = 0; y < size; y++) {
      const v = (y + 0.5) / size;
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        let pf = 0;
        let amp = 1;
        let tot = 0;
        for (const { p, f } of perlin) {
          pf += f(u * p, v * p, w * p) * amp;
          tot += amp;
          amp *= 0.5;
        }
        pf = clamp01((pf / tot) * 1.4 + 0.5);
        const w4 = worley[0](u, v, w);
        const w8 = worley[1](u, v, w);
        const w16 = worley[2](u, v, w);
        const w32 = worley[3](u, v, w);
        const w64 = worley[4](u, v, w);
        const fbm4 = w4 * 0.625 + w8 * 0.25 + w16 * 0.125;
        const fbm8 = w8 * 0.625 + w16 * 0.25 + w32 * 0.125;
        const fbm16 = w16 * 0.625 + w32 * 0.25 + w64 * 0.125;
        // Perlin-Worley: Perlin dilated by inverted billowy Worley.
        const pw = clamp01(remap(pf, 0, 1, fbm4 * 0.95 - 0.05, 1));
        data[o++] = Math.round(pw * 255);
        data[o++] = Math.round(clamp01(fbm4) * 255);
        data[o++] = Math.round(clamp01(fbm8) * 255);
        data[o++] = Math.round(clamp01(fbm16) * 255);
      }
    }
  }
  return toTexture(data, size);
};

const buildDetail = (size = 32) => {
  const rng = mulberry32(0xc10d0002);
  const worley = [2, 4, 8, 16, 32].map((c) => makeWorley(rng, c));
  const data = new Uint8Array(size * size * size * 4);
  let o = 0;
  for (let z = 0; z < size; z++) {
    const w = (z + 0.5) / size;
    for (let y = 0; y < size; y++) {
      const v = (y + 0.5) / size;
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const a = worley.map((f) => f(u, v, w));
        const f2 = a[0] * 0.625 + a[1] * 0.25 + a[2] * 0.125;
        const f4 = a[1] * 0.625 + a[2] * 0.25 + a[3] * 0.125;
        const f8 = a[2] * 0.625 + a[3] * 0.25 + a[4] * 0.125;
        data[o++] = Math.round(clamp01(f2) * 255);
        data[o++] = Math.round(clamp01(f4) * 255);
        data[o++] = Math.round(clamp01(f8) * 255);
        data[o++] = 255;
      }
    }
  }
  return toTexture(data, size);
};

const buildCurl = (size = 32) => {
  const rng = mulberry32(0xc10d0003);
  const P = 4;
  const px = makePerlin(rng, P);
  const py = makePerlin(rng, P);
  const pz = makePerlin(rng, P);
  const e = 0.5 / size;
  const s = (f: typeof px, u: number, v: number, w: number) => f(u * P, v * P, w * P);
  const data = new Uint8Array(size * size * size * 4);
  let o = 0;
  for (let z = 0; z < size; z++) {
    const w = (z + 0.5) / size;
    for (let y = 0; y < size; y++) {
      const v = (y + 0.5) / size;
      for (let x = 0; x < size; x++) {
        const u = (x + 0.5) / size;
        const dPzdy = s(pz, u, v + e, w) - s(pz, u, v - e, w);
        const dPydz = s(py, u, v, w + e) - s(py, u, v, w - e);
        const dPxdz = s(px, u, v, w + e) - s(px, u, v, w - e);
        const dPzdx = s(pz, u + e, v, w) - s(pz, u - e, v, w);
        const dPydx = s(py, u + e, v, w) - s(py, u - e, v, w);
        const dPxdy = s(px, u, v + e, w) - s(px, u, v - e, w);
        let cx = dPzdy - dPydz;
        let cy = dPxdz - dPzdx;
        let cz = dPydx - dPxdy;
        const len = Math.hypot(cx, cy, cz) || 1;
        const mag = Math.min(1, len / (2 * e * P * 1.6));
        cx = (cx / len) * mag;
        cy = (cy / len) * mag;
        cz = (cz / len) * mag;
        data[o++] = Math.round((cx * 0.5 + 0.5) * 255);
        data[o++] = Math.round((cy * 0.5 + 0.5) * 255);
        data[o++] = Math.round((cz * 0.5 + 0.5) * 255);
        data[o++] = 255;
      }
    }
  }
  return toTexture(data, size);
};

export type CloudNoise = {
  base: THREE.Data3DTexture;
  detail: THREE.Data3DTexture;
  curl: THREE.Data3DTexture;
};

let cached: CloudNoise | null = null;
export const getCloudNoise = (): CloudNoise => {
  if (!cached) {
    cached = { base: buildBase(), detail: buildDetail(), curl: buildCurl() };
  }
  return cached;
};

export const __test = { fract };
