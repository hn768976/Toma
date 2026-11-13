import { clamp, easeOutCubic, mulberry32 } from "./random";

/**
 * Voxel brain: a side-profile brain silhouette (frontal lobe facing left,
 * cerebellum and a short, wide brain stem at the lower right) extruded into
 * a rounded relief, plus the fly-in choreography that assembles it on the
 * pedestal.
 *
 * Choreography (matched to the reference):
 * - ~1.2–2.4 s: a few "scout" cubes drop in from high above.
 * - ~2.2–5.3 s: the swarm. Large tumbling glass cubes arrive from above and
 *   the upper left, shrink as they settle and lock in sweeping from the back
 *   (right) of the brain to the front (left). Only the front face flies;
 *   the cubes behind it fade in place, so the swarm stays airy instead of a
 *   dense column.
 * - 5.5 s onwards: the finished brain holds.
 */

export const VOXEL = 0.2; // world size of one voxel
export const COLS = 20;
export const ROWS = 16;

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Brain silhouette in voxel units: X in [-10, 10], Y in [0, 16]. */
const insideBrain = (X: number, Y: number) => {
  const cerebrum = inEllipse(X, Y, 0, 9.4, 9.8, 6.4);
  const frontal = inEllipse(X, Y, -6.2, 8.6, 4.0, 5.2);
  const temporal = inEllipse(X, Y, -3.6, 5.0, 5.6, 2.6);
  const cerebellum = inEllipse(X, Y, 5.6, 3.6, 3.6, 2.5);
  // Short, wide stem joining the brain to the pedestal.
  const stem = X >= 1.0 && X <= 4.5 && Y >= 0 && Y <= 3.2;
  // Small notch between the temporal lobe and the stem.
  const notch = inEllipse(X, Y, -0.6, 1.2, 1.3, 1.6);
  return (cerebrum || frontal || temporal || cerebellum || stem) && !notch;
};

export type Voxel = {
  /** Final resting position (world, relative to the brain origin). */
  tx: number;
  ty: number;
  tz: number;
  /** Whether this cube flies in (surface layers) or fades in place (interior). */
  flies: boolean;
  /** Fly-in start offset relative to the target. */
  ox: number;
  oy: number;
  oz: number;
  /** Bezier bulge so cubes swoop instead of travelling in straight lines. */
  bx: number;
  by: number;
  bz: number;
  /** Scale while in flight (shrinks to 1 as it settles). */
  flightScale: number;
  start: number; // seconds
  dur: number; // seconds
  spinX: number;
  spinY: number;
  spinZ: number;
  shade: number; // per-cube brightness variation
};

export const buildVoxels = (): Voxel[] => {
  const rand = mulberry32(7331);
  const mask: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    mask.push([]);
    for (let c = 0; c < COLS; c++) {
      mask[r].push(insideBrain(c - COLS / 2 + 0.5, r + 0.5));
    }
  }
  // Distance (in cells) to the silhouette edge, for a rounded relief.
  const dist: number[][] = mask.map((row) => row.map(() => 0));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!mask[r][c]) continue;
      let best = 99;
      for (let rr = 0; rr < ROWS; rr++) {
        for (let cc = 0; cc < COLS; cc++) {
          if (mask[rr][cc]) continue;
          const d = Math.hypot(rr - r, cc - c);
          if (d < best) best = d;
        }
      }
      best = Math.min(best, c + 1, COLS - c, ROWS - r + 2);
      dist[r][c] = best;
    }
  }

  const voxels: Voxel[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!mask[r][c]) continue;
      const X = c - COLS / 2 + 0.5;
      const isStem = X >= 1.0 && X <= 4.5 && r < 3;
      const t = clamp((dist[r][c] - 1) / 3.2, 0, 1);
      const layers = isStem ? 3 : 2 + Math.round(Math.sqrt(t) * 6);
      const xNorm = (c + 0.5) / COLS; // 0 = left (frontal), 1 = right
      const yNorm = (r + 0.5) / ROWS;
      // Lock-in order: sweep from the right (back of the brain) to the left.
      const columnStart = 2.1 + (1 - xNorm) * 1.75 + yNorm * 0.12;
      for (let l = 0; l < layers; l++) {
        const z = (l - (layers - 1) / 2) * VOXEL;
        // Only the visible front face flies in; the rest materialise in place.
        const surface = l === layers - 1;
        const start = columnStart + rand() * 0.4;
        const dur = 0.72 + rand() * 0.3;
        voxels.push({
          tx: X * VOXEL,
          ty: (r + 0.5) * VOXEL,
          // Slight depth jitter on the front surface gives a crafted, uneven relief.
          tz: z + (l === layers - 1 ? (rand() - 0.5) * 0.04 : 0),
          // About half of the front face flies; the rest materialise, keeping the swarm sparse.
          flies: surface && rand() < 0.5,
          // From above and the upper left, some towards the camera (they read larger).
          ox: -2.4 + rand() * 2.2,
          oy: 1.2 + rand() * 2.4,
          oz: -0.3 + rand() * 2.2,
          bx: (rand() - 0.5) * 1.4,
          by: (rand() - 0.2) * 0.9,
          bz: (rand() - 0.5) * 1.2,
          flightScale: 2.0 + rand() * 1.8,
          start,
          dur,
          spinX: (rand() - 0.5) * 6,
          spinY: (rand() - 0.5) * 6,
          spinZ: (rand() - 0.5) * 6,
          shade: 0.82 + rand() * 0.3,
        });
      }
    }
  }

  // A handful of "scout" cubes drop in early from high above (≈1.2–2.4 s).
  const scouts = voxels.filter((v) => v.flies && v.ty < 1.0 && v.tx > 0.1);
  for (let s = 0; s < 3 && scouts.length; s++) {
    const pick = scouts[Math.floor(rand() * scouts.length)];
    pick.start = 1.3 + s * 0.3 + rand() * 0.08;
    pick.dur = 1.0 + rand() * 0.25;
    pick.ox = -0.2 + rand() * 1.0;
    pick.oy = 5.5 + rand() * 2.0;
    pick.oz = -0.3 + rand() * 0.8;
    pick.flightScale = 1.2 + rand() * 0.5;
  }
  return voxels;
};

export type VoxelPose = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  glow: number;
};

/** Pose of a voxel at time t (seconds). */
export const voxelPose = (v: Voxel, t: number, out: VoxelPose): VoxelPose => {
  const raw = clamp((t - v.start) / v.dur, 0, 1);
  out.rx = out.ry = out.rz = 0;
  if (!v.flies) {
    // Interior cubes materialise in place as their column locks in.
    const k = clamp((t - (v.start + v.dur * 0.75)) / 0.3, 0, 1);
    out.x = v.tx;
    out.y = v.ty;
    out.z = v.tz;
    out.scale = easeOutCubic(k);
    out.glow = k > 0 && k < 1 ? 0.4 : 0;
    return out;
  }
  if (t < v.start) {
    out.scale = 0;
    out.x = v.tx + v.ox;
    out.y = v.ty + v.oy;
    out.z = v.tz + v.oz;
    out.glow = 0;
    return out;
  }
  const e = easeOutCubic(raw);
  const inv = 1 - e;
  // Quadratic bezier: start -> bulge -> target.
  const sx = v.tx + v.ox;
  const sy = v.ty + v.oy;
  const sz = v.tz + v.oz;
  const mx = v.tx + v.ox * 0.45 + v.bx;
  const my = v.ty + v.oy * 0.45 + v.by;
  const mz = v.tz + v.oz * 0.45 + v.bz;
  out.x = inv * inv * sx + 2 * inv * e * mx + e * e * v.tx;
  out.y = inv * inv * sy + 2 * inv * e * my + e * e * v.ty;
  out.z = inv * inv * sz + 2 * inv * e * mz + e * e * v.tz;
  out.rx = v.spinX * inv;
  out.ry = v.spinY * inv;
  out.rz = v.spinZ * inv;
  // Appear quickly, large while tumbling, shrinking onto the lattice.
  const appear = clamp(raw / 0.1, 0, 1);
  out.scale = appear * (1 + (v.flightScale - 1) * inv * inv);
  out.glow = raw >= 1 ? Math.max(0, 1 - (t - v.start - v.dur) / 0.35) : e * 0.5;
  return out;
};
