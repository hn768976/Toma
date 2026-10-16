import { makeSimplex3 } from "../../lib/noise";
import { hash2, mulberry32 } from "../../lib/random";
import { TAU } from "../../lib/loop";

// One periodic terrain tile. Units: 1 = one floor grid cell.
// The camera flies toward -z; the tile spans z ∈ [-TILE_L, 0] and repeats
// exactly every TILE_L: noise is sampled on a cylinder (depth → angle) and
// every per-vertex hash uses the row index modulo the rows per tile.
//
// Two meshes share the tile:
//  - the floor: a regular 1-cell grid (square grid edges), flat with a few
//    low seeded bumps;
//  - the mountains: a coarser jittered lattice (low-poly facets several cells
//    wide, about half the triangle edges kept) rising steeply with |x|.

export const CELL = 1;
export const VALLEY_HALF = 6; // valley width 12 cells → cell = 1/12 valley
export const FLAT_HALF = 1.2 * VALLEY_HALF; // flat floor for |x| < 7.2
export const NZ = 64; // floor rows per tile
export const TILE_L = NZ * CELL;
const FLOOR_HALF = 10; // floor grid drawn for |i| <= FLOOR_HALF
const MZ = 24; // mountain rows per tile (cells of TILE_L / MZ ≈ 2.67)
const M_DZ = TILE_L / MZ;
const M_X0 = 3.2; // mountain lattice starts here (low near-camera hills)
const M_DX = 2.5;
const M_COLS = 15;

const SEED = 1033506071;
const simplex = makeSimplex3(SEED);
const R_CYL = TILE_L / TAU;

const cyl = (x: number, z: number, f: number, off: number) => {
  const a = (z / TILE_L) * TAU;
  return simplex(x * f + off, Math.cos(a) * R_CYL * f + off * 0.37, Math.sin(a) * R_CYL * f - off * 0.61);
};

const ridged = (x: number, z: number) => {
  let sum = 0;
  let amp = 1;
  let f = 0.07;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    const r = 1 - Math.abs(cyl(x, z, f, o * 17.3));
    sum += r * r * amp;
    norm += amp;
    amp *= 0.45;
    f *= 2.1;
  }
  return sum / norm;
};

// Seeded low bumps on the floor, off the camera's path.
const rngB = mulberry32(SEED ^ 0xb00b5);
const bumps = Array.from({ length: 5 }, () => {
  const side = rngB() < 0.5 ? -1 : 1;
  return { x: side * (2.8 + rngB() * 2.2), z: -rngB() * TILE_L, r: 1.5 + rngB() * 1.2, h: 0.25 + rngB() * 0.35 };
});
const wrapDz = (dz: number) => {
  let d = dz % TILE_L;
  if (d > TILE_L / 2) d -= TILE_L;
  if (d < -TILE_L / 2) d += TILE_L;
  return d;
};

export const floorHeight = (x: number, z: number) => {
  let h = 0;
  for (const b of bumps) {
    const dx = x - b.x;
    const dz = wrapDz(z - b.z);
    const d2 = (dx * dx + dz * dz) / (b.r * b.r);
    if (d2 < 4) h += b.h * Math.exp(-d2 * 1.6);
  }
  return h;
};

export const mountainHeight = (x: number, z: number) => {
  const ax = Math.abs(x);
  const m = ax - M_X0;
  if (m <= 0) return -0.08;
  // big separate masses: a low-frequency mask carves saddles between them
  const mass = Math.min(1, Math.max(0, (cyl(x, z, 0.035, 41.0) + 0.25) / 0.75));
  const r = ridged(x, z);
  // low foothills right at the valley edge (the big near-corner slopes)
  // rolling foreground ridges reaching into the frame's bottom corners
  const foot = Math.min(1, m / 2.0) * (0.5 + 2.0 * Math.max(0, cyl(x, z, 0.14, 5.1)));
  const rise = Math.min(1, Math.max(0, (ax - FLAT_HALF - 2.5) / 7));
  const sideBias = x < 0 ? 1.15 : 0.85; // the left wall stands taller, as in the reference
  const tall = rise * rise * (2.5 + 20 * sideBias * mass * mass * (0.35 + 0.65 * r));
  return Math.max(foot * (1 - rise * 0.6), 0) + tall;
};

export type TerrainData = {
  floorPositions: Float32Array;
  floorShade: Float32Array;
  mountPositions: Float32Array;
  mountShade: Float32Array; // (height01, facet shade, tone jitter)
  floorSegs: Float32Array;
  floorData: Float32Array;
  mountSegs: Float32Array;
  mountData: Float32Array;
};

export const buildTerrain = (): TerrainData => {
  // ---- floor grid ----
  const fcols = FLOOR_HALF * 2 + 1;
  const frows = NZ + 1;
  const fv = (i: number, j: number) => {
    const x = i * CELL;
    const z = -j * CELL;
    return [x, floorHeight(x, z), z] as const;
  };
  const floorPositions: number[] = [];
  const floorShade: number[] = [];
  for (let j = 0; j < NZ; j++) {
    for (let i = -FLOOR_HALF; i < FLOOR_HALF; i++) {
      const a = fv(i, j), b = fv(i + 1, j), c = fv(i, j + 1), d = fv(i + 1, j + 1);
      for (const p of [a, b, d, a, d, c]) {
        floorPositions.push(...p);
        floorShade.push(0, 1, 0);
      }
    }
  }
  const floorSegs: number[] = [];
  const floorFlags: number[] = []; // x = 1 on the centre line (drawn brighter)
  for (let j = 0; j < NZ; j++) {
    for (let i = -FLOOR_HALF; i <= FLOOR_HALF; i++) {
      floorSegs.push(...fv(i, j), ...fv(i, j + 1));
      floorFlags.push(i === 0 ? 1 : 0, 0, 0, i === 0 ? 1 : 0, 0, 0);
      if (i < FLOOR_HALF) {
        floorSegs.push(...fv(i, j), ...fv(i + 1, j));
        floorFlags.push(0, 0, 0, 0, 0, 0);
      }
    }
  }
  void fcols;
  void frows;

  // ---- mountain lattice (both sides) ----
  const mountPositions: number[] = [];
  const mountShade: number[] = [];
  const mountSegs: number[] = [];
  const light = [0.35, 0.8, 0.45];
  const ll = Math.hypot(...light);
  for (const side of [-1, 1]) {
    const vert = (k: number, r: number) => {
      const rm = ((r % MZ) + MZ) % MZ;
      const jx = k === 0 ? 0 : (hash2(k * side, rm, 11) - 0.5) * M_DX * 0.55;
      const jz = (hash2(k * side, rm, 23) - 0.5) * M_DZ * 0.55;
      const x = side * (M_X0 + k * M_DX) + side * jx;
      const z = -(r * M_DZ) + jz - (r === MZ ? 0 : 0);
      const zz = r === MZ ? jz - TILE_L : z; // the closing row equals row 0 shifted one tile
      return [x, mountainHeight(x, zz), zz] as const;
    };
    const tris: (readonly [number, number, number])[][] = [];
    const flips = new Map<string, boolean>();
    for (let r = 0; r < MZ; r++) {
      for (let k = 0; k < M_COLS; k++) {
        const a = vert(k, r), b = vert(k + 1, r), c = vert(k, r + 1), d = vert(k + 1, r + 1);
        const flip = hash2(k * side, r, 77) < 0.5;
        flips.set(`${k},${r}`, flip);
        if (!flip) tris.push([a, b, d], [a, d, c]);
        else tris.push([a, b, c], [b, d, c]);
      }
    }
    const normalOf = (t: (readonly [number, number, number])[]) => {
      const [a, b, c] = t;
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
      return [nx, ny, nz];
    };
    const key = (p: readonly number[], q: readonly number[]) => {
      const s1 = p.map((v) => v.toFixed(4)).join(",");
      const s2 = q.map((v) => v.toFixed(4)).join(",");
      return s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
    };
    const edgeFaces = new Map<string, number[][]>();
    tris.forEach((t, ti) => {
      const n = normalOf(t);
      const lam = Math.max(0, (n[0] * light[0] * side + n[1] * light[1] + n[2] * light[2]) / ll);
      const facet = 0.62 + 0.55 * lam;
      const tone = hash2(ti, side, 5);
      for (const p of t) {
        mountPositions.push(...p);
        mountShade.push(Math.min(1, Math.max(0, p[1] / 14)), facet, tone);
      }
      for (let e = 0; e < 3; e++) {
        const kk = key(t[e], t[(e + 1) % 3]);
        if (!edgeFaces.has(kk)) edgeFaces.set(kk, []);
        edgeFaces.get(kk)!.push(n);
      }
    });
    const consider = (p: readonly number[], q: readonly number[], salt: number, k: number, r: number) => {
      if (Math.max(p[1], q[1]) < 0.05) return;
      const faces = edgeFaces.get(key(p, q));
      let crease = 0.3;
      if (faces && faces.length === 2) {
        const [a, b] = faces;
        crease = 1 - (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);
      }
      const keep = 0.32 + crease * 2.2;
      if (hash2(k * 3 + salt + side * 101, r, 401) < keep) mountSegs.push(...p, ...q);
    };
    for (let r = 0; r < MZ; r++) {
      for (let k = 0; k <= M_COLS; k++) {
        consider(vert(k, r), vert(k, r + 1), 0, k, r);
        if (k < M_COLS) {
          consider(vert(k, r), vert(k + 1, r), 1, k, r);
          if (!flips.get(`${k},${r}`)) consider(vert(k, r), vert(k + 1, r + 1), 2, k, r);
          else consider(vert(k + 1, r), vert(k, r + 1), 2, k, r);
        }
      }
    }
  }
  return {
    floorPositions: new Float32Array(floorPositions),
    floorShade: new Float32Array(floorShade),
    mountPositions: new Float32Array(mountPositions),
    mountShade: new Float32Array(mountShade),
    floorSegs: new Float32Array(floorSegs),
    floorData: new Float32Array(floorFlags),
    mountSegs: new Float32Array(mountSegs),
    mountData: new Float32Array(mountSegs.length),
  };
};

// Built once at module level: identical for every frame and every thread.
export const TERRAIN = buildTerrain();
