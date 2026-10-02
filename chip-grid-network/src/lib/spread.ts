import { GRID_N, LINKS, NODE_COUNT, neighbours, nodeIndex } from "./grid";
import { mulberry32 } from "./random";

// ---------------------------------------------------------------------------
// Spread timing. Everything here is a pure function of the grid and a seed:
// the switch frame of every node is worked out once from grid distance, and
// the shaders compare it against the current frame. Nothing is stored "as it
// happens", so any frame can be rendered on its own.
// ---------------------------------------------------------------------------

export type SpreadConfig = {
  /** Source node(s), as grid coordinates. */
  sources: [number, number][];
  /** Frame at which the source(s) switch. */
  tStart: number;
  /** Frames per grid step. */
  stepFrames: number;
  /**
   * "manhattan": breadth-first grid distance (diamond front).
   * "radial": straight-line distance in grid steps (circle-ish front).
   */
  metric: "manhattan" | "radial";
  /** Seeded jitter, as a fraction of one step (+/-). */
  jitter: number;
  seed: number;
};

export type SpreadTiming = {
  /** Frame at which each node switches colour. */
  tNode: Float32Array;
  /** Per link: frame the front leaves the earlier node. */
  linkStart: Float32Array;
  /** Per link: frame the front reaches the later node. */
  linkEnd: Float32Array;
  /** Per link: 1 if the front travels from link.b to link.a. */
  linkReverse: Float32Array;
  /** Frame the last node switches. */
  tLast: number;
};

/**
 * Shortest cable travel, as a fraction of a step. Causality guarantees every
 * node an incoming cable at least this long. A link whose two ends switch
 * closer together than this (tangential links in the radial comps) fills
 * from both ends at this travel time and the two fronts meet in the middle,
 * so no cable ever flips colour without a visible front.
 */
export const MIN_GAP = 0.45;

const bfs = (sources: number[]): Float32Array => {
  const d = new Float32Array(NODE_COUNT).fill(Infinity);
  const queue: number[] = [];
  for (const s of sources) {
    d[s] = 0;
    queue.push(s);
  }
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q];
    for (const n of neighbours(k)) {
      if (d[n] === Infinity) {
        d[n] = d[k] + 1;
        queue.push(n);
      }
    }
  }
  return d;
};

const radial = (sources: [number, number][]): Float32Array => {
  const d = new Float32Array(NODE_COUNT);
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      let best = Infinity;
      for (const [si, sj] of sources) {
        best = Math.min(best, Math.hypot(i - si, j - sj));
      }
      d[nodeIndex(i, j)] = best;
    }
  }
  return d;
};

export const computeSpread = (cfg: SpreadConfig): SpreadTiming => {
  const rng = mulberry32(cfg.seed);
  const sourceIdx = cfg.sources.map(([i, j]) => nodeIndex(i, j));
  const isSource = new Uint8Array(NODE_COUNT);
  for (const s of sourceIdx) isSource[s] = 1;

  const dist = cfg.metric === "manhattan" ? bfs(sourceIdx) : radial(cfg.sources);

  // 1. distance + seeded jitter (in steps)
  const steps = new Float32Array(NODE_COUNT);
  for (let k = 0; k < NODE_COUNT; k++) {
    const jit = (rng() * 2 - 1) * cfg.jitter;
    steps[k] = isSource[k] ? 0 : Math.max(0, dist[k] + jit);
  }

  // 2. Causality: every node (except a source) must have a neighbour that
  //    switched at least MIN_GAP steps earlier, so a cable always delivers
  //    the colour before the node changes. Relax until stable.
  for (let iter = 0; iter < 200; iter++) {
    let changed = false;
    for (let k = 0; k < NODE_COUNT; k++) {
      if (isSource[k]) continue;
      let m = Infinity;
      for (const n of neighbours(k)) m = Math.min(m, steps[n]);
      if (steps[k] < m + MIN_GAP) {
        steps[k] = m + MIN_GAP;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const tNode = new Float32Array(NODE_COUNT);
  let tLast = 0;
  for (let k = 0; k < NODE_COUNT; k++) {
    tNode[k] = cfg.tStart + steps[k] * cfg.stepFrames;
    tLast = Math.max(tLast, tNode[k]);
  }

  // 3. Links fill from the node that switches first toward the other one.
  //    The fill duration is the gap between the two switch times, so the
  //    front always arrives exactly when the receiving node flips.
  const linkStart = new Float32Array(LINKS.length);
  const linkEnd = new Float32Array(LINKS.length);
  const linkReverse = new Float32Array(LINKS.length);
  LINKS.forEach((l, idx) => {
    const ta = tNode[l.a];
    const tb = tNode[l.b];
    linkStart[idx] = Math.min(ta, tb);
    linkEnd[idx] = Math.max(ta, tb);
    linkReverse[idx] = tb < ta ? 1 : 0;
  });

  return { tNode, linkStart, linkEnd, linkReverse, tLast };
};
