import { mulberry32, range } from "../../lib/random";

// Network layout, seeded at module level. Three generations around a
// central node; no overlapping nodes, no link passing through a node, no
// crossing links. Each node records when its arrow leaves the parent and
// when it arrives (frames).

export type HubNode = {
  x: number;
  z: number;
  gen: number;
  parent: number;
  launch: number; // frame the arrow leaves the parent
  arrive: number; // frame the arrow reaches this node (node pops)
};

const MIN_NODE_DIST = 2.6;
const LINK_CLEAR = 0.95;
const TRAVEL = 40;

const segPointDist = (ax: number, az: number, bx: number, bz: number, px: number, pz: number) => {
  const dx = bx - ax,
    dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(ax + dx * t - px, az + dz * t - pz);
};
const segsCross = (a: number[], b: number[], c: number[], d: number[]) => {
  const o = (p: number[], q: number[], r: number[]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};

const build = (): HubNode[] => {
  const r = mulberry32(0x4e7b0b);
  const nodes: HubNode[] = [{ x: 0, z: 0, gen: 0, parent: -1, launch: -1, arrive: 4 }];
  const ok = (p: number, x: number, z: number) => {
    const P = nodes[p];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (Math.hypot(n.x - x, n.z - z) < MIN_NODE_DIST) return false;
      if (i !== p && segPointDist(P.x, P.z, x, z, n.x, n.z) < LINK_CLEAR) return false;
    }
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      const q = nodes[n.parent];
      if (n.parent === p || i === p) continue;
      if (segsCross([P.x, P.z], [x, z], [q.x, q.z], [n.x, n.z])) return false;
    }
    // the new node must not sit on an existing link either
    for (let i = 1; i < nodes.length; i++) {
      const n = nodes[i];
      const q = nodes[n.parent];
      if (segPointDist(q.x, q.z, n.x, n.z, x, z) < LINK_CLEAR) return false;
    }
    return true;
  };
  const add = (p: number, ang: number, dist: number, gen: number, launch: number) => {
    for (let k = 0; k < 60; k++) {
      const a = ang + (k ? range(r, -0.5, 0.5) * (1 + k / 20) : 0);
      const d = dist * (k ? range(r, 0.85, 1.2) : 1);
      const x = nodes[p].x + Math.cos(a) * d;
      const z = nodes[p].z + Math.sin(a) * d;
      if (Math.abs(x) > 12.5 || Math.abs(z) > 7.5) continue;
      if (ok(p, x, z)) {
        const len = d;
        nodes.push({ x, z, gen, parent: p, launch, arrive: launch + Math.round(TRAVEL * (0.7 + len / 10)) });
        return nodes.length - 1;
      }
    }
    return -1;
  };
  // generation 1: seven arrows from the centre
  const g1: number[] = [];
  const base = r() * Math.PI * 2;
  for (let i = 0; i < 7; i++) {
    const id = add(0, base + (i / 7) * Math.PI * 2 + range(r, -0.15, 0.15), range(r, 3.6, 4.6), 1, 16 + i * 4);
    if (id > 0) g1.push(id);
  }
  // generation 2: one or two children each, pointing roughly outward
  const g2: number[] = [];
  for (const p of g1) {
    const n = nodes[p];
    const out = Math.atan2(n.z, n.x);
    const kids = r() < 0.2 ? 2 : 1;
    for (let k = 0; k < kids; k++) {
      const a = out + (kids === 2 ? (k ? 0.55 : -0.55) : range(r, -0.3, 0.3));
      const id = add(p, a, range(r, 3.3, 4.3), 2, n.arrive + 22 + Math.floor(r() * 22));
      if (id > 0) g2.push(id);
    }
  }
  // generation 3: top up to ~20 nodes
  const order = g2.map((id, k) => [id, (k * 5) % g2.length]).sort((a, b) => a[1] - b[1]).map((a) => a[0]);
  for (const p of order) {
    if (nodes.length >= 20) break;
    const n = nodes[p];
    const out = Math.atan2(n.z - nodes[n.parent].z, n.x - nodes[n.parent].x);
    add(p, out + range(r, -0.4, 0.4), range(r, 3.0, 3.8), 3, n.arrive + 25 + Math.floor(r() * 25));
  }
  return nodes;
};

export const HUB_NODES = build();
export const HUB_TRAVEL = TRAVEL;
