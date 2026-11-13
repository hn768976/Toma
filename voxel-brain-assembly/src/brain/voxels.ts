import { clamp, easeOutCubic, mulberry32 } from "./random";

/**
 * Voxel brain: a side-profile brain silhouette (frontal lobe facing left,
 * cerebellum + brain stem at the lower right) extruded into a rounded
 * relief, plus the fly-in choreography that assembles it on the pedestal.
 */

export const VOXEL = 0.2; // world size of one voxel
export const COLS = 20;
export const ROWS = 16;

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Brain silhouette in voxel units: X in [-10, 10], Y in [0, 16]. */
const insideBrain = (X: number, Y: number) => {
  const cerebrum = inEllipse(X, Y, 0, 9.7, 9.7, 6.15);
  const temporal = inEllipse(X, Y, -5.0, 5.4, 4.6, 3.0);
  const frontal = inEllipse(X, Y, -6.2, 8.4, 3.8, 4.6);
  const cerebellum = inEllipse(X, Y, 5.5, 4.3, 3.4, 2.25);
  const stem = X >= 1.0 && X <= 3.6 && Y >= 0 && Y <= 4.6;
  return cerebrum || temporal || frontal || cerebellum || stem;
};

export type Voxel = {
  /** Final resting position (world, relative to the brain origin). */
  tx: number;
  ty: number;
  tz: number;
  /** Fly-in start offset relative to the target. */
  ox: number;
  oy: number;
  oz: number;
  /** Bezier bulge so cubes swoop instead of travelling in straight lines. */
  bx: number;
  by: number;
  bz: number;
  start: number; // seconds
  dur: number; // seconds
  spinX: number;
  spinY: number;
  spinZ: number;
  shade: number; // per-cube brightness variation
};

export const buildVoxels = (): Voxel[] => {
  const rand = mulberry32(7331);
  // 2D mask
  const mask: boolean[][] = [];
  for (let r = 0; r < ROWS; r++) {
    mask.push([]);
    for (let c = 0; c < COLS; c++) {
      const X = c - COLS / 2 + 0.5;
      const Y = r + 0.5;
      mask[r].push(insideBrain(X, Y));
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
      // Grid border counts as outside too.
      best = Math.min(best, r + 1, c + 1, COLS - c, ROWS - r + 2);
      dist[r][c] = best;
    }
  }

  const voxels: Voxel[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!mask[r][c]) continue;
      const X = c - COLS / 2 + 0.5;
      const isStem = X >= 1.0 && X <= 3.6 && r < 4;
      const t = clamp((dist[r][c] - 1) / 3.2, 0, 1);
      const layers = isStem ? 2 : 2 + Math.round(Math.sqrt(t) * 6);
      for (let l = 0; l < layers; l++) {
        const z = (l - (layers - 1) / 2) * VOXEL;
        const xNorm = (c + 0.5) / COLS; // 0 = left (frontal), 1 = right
        const yNorm = (r + 0.5) / ROWS;
        // Assembly sweeps from the right-hand side towards the frontal lobe.
        const start = 2.05 + (1 - xNorm) * 1.5 + yNorm * 0.25 + rand() * 0.4;
        const dur = 0.62 + rand() * 0.38;
        // Off-target start: mostly above and to the right, a few in front.
        const ox = 0.3 + rand() * 1.9;
        const oy = 0.9 + rand() * 2.6;
        const oz = -1.0 + rand() * 2.8;
        voxels.push({
          tx: X * VOXEL,
          ty: (r + 0.5) * VOXEL,
          // Slight depth jitter on the surface gives the relief a crafted, uneven feel.
          tz: z + (l === layers - 1 ? (rand() - 0.5) * 0.05 : 0),
          ox,
          oy,
          oz,
          bx: (rand() - 0.3) * 1.6,
          by: (rand() - 0.2) * 1.2,
          bz: (rand() - 0.5) * 1.6,
          start,
          dur,
          spinX: (rand() - 0.5) * 7,
          spinY: (rand() - 0.5) * 7,
          spinZ: (rand() - 0.5) * 7,
          shade: 0.78 + rand() * 0.38,
        });
      }
    }
  }

  // A handful of "scout" cubes that drop in early from high above (≈1.2–2.3 s),
  // as in the reference, before the main swarm arrives.
  const scouts = voxels
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.ty < 1.2 && v.tx > 0.1)
    .slice(0, 40);
  for (let s = 0; s < 7 && scouts.length; s++) {
    const pick = scouts[Math.floor(rand() * scouts.length)].v;
    pick.start = 1.15 + s * 0.17 + rand() * 0.08;
    pick.dur = 0.95 + rand() * 0.25;
    pick.ox = 0.4 + rand() * 1.4;
    pick.oy = 5.5 + rand() * 2.5;
    pick.oz = -0.5 + rand() * 1.0;
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
  if (t < v.start) {
    out.scale = 0;
    out.x = v.tx + v.ox;
    out.y = v.ty + v.oy;
    out.z = v.tz + v.oz;
    out.rx = out.ry = out.rz = 0;
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
  out.scale = clamp(raw / 0.12, 0, 1) * (0.92 + 0.08 * e);
  // Brief flash as the cube locks into place.
  out.glow = raw >= 1 ? Math.max(0, 1 - (t - v.start - v.dur) / 0.35) : e * 0.6;
  return out;
};
