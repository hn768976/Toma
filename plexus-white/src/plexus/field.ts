import {
  ACCENT_SHARE,
  CLUSTER_COLS,
  CLUSTER_JITTER,
  CLUSTER_ROWS,
  CLUSTER_SHARE,
  CLUSTER_SIGMA_XY,
  CLUSTER_SIGMA_Z,
  DEPTH_SPAN,
  DURATION_IN_FRAMES,
  FIELD_MARGIN_X,
  FIELD_MARGIN_Y,
  NODE_COUNT,
  REF_HEIGHT,
  REF_WIDTH,
} from "./constants";
import { gaussian, mulberry32 } from "./random";

const TAU = Math.PI * 2;

/**
 * One sine term of a node's orbit. `k` is the number of whole cycles completed
 * over the 540-frame loop, so it must be an integer — that is the entire reason
 * the motion loops. Position is therefore a pure function of the frame number:
 * no state, no accumulation, safe for out-of-order rendering.
 */
type Term = { k: number; amp: number; phase: number };

export type PlexusNode = {
  /** Base position, reference px. x/y are screen coordinates (the field is flat
   *  — z drives size, tone, blur and the 3D distance test, not perspective). */
  bx: number;
  by: number;
  /** Base depth, 0 (far) .. 1 (near). */
  bz: number;
  tx: Term[];
  ty: Term[];
  tz: Term[];
  accent: boolean;
};

export const FIELD_X0 = -FIELD_MARGIN_X * REF_WIDTH;
export const FIELD_X1 = (1 + FIELD_MARGIN_X) * REF_WIDTH;
export const FIELD_Y0 = -FIELD_MARGIN_Y * REF_HEIGHT;
export const FIELD_Y1 = (1 + FIELD_MARGIN_Y) * REF_HEIGHT;

const FIELD_W = FIELD_X1 - FIELD_X0;
const FIELD_H = FIELD_Y1 - FIELD_Y0;

// Drift amplitudes, reference px. Small on purpose: a node's furthest excursion
// is about 5% of the frame width, so the field reads as breathing rather than
// travelling, and the slowest term carries most of the movement. These were set
// by measuring the reference clip — how far its frames decorrelate over a 1s
// and a 10s lag, per unit of ink — rather than by eye; halving them looks
// static next to it and doubling them looks like drifting confetti.
const DRIFT_XY = [
  { k: 1, amp: 118 },
  { k: 2, amp: 48 },
  { k: 3, amp: 22 },
];
// Depth drift matters as much as lateral drift: it is what makes connections
// form and break, rather than merely stretch.
const DRIFT_Z = [
  { k: 1, amp: 0.085 },
  { k: 2, amp: 0.035 },
];

const buildTerms = (
  rand: () => number,
  spec: { k: number; amp: number }[],
  jitter: number,
): Term[] =>
  spec.map(({ k, amp }) => ({
    k,
    // Vary the amplitude per node so no two orbits are the same size, and let a
    // term occasionally almost vanish.
    amp: amp * (1 - jitter + rand() * jitter * 2),
    phase: rand() * TAU,
  }));

/**
 * Builds the node field. Placement mixes two behaviours so the result forms
 * clear triangulated knots in places and open white space in others:
 *
 *  - CLUSTER_SHARE of the nodes are scattered around a handful of cluster
 *    centres with a Gaussian spread (the knots),
 *  - the rest are placed by best-candidate sampling — pick the candidate
 *    furthest from everything placed so far — which gives a Poisson-disc-ish
 *    scatter instead of the clumps-and-gaps of pure uniform random.
 */
export const buildField = (seed: number): PlexusNode[] => {
  const rand = mulberry32(seed);

  const clusters: { x: number; y: number; z: number }[] = [];
  for (let row = 0; row < CLUSTER_ROWS; row++) {
    for (let col = 0; col < CLUSTER_COLS; col++) {
      const cw = FIELD_W / CLUSTER_COLS;
      const ch = FIELD_H / CLUSTER_ROWS;
      clusters.push({
        x: FIELD_X0 + (col + 0.5 + (rand() * 2 - 1) * CLUSTER_JITTER) * cw,
        y: FIELD_Y0 + (row + 0.5 + (rand() * 2 - 1) * CLUSTER_JITTER) * ch,
        z: rand(),
      });
    }
  }

  const nodes: PlexusNode[] = [];

  // 3D separation between a candidate and a placed node, with z lifted into
  // the same units as x/y so depth counts properly.
  const sep = (
    x: number,
    y: number,
    z: number,
    n: PlexusNode,
  ): number => {
    const dx = x - n.bx;
    const dy = y - n.by;
    const dz = (z - n.bz) * DEPTH_SPAN;
    return dx * dx + dy * dy + dz * dz;
  };

  for (let i = 0; i < NODE_COUNT; i++) {
    let x: number;
    let y: number;
    let z: number;

    if (rand() < CLUSTER_SHARE) {
      const c = clusters[Math.floor(rand() * clusters.length)];
      x = c.x + gaussian(rand) * CLUSTER_SIGMA_XY * FIELD_W;
      y = c.y + gaussian(rand) * CLUSTER_SIGMA_XY * FIELD_H;
      z = c.z + gaussian(rand) * CLUSTER_SIGMA_Z;
      // Wrap rather than clamp, so knots that straddle the volume boundary
      // don't pile up against it.
      x = FIELD_X0 + (((x - FIELD_X0) % FIELD_W) + FIELD_W) % FIELD_W;
      y = FIELD_Y0 + (((y - FIELD_Y0) % FIELD_H) + FIELD_H) % FIELD_H;
      z = ((z % 1) + 1) % 1;
    } else {
      let best = { x: 0, y: 0, z: 0, d: -1 };
      for (let c = 0; c < 6; c++) {
        const cx = FIELD_X0 + rand() * FIELD_W;
        const cy = FIELD_Y0 + rand() * FIELD_H;
        const cz = rand();
        let nearest = Infinity;
        for (const n of nodes) {
          const d = sep(cx, cy, cz, n);
          if (d < nearest) nearest = d;
        }
        if (nearest > best.d) best = { x: cx, y: cy, z: cz, d: nearest };
      }
      x = best.x;
      y = best.y;
      z = best.z;
    }

    nodes.push({
      bx: x,
      by: y,
      bz: z,
      tx: buildTerms(rand, DRIFT_XY, 0.55),
      ty: buildTerms(rand, DRIFT_XY, 0.55),
      tz: buildTerms(rand, DRIFT_Z, 0.6),
      // Accent membership is decided here for every node; the V1 composition
      // simply ignores it, so both versions share an identical structure.
      accent: rand() < ACCENT_SHARE,
    });
  }

  return nodes;
};

const evaluate = (terms: Term[], t: number) => {
  let sum = 0;
  for (const term of terms) sum += term.amp * Math.sin(TAU * term.k * t + term.phase);
  return sum;
};

/** Current position of a node. `frame` may be any integer; t is its phase
 *  through the loop, so frame 540 evaluates exactly as frame 0. */
export const nodeX = (n: PlexusNode, t: number) => n.bx + evaluate(n.tx, t);
export const nodeY = (n: PlexusNode, t: number) => n.by + evaluate(n.ty, t);
export const nodeZ = (n: PlexusNode, t: number) => {
  const z = n.bz + evaluate(n.tz, t);
  // Reflect at the ends of the depth range rather than clamping, so nodes keep
  // moving in depth instead of sticking to the near/far planes.
  const w = ((z % 2) + 2) % 2;
  return w > 1 ? 2 - w : w;
};

export const loopPhase = (frame: number) =>
  (((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES) /
  DURATION_IN_FRAMES;
