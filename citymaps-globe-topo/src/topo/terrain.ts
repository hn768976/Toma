// Procedural terrain (no real place) and its contour lines, built once.

import { periodicNoise } from "../lib/noise";
import { mulberry32, range } from "../lib/random";

export interface Contour {
  pts: number[]; // x, z pairs
  closed: boolean;
  level: number; // 0..levels-1
  height: number; // 0..1
}

export interface Terrain {
  nx: number;
  nz: number;
  sizeX: number;
  sizeZ: number;
  h: Float32Array;
  contours: Contour[];
  summits: { x: number; z: number; h: number }[];
  levels: number;
}

export const buildTerrain = (seed: number, levels = 40): Terrain => {
  const rng = mulberry32(seed * 7717 + 3);
  const sizeX = 1;
  const sizeZ = 0.6;
  const nx = 400;
  const nz = 240;
  const n1 = periodicNoise(rng, 64);
  const n2 = periodicNoise(rng, 64);
  const n3 = periodicNoise(rng, 64);
  const fbm = (x: number, z: number, oct: number, n: (a: number, b: number) => number) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      s += a * n(x * f + 13.1 * i, z * f - 7.7 * i);
      a *= 0.5;
      f *= 2.03;
    }
    return s;
  };
  const ridged = (x: number, z: number) => {
    let s = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < 4; i++) {
      const v = 1 - Math.abs(n3(x * f + 5.3 * i, z * f + 1.7 * i));
      s += a * v * v;
      a *= 0.5;
      f *= 2.1;
    }
    return s;
  };
  // 2-3 peaks and a valley
  const peaks = [
    { x: range(rng, -0.06, 0.04), z: range(rng, -0.08, -0.03), h: 1.0, sx: 0.15, sz: 0.12 },
    { x: range(rng, 0.28, 0.36), z: range(rng, -0.04, 0.04), h: 0.55, sx: 0.13, sz: 0.11 },
    { x: range(rng, -0.4, -0.32), z: range(rng, 0.05, 0.12), h: 0.5, sx: 0.12, sz: 0.1 },
    { x: range(rng, 0.12, 0.2), z: range(rng, 0.12, 0.18), h: 0.38, sx: 0.07, sz: 0.06 },
    { x: range(rng, -0.22, -0.14), z: range(rng, -0.24, -0.18), h: 0.42, sx: 0.09, sz: 0.07 },
  ];
  const valley = { x: range(rng, 0.05, 0.15), z: range(rng, 0.12, 0.18), d: 0.18 };
  const h = new Float32Array(nx * nz);
  let hmin = Infinity;
  let hmax = -Infinity;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = (i / (nx - 1) - 0.5) * sizeX;
      const z = (j / (nz - 1) - 0.5) * sizeZ;
      // domain warp for organic shapes
      const wx = x + 0.07 * fbm(x * 3, z * 3, 2, n1);
      const wz = z + 0.07 * fbm(x * 3 + 3, z * 3 - 2, 2, n2);
      let v = 0;
      for (const p of peaks) {
        const dx = (wx - p.x) / p.sx;
        const dz = (wz - p.z) / p.sz;
        v += p.h * Math.exp(-(dx * dx + dz * dz) * 0.9);
      }
      v += 0.13 * ridged(wx * 3.2, wz * 3.2) * (0.35 + v);
      v += 0.035 * fbm(wx * 7, wz * 7, 2, n1);
      const vd = Math.hypot((wx - valley.x) / 0.3, (wz - valley.z) / 0.06);
      v -= valley.d * Math.exp(-vd * vd);
      h[j * nx + i] = v;
      hmin = Math.min(hmin, v);
      hmax = Math.max(hmax, v);
    }
  }
  // shape: flatten lowlands so lines gather on the hills and gaps open up between them
  for (let k = 0; k < h.length; k++) h[k] = Math.pow((h[k] - hmin) / (hmax - hmin), 1.6);

  // summits: local maxima over a window
  const summits: Terrain["summits"] = [];
  const R = 18;
  for (let j = R; j < nz - R; j += 3) {
    for (let i = R; i < nx - R; i += 3) {
      const v = h[j * nx + i];
      if (v < 0.25) continue;
      let isMax = true;
      for (let dj = -R; dj <= R && isMax; dj += 2)
        for (let di = -R; di <= R; di += 2) if (h[(j + dj) * nx + i + di] > v) { isMax = false; break; }
      if (isMax) summits.push({ x: (i / (nx - 1) - 0.5) * sizeX, z: (j / (nz - 1) - 0.5) * sizeZ, h: v });
    }
  }

  // marching squares
  const contours: Contour[] = [];
  const P = (i: number, j: number) => [(i / (nx - 1) - 0.5) * sizeX, (j / (nz - 1) - 0.5) * sizeZ];
  for (let L = 0; L < levels; L++) {
    const lv = (L + 0.5) / levels;
    // edge ids: horizontal edge (i,j)-(i+1,j) = 2*(j*nx+i); vertical (i,j)-(i,j+1) = 2*(j*nx+i)+1
    const pointOf = new Map<number, [number, number]>();
    const adj = new Map<number, number[]>();
    const edgePt = (id: number): [number, number] => {
      let p = pointOf.get(id);
      if (p) return p;
      const base = id >> 1;
      const i = base % nx;
      const j = Math.floor(base / nx);
      const i2 = id & 1 ? i : i + 1;
      const j2 = id & 1 ? j + 1 : j;
      const a = h[j * nx + i];
      const b = h[j2 * nx + i2];
      const t = (lv - a) / (b - a);
      const pa = P(i, j);
      const pb = P(i2, j2);
      p = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t];
      pointOf.set(id, p);
      return p;
    };
    const link = (a: number, b: number) => {
      edgePt(a);
      edgePt(b);
      (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
      (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
    };
    for (let j = 0; j < nz - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = h[j * nx + i] > lv ? 1 : 0;
        const b = h[j * nx + i + 1] > lv ? 2 : 0;
        const c = h[(j + 1) * nx + i + 1] > lv ? 4 : 0;
        const d = h[(j + 1) * nx + i] > lv ? 8 : 0;
        const cs = a | b | c | d;
        if (cs === 0 || cs === 15) continue;
        const top = 2 * (j * nx + i); // (i,j)-(i+1,j)
        const right = 2 * (j * nx + i + 1) + 1; // (i+1,j)-(i+1,j+1)
        const bottom = 2 * ((j + 1) * nx + i); // (i,j+1)-(i+1,j+1)
        const left = 2 * (j * nx + i) + 1; // (i,j)-(i,j+1)
        const centre = (h[j * nx + i] + h[j * nx + i + 1] + h[(j + 1) * nx + i + 1] + h[(j + 1) * nx + i]) / 4 > lv;
        switch (cs) {
          case 1: case 14: link(left, top); break;
          case 2: case 13: link(top, right); break;
          case 3: case 12: link(left, right); break;
          case 4: case 11: link(right, bottom); break;
          case 6: case 9: link(top, bottom); break;
          case 7: case 8: link(left, bottom); break;
          case 5:
            if (centre) { link(left, bottom); link(top, right); } else { link(left, top); link(right, bottom); }
            break;
          case 10:
            if (centre) { link(left, top); link(right, bottom); } else { link(left, bottom); link(top, right); }
            break;
        }
      }
    }
    // walk chains
    const visited = new Set<number>();
    const walk = (start: number) => {
      const chain = [start];
      visited.add(start);
      let cur = start;
      for (;;) {
        const nb = (adj.get(cur) ?? []).find((x) => !visited.has(x));
        if (nb === undefined) break;
        visited.add(nb);
        chain.push(nb);
        cur = nb;
      }
      return chain;
    };
    // open chains first (endpoints have degree 1)
    for (const [id, nbs] of adj) {
      if (nbs.length === 1 && !visited.has(id)) emit(walk(id), false);
    }
    for (const id of adj.keys()) {
      if (!visited.has(id)) emit(walk(id), true);
    }
    function emit(chain: number[], closed: boolean) {
      if (chain.length < 6) return;
      let pts: number[] = [];
      let lastX = Infinity;
      let lastZ = Infinity;
      for (const id of chain) {
        const p = pointOf.get(id)!;
        if (Math.hypot(p[0] - lastX, p[1] - lastZ) < 0.0022) continue;
        pts.push(p[0], p[1]);
        lastX = p[0];
        lastZ = p[1];
      }
      if (pts.length < 8) return;
      let total = 0;
      for (let q = 2; q < pts.length; q += 2) total += Math.hypot(pts[q] - pts[q - 2], pts[q + 1] - pts[q - 1]);
      if (total < 0.06) return;
      // Chaikin smoothing, 2 passes
      for (let it = 0; it < 2; it++) {
        const out: number[] = [];
        const n = pts.length / 2;
        const lim = closed ? n : n - 1;
        if (!closed) out.push(pts[0], pts[1]);
        for (let k = 0; k < lim; k++) {
          const ax = pts[k * 2];
          const az = pts[k * 2 + 1];
          const bx = pts[((k + 1) % n) * 2];
          const bz = pts[((k + 1) % n) * 2 + 1];
          out.push(0.75 * ax + 0.25 * bx, 0.75 * az + 0.25 * bz, 0.25 * ax + 0.75 * bx, 0.25 * az + 0.75 * bz);
        }
        if (!closed) out.push(pts[pts.length - 2], pts[pts.length - 1]);
        pts = out;
      }
      contours.push({ pts, closed, level: L, height: lv });
    }
  }
  return { nx, nz, sizeX, sizeZ, h, contours, summits, levels };
};
