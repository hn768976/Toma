// Plexus network wrapped around the planet: nodes on the surface (in the
// Earth-fixed frame, so they rotate with the globe), a sparser layer of
// nodes floating in the upper atmosphere, and edges between near neighbours.

import { Vec3, dot, mulberry32, norm, scale, sub, len } from "./math";

export type NetNode = {
  p: Vec3; // Earth-fixed position (planet radius = 1)
  size: number;
  bright: number;
  phase: number;
};

export type NetEdge = {
  a: number;
  b: number;
  bright: number;
  phase: number;
};

export type Network = { nodes: NetNode[]; edges: NetEdge[] };

const randomUnit = (rnd: () => number): Vec3 => {
  const z = rnd() * 2 - 1;
  const t = rnd() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(t), z, r * Math.sin(t)];
};

export const buildNetwork = (seed: number): Network => {
  const rnd = mulberry32(seed);
  const nodes: NetNode[] = [];

  // Clustered surface nodes (hubs) + a uniform sprinkle.
  const hubs: Vec3[] = [];
  for (let i = 0; i < 70; i++) hubs.push(randomUnit(rnd));
  for (let i = 0; i < 9000; i++) {
    let p: Vec3;
    if (rnd() < 0.35) {
      const h = hubs[Math.floor(rnd() * hubs.length)];
      const jitter = scale(randomUnit(rnd), 0.05 + rnd() * 0.18);
      p = norm([h[0] + jitter[0], h[1] + jitter[1], h[2] + jitter[2]]);
    } else {
      p = randomUnit(rnd);
    }
    const alt = 1.004 + rnd() * 0.004;
    nodes.push({
      p: scale(p, alt),
      size: 0.6 + rnd() * rnd() * 1.6,
      bright: 0.45 + rnd() * 0.55,
      phase: rnd() * Math.PI * 2,
    });
  }
  const surfaceCount = nodes.length;

  // Floating "upper atmosphere" nodes that make shards reaching into space.
  for (let i = 0; i < 1500; i++) {
    const p = randomUnit(rnd);
    const alt = 1.008 + Math.pow(rnd(), 2.5) * 0.045;
    nodes.push({
      p: scale(p, alt),
      size: 0.5 + rnd() * 1.1,
      bright: 0.35 + rnd() * 0.65,
      phase: rnd() * Math.PI * 2,
    });
  }

  // Connect every node to its nearest neighbours (brute force, done once).
  const edges: NetEdge[] = [];
  const seen = new Set<number>();
  const N = nodes.length;
  for (let i = 0; i < N; i++) {
    const isAir = i >= surfaceCount;
    const maxD = isAir ? 0.07 : 0.05;
    const k = isAir ? 3 : 2 + Math.floor(rnd() * 2);
    const cand: { j: number; d: number }[] = [];
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const d = len(sub(nodes[i].p, nodes[j].p));
      if (d < maxD && d > 0.012) cand.push({ j, d });
    }
    cand.sort((x, y) => x.d - y.d);
    for (let c = 0; c < Math.min(k, cand.length); c++) {
      const j = cand[c].j;
      const key = i < j ? i * N + j : j * N + i;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: i, b: j, bright: 0.35 + rnd() * 0.65, phase: rnd() * Math.PI * 2 });
    }
  }
  return { nodes, edges };
};

/** Background stars in camera space (direction vectors). */
export type Star = { d: Vec3; size: number; bright: number; phase: number };

export const buildStars = (count: number, seed: number, tanHalf: number, aspect: number): Star[] => {
  const rnd = mulberry32(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const x = (rnd() * 2 - 1) * tanHalf * aspect * 1.05;
    const y = (rnd() * 2 - 1) * tanHalf * 1.05;
    out.push({
      d: norm([x, y, -1]),
      size: 0.5 + Math.pow(rnd(), 3) * 1.6,
      bright: 0.15 + Math.pow(rnd(), 2) * 0.7,
      phase: rnd() * Math.PI * 2,
    });
  }
  return out;
};

export { dot };
