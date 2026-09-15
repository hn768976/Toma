// Procedural PCB trace generator.
//
// Most of the references sit the hero on a printed-circuit background: long
// orthogonal runs that turn at right angles and 45 degrees, ending in round
// pads. Generating them beats hand-authoring because each version can ask for a
// different density, direction bias and seed and get a field that suits it,
// and because the walk also reports distance-along-trace, which is what lets
// the shader run energy pulses down each run.

import { makeRng, range } from "./rng";

export type TraceField = {
  /** Flat XYZ pairs, one pair per segment, ready for LineSegments. */
  positions: Float32Array;
  /** Distance from the start of the run, per vertex. */
  distances: Float32Array;
  /** Total length of the run each vertex belongs to. */
  lengths: Float32Array;
  /** Stable per-run id, used to de-phase the pulses. */
  ids: Float32Array;
  /** Pad centres, flat XYZ. */
  pads: Float32Array;
};

export type TraceOptions = {
  /** Number of runs to generate. */
  count: number;
  /** Half-extents of the area traces are laid out in. */
  width: number;
  height: number;
  /** Grid pitch. Traces only ever turn on these boundaries. */
  pitch?: number;
  /** Segments per run, before it is cut short at the field edge. */
  steps?: number;
  /** 0 = no directional bias, 1 = every run heads along +/-X. */
  horizontalBias?: number;
  /** Probability of a 45-degree rather than 90-degree turn. */
  diagonalChance?: number;
  /** Chance a run ends in a pad. */
  padChance?: number;
  seed?: number;
};

const DIRS_ORTHO: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIRS_DIAG: [number, number][] = [
  [0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, 0.7071],
  [-0.7071, -0.7071],
];

export const generateTraces = ({
  count,
  width,
  height,
  pitch = 0.22,
  steps = 7,
  horizontalBias = 0.5,
  diagonalChance = 0.22,
  padChance = 0.55,
  seed = 11,
}: TraceOptions): TraceField => {
  const rng = makeRng(seed);
  const positions: number[] = [];
  const distances: number[] = [];
  const lengths: number[] = [];
  const ids: number[] = [];
  const pads: number[] = [];

  for (let t = 0; t < count; t++) {
    // Snap the start to the grid so parallel runs line up like a real board.
    let x = Math.round(range(rng, -width, width) / pitch) * pitch;
    let y = Math.round(range(rng, -height, height) / pitch) * pitch;

    let dir: [number, number] =
      rng() < horizontalBias
        ? rng() < 0.5
          ? [1, 0]
          : [-1, 0]
        : rng() < 0.5
          ? [0, 1]
          : [0, -1];

    const points: [number, number][] = [[x, y]];
    const stepCount = Math.max(2, Math.round(steps * range(rng, 0.5, 1.5)));

    for (let s = 0; s < stepCount; s++) {
      const run = pitch * Math.round(range(rng, 1, 6));
      x += dir[0] * run;
      y += dir[1] * run;
      // Stop at the edge rather than wrapping, so runs read as finite parts.
      if (Math.abs(x) > width || Math.abs(y) > height) break;
      points.push([x, y]);

      if (rng() < 0.75) {
        const pool = rng() < diagonalChance ? DIRS_DIAG : DIRS_ORTHO;
        const next = pool[Math.floor(rng() * pool.length)];
        // Never double back on itself; that reads as a glitch, not a trace.
        if (next[0] !== -dir[0] || next[1] !== -dir[1]) {
          dir = next;
        }
      }
    }

    if (points.length < 2) continue;

    let total = 0;
    const cumulative: number[] = [0];
    for (let i = 1; i < points.length; i++) {
      total += Math.hypot(
        points[i][0] - points[i - 1][0],
        points[i][1] - points[i - 1][1],
      );
      cumulative.push(total);
    }
    if (total <= 0) continue;

    const id = t / Math.max(1, count - 1);
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      positions.push(a[0], a[1], 0, b[0], b[1], 0);
      distances.push(cumulative[i - 1], cumulative[i]);
      lengths.push(total, total);
      ids.push(id, id);
    }

    if (rng() < padChance) {
      const end = points[points.length - 1];
      pads.push(end[0], end[1], 0);
    }
    if (rng() < padChance * 0.5) {
      pads.push(points[0][0], points[0][1], 0);
    }
  }

  return {
    positions: new Float32Array(positions),
    distances: new Float32Array(distances),
    lengths: new Float32Array(lengths),
    ids: new Float32Array(ids),
    pads: new Float32Array(pads),
  };
};
