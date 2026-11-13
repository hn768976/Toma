// Road graph (junctions + edges) built from the generated polylines, and closed
// driving routes found on it with a turn-penalised edge Dijkstra.
import type { Road, RoadClass } from './generate';
import { segInt } from './generate';
import type { Pt } from './geom';

export interface GNode { x: number; y: number; edges: number[] }
export interface GEdge { a: number; b: number; pts: number[]; len: number; cls: RoadClass }
export interface Graph { nodes: GNode[]; edges: GEdge[] }

const DRIVABLE: RoadClass[] = ['avenue', 'street', 'lane'];

export function buildGraph(roads: Road[]): Graph {
  const lines = roads.filter((r) => DRIVABLE.includes(r.cls));
  // segment hash
  const CELL = 120;
  const cells = new Map<number, number[]>();
  const segs: number[] = []; // line, segIndex
  const key = (ix: number, iy: number) => (ix + 500) * 10000 + (iy + 500);
  lines.forEach((l, li) => {
    for (let s = 0; s + 3 < l.pts.length; s += 2) {
      const id = segs.length / 2;
      segs.push(li, s / 2);
      const x0 = Math.floor(Math.min(l.pts[s], l.pts[s + 2]) / CELL), x1 = Math.floor(Math.max(l.pts[s], l.pts[s + 2]) / CELL);
      const y0 = Math.floor(Math.min(l.pts[s + 1], l.pts[s + 3]) / CELL), y1 = Math.floor(Math.max(l.pts[s + 1], l.pts[s + 3]) / CELL);
      for (let ix = x0; ix <= x1; ix++) for (let iy = y0; iy <= y1; iy++) {
        const k = key(ix, iy);
        let a = cells.get(k);
        if (!a) cells.set(k, (a = []));
        a.push(id);
      }
    }
  });
  // node registry with 1.2 m merge radius
  const nodes: GNode[] = [];
  const nodeHash = new Map<number, number[]>();
  const NK = (x: number, y: number) => key(Math.floor(x / 4), Math.floor(y / 4));
  const getNode = (x: number, y: number) => {
    const ix = Math.floor(x / 4), iy = Math.floor(y / 4);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = nodeHash.get(key(ix + dx, iy + dy));
      if (a) for (const n of a) if (Math.hypot(nodes[n].x - x, nodes[n].y - y) < 1.2) return n;
    }
    const id = nodes.length;
    nodes.push({ x, y, edges: [] });
    const k = NK(x, y);
    let a = nodeHash.get(k);
    if (!a) nodeHash.set(k, (a = []));
    a.push(id);
    return id;
  };
  const splits: { pos: number; node: number }[][] = lines.map(() => []);
  const seen = new Set<string>();
  for (const arr of cells.values()) {
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
      const s1 = arr[i], s2 = arr[j];
      const l1 = segs[s1 * 2], l2 = segs[s2 * 2];
      const k1 = segs[s1 * 2 + 1], k2 = segs[s2 * 2 + 1];
      if (l1 === l2 && Math.abs(k1 - k2) <= 1) continue;
      const pk = s1 < s2 ? s1 + ',' + s2 : s2 + ',' + s1;
      if (seen.has(pk)) continue;
      seen.add(pk);
      const A = lines[l1].pts, B = lines[l2].pts;
      const ax = A[k1 * 2], ay = A[k1 * 2 + 1], bx = A[k1 * 2 + 2], by = A[k1 * 2 + 3];
      const cx = B[k2 * 2], cy = B[k2 * 2 + 1], dx = B[k2 * 2 + 2], dy = B[k2 * 2 + 3];
      const la = Math.hypot(bx - ax, by - ay), lb = Math.hypot(dx - cx, dy - cy);
      const eps = Math.max(0.8 / Math.max(la, 1e-3), 0.8 / Math.max(lb, 1e-3));
      const hit = segInt(ax, ay, bx, by, cx, cy, dx, dy, Math.min(eps, 0.2));
      if (!hit) continue;
      // only accept the extension tolerance at polyline ends
      const t = hit.t, u = hit.u;
      const endA = (k1 === 0 && t < 0) || (k1 === A.length / 2 - 2 && t > 1) || (t >= 0 && t <= 1);
      const endB = (k2 === 0 && u < 0) || (k2 === B.length / 2 - 2 && u > 1) || (u >= 0 && u <= 1);
      if (!endA || !endB) continue;
      const n = getNode(hit.x, hit.y);
      splits[l1].push({ pos: k1 + Math.max(0, Math.min(1, t)), node: n });
      splits[l2].push({ pos: k2 + Math.max(0, Math.min(1, u)), node: n });
    }
  }
  const edges: GEdge[] = [];
  lines.forEach((l, li) => {
    const nSeg = l.pts.length / 2 - 1;
    const sp = splits[li];
    sp.push({ pos: 0, node: getNode(l.pts[0], l.pts[1]) });
    sp.push({ pos: nSeg, node: getNode(l.pts[nSeg * 2], l.pts[nSeg * 2 + 1]) });
    sp.sort((a, b) => a.pos - b.pos);
    const at = (pos: number) => {
      const k = Math.min(nSeg - 1, Math.floor(pos));
      const f = pos - k;
      return [l.pts[k * 2] + (l.pts[k * 2 + 2] - l.pts[k * 2]) * f, l.pts[k * 2 + 1] + (l.pts[k * 2 + 3] - l.pts[k * 2 + 1]) * f];
    };
    for (let i = 0; i < sp.length - 1; i++) {
      const a = sp[i], b = sp[i + 1];
      if (a.node === b.node) continue;
      const pts: number[] = [nodes[a.node].x, nodes[a.node].y];
      for (let k = Math.floor(a.pos) + 1; k <= Math.ceil(b.pos) - 1; k++) if (k > a.pos && k < b.pos) pts.push(l.pts[k * 2], l.pts[k * 2 + 1]);
      pts.push(nodes[b.node].x, nodes[b.node].y);
      void at;
      let len = 0;
      for (let k = 2; k < pts.length; k += 2) len += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
      if (len < 0.5) continue;
      const id = edges.length;
      edges.push({ a: a.node, b: b.node, pts, len, cls: l.cls });
      nodes[a.node].edges.push(id);
      nodes[b.node].edges.push(id);
    }
  });
  return { nodes, edges };
}

// direction leaving node n along edge e (unit vector)
function dirFrom(g: Graph, e: number, n: number): Pt {
  const E = g.edges[e];
  const p = E.pts;
  let x0, y0, x1, y1;
  if (E.a === n) { x0 = p[0]; y0 = p[1]; x1 = p[2]; y1 = p[3]; }
  else { const m = p.length; x0 = p[m - 2]; y0 = p[m - 1]; x1 = p[m - 4]; y1 = p[m - 3]; }
  const L = Math.hypot(x1 - x0, y1 - y0) || 1;
  return { x: (x1 - x0) / L, y: (y1 - y0) / L };
}

const CLS_COST: Record<string, number> = { avenue: 0.45, street: 1.0, lane: 20.0 };

// Edge-state Dijkstra from node s to node t, with turn penalties and no U-turns.
export function routeBetween(g: Graph, s: number, t: number, startEdge = -1, banned?: Set<number>): number[] | null {
  // state: (edge, arrivingAtNode) encoded as edge*2 + dirBit (dirBit 0 = arrived at b, 1 = arrived at a)
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  const heap: [number, number][] = [];
  const push = (d: number, st: number) => {
    heap.push([d, st]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const endNode = (st: number) => { const e = g.edges[st >> 1]; return st & 1 ? e.a : e.b; };
  const turnCost = (inDir: Pt, outDir: Pt) => {
    const dot = inDir.x * outDir.x + inDir.y * outDir.y;
    if (dot < -0.5) return Infinity;
    if (dot > 0.95) return 0;
    return 700 * (1 - dot) + 250;
  };
  for (const e of g.nodes[s].edges) {
    if (banned?.has(e)) continue;
    const E = g.edges[e];
    const st = e * 2 + (E.a === s ? 0 : 1);
    let c = E.len * (CLS_COST[E.cls] ?? 1);
    if (startEdge >= 0) {
      const din = arriveDir(g, startEdge);
      c += turnCost(din, dirFrom(g, e, s));
      if (!isFinite(c)) continue;
    }
    dist.set(st, c);
    push(c, st);
  }
  while (heap.length) {
    const [d, st] = pop();
    if (d > (dist.get(st) ?? Infinity)) continue;
    const n = endNode(st);
    if (n === t) {
      const path: number[] = [];
      let cur: number | undefined = st;
      while (cur !== undefined) { path.push(cur); cur = prev.get(cur); }
      return path.reverse();
    }
    const din = arriveDir(g, st);
    for (const e of g.nodes[n].edges) {
      if (e === st >> 1 || banned?.has(e)) continue;
      const E = g.edges[e];
      const ns = e * 2 + (E.a === n ? 0 : 1);
      const tc = turnCost(din, dirFrom(g, e, n));
      if (!isFinite(tc)) continue;
      const nd = d + E.len * (CLS_COST[E.cls] ?? 1) + tc;
      if (nd < (dist.get(ns) ?? Infinity)) { dist.set(ns, nd); prev.set(ns, st); push(nd, ns); }
    }
  }
  return null;
}

// direction of travel when arriving at the end of state st
function arriveDir(g: Graph, st: number): Pt {
  const e = st >> 1;
  const E = g.edges[e];
  const endN = st & 1 ? E.a : E.b;
  const d = dirFrom(g, e, endN);
  return { x: -d.x, y: -d.y };
}

export function statesToPolyline(g: Graph, states: number[]): { pts: number[]; nodes: number[] } {
  const pts: number[] = [];
  const nodes: number[] = [];
  for (const st of states) {
    const E = g.edges[st >> 1];
    const p = E.pts.slice();
    if (st & 1) {
      const r: number[] = [];
      for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]);
      p.splice(0, p.length, ...r);
    }
    if (pts.length === 0) { pts.push(p[0], p[1]); nodes.push(0); }
    for (let i = 2; i < p.length; i += 2) pts.push(p[i], p[i + 1]);
    nodes.push(pts.length / 2 - 1);
  }
  return { pts, nodes };
}

export function nearestNode(g: Graph, x: number, y: number, minDeg = 3): number {
  let best = -1, bd = Infinity;
  g.nodes.forEach((n, i) => {
    if (n.edges.length < minDeg) return;
    if (!n.edges.some((e) => g.edges[e].cls !== 'lane')) return;
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}
