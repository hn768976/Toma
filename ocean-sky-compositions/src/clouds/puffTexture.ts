import * as THREE from "three";
import { mulberry32 } from "../lib/random";

// A 2x2 atlas of cumulus "puff" sprites generated procedurally.
// Channels: R = opacity, G/B = surface normal x/y (0.5 = flat), A = thickness.
// Normals come from a height field built out of overlapping sphere caps, so
// each sprite shades like a lumpy cauliflower cloud instead of a flat disc.
export const ATLAS_CELLS = 2;
const CELL = 512;

const valueNoise = (seed: number) => {
  const rand = mulberry32(seed);
  const SIZE = 256;
  const table = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < table.length; i++) table[i] = rand();
  const at = (x: number, y: number) =>
    table[(((y % SIZE) + SIZE) % SIZE) * SIZE + (((x % SIZE) + SIZE) % SIZE)];
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  return (x: number, y: number, octaves = 4) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * f, y * f);
      f *= 2.03;
      amp *= 0.5;
    }
    return sum;
  };
};

const buildCell = (seed: number) => {
  const rand = mulberry32(seed);
  const fbm = valueNoise(seed * 7 + 3);
  // Coordinates: 0..1 with y pointing up. A main dome carries dozens of
  // smaller domes (billows), which in turn carry tiny bumps: the classic
  // cauliflower structure of cumulus tops.
  const DOME = { x: 0.5, y: 0.36, r: 0.3 };
  const domeH = (x: number, y: number) => {
    const dx = (x - DOME.x) / 1.05;
    const dy = y - DOME.y;
    const q = DOME.r * DOME.r - dx * dx - dy * dy;
    return q > 0 ? Math.sqrt(q) : 0;
  };
  type Blob = { x: number; y: number; r: number; base: number };
  const blobs: Blob[] = [];
  const addBlobs = (count: number, rMin: number, rMax: number, spread: number) => {
    for (let i = 0; i < count; i++) {
      const a = Math.PI * (-0.1 + 1.2 * rand());
      const d = DOME.r * spread * Math.sqrt(rand());
      const x = DOME.x + Math.cos(a) * d * 1.05;
      const y = DOME.y + Math.sin(a) * d;
      const r = rMin + (rMax - rMin) * rand();
      blobs.push({ x, y, r, base: domeH(x, y) * 0.78 });
    }
  };
  addBlobs(10, 0.09, 0.15, 0.85);
  addBlobs(9, 0.05, 0.09, 1.0);

  const h = new Float32Array(CELL * CELL);
  let maxH = 0;
  for (let j = 0; j < CELL; j++) {
    const y = (j + 0.5) / CELL;
    for (let i = 0; i < CELL; i++) {
      const x = (i + 0.5) / CELL;
      let best = domeH(x, y);
      for (const b of blobs) {
        const dx = x - b.x;
        const dy = y - b.y;
        const q = b.r * b.r - dx * dx - dy * dy;
        if (q > 0) {
          const v = b.base + Math.sqrt(q);
          if (v > best) best = v;
        }
      }
      // fine billowy detail on the surface
      const detail = fbm(x * 30, y * 30, 3) - 0.5;
      const val = best > 0 ? best + detail * 0.012 : 0;
      h[j * CELL + i] = val;
      if (val > maxH) maxH = val;
    }
  }
  // soften the height field so billows read as vapour, not solid spheres
  const blurPass = (src: Float32Array, horizontal: boolean, radius: number) => {
    const dst = new Float32Array(src.length);
    const n = radius * 2 + 1;
    for (let j = 0; j < CELL; j++) {
      for (let i = 0; i < CELL; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) {
          const ii = horizontal ? Math.min(CELL - 1, Math.max(0, i + k)) : i;
          const jj = horizontal ? j : Math.min(CELL - 1, Math.max(0, j + k));
          sum += src[jj * CELL + ii];
        }
        dst[j * CELL + i] = sum / n;
      }
    }
    return dst;
  };
  let soft = h;
  for (let pass = 0; pass < 2; pass++) {
    soft = blurPass(blurPass(soft, true, 8), false, 8);
  }
  h.set(soft);

  const out = new Uint8Array(CELL * CELL * 4);
  const get = (i: number, j: number) =>
    h[Math.min(CELL - 1, Math.max(0, j)) * CELL + Math.min(CELL - 1, Math.max(0, i))];
  const px = 1 / CELL;
  for (let j = 0; j < CELL; j++) {
    for (let i = 0; i < CELL; i++) {
      const x = (i + 0.5) / CELL;
      const y = (j + 0.5) / CELL;
      const hv = get(i, j);
      const dx = (get(i + 2, j) - get(i - 2, j)) / (4 * px);
      const dy = (get(i, j + 2) - get(i, j - 2)) / (4 * px);
      let nx = -dx * 0.45;
      let ny = -dy * 0.45;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= len;
      ny /= len;
      // ragged, soft silhouette
      const edgeNoise = fbm(x * 9 + 11, y * 9 + 5, 4) - 0.5;
      const bottom = Math.min(1, Math.max(0, (y - 0.1) / 0.16));
      const alpha =
        Math.min(1, Math.max(0, (hv + edgeNoise * 0.07 - 0.006) / 0.1)) *
        bottom;
      const k = (j * CELL + i) * 4;
      out[k] = Math.round(alpha * alpha * (3 - 2 * alpha) * 255);
      out[k + 1] = Math.round((nx * 0.5 + 0.5) * 255);
      out[k + 2] = Math.round((ny * 0.5 + 0.5) * 255);
      out[k + 3] = Math.round(Math.min(1, hv / maxH) * 255);
    }
  }
  return out;
};

let cached: THREE.DataTexture | null = null;

export const getPuffAtlas = () => {
  if (cached) return cached;
  const size = CELL * ATLAS_CELLS;
  const data = new Uint8Array(size * size * 4);
  for (let c = 0; c < ATLAS_CELLS * ATLAS_CELLS; c++) {
    const cell = buildCell(1000 + c * 97);
    const ox = (c % ATLAS_CELLS) * CELL;
    const oy = Math.floor(c / ATLAS_CELLS) * CELL;
    for (let j = 0; j < CELL; j++) {
      data.set(
        cell.subarray(j * CELL * 4, (j + 1) * CELL * 4),
        ((oy + j) * size + ox) * 4,
      );
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
};
