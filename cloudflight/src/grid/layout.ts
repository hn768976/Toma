import { mulberry32 } from "../lib/random";

/** Seeded Data Grid layout: axis-aligned segments, dots and tags. */

export const BOX = { x: [-26, 26], y: [-11, 11], z: [-95, 14] } as const;
export const LEVELS_Y = [-9.5, -6.5, -4, 4, 6.5, 9.5];
export const LEVELS_X = [-20, -13, -8, -5, 5, 8, 13, 20];
export const TAG_PERIODS = [30, 40, 50, 60, 75, 100, 120, 150, 200, 300, 600];

export type Segment = { a: [number, number, number]; b: [number, number, number]; bright: number };
export type Tag = {
  pos: [number, number, number];
  scale: number;
  period: number;
  values: string[];
};

const snap = (v: number, step: number) => Math.round(v / step) * step;

export const makeLayout = (seed: number, nLines = 1200, nTags = 150) => {
  const rng = mulberry32(seed);
  const r = (a: number, b: number) => a + (b - a) * rng();
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rng() * arr.length)];
  const segs: Segment[] = [];
  // A few long full-width lines (floors and a horizon) give the grid its order.
  for (const [y, z] of [[0.15, -60], [-4, -35], [4, -45], [-6.5, -70], [6.5, -25]] as const) {
    segs.push({ a: [-60, y, z], b: [60, y, z], bright: 1.2 });
  }
  while (segs.length < nLines) {
    const k = rng();
    let a: [number, number, number];
    let b: [number, number, number];
    if (k < 0.3) {
      // Receding along z, mostly on floor/ceiling planes.
      const x = snap(r(BOX.x[0], BOX.x[1]), 1.5);
      const y = rng() < 0.7 ? pick(LEVELS_Y) + snap(r(-0.6, 0.6), 0.3) : snap(r(BOX.y[0], BOX.y[1]), 1);
      // Receding lines start well ahead so they don't fan out as a starburst.
      const z0 = r(BOX.z[0], -18);
      const len = r(2, 16);
      a = [x, y, z0];
      b = [x, y, z0 - len];
    } else if (k < 0.66) {
      // Across, along x.
      const y = rng() < 0.7 ? pick(LEVELS_Y) : snap(r(BOX.y[0], BOX.y[1]), 1);
      const z = snap(r(BOX.z[0], BOX.z[1]), 2);
      const x0 = r(BOX.x[0], BOX.x[1]);
      const len = rng() < 0.1 ? r(15, 40) : r(1.5, 14);
      a = [x0, y, z];
      b = [x0 + len * (rng() < 0.5 ? -1 : 1), y, z];
    } else {
      // Vertical, along y, often on wall planes.
      const x = rng() < 0.6 ? pick(LEVELS_X) + snap(r(-0.8, 0.8), 0.4) : snap(r(BOX.x[0], BOX.x[1]), 1);
      const z = snap(r(BOX.z[0], BOX.z[1]), 2);
      const y0 = r(BOX.y[0], BOX.y[1]);
      const len = rng() < 0.12 ? r(10, 22) : r(1.5, 9);
      a = [x, y0, z];
      b = [x, y0 + len * (rng() < 0.5 ? -1 : 1), z];
    }
    // Keep the camera corridor open.
    const midX = (a[0] + b[0]) / 2;
    const midY = (a[1] + b[1]) / 2;
    if (Math.abs(midX) < 2.2 && Math.abs(midY) < 2.2) continue;
    const bright = rng() < 0.07 ? r(1.2, 1.6) : r(0.35, 0.8);
    segs.push({ a, b, bright });
    // Circuit-trace bends: a short perpendicular run at one end.
    if (rng() < 0.15 && segs.length < nLines) {
      const axis = a[0] !== b[0] ? 1 : 0;
      const e: [number, number, number] = [b[0], b[1], b[2]];
      e[axis] += (rng() < 0.5 ? -1 : 1) * r(0.8, 2.5);
      segs.push({ a: b, b: e, bright });
    }
  }

  // Dots at a share of line ends.
  const dots: { p: [number, number, number]; size: number; phase: number }[] = [];
  segs.forEach((s) => {
    if (rng() < 0.6) dots.push({ p: s.a, size: r(0.7, 1.4), phase: rng() * Math.PI * 2 });
    if (rng() < 0.4) dots.push({ p: s.b, size: r(0.7, 1.4), phase: rng() * Math.PI * 2 });
  });

  // Tags sit on lines, mostly in the space ahead of the camera.
  const ahead = segs.filter((s) => {
    const z = (s.a[2] + s.b[2]) / 2;
    const x = (s.a[0] + s.b[0]) / 2;
    const y = (s.a[1] + s.b[1]) / 2;
    return z < -16 && z > -70 && Math.abs(x) < 15 && Math.abs(y) < 8;
  });
  const tags: Tag[] = [];
  while (tags.length < nTags) {
    const pool = rng() < 0.85 ? ahead : segs;
    const s = pool[Math.floor(rng() * pool.length)];
    const t = rng();
    const p: [number, number, number] = [
      s.a[0] + (s.b[0] - s.a[0]) * t,
      s.a[1] + (s.b[1] - s.a[1]) * t + 0.25,
      s.a[2] + (s.b[2] - s.a[2]) * t,
    ];
    const period = pick(TAG_PERIODS);
    const n = 600 / period;
    const values = Array.from({ length: n }, () => (10 + rng() * 89.99).toFixed(2));
    tags.push({ pos: p, scale: r(0.6, 0.95), period, values });
  }
  return { segs, dots, tags };
};
