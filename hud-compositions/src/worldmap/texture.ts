/**
 * Procedural relief/albedo texture for the world map, generated once per
 * render tab in Miller projection space. Real mountain ranges, deserts,
 * forests and ice caps are approximated with hand-placed shapes so the map
 * reads like a greyscale satellite mosaic. No external imagery is used.
 */
import { MILLER_YMAX, millerRaw } from "./projection";

const RAD = Math.PI / 180;

// ------------------------------------------------------------------ noise
const hash2 = (x: number, y: number) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const vnoise = (x: number, y: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x: number, y: number, oct: number) => {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x, y);
    n += a;
    x = x * 2.03 + 17.1;
    y = y * 2.03 + 9.7;
    a *= 0.5;
  }
  return s / n;
};
const ridged = (x: number, y: number, oct: number) => {
  let s = 0;
  let a = 0.5;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    const r = 1 - Math.abs(vnoise(x, y) * 2 - 1);
    s += a * r * r;
    n += a;
    x = x * 2.1 + 5.3;
    y = y * 2.1 + 1.9;
    a *= 0.5;
  }
  return s / n;
};

// ------------------------------------------------------------------ geography
type Range = { pts: [number, number][]; w: number; h: number };
const RANGES: Range[] = [
  { pts: [[-150, 62], [-135, 58], [-122, 50], [-112, 42], [-107, 36], [-105, 30], [-100, 22]], w: 5, h: 0.9 },
  { pts: [[-78, 8], [-77, -2], [-76, -12], [-69, -20], [-69, -30], [-71, -40], [-73, -50]], w: 2.6, h: 1 },
  { pts: [[68, 37], [76, 35], [84, 30], [92, 28], [98, 29]], w: 3.5, h: 1.1 },
  { pts: [[80, 34], [88, 34], [96, 33]], w: 6, h: 0.75 },
  { pts: [[75, 42], [82, 43], [90, 44]], w: 2.5, h: 0.6 },
  { pts: [[6, 45], [10, 46.5], [15, 47]], w: 1.4, h: 0.7 },
  { pts: [[60, 68], [59, 58], [58, 50]], w: 1.8, h: 0.45 },
  { pts: [[-8, 31], [0, 34], [8, 35]], w: 1.6, h: 0.55 },
  { pts: [[40, 43], [46, 42]], w: 1.5, h: 0.7 },
  { pts: [[45, 36], [52, 30], [57, 27]], w: 2.2, h: 0.6 },
  { pts: [[38, 12], [37, 5], [36, -3], [34, -10]], w: 2.4, h: 0.55 },
  { pts: [[6, 60], [12, 64], [18, 68]], w: 2.2, h: 0.45 },
  { pts: [[-85, 34], [-78, 39], [-72, 43]], w: 2.0, h: 0.35 },
  { pts: [[100, 52], [112, 56], [125, 60], [140, 63], [160, 66]], w: 3, h: 0.45 },
  { pts: [[145, -38], [150, -30], [152, -24]], w: 1.6, h: 0.35 },
  { pts: [[20, -33], [30, -28]], w: 1.5, h: 0.35 },
];
type Blob = { c: [number, number]; r: [number, number]; v: number };
const DESERTS: Blob[] = [
  { c: [12, 23], r: [24, 9], v: 0.9 },
  { c: [47, 23], r: [9, 7], v: 0.85 },
  { c: [133, -25], r: [15, 8], v: 0.8 },
  { c: [103, 42], r: [12, 4], v: 0.7 },
  { c: [22, -23], r: [6, 5], v: 0.65 },
  { c: [-112, 33], r: [7, 5], v: 0.7 },
  { c: [57, 32], r: [8, 4], v: 0.7 },
  { c: [83, 39], r: [7, 3], v: 0.8 },
  { c: [65, 43], r: [10, 4], v: 0.6 },
  { c: [-69, -24], r: [3, 6], v: 0.6 },
];
const FORESTS: Blob[] = [
  { c: [-62, -5], r: [15, 9], v: 0.8 },
  { c: [22, 0], r: [11, 6], v: 0.8 },
  { c: [105, 10], r: [12, 10], v: 0.6 },
  { c: [95, 60], r: [50, 6], v: 0.4 },
  { c: [-95, 55], r: [30, 6], v: 0.4 },
  { c: [-82, 38], r: [8, 6], v: 0.4 },
];

const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const ex = px - (ax + dx * t);
  const ey = py - (ay + dy * t);
  return Math.sqrt(ex * ex + ey * ey);
};
const blob = (lon: number, lat: number, b: Blob, edge: number) => {
  const dx = (lon - b.c[0]) / b.r[0];
  const dy = (lat - b.c[1]) / b.r[1];
  const d = Math.sqrt(dx * dx + dy * dy) + edge;
  return b.v * Math.max(0, Math.min(1, (1.15 - d) / 0.45));
};

export type LandTexture = {
  /** Greyscale luminance 0-1, row-major, in Miller space. */
  lum: Float32Array;
  w: number;
  h: number;
};

/**
 * Builds the luminance field. x spans [-π, π], y spans [-YMAX, YMAX].
 */
export const buildLandTexture = (w = 2048): LandTexture => {
  const h = Math.round((w * MILLER_YMAX) / Math.PI);
  const elev = new Float32Array(w * h);
  const alb = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const y = MILLER_YMAX - ((j + 0.5) / h) * 2 * MILLER_YMAX;
    const lat = (2.5 * Math.atan(Math.exp(0.8 * y)) - 0.625 * Math.PI) / RAD;
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w) * 360 - 180;
      const n1 = fbm(lon * 0.08, lat * 0.08, 4);
      const edge = (n1 - 0.5) * 0.8;
      // Elevation from mountain belts.
      let e = 0.08 * fbm(lon * 0.15 + 3, lat * 0.15, 5);
      for (const r of RANGES) {
        let d = 1e9;
        for (let k = 0; k < r.pts.length - 1; k++) {
          const a = r.pts[k];
          const b = r.pts[k + 1];
          d = Math.min(d, segDist(lon, lat, a[0], a[1], b[0], b[1]));
        }
        const ww = r.w * (0.7 + 0.6 * n1);
        if (d < ww * 2.5) {
          const fall = Math.exp(-(d * d) / (ww * ww));
          e += r.h * fall * (0.35 + 0.9 * ridged(lon * 0.45, lat * 0.45, 5));
        }
      }
      // Albedo: base, deserts brighter, forests darker, ice white.
      let a = 0.42 + 0.22 * (fbm(lon * 0.05 + 11, lat * 0.05, 5) - 0.5) + 0.16 * (fbm(lon * 0.25 + 3, lat * 0.25, 5) - 0.5) + 0.14 * (fbm(lon * 1.2, lat * 1.2, 4) - 0.5);
      let desert = 0;
      for (const b of DESERTS) desert = Math.max(desert, blob(lon, lat, b, edge * 1.8 + (fbm(lon * 0.3, lat * 0.3, 4) - 0.5) * 0.8));
      let forest = 0;
      for (const b of FORESTS) forest = Math.max(forest, blob(lon, lat, b, edge * 1.8 + (fbm(lon * 0.3 + 5, lat * 0.3, 4) - 0.5) * 0.9));
      a = a + (0.74 - a) * desert * (0.55 + 0.6 * fbm(lon * 0.4, lat * 0.4, 5));
      a = a * (1 - 0.22 * forest * (0.6 + 0.8 * fbm(lon * 0.5, lat * 0.5, 4)));
      // Ice: Greenland, Antarctica, high Arctic, high peaks.
      const greenland = blob(lon, lat, { c: [-41, 74], r: [13, 9], v: 1 }, edge * 0.5);
      const polar = Math.max(0, Math.min(1, (Math.abs(lat) - (lat > 0 ? 70 : 62)) / 6 + edge));
      const snow = Math.max(greenland, polar, Math.max(0, Math.min(1, (e - 0.85) * 3)));
      a = a + (0.97 - a) * snow;
      elev[j * w + i] = e;
      alb[j * w + i] = a;
    }
  }
  // Hillshade (light from the north-west) combined with albedo.
  const lum = new Float32Array(w * h);
  const scale = w / 360;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      const ex = elev[j * w + Math.min(w - 1, i + 1)] - elev[j * w + Math.max(0, i - 1)];
      const ey = elev[Math.min(h - 1, j + 1) * w + i] - elev[Math.max(0, j - 1) * w + i];
      const nx = -ex * scale * 1.4;
      const ny = ey * scale * 1.4;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      const shade = Math.max(0, (nx * -0.6 + ny * 0.55 + 0.58) / len);
      lum[idx] = Math.max(0, Math.min(1, alb[idx] * (0.45 + 0.75 * shade)));
    }
  }
  return { lum, w, h };
};

/** Tileable fine-detail noise used as a world-locked overlay when zoomed. */
export const buildDetailTile = (size = 512): Float32Array => {
  const out = new Float32Array(size * size);
  const period = 32;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      // Periodic fbm by blending four offset samples.
      const u = i / size;
      const v = j / size;
      const s = (x: number, y: number) => fbm(x * period, y * period, 5) * 0.7 + ridged(x * period * 0.5, y * period * 0.5, 4) * 0.3;
      const a = s(u, v);
      const b = s(u - 1, v);
      const c = s(u, v - 1);
      const d = s(u - 1, v - 1);
      out[j * size + i] = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }
  }
  return out;
};

export const millerToTex = (lon: number, lat: number, tex: LandTexture) => {
  const [x, y] = millerRaw(lon * RAD, lat * RAD);
  return { u: ((x + Math.PI) / (2 * Math.PI)) * tex.w, v: ((MILLER_YMAX - y) / (2 * MILLER_YMAX)) * tex.h };
};
