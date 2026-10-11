import { mulberry32, Rng } from "../lib/random";

/**
 * Procedural PCB routing for the CPU Cube board.
 * Traces are walked on a grid in 8 directions (Manhattan runs with 45° bends),
 * fanning out radially from the cube footprint, plus background routing all
 * over the board. Everything comes from one seeded stream, built once.
 */

export interface Trace {
  pts: [number, number][]; // world x,z
  cum: number[]; // cumulative length
  len: number;
  glow: number; // 0..1 brightness in the emissive map
  radial: boolean;
}
export interface Part {
  x: number;
  z: number;
  w: number;
  h: number;
  kind: "chip" | "smd" | "pad";
}
export interface Board {
  half: number;
  pitch: number;
  traces: Trace[];
  parts: Part[];
}

const DIRS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

const buildBoard = (): Board => {
  const rng: Rng = mulberry32(0xc0be17);
  const half = 16;
  const pitch = 0.042;
  const n = Math.round((2 * half) / pitch);
  const occ = new Uint8Array(n * n);
  const toCell = (v: number) => Math.round((v + half) / pitch);
  const toWorld = (c: number) => c * pitch - half;
  const free = (x: number, y: number) => x >= 1 && y >= 1 && x < n - 1 && y < n - 1 && occ[y * n + x] === 0;
  const mark = (x: number, y: number) => {
    occ[y * n + x] = 1;
  };
  // keep traces out of the cube footprint and chip bodies
  const block = (x0: number, z0: number, x1: number, z1: number) => {
    for (let y = toCell(z0); y <= toCell(z1); y++)
      for (let x = toCell(x0); x <= toCell(x1); x++) if (x >= 0 && y >= 0 && x < n && y < n) occ[y * n + x] = 1;
  };

  const parts: Part[] = [];
  // chips scattered on the board (not under the cube)
  for (let i = 0; i < 900; i++) {
    const w = 0.12 + rng() * rng() * 0.8;
    const h = 0.12 + rng() * rng() * 0.7;
    const x = (rng() * 2 - 1) * (half - 1);
    const z = (rng() * 2 - 1) * (half - 1);
    if (Math.abs(x) < 1.4 && Math.abs(z) < 1.4) continue;
    parts.push({ x, z, w, h, kind: "chip" });
    block(x - w / 2, z - h / 2, x + w / 2, z + h / 2);
  }
  // small two-pad SMD parts
  for (let i = 0; i < 3500; i++) {
    const x = (rng() * 2 - 1) * (half - 0.5);
    const z = (rng() * 2 - 1) * (half - 0.5);
    if (Math.abs(x) < 1.0 && Math.abs(z) < 1.0) continue;
    const rot = rng() < 0.5;
    const w = rot ? 0.05 : 0.11;
    const h = rot ? 0.11 : 0.05;
    parts.push({ x, z, w, h, kind: "smd" });
    block(x - w / 2, z - h / 2, x + w / 2, z + h / 2);
  }
  block(-0.62, -0.62, 0.62, 0.62);

  const traces: Trace[] = [];
  const walk = (sx: number, sy: number, dir: number, maxLen: number, radial: boolean, outward: number | null, depth: number) => {
    let x = sx;
    let y = sy;
    let d = dir;
    if (!free(x, y)) return;
    mark(x, y);
    const cells: [number, number][] = [[x, y]];
    let sinceTurn = 0;
    const minRun = radial ? 6 : 4;
    for (let step = 0; step < maxLen; step++) {
      // occasional 45° bends, kept within ±90° of the outward direction for radial traces
      if (sinceTurn > minRun && rng() < (radial ? 0.05 : 0.07)) {
        const nd = (d + (rng() < 0.5 ? 1 : 7)) % 8;
        const ok = outward === null || Math.min((nd - outward + 8) % 8, (outward - nd + 8) % 8) <= 2;
        if (ok) {
          d = nd;
          sinceTurn = 0;
        }
      }
      const [dx, dy] = DIRS[d];
      const nx = x + dx;
      const ny = y + dy;
      let ok = free(nx, ny);
      // diagonal moves may not cut across another trace
      if (ok && dx !== 0 && dy !== 0 && !free(x + dx, y) && !free(x, y + dy)) ok = false;
      if (!ok) {
        // try to bend around once
        const alt = (d + (rng() < 0.5 ? 1 : 7)) % 8;
        const okAlt = outward === null || Math.min((alt - outward + 8) % 8, (outward - alt + 8) % 8) <= 2;
        const [ax, ay] = DIRS[alt];
        if (okAlt && sinceTurn > 1 && free(x + ax, y + ay)) {
          d = alt;
          sinceTurn = 0;
          continue;
        }
        break;
      }
      x = nx;
      y = ny;
      mark(x, y);
      cells.push([x, y]);
      sinceTurn++;
      if (depth < 2 && step > 10 && rng() < 0.012) {
        const bd = (d + (rng() < 0.5 ? 1 : 7)) % 8;
        const [bx, by] = DIRS[bd];
        pending.push([x + bx, y + by, bd, Math.floor(maxLen * 0.5), radial, outward, depth + 1]);
      }
    }
    if (cells.length < 6) return;
    // compress straight runs to corner points
    const pts: [number, number][] = [];
    for (let i = 0; i < cells.length; i++) {
      if (i === 0 || i === cells.length - 1) {
        pts.push([toWorld(cells[i][0]), toWorld(cells[i][1])]);
        continue;
      }
      const a = cells[i - 1];
      const b = cells[i];
      const c = cells[i + 1];
      if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) pts.push([toWorld(b[0]), toWorld(b[1])]);
    }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    traces.push({ pts, cum, len: cum[cum.length - 1], glow: radial ? 0.04 + 0.12 * rng() : rng() < 0.12 ? 0.3 + 0.4 * rng() : 0.04 + 0.22 * rng() * rng(), radial });
  };
  const pending: [number, number, number, number, boolean, number | null, number][] = [];
  const flush = () => {
    while (pending.length) {
      const p = pending.shift()!;
      walk(p[0], p[1], p[2], p[3], p[4], p[5], p[6]);
    }
  };

  // radial fan from the four sides of the footprint
  const r0 = toCell(0.62) - toCell(0) + 1;
  const c0 = toCell(0);
  for (let k = -r0 + 2; k <= r0 - 2; k++) {
    const len = 120 + Math.floor(rng() * 260);
    walk(c0 + r0, c0 + k, 0, len, true, 0, 0);
    walk(c0 - r0, c0 + k, 4, len, true, 4, 0);
    walk(c0 + k, c0 + r0, 2, len, true, 2, 0);
    walk(c0 + k, c0 - r0, 6, len, true, 6, 0);
    flush();
  }
  // corner diagonals
  for (let k = 0; k < 6; k++) {
    walk(c0 + r0 + k, c0 + r0 - k, 1, 200, true, 1, 0);
    walk(c0 - r0 - k, c0 + r0 - k, 3, 200, true, 3, 0);
    walk(c0 - r0 - k, c0 - r0 + k, 5, 200, true, 5, 0);
    walk(c0 + r0 + k, c0 - r0 + k, 7, 200, true, 7, 0);
  }
  flush();
  // routing everywhere else, in bus bundles
  for (let i = 0; i < 4200; i++) {
    const sx = 2 + Math.floor(rng() * (n - 4));
    const sy = 2 + Math.floor(rng() * (n - 4));
    const d = Math.floor(rng() * 4) * 2;
    const bundle = 1 + Math.floor(rng() * rng() * 7);
    const len = 20 + Math.floor(rng() * 160);
    const [px, py] = DIRS[(d + 2) % 8];
    for (let b = 0; b < bundle; b++) walk(sx + px * b * 2, sy + py * b * 2, d, len, false, null, 1);
    flush();
  }
  return { half, pitch, traces, parts };
};

let cached: Board | null = null;
export const getBoard = () => (cached ??= buildBoard());

/** Point + unit direction at arc length s along a trace. */
export const traceAt = (t: Trace, s: number): [number, number, number, number] => {
  const { pts, cum } = t;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const u = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
  const dx = (b[0] - a[0]) / seg;
  const dz = (b[1] - a[1]) / seg;
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, dx, dz];
};
