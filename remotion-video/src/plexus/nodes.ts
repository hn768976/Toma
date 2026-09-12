import { mulberry32 } from "../lib/random";
import {
  LINK_DISTANCE,
  MAX_LINKS_PER_NODE,
  NODE_COUNT,
  TUNNEL_DEPTH,
  TUNNEL_INNER_RADIUS,
  TUNNEL_OUTER_RADIUS,
} from "./constants";

export type PlexusNode = {
  x: number;
  y: number;
  z: number;
  // Per-node variation so the cloud never looks stamped from one dot.
  sizeFactor: number;
  wigglePhaseX: number;
  wigglePhaseY: number;
  wiggleAmp: number;
};

export type PlexusEdge = {
  a: number;
  b: number;
  // Signed z-offset from a to b, already resolved to the shorter way
  // around the wrap. Drawing b at (a.z + dz) keeps an edge coherent even
  // when the loop seam falls between its endpoints.
  dz: number;
  // 1 for touching nodes, 0 at LINK_DISTANCE: fades long links out.
  strength: number;
};

// Shortest signed difference on a circle of circumference TUNNEL_DEPTH.
const wrapDelta = (d: number) => {
  const m = ((d % TUNNEL_DEPTH) + TUNNEL_DEPTH) % TUNNEL_DEPTH;
  return m > TUNNEL_DEPTH / 2 ? m - TUNNEL_DEPTH : m;
};

export const generateNodes = (seed: number): PlexusNode[] => {
  const rand = mulberry32(seed);
  const rInner2 = TUNNEL_INNER_RADIUS * TUNNEL_INNER_RADIUS;
  const rOuter2 = TUNNEL_OUTER_RADIUS * TUNNEL_OUTER_RADIUS;

  return Array.from({ length: NODE_COUNT }, () => {
    const angle = rand() * Math.PI * 2;
    // sqrt-distributed radius = uniform density across the annulus, so the
    // shell doesn't bunch up against the hollow core.
    const radius = Math.sqrt(rInner2 + rand() * (rOuter2 - rInner2));
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: rand() * TUNNEL_DEPTH,
      sizeFactor: 0.62 + rand() * 0.85,
      wigglePhaseX: rand() * Math.PI * 2,
      wigglePhaseY: rand() * Math.PI * 2,
      wiggleAmp: 0.35 + rand() * 0.9,
    };
  });
};

// Edges are a pure function of the node positions, so they're built once
// and reused for every frame. Candidates are sorted shortest-first and
// added greedily under a degree cap, which keeps links local and leaves
// the airy triangulated gaps the look depends on.
export const buildEdges = (nodes: PlexusNode[]): PlexusEdge[] => {
  const candidates: PlexusEdge[] = [];
  const maxDist2 = LINK_DISTANCE * LINK_DISTANCE;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dz = wrapDelta(nodes[j].z - nodes[i].z);
      const dist2 = dx * dx + dy * dy + dz * dz;
      if (dist2 >= maxDist2) {
        continue;
      }
      const dist = Math.sqrt(dist2);
      candidates.push({ a: i, b: j, dz, strength: 1 - dist / LINK_DISTANCE });
    }
  }

  candidates.sort((p, q) => q.strength - p.strength);

  const degree = new Array<number>(nodes.length).fill(0);
  const edges: PlexusEdge[] = [];
  for (const edge of candidates) {
    if (
      degree[edge.a] >= MAX_LINKS_PER_NODE ||
      degree[edge.b] >= MAX_LINKS_PER_NODE
    ) {
      continue;
    }
    degree[edge.a]++;
    degree[edge.b]++;
    edges.push(edge);
  }
  return edges;
};
