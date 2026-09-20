import { mulberry32, type Rng } from "./random";

export type Pt = { x: number; y: number };

export type TracePath = {
  points: Pt[];
  /** Per-path phase so data packets do not march in lockstep. */
  phase: number;
  /** Cumulative length at each point, normalised to 0..1 across the board. */
  dist: number[];
  width: number;
  /** Junction pads to punch along the run. */
  pads: Pt[];
};

const DIRS: Pt[] = [
  { x: 1, y: 0 },
  { x: 0.7071, y: 0.7071 },
  { x: 0, y: 1 },
  { x: -0.7071, y: 0.7071 },
  { x: -1, y: 0 },
  { x: -0.7071, y: -0.7071 },
  { x: 0, y: -1 },
  { x: 0.7071, y: -0.7071 },
];

const snapToNearestDir = (vx: number, vy: number) => {
  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < DIRS.length; i++) {
    const d = DIRS[i].x * vx + DIRS[i].y * vy;
    if (d > bestDot) {
      bestDot = d;
      best = i;
    }
  }
  return best;
};

/**
 * Routes PCB-looking traces outward from the chip footprint to the board edge.
 *
 * Real boards run on an octilinear grid (90° and 45° only), which is what makes
 * a circuit board read as a circuit board rather than as random scribble, so
 * every segment is snapped to one of eight directions and the walk is biased
 * to keep heading away from the chip.
 */
export type GraphMode = "fan" | "field";

export const buildTraceGraph = (
  seed: number,
  density: number,
  opts?: { chipHalf?: number; margin?: number; mode?: GraphMode },
): TracePath[] => {
  const rng: Rng = mulberry32(seed);
  const mode: GraphMode = opts?.mode ?? "fan";
  const chipHalf = opts?.chipHalf ?? 0.085;
  const margin = opts?.margin ?? 0.02;
  const paths: TracePath[] = [];

  // The "field" layer tiles across the wider board and therefore has no chip
  // footprint to fan out from: it is clutter only.
  const fanCount = mode === "field" ? 0 : Math.max(24, Math.round(112 * density));

  // Fan-out: one trace per chip pin, walking to the edge of the board.
  for (let i = 0; i < fanCount; i++) {
    const side = i % 4;
    const t = (Math.floor(i / 4) + 0.5) / Math.ceil(fanCount / 4);
    const jitter = (rng() - 0.5) * 0.012;
    let x: number;
    let y: number;
    let dir: number;
    const along = (t - 0.5) * 2 * chipHalf * 1.9 + jitter;
    if (side === 0) {
      x = 0.5 + along;
      y = 0.5 - chipHalf;
      dir = 6;
    } else if (side === 1) {
      x = 0.5 + chipHalf;
      y = 0.5 + along;
      dir = 0;
    } else if (side === 2) {
      x = 0.5 + along;
      y = 0.5 + chipHalf;
      dir = 2;
    } else {
      x = 0.5 - chipHalf;
      y = 0.5 + along;
      dir = 4;
    }

    const points: Pt[] = [{ x, y }];
    const pads: Pt[] = [];
    let guard = 0;
    while (guard++ < 26) {
      // Bias each hop back toward "outward" so traces never coil inward.
      const outward = snapToNearestDir(x - 0.5, y - 0.5);
      if (rng() < 0.55) {
        dir = outward;
      } else {
        const turn = rng() < 0.5 ? 1 : -1;
        dir = (outward + turn + 8) % 8;
      }
      const len = 0.03 + rng() * 0.12;
      x += DIRS[dir].x * len;
      y += DIRS[dir].y * len;
      points.push({ x, y });
      if (rng() < 0.22) pads.push({ x, y });
      if (x < -margin || x > 1 + margin || y < -margin || y > 1 + margin) break;
    }

    paths.push(finalise(points, pads, 0.0022 + rng() * 0.0026, rng()));
  }

  // Secondary clutter: short runs between components out in the field, which
  // keeps the board from looking like a bare starburst.
  const clutter = Math.round((mode === "field" ? 320 : 150) * density);
  for (let i = 0; i < clutter; i++) {
    let x = rng();
    let y = rng();
    // Keep clutter off the chip footprint on the fan layer only.
    if (
      mode === "fan" &&
      Math.abs(x - 0.5) < chipHalf * 1.4 &&
      Math.abs(y - 0.5) < chipHalf * 1.4
    ) {
      x = x < 0.5 ? x - chipHalf * 1.6 : x + chipHalf * 1.6;
    }
    const points: Pt[] = [{ x, y }];
    const pads: Pt[] = [];
    let dir = Math.floor(rng() * 8);
    const hops = 2 + Math.floor(rng() * 4);
    for (let h = 0; h < hops; h++) {
      if (rng() < 0.45) dir = (dir + (rng() < 0.5 ? 1 : -1) + 8) % 8;
      const len = 0.02 + rng() * 0.07;
      x += DIRS[dir].x * len;
      y += DIRS[dir].y * len;
      points.push({ x, y });
      if (rng() < 0.3) pads.push({ x, y });
    }
    paths.push(finalise(points, pads, 0.0016 + rng() * 0.0018, rng()));
  }

  return paths;
};

const finalise = (
  points: Pt[],
  pads: Pt[],
  width: number,
  phase: number,
): TracePath => {
  const dist: number[] = [0];
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    acc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    dist.push(acc);
  }
  // Normalise against the board half-diagonal so the wavefront sweeps the
  // whole surface in one pass regardless of how long an individual run is.
  const norm = 0.75;
  return {
    points,
    pads,
    width,
    phase,
    dist: dist.map((d) => Math.min(1, d / norm)),
  };
};
