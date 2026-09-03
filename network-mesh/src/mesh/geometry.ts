import { rnd, rndInt, rndRange } from "../lib/rng";

/**
 * A node's immutable identity: where it sits, how deep it is, and the closed
 * path it drifts along. Generated once (seeded) and never recomputed.
 */
export interface MeshNodeSpec {
  index: number;
  x0: number;
  y0: number;
  /** Depth. 0.2 = far, 1.0 = near the camera. */
  z: number;
  /** Drift path: two harmonics whose integer frequencies close at frame 450. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  k1: number;
  k2: number;
  p1: number;
  p2: number;
  /** Brightness pulse: harmonic count over the loop, so the period divides 450. */
  pulseHarmonic: number;
  pulsePhase: number;
  pulseDepth: number;
  /** Frame at which this node flashes, or -1 for never. */
  flashFrame: number;
  flashLength: number;
}

export interface MeshEdge {
  a: number;
  b: number;
  /** 1 at zero length, 0 at the connection threshold. */
  strength: number;
  /** Mean depth of the two endpoints. */
  z: number;
}

export interface MeshTriangle {
  a: number;
  b: number;
  c: number;
  z: number;
}

export interface MeshFrame {
  x: Float64Array;
  y: Float64Array;
  /** Per-node brightness multiplier from pulse + flash, before light boost. */
  bright: Float64Array;
  edges: MeshEdge[];
  triangles: MeshTriangle[];
}

const TAU = Math.PI * 2;

// Edge alpha falls off with length and reaches exactly zero at the
// connection threshold, so edges fade in and out instead of popping.
const EDGE_FALLOFF = 1.25;
// Below this an edge is invisible; not drawing it saves the fill.
const MIN_EDGE_STRENGTH = 0.012;

/**
 * Seeds `count` nodes across the frame plus `margin` on every side. Positions
 * come from a jittered grid rather than pure rejection sampling so the field
 * stays evenly woven instead of clumping.
 */
export const generateNodes = (
  count: number,
  seedKey: string,
  width: number,
  height: number,
  margin: number,
): MeshNodeSpec[] => {
  const fieldW = width + margin * 2;
  const fieldH = height + margin * 2;
  const aspect = fieldW / fieldH;
  const cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
  const rows = Math.max(1, Math.ceil(count / cols));
  const cellW = fieldW / cols;
  const cellH = fieldH / rows;

  const nodes: MeshNodeSpec[] = [];
  for (let i = 0; i < count; i++) {
    const s = `${seedKey}-node-${i}`;
    const col = i % cols;
    const row = Math.floor(i / cols) % rows;
    // Jitter fills most of the cell, which keeps spacing irregular without
    // letting two nodes sit on top of each other.
    const x0 = -margin + (col + rndRange(`${s}-jx`, 0.06, 0.94)) * cellW;
    const y0 = -margin + (row + rndRange(`${s}-jy`, 0.06, 0.94)) * cellH;
    const z = rndRange(`${s}-z`, 0.2, 1.0);

    // Drift amplitude scales with depth: near nodes sweep further in the same
    // 450 frames, so they move faster. That parallax is what reads as volume.
    const amp = (34 + z * 128) * rndRange(`${s}-amp`, 0.7, 1.35);
    nodes.push({
      index: i,
      x0,
      y0,
      z,
      ax: amp,
      ay: amp * rndRange(`${s}-ay`, 0.55, 1.1),
      bx: amp * rndRange(`${s}-bx`, 0.16, 0.44),
      by: amp * rndRange(`${s}-by`, 0.16, 0.44),
      k1: 1,
      k2: rndInt(`${s}-k2`, 2, 4),
      p1: rnd(`${s}-p1`) * TAU,
      p2: rnd(`${s}-p2`) * TAU,
      pulseHarmonic: rndInt(`${s}-ph`, 2, 7),
      pulsePhase: rnd(`${s}-pp`) * TAU,
      pulseDepth: rndRange(`${s}-pd`, 0.12, 0.34),
      flashFrame: rnd(`${s}-fl`) < 0.34 ? rndInt(`${s}-flf`, 0, 450) : -1,
      flashLength: rndInt(`${s}-fll`, 3, 5),
    });
  }
  return nodes;
};

/** Cyclic distance in frames, so flashes that straddle frame 450 still loop. */
const cyclicDelta = (frame: number, at: number, duration: number) => {
  const d = ((frame - at) % duration + duration) % duration;
  return d;
};

/**
 * Uniform spatial grid over the node field. Rebuilt each frame; neighbour
 * search visits the 3x3 cells around a node instead of all pairs, which is
 * what keeps 340 nodes affordable at 4K.
 */
class Grid {
  private readonly cell: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly originX: number;
  private readonly originY: number;
  private readonly buckets: number[][];

  constructor(cell: number, minX: number, minY: number, maxX: number, maxY: number) {
    this.cell = cell;
    this.originX = minX;
    this.originY = minY;
    this.cols = Math.max(1, Math.ceil((maxX - minX) / cell));
    this.rows = Math.max(1, Math.ceil((maxY - minY) / cell));
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }

  private clampCol(x: number) {
    const c = Math.floor((x - this.originX) / this.cell);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private clampRow(y: number) {
    const r = Math.floor((y - this.originY) / this.cell);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }

  insert(index: number, x: number, y: number) {
    this.buckets[this.clampRow(y) * this.cols + this.clampCol(x)].push(index);
  }

  /** Calls `visit` for every index in the 3x3 block of cells around (x, y). */
  neighbours(x: number, y: number, visit: (index: number) => void) {
    const c = this.clampCol(x);
    const r = this.clampRow(y);
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr;
      if (rr < 0 || rr >= this.rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc;
        if (cc < 0 || cc >= this.cols) continue;
        const bucket = this.buckets[rr * this.cols + cc];
        for (let i = 0; i < bucket.length; i++) visit(bucket[i]);
      }
    }
  }
}

/**
 * Drifts every node to its position at `frame`, then rebuilds the edge set
 * from scratch. Connections form and break purely as a consequence of the
 * drift — nothing about the topology is keyframed.
 */
export const computeMeshFrame = (
  nodes: MeshNodeSpec[],
  frame: number,
  duration: number,
  threshold: number,
  maxConnections: number,
  wantTriangles: boolean,
  width: number,
  height: number,
  margin: number,
): MeshFrame => {
  const n = nodes.length;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const bright = new Float64Array(n);
  const t = (frame / duration) * TAU;

  for (let i = 0; i < n; i++) {
    const node = nodes[i];
    x[i] =
      node.x0 +
      node.ax * Math.cos(node.k1 * t + node.p1) +
      node.bx * Math.cos(node.k2 * t + node.p2);
    y[i] =
      node.y0 +
      node.ay * Math.sin(node.k1 * t + node.p1) +
      node.by * Math.sin(node.k2 * t + node.p2);

    const pulse =
      1 +
      node.pulseDepth *
        Math.sin(node.pulseHarmonic * t + node.pulsePhase);
    let flash = 0;
    if (node.flashFrame >= 0) {
      const d = cyclicDelta(frame, node.flashFrame, duration);
      if (d < node.flashLength) {
        // Instant onset, quick decay across the 3-4 frame window.
        flash = 1 - d / node.flashLength;
      }
    }
    bright[i] = pulse + flash * 1.9;
  }

  // ---- edges -------------------------------------------------------------
  const grid = new Grid(
    threshold,
    -margin,
    -margin,
    width + margin,
    height + margin,
  );
  // Nodes can drift outside the seeded field; the grid clamps them into the
  // border cells rather than growing, which is correct for neighbour search.
  for (let i = 0; i < n; i++) grid.insert(i, x[i], y[i]);

  const thresholdSq = threshold * threshold;
  const candA: number[] = [];
  const candB: number[] = [];
  const candD: number[] = [];
  for (let i = 0; i < n; i++) {
    grid.neighbours(x[i], y[i], (j) => {
      if (j <= i) return;
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      const dSq = dx * dx + dy * dy;
      if (dSq >= thresholdSq) return;
      candA.push(i);
      candB.push(j);
      candD.push(Math.sqrt(dSq));
    });
  }

  // Per-node connection budget. A hard "keep the 5 shortest, drop the rest"
  // cap looks wrong in motion: an edge well inside the distance threshold
  // blinks out the instant a closer neighbour takes its slot. So the cap is
  // expressed continuously instead — a node's edge strengths may sum to at
  // most `maxConnections`, which is the same statement (an edge at full
  // strength costs one connection) but degrades smoothly. Crowded regions
  // dim rather than shed lines, and nothing pops.
  const baseStrength = new Float64Array(candA.length);
  const load = new Float64Array(n);
  for (let i = 0; i < candA.length; i++) {
    const s = Math.pow(1 - candD[i] / threshold, EDGE_FALLOFF);
    baseStrength[i] = s;
    load[candA[i]] += s;
    load[candB[i]] += s;
  }
  const budget = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    budget[i] = load[i] > maxConnections ? maxConnections / load[i] : 1;
  }

  const edges: MeshEdge[] = [];
  const adjacency: number[][] = wantTriangles
    ? Array.from({ length: n }, () => [] as number[])
    : [];
  for (let i = 0; i < candA.length; i++) {
    const a = candA[i];
    const b = candB[i];
    const strength = baseStrength[i] * Math.min(budget[a], budget[b]);
    // Cutting off below visibility bounds any residual pop to a line nobody
    // can see.
    if (strength < MIN_EDGE_STRENGTH) continue;
    edges.push({
      a,
      b,
      strength,
      z: (nodes[a].z + nodes[b].z) * 0.5,
    });
    if (wantTriangles) {
      adjacency[a].push(b);
      adjacency[b].push(a);
    }
  }
  // Faintest first, so the strong short edges sit on top where they cross.
  edges.sort((p, q) => p.strength - q.strength || p.a - q.a || p.b - q.b);

  // ---- triangles ---------------------------------------------------------
  const triangles: MeshTriangle[] = [];
  if (wantTriangles) {
    for (let i = 0; i < n; i++) adjacency[i].sort((p, q) => p - q);
    for (let e = 0; e < edges.length; e++) {
      const { a, b } = edges[e];
      const adjA = adjacency[a];
      const adjB = adjacency[b];
      for (let p = 0; p < adjA.length; p++) {
        const c = adjA[p];
        if (c <= a || c <= b) continue;
        if (adjB.indexOf(c) === -1) continue;
        triangles.push({
          a,
          b,
          c,
          z: (nodes[a].z + nodes[b].z + nodes[c].z) / 3,
        });
      }
    }
  }

  return { x, y, bright, edges, triangles };
};
