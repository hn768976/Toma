import type { Key } from "../lib/math";

// Comet flight paths, keyed in seconds with positions normalised to the
// frame (x: 0 = left, 1 = right; y: 0 = top, 1 = bottom). Keys were
// traced from the reference footage at 0.2 s intervals.

export const MERGE_T = 3.3; // comets fuse into the sun
export const BURST_T = 3.55; // shockwave + particle burst
export const DURATION = 9;

export type Comet = { keys: Key[]; width: number; seed: number };

export const COMETS: Comet[] = [
  {
    // Opener: drops in from the top, hooks left and leaves bottom-left,
    // then swings back in from the lower right into the orbit.
    width: 1.0,
    seed: 11,
    keys: [
      [-0.5, 0.58, -0.35],
      [0.0, 0.5, -0.03],
      [0.2, 0.44, 0.05],
      [0.4, 0.3, 0.16],
      [0.55, 0.17, 0.4],
      [0.7, 0.11, 0.72],
      [0.9, 0.19, 1.04],
      [1.15, 0.45, 1.25],
      [1.45, 0.86, 1.12],
      [1.7, 1.02, 0.75],
      [1.95, 0.95, 0.42],
      [2.2, 0.8, 0.5],
      [2.45, 0.62, 0.57],
      [2.65, 0.46, 0.53],
      [2.85, 0.58, 0.47],
      [3.05, 0.68, 0.5],
      [3.2, 0.55, 0.5],
      [MERGE_T, 0.5, 0.5],
    ],
  },
  {
    // Rises from bottom-right, loops through the left side, then streaks
    // horizontally right and settles into the orbit.
    width: 1.15,
    seed: 23,
    keys: [
      [0.05, 1.12, 1.2],
      [0.2, 1.0, 1.02],
      [0.4, 0.8, 0.8],
      [0.6, 0.59, 0.49],
      [0.8, 0.38, 0.3],
      [1.0, 0.22, 0.27],
      [1.15, 0.12, 0.33],
      [1.3, 0.16, 0.41],
      [1.45, 0.31, 0.39],
      [1.65, 0.53, 0.46],
      [1.85, 0.66, 0.49],
      [2.05, 0.71, 0.48],
      [2.25, 0.67, 0.53],
      [2.45, 0.52, 0.56],
      [2.65, 0.62, 0.5],
      [2.85, 0.74, 0.48],
      [3.02, 0.6, 0.51],
      [3.18, 0.52, 0.5],
      [MERGE_T, 0.5, 0.5],
    ],
  },
  {
    // Dives diagonally from the top-left, exits bottom, sweeps up the right
    // edge as the big foreground arc and re-enters from the top.
    width: 1.35,
    seed: 37,
    keys: [
      [0.75, 0.13, -0.25],
      [1.0, 0.26, 0.22],
      [1.15, 0.36, 0.62],
      [1.3, 0.48, 1.08],
      [1.5, 0.74, 1.2],
      [1.7, 0.97, 0.9],
      [1.9, 0.99, 0.45],
      [2.1, 0.86, 0.06],
      [2.3, 0.62, -0.12],
      [2.45, 0.44, 0.06],
      [2.6, 0.4, 0.34],
      [2.75, 0.47, 0.5],
      [2.9, 0.64, 0.54],
      [3.05, 0.69, 0.48],
      [3.18, 0.56, 0.48],
      [MERGE_T, 0.5, 0.5],
    ],
  },
  {
    // Enters from the right edge, glides left along the top third, then
    // drops into the orbit.
    width: 0.9,
    seed: 41,
    keys: [
      [0.95, 1.18, 0.3],
      [1.2, 0.98, 0.32],
      [1.4, 0.9, 0.24],
      [1.6, 0.73, 0.22],
      [1.8, 0.62, 0.29],
      [2.0, 0.57, 0.34],
      [2.2, 0.55, 0.45],
      [2.4, 0.69, 0.53],
      [2.6, 0.79, 0.47],
      [2.8, 0.58, 0.46],
      [2.98, 0.42, 0.5],
      [3.15, 0.47, 0.52],
      [MERGE_T, 0.5, 0.5],
    ],
  },
  {
    // Late arrival from the top-left that triggers the fusion.
    width: 1.05,
    seed: 53,
    keys: [
      [2.55, 0.12, -0.25],
      [2.8, 0.22, 0.12],
      [3.0, 0.34, 0.38],
      [3.15, 0.45, 0.48],
      [MERGE_T, 0.5, 0.5],
    ],
  },
];
