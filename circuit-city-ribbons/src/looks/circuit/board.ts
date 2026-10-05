import { mulberry32, range, Rng } from "../../lib/random";

/*
 * Seeded PCB router. Runs once at module level.
 *
 * Board space: x (left/right), z (toward the camera is +z). The chip sits at
 * the origin. Buses of parallel lanes are walked across an occupancy grid with
 * straight runs and 45-degree bends; every lane is oriented so its "along"
 * coordinate increases toward the chip (pulses travel toward the chip).
 */

export const PITCH = 0.065; // lane spacing
export const TRACE_W = 0.026;
export const TRACE_H = 0.018;
export const CHIP = 3.0; // package size
export const PIN_N = 40;

const X0 = -18;
const X1 = 18;
const Z0 = -24;
const Z1 = 32;
const CELL = 0.0325;
const GW = Math.round((X1 - X0) / CELL);
const GH = Math.round((Z1 - Z0) / CELL);

export type Lane = {
  pts: [number, number][]; // polyline (x, z), ends nearest the chip last
  seed: number;
  kind: number; // 0 plain, 1 glows softly all over
  padStart: number; // 0 none, 1 pad, 2 via
  padEnd: number;
};

export type Comp = {
  x: number;
  z: number;
  w: number; // x size
  d: number; // z size
  h: number;
  type: number; // 0 resistor, 1 capacitor, 2 small IC
  rot: number; // 0 or 1 (swap w/d already applied)
};

const DIRS: [number, number][] = [
  [1, 0],
  [Math.SQRT1_2, Math.SQRT1_2],
  [0, 1],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-1, 0],
  [-Math.SQRT1_2, -Math.SQRT1_2],
  [0, -1],
  [Math.SQRT1_2, -Math.SQRT1_2],
];

class Grid {
  g = new Uint8Array(GW * GH);
  idx(x: number, z: number) {
    const i = Math.floor((x - X0) / CELL);
    const j = Math.floor((z - Z0) / CELL);
    if (i < 0 || j < 0 || i >= GW || j >= GH) return -1;
    return j * GW + i;
  }
  // test or mark a thick segment (capsule) of half width hw
  seg(ax: number, az: number, bx: number, bz: number, hw: number, mark: boolean) {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / (CELL * 0.5)));
    const dx = (bx - ax) / Math.max(len, 1e-9);
    const dz = (bz - az) / Math.max(len, 1e-9);
    const nx = -dz;
    const nz = dx;
    const m = Math.max(1, Math.ceil((2 * hw) / (CELL * 0.5)));
    for (let i = 0; i <= n; i++) {
      const px = ax + (bx - ax) * (i / n);
      const pz = az + (bz - az) * (i / n);
      for (let k = 0; k <= m; k++) {
        const o = -hw + (2 * hw * k) / m;
        const id = this.idx(px + nx * o, pz + nz * o);
        if (id < 0) {
          if (!mark) return false;
          continue;
        }
        if (mark) this.g[id] = 1;
        else if (this.g[id]) return false;
      }
    }
    return true;
  }
  rect(cx: number, cz: number, w: number, d: number, mark: boolean) {
    for (let x = cx - w / 2; x <= cx + w / 2 + 1e-6; x += CELL * 0.5) {
      for (let z = cz - d / 2; z <= cz + d / 2 + 1e-6; z += CELL * 0.5) {
        const id = this.idx(x, z);
        if (id < 0) return false;
        if (mark) this.g[id] = 1;
        else if (this.g[id]) return false;
      }
    }
    return true;
  }
}

// polyline offset with miters
const offsetPolyline = (pts: [number, number][], o: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let d0x = p[0] - prev[0];
    let d0z = p[1] - prev[1];
    let d1x = next[0] - p[0];
    let d1z = next[1] - p[1];
    if (i === 0) {
      d0x = d1x;
      d0z = d1z;
    }
    if (i === pts.length - 1) {
      d1x = d0x;
      d1z = d0z;
    }
    const l0 = Math.hypot(d0x, d0z) || 1;
    const l1 = Math.hypot(d1x, d1z) || 1;
    const n0x = -d0z / l0;
    const n0z = d0x / l0;
    const n1x = -d1z / l1;
    const n1z = d1x / l1;
    let mx = n0x + n1x;
    let mz = n0z + n1z;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const cos = mx * n0x + mz * n0z;
    const k = o / Math.max(cos, 0.5);
    out.push([p[0] + mx * k, p[1] + mz * k]);
  }
  return out;
};

const lenOf = (pts: [number, number][]) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

// trim a polyline by a length at the start
const trimStart = (pts: [number, number][], t: number): [number, number][] => {
  const out = pts.slice();
  while (t > 0 && out.length >= 2) {
    const [a, b] = out;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > t + 1e-4) {
      const f = t / l;
      out[0] = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      return out;
    }
    t -= l;
    out.shift();
  }
  return out;
};

const orientTowardChip = (l: Lane): Lane => {
  const a = l.pts[0];
  const b = l.pts[l.pts.length - 1];
  if (Math.hypot(a[0], a[1]) >= Math.hypot(b[0], b[1])) return l;
  return { ...l, pts: l.pts.slice().reverse(), padStart: l.padEnd, padEnd: l.padStart };
};

export type BoardData = { lanes: Lane[]; comps: Comp[] };

export const BOARD: BoardData = (() => {
  const r: Rng = mulberry32(1101145185);
  const grid = new Grid();
  const lanes: Lane[] = [];
  const comps: Comp[] = [];

  // chip + substrate footprint reserved
  grid.rect(0, 0, CHIP + 0.7, CHIP + 0.7, true);

  // ---- chip fan-out on all four sides
  for (let side = 0; side < 4; side++) {
    // outward direction and tangent
    const out: [number, number] = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ][side] as [number, number];
    const tan: [number, number] = [-out[1], out[0]];
    const base = CHIP / 2 + 0.3; // pin end
    const A = 0.3 + 0.6 * PITCH * (PIN_N / 2);
    for (let i = 0; i < PIN_N; i++) {
      const k = i - (PIN_N - 1) / 2;
      const s = Math.sign(k);
      const a = A - 0.6 * PITCH * Math.abs(k);
      const shift = PITCH * k; // final spacing 2 * PITCH
      const p = (t: number, o: number): [number, number] => [out[0] * t + tan[0] * o, out[1] * t + tan[1] * o];
      const straight = range(r, 0.6, side === 0 ? 7 : 4) + Math.abs(k) * 0.05;
      const pts: [number, number][] = [
        p(base, PITCH * k),
        p(base + a, PITCH * k),
        p(base + a + Math.abs(shift), PITCH * k + shift),
        p(base + a + Math.abs(shift) + straight, PITCH * k + shift),
      ];
      // second, wider jog for some lanes
      if (r() < 0.35) {
        const last = pts[pts.length - 1];
        const j = range(r, 0.2, 0.6) * s;
        pts.push([last[0] + out[0] * Math.abs(j) + tan[0] * j, last[1] + out[1] * Math.abs(j) + tan[1] * j]);
        pts.push([pts[pts.length - 1][0] + out[0] * range(r, 0.5, 3), pts[pts.length - 1][1] + out[1] * range(r, 0.5, 3)]);
      }
      for (let q = 1; q < pts.length; q++) {
        grid.seg(pts[q - 1][0], pts[q - 1][1], pts[q][0], pts[q][1], PITCH * 0.6, true);
      }
      lanes.push({
        pts: pts.slice().reverse(),
        seed: r(),
        kind: r() < 0.25 ? 1 : 0,
        padStart: r() < 0.7 ? (r() < 0.4 ? 2 : 1) : 0,
        padEnd: 0,
      });
    }
  }

  // ---- general buses
  const tryBus = (sx: number, sz: number, dir: number, n: number, maxLen: number, spacing: number) => {
    const hw = (n * spacing) / 2 + PITCH * 0.3;
    const main = dir;
    let cur = dir;
    const pts: [number, number][] = [[sx, sz]];
    let remaining = maxLen;
    let lastWasDiag = false;
    let guard = 0;
    if (!grid.seg(sx, sz, sx + DIRS[dir][0] * 0.05, sz + DIRS[dir][1] * 0.05, hw, false)) return false;
    while (remaining > 0.2 && guard++ < 20) {
      const diag = cur !== main;
      const want = diag ? range(r, 0.25, 1.4) : range(r, 0.8, 5);
      const [dx, dz] = DIRS[cur];
      const p = pts[pts.length - 1];
      // advance until blocked
      let free = 0;
      const step = PITCH;
      while (free < Math.min(want, remaining)) {
        const ax = p[0] + dx * (free + PITCH * 0.6);
        const az = p[1] + dz * (free + PITCH * 0.6);
        if (!grid.seg(ax, az, ax + dx * step, az + dz * step, hw, false)) break;
        free += step;
      }
      if (free < 0.3) break;
      pts.push([p[0] + dx * free, p[1] + dz * free]);
      remaining -= free;
      if (free < Math.min(want, remaining) - 0.05) break; // blocked
      if (diag) {
        cur = main;
        lastWasDiag = true;
      } else if (r() < 0.55 && !lastWasDiag) {
        cur = (main + (r() < 0.5 ? 1 : 7)) % 8;
      } else {
        lastWasDiag = false;
        if (r() < 0.12) cur = (main + (r() < 0.5 ? 2 : 6)) % 8; // a 90 degree run, then back
      }
    }
    if (pts.length < 2 || lenOf(pts) < 0.6) return false;
    for (let q = 1; q < pts.length; q++) {
      grid.seg(pts[q - 1][0], pts[q - 1][1], pts[q][0], pts[q][1], hw, true);
    }
    const stagger = r() < 0.85;
    const stagDir = r() < 0.5 ? 1 : -1;
    const kind = r() < 0.18 ? 1 : 0;
    const pad = r() < 0.92;
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * spacing;
      let lp = offsetPolyline(pts, o);
      const kk = stagDir > 0 ? k : n - 1 - k;
      if (stagger) lp = trimStart(lp, kk * spacing * 0.9);
      lp = trimStart(lp.slice().reverse(), stagger && r() < 0.3 ? kk * spacing : 0).reverse();
      if (lp.length < 2 || lenOf(lp) < 0.2) continue;
      lanes.push({
        pts: lp,
        seed: r(),
        kind: kind || (r() < 0.04 ? 1 : 0),
        padStart: pad ? (r() < 0.3 ? 2 : 1) : 0,
        padEnd: pad ? (r() < 0.3 ? 2 : 1) : 0,
      });
    }
    return true;
  };

  const dirToward = (x: number, z: number) => {
    // main direction pointing roughly toward the chip, snapped to an axis
    if (Math.abs(x) > Math.abs(z) * 1.3) return x > 0 ? 4 : 0;
    return z > 0 ? 6 : 2;
  };

  // big buses first, then progressively smaller ones to fill gaps
  const passes: [number, number, number, number][] = [
    // attempts, minLanes, maxLanes, maxLen
    [900, 8, 20, 26],
    [3000, 4, 12, 14],
    [7000, 2, 7, 8],
    [9000, 1, 3, 4],
  ];
  for (const [attempts, lo, hi, maxL] of passes) {
    for (let a = 0; a < attempts; a++) {
      // bias starts toward the camera side of the chip (the part we see)
      const zz = r() < 0.75 ? range(r, -2, Z1 - 1) : range(r, Z0 + 1, -2);
      const xx = range(r, X0 + 1, X1 - 1);
      // start far from the chip and route toward it
      let dir = dirToward(xx, zz);
      if (r() < 0.38) dir = (dir + (r() < 0.5 ? 2 : 6)) % 8; // cross runs
      const n = Math.floor(range(r, lo, hi + 0.999));
      tryBus(xx, zz, dir, n, range(r, maxL * 0.4, maxL), PITCH);
    }
  }

  // ---- components in free spots
  for (let a = 0; a < 900; a++) {
    const type = r() < 0.5 ? 0 : r() < 0.6 ? 1 : 2;
    let w = type === 0 ? 0.24 : type === 1 ? 0.18 : range(r, 0.4, 0.8);
    let d = type === 0 ? 0.12 : type === 1 ? 0.11 : range(r, 0.3, 0.6);
    const rot = r() < 0.5 ? 1 : 0;
    if (rot) [w, d] = [d, w];
    const x = range(r, X0 + 1, X1 - 1);
    const z = range(r, Z0 + 1, Z1 - 1);
    if (Math.abs(x) < 2.2 && Math.abs(z) < 2.2) continue;
    if (!grid.rect(x, z, w + 0.08, d + 0.08, false)) continue;
    grid.rect(x, z, w + 0.04, d + 0.04, true);
    comps.push({ x, z, w, d, h: type === 2 ? 0.06 : type === 0 ? 0.05 : 0.07, type, rot });
  }

  return { lanes: lanes.map(orientTowardChip), comps };
})();

export const lanesLength = (pts: [number, number][]) => lenOf(pts);
