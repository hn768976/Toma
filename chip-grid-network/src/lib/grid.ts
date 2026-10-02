import { mulberry32 } from "./random";

// ---------------------------------------------------------------------------
// Grid layout shared by every composition.
// ---------------------------------------------------------------------------

/** Nodes per side. */
export const GRID_N = 18;
/** Node spacing in world units. */
export const SPACING = 4;
/** Grid index that sits at the world origin (the "centre node" is (9, 9)). */
export const GRID_CENTER = 9;

export const NODE_COUNT = GRID_N * GRID_N;

export const nodeIndex = (i: number, j: number) => j * GRID_N + i;
export const nodeX = (i: number) => (i - GRID_CENTER) * SPACING;
export const nodeZ = (j: number) => (j - GRID_CENTER) * SPACING;

/** World-space extent of node centres. */
export const GRID_MIN = nodeX(0);
export const GRID_MAX = nodeX(GRID_N - 1);

// ---------------------------------------------------------------------------
// Node dimensions (world units). Plan is a chamfered square (octagon).
// ---------------------------------------------------------------------------
export const DIM = {
  plinthHalf: 0.98,
  plinthChamfer: 0.36,
  plinthHeight: 0.2,
  wallHalf: 0.8,
  wallChamfer: 0.26,
  wallBottom: 0.2,
  wallTop: 1.36,
  topHalf: 0.9,
  topChamfer: 0.3,
  topThickness: 0.12,
  insetHalf: 0.56,
  insetThickness: 0.03,
  dieHalf: 0.17,
  dieThickness: 0.035,
  // Cable sockets / tubes
  cableY: 0.48,
  tubeRadius: 0.08,
  coreRadius: 0.03,
  tubeSpacing: 0.18,
  socketDepth: 0.08,
  collarLength: 0.07,
} as const;

/** Top of the aluminium top plate. */
export const TOP_Y = DIM.wallTop + DIM.topThickness;
/** Surface the PCB / frosted inset sits on. */
export const INSET_Y = TOP_Y + DIM.insetThickness;
/** Where a cable leaves the socket collar (distance from node centre). */
export const TUBE_START = DIM.wallHalf + DIM.socketDepth + DIM.collarLength * 0.6;
export const TUBE_LENGTH = SPACING - 2 * TUBE_START;

// ---------------------------------------------------------------------------
// Seeded per-node properties (module-level seed, never Math.random()).
// ---------------------------------------------------------------------------
export type NodeInfo = {
  index: number;
  i: number;
  j: number;
  x: number;
  z: number;
  whiteTop: boolean;
  seed: number;
};

const nodeRng = mulberry32(0x5eed_c41b);
export const NODES: NodeInfo[] = [];
for (let j = 0; j < GRID_N; j++) {
  for (let i = 0; i < GRID_N; i++) {
    NODES.push({
      index: nodeIndex(i, j),
      i,
      j,
      x: nodeX(i),
      z: nodeZ(j),
      whiteTop: nodeRng() < 0.08,
      seed: nodeRng(),
    });
  }
}

// ---------------------------------------------------------------------------
// Links: every node connects to its right (+x) and down (+z) neighbour.
// ---------------------------------------------------------------------------
export type LinkInfo = {
  a: number; // node index at the low end (-x or -z)
  b: number; // node index at the high end
  axis: 0 | 1; // 0 = along x, 1 = along z
  seed: number;
};

const linkRng = mulberry32(0x11ce_ab1e);
export const LINKS: LinkInfo[] = [];
for (let j = 0; j < GRID_N; j++) {
  for (let i = 0; i < GRID_N; i++) {
    if (i < GRID_N - 1) {
      LINKS.push({ a: nodeIndex(i, j), b: nodeIndex(i + 1, j), axis: 0, seed: linkRng() });
    }
    if (j < GRID_N - 1) {
      LINKS.push({ a: nodeIndex(i, j), b: nodeIndex(i, j + 1), axis: 1, seed: linkRng() });
    }
  }
}

export const neighbours = (k: number): number[] => {
  const i = k % GRID_N;
  const j = Math.floor(k / GRID_N);
  const out: number[] = [];
  if (i > 0) out.push(k - 1);
  if (i < GRID_N - 1) out.push(k + 1);
  if (j > 0) out.push(k - GRID_N);
  if (j < GRID_N - 1) out.push(k + GRID_N);
  return out;
};
