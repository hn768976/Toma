import { BOARD_SEED, int, mulberry32, pick, range, type Rng } from '../lib/random';

// Seeded circuit-board layout, generated once at module load. Identical for
// every composition and every render thread (same seed, no render-time
// randomness). Coordinates are (x, z) on the board plane; the icon is at the
// origin, the camera looks from +z.

export type P2 = [number, number];

export type Trace = {
  pts: P2[];
  cum: number[]; // cumulative arc length per point
  len: number;
  color: 0 | 1; // 0 = teal, 1 = blue
  kind: 'fan' | 'bus' | 'walk';
};

export type Chip = { x: number; z: number; length: number; width: number; pins: number; pitch: number };

export type Pad = {
  x: number;
  z: number;
  r: number;
  color: 0 | 1 | 2; // teal, blue, pink accent
  square: boolean;
  base: number;
  blinkK: number; // whole cycles per loop (0 = steady)
  phase: number;
};

export type Spark = { trace: number; u0: number; k: number; size: number; color: 0 | 1 };

export type Block = { x: number; z: number; w: number; d: number; h: number };

export const TEAL = '#30D0A0';
export const BLUE = '#3F7BFF';
export const PINK = '#FF4F8F';

const S2 = Math.SQRT2;

const finish = (pts: P2[], color: 0 | 1, kind: Trace['kind']): Trace => {
  // drop duplicate / collinear points
  const clean: P2[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    const q = clean[clean.length - 1];
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-4) continue;
    if (clean.length >= 2) {
      const o = clean[clean.length - 2];
      const cross = (q[0] - o[0]) * (p[1] - q[1]) - (q[1] - o[1]) * (p[0] - q[0]);
      if (Math.abs(cross) < 1e-7) { clean[clean.length - 1] = p; continue; }
    }
    clean.push(p);
  }
  const cum = [0];
  for (let i = 1; i < clean.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(clean[i][0] - clean[i - 1][0], clean[i][1] - clean[i - 1][1]));
  }
  return { pts: clean, cum, len: cum[cum.length - 1], color, kind };
};

// Keep-out around the icon and its label.
const inIconZone = (x: number, z: number) => Math.abs(x) < 0.78 && z > -0.45 && z < 0.6;

const generate = (rng: Rng) => {
  const chips: Chip[] = [
    { x: -2.15, z: 0.25, length: 1.45, width: 0.19, pins: 9, pitch: 0.13 },
    { x: 2.3, z: -0.4, length: 1.5, width: 0.19, pins: 9, pitch: 0.135 },
    { x: -5.6, z: -4.4, length: 1.35, width: 0.19, pins: 7, pitch: 0.15 },
    { x: 6.0, z: -3.6, length: 1.4, width: 0.19, pins: 7, pitch: 0.15 },
  ];
  const traces: Trace[] = [];
  const pads: Pad[] = [];

  const pinZ = (c: Chip, i: number) => c.z + (i - (c.pins - 1) / 2) * c.pitch;
  const chipEdge = (c: Chip, side: number) => c.x + side * (c.width / 2 + 0.07);

  const endPad = (x: number, z: number, color: 0 | 1) => {
    pads.push({
      x, z, r: range(rng, 0.018, 0.028), color, square: false,
      base: range(rng, 0.7, 1.2),
      blinkK: rng() < 0.4 ? int(rng, 2, 9) : 0,
      phase: rng(),
    });
  };

  // ---- fans: chip inner side → spreading towards the icon (45° bends) ----
  const fan = (c: Chip, side: number, targetZ: number, spread: number, reach: [number, number]) => {
    const mid = (c.pins - 1) / 2;
    const maxRank = mid;
    for (let i = 0; i < c.pins; i++) {
      const z0 = pinZ(c, i);
      const x0 = chipEdge(c, side);
      const rank = Math.abs(i - mid);
      // outer traces bend first so the fan never crosses itself
      const x1 = x0 + side * (0.08 + 0.07 * (maxRank - rank) + range(rng, 0, 0.02));
      const zt = targetZ + (i - mid) * spread + range(rng, -0.03, 0.03);
      const dz = zt - z0;
      const x2 = x1 + side * Math.abs(dz);
      let xe = side * range(rng, reach[0], reach[1]);
      if (side * (xe - x2) < 0.12) xe = x2 + side * 0.12;
      let pts: P2[] = [[x0, z0], [x1, z0], [x2, zt], [xe, zt]];
      // keep out of the icon zone
      if (pts.some(([x, z]) => inIconZone(x, z))) {
        xe = side * 0.82;
        pts = [[x0, z0], [x1, z0], [x2, zt], [xe, zt]];
      }
      // occasional second jog near the end
      if (rng() < 0.3 && Math.abs(xe - x2) > 0.5) {
        const xm = x2 + (xe - x2) * range(rng, 0.35, 0.6);
        const j = (zt > c.z ? 1 : -1) * range(rng, 0.05, 0.12);
        pts = [[x0, z0], [x1, z0], [x2, zt], [xm, zt], [xm + side * Math.abs(j), zt + j], [xe, zt + j]];
        if (pts.some(([x, z]) => inIconZone(x, z))) pts = [[x0, z0], [x1, z0], [x2, zt], [xe, zt]];
      }
      const color: 0 | 1 = rng() < 0.55 ? 0 : 1;
      const t = finish(pts, color, 'fan');
      traces.push(t);
      const e = t.pts[t.pts.length - 1];
      endPad(e[0], e[1], color);
    }
  };

  // ---- buses: chip outer side → parallel runs off the board with 45° jogs ----
  const bus = (c: Chip, side: number, farX: number) => {
    const p = c.pitch;
    const group = 3;
    for (let g0 = 0; g0 < c.pins; g0 += group) {
      const members = Array.from({ length: Math.min(group, c.pins - g0) }, (_, k) => g0 + k);
      const jogs: { x: number; dz: number }[] = [];
      let xs = chipEdge(c, side) + side * range(rng, 0.25, 0.9);
      const nj = int(rng, 1, 3);
      for (let j = 0; j < nj; j++) {
        jogs.push({ x: xs, dz: pick(rng, [-1, 1]) * range(rng, 0.15, 0.6) });
        xs += side * range(rng, 0.9, 2.4);
      }
      const color: 0 | 1 = rng() < 0.6 ? 0 : 1;
      for (const i of members) {
        let z = pinZ(c, i);
        const x0 = chipEdge(c, side);
        const pts: P2[] = [[x0, z]];
        for (const jg of jogs) {
          // parallel 45° jog: lines on the turn side start earlier by p(√2−1)
          const dir = Math.sign(jg.dz);
          const rankTowardTurn = dir > 0 ? members[members.length - 1] - i : i - members[0];
          const xStart = jg.x + side * rankTowardTurn * p * (S2 - 1);
          pts.push([xStart, z]);
          z += jg.dz;
          pts.push([xStart + side * Math.abs(jg.dz), z]);
        }
        pts.push([farX * side, z]);
        // bus traces run far → chip, so sparks travel toward the icon
        traces.push(finish(pts.reverse(), color, 'bus'));
      }
    }
  };

  fan(chips[0], 1, 0.0, 0.19, [0.82, 1.25]);
  bus(chips[0], -1, 16);
  fan(chips[1], -1, -0.1, 0.2, [0.82, 1.3]);
  bus(chips[1], 1, 16);
  fan(chips[2], 1, -3.8, 0.24, [3.0, 4.2]);
  bus(chips[2], -1, 18);
  fan(chips[3], -1, -2.8, 0.24, [3.2, 4.4]);
  bus(chips[3], 1, 18);

  // ---- random 45° walkers filling the board ----
  const dirs: P2[] = [[1, 0], [S2 / 2, S2 / 2], [0, 1], [-S2 / 2, S2 / 2], [-1, 0], [-S2 / 2, -S2 / 2], [0, -1], [S2 / 2, -S2 / 2]];
  let walkers = 0;
  let attempts = 0;
  while (walkers < 34 && attempts < 400) {
    attempts++;
    let x = range(rng, -9, 9);
    let z = range(rng, -9, 1.8);
    if (Math.hypot(x, z * 1.3) < 1.8) continue;
    let d = int(rng, 0, 7);
    const pts: P2[] = [[x, z]];
    const segs = int(rng, 2, 5);
    let ok = true;
    for (let s = 0; s < segs; s++) {
      const L = range(rng, 0.3, 1.4);
      x += dirs[d][0] * L;
      z += dirs[d][1] * L;
      if (Math.hypot(x, z * 1.3) < 1.5 || inIconZone(x, z)) { ok = false; break; }
      pts.push([x, z]);
      d = (d + pick(rng, [-1, 1, -1, 1, 2, -2]) + 8) % 8;
    }
    if (!ok || pts.length < 3) continue;
    const color: 0 | 1 = rng() < 0.5 ? 0 : 1;
    traces.push(finish(pts, color, 'walk'));
    endPad(pts[0][0], pts[0][1], color);
    endPad(x, z, color);
    walkers++;
  }

  // ---- via / LED dot field around the icon ----
  const g = 0.085;
  for (let ix = -30; ix <= 30; ix++) {
    for (let iz = -30; iz <= 14; iz++) {
      const x = ix * g;
      const z = iz * g;
      const r = Math.hypot(x / 1.25, (z + 0.3) / 1.1);
      if (inIconZone(x, z)) continue;
      const pr = 0.32 * Math.exp(-r * r * 1.1) * (ix % 2 === 0 ? 1 : 0.3);
      if (rng() > pr) continue;
      const roll = rng();
      pads.push({
        x, z, r: range(rng, 0.0065, 0.011),
        color: roll < 0.06 ? 2 : roll < 0.55 ? 0 : 1,
        square: true,
        base: range(rng, 0.25, 0.8),
        blinkK: rng() < 0.3 ? int(rng, 3, 14) : 0,
        phase: rng(),
      });
    }
  }

  // ---- sparks: travel along traces toward the icon, whole cycles per loop ----
  const sparks: Spark[] = [];
  traces.forEach((t, i) => {
    const p = t.kind === 'fan' ? 0.75 : t.kind === 'bus' ? 0.4 : 0.3;
    const n = t.kind === 'bus' && rng() < 0.3 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      if (rng() > p) continue;
      const cycles = t.kind === 'fan' ? int(rng, 2, 4) : t.kind === 'bus' ? int(rng, 1, 2) : int(rng, 1, 3);
      sparks.push({ trace: i, u0: rng(), k: cycles, size: range(rng, 0.8, 1.2), color: t.color });
    }
  });

  // ---- dark blocks farther from the icon ----
  const blocks: Block[] = [];
  const cell = 1.15;
  for (let ix = -14; ix <= 14; ix++) {
    for (let iz = -16; iz <= 3; iz++) {
      const cx = ix * cell + range(rng, -0.15, 0.15);
      const cz = iz * cell + range(rng, -0.15, 0.15);
      const r = Math.hypot(cx / 1.3, cz);
      if (r < 3.4) continue;
      if (chips.some((c) => Math.abs(c.x - cx) < 1.1 && Math.abs(c.z - cz) < 1.5)) continue;
      if (rng() > (cz > 0 ? 0.35 : 0.55)) continue;
      const w = range(rng, 0.55, 1.05);
      const d = range(rng, 0.55, 1.05);
      const h = rng() < 0.6 ? range(rng, 0.04, 0.25) : range(rng, 0.3, 1.1);
      blocks.push({ x: cx, z: cz, w, d, h });
    }
  }

  return { chips, traces, pads, sparks, blocks };
};

export const BOARD = generate(mulberry32(BOARD_SEED));

/** Position + unit direction at arc-length fraction u along a trace. */
export const sampleTrace = (t: Trace, u: number): { x: number; z: number; dx: number; dz: number } => {
  const s = Math.min(Math.max(u, 0), 1) * t.len;
  let i = 1;
  while (i < t.cum.length - 1 && t.cum[i] < s) i++;
  const a = t.pts[i - 1];
  const b = t.pts[i];
  const seg = t.cum[i] - t.cum[i - 1] || 1;
  const f = (s - t.cum[i - 1]) / seg;
  return {
    x: a[0] + (b[0] - a[0]) * f,
    z: a[1] + (b[1] - a[1]) * f,
    dx: (b[0] - a[0]) / seg,
    dz: (b[1] - a[1]) / seg,
  };
};
