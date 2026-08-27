import {random} from 'remotion';
import {DURATION} from './layout';
import type {ParticleSet} from './silhouette';
import type {Motion, PathRef, Silhouette} from '../variants';

/**
 * Signal propagation along the subject's crease network.
 *
 * The crease paths are sampled into a graph: consecutive samples along a path
 * are linked cheaply, and samples on DIFFERENT paths that come close to each
 * other are linked at a penalty. A pulse is then a geodesic wavefront expanding
 * from one node, so it runs along a fold and only crosses to a neighbouring
 * fold where two folds actually meet - and it splits there into two or three
 * continuing fronts of its own accord. Nothing about the branching is scripted.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export type Graph = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  adj: Int32Array[];
  w: Float32Array[];
};

const samplePath = (p: PathRef, step: number): [number, number][] => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.position = 'absolute';
  svg.style.opacity = '0';
  const el = document.createElementNS(SVG_NS, 'path');
  el.setAttribute('d', p.d);
  svg.appendChild(el);
  document.body.appendChild(svg);

  const out: [number, number][] = [];
  try {
    const len = el.getTotalLength();
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const pt = el.getPointAtLength((len * i) / n);
      const x = p.t ? pt.x * p.t[0] + p.t[2] : pt.x;
      const y = p.t ? pt.y * p.t[1] + p.t[3] : pt.y;
      out.push([x, y]);
    }
  } finally {
    svg.remove();
  }
  return out;
};

/** Crossing between two different folds costs this much more than following one. */
const CROSS_PENALTY = 2.4;

export const buildGraph = (
  paths: PathRef[],
  step: number,
  linkR: number,
): Graph => {
  const xs: number[] = [];
  const ys: number[] = [];
  const owner: number[] = [];
  const adj: number[][] = [];
  const wts: number[][] = [];

  const link = (a: number, b: number, w: number) => {
    adj[a].push(b);
    wts[a].push(w);
    adj[b].push(a);
    wts[b].push(w);
  };

  paths.forEach((p, pi) => {
    const pts = samplePath(p, step);
    let prev = -1;
    for (const [x, y] of pts) {
      const idx = xs.length;
      xs.push(x);
      ys.push(y);
      owner.push(pi);
      adj.push([]);
      wts.push([]);
      if (prev >= 0) link(prev, idx, Math.hypot(x - xs[prev], y - ys[prev]));
      prev = idx;
    }
  });

  // junctions: nodes on different paths that come within linkR of each other
  const cell = linkR;
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < xs.length; i++) {
    const key = `${Math.floor(xs[i] / cell)},${Math.floor(ys[i] / cell)}`;
    const b = buckets.get(key);
    if (b) b.push(i);
    else buckets.set(key, [i]);
  }
  for (let i = 0; i < xs.length; i++) {
    const gx = Math.floor(xs[i] / cell);
    const gy = Math.floor(ys[i] / cell);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const b = buckets.get(`${gx + dx},${gy + dy}`);
        if (!b) continue;
        for (const j of b) {
          if (j <= i || owner[j] === owner[i]) continue;
          const d = Math.hypot(xs[i] - xs[j], ys[i] - ys[j]);
          if (d <= linkR) link(i, j, d * CROSS_PENALTY + linkR);
        }
      }
    }
  }

  return {
    n: xs.length,
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    adj: adj.map((a) => Int32Array.from(a)),
    w: wts.map((a) => Float32Array.from(a)),
  };
};

/** Geodesic distance from one node to every other, along the graph. */
const dijkstra = (g: Graph, src: number, limit: number): Float32Array => {
  const dist = new Float32Array(g.n).fill(Infinity);
  dist[src] = 0;
  // binary heap of [dist, node]
  const hd: number[] = [0];
  const hn: number[] = [src];
  const push = (d: number, v: number) => {
    hd.push(d);
    hn.push(v);
    let i = hd.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hd[p] <= hd[i]) break;
      [hd[p], hd[i]] = [hd[i], hd[p]];
      [hn[p], hn[i]] = [hn[i], hn[p]];
      i = p;
    }
  };
  const pop = (): [number, number] => {
    const top: [number, number] = [hd[0], hn[0]];
    const ld = hd.pop()!;
    const ln = hn.pop()!;
    if (hd.length) {
      hd[0] = ld;
      hn[0] = ln;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < hd.length && hd[l] < hd[m]) m = l;
        if (r < hd.length && hd[r] < hd[m]) m = r;
        if (m === i) break;
        [hd[m], hd[i]] = [hd[i], hd[m]];
        [hn[m], hn[i]] = [hn[i], hn[m]];
        i = m;
      }
    }
    return top;
  };

  while (hd.length) {
    const [d, v] = pop();
    if (d > dist[v] || d > limit) continue;
    const a = g.adj[v];
    const w = g.w[v];
    for (let k = 0; k < a.length; k++) {
      const nd = d + w[k];
      if (nd < dist[a[k]]) {
        dist[a[k]] = nd;
        push(nd, a[k]);
      }
    }
  }
  return dist;
};

export type Pulse = {
  start: number;
  life: number;
  speed: number;
  dist: Float32Array;
};

export type Field = {
  graph: Graph;
  node: Int32Array; // particle -> nearest graph node, or -1
  pulses: Pulse[];
  decay: number;
  spread: number;
  gain: number;
};

export const buildPropagation = (
  sil: Silhouette,
  motion: Motion,
  particles: ParticleSet,
  seed: string,
): Field | null => {
  if (motion.mode !== 'propagate') return null;
  const paths = sil.sulci ?? sil.lines;
  const graph = buildGraph(paths, 9, 30);

  // particle -> nearest node, via a spatial hash in path space
  const cell = 34;
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < graph.n; i++) {
    const key = `${Math.floor(graph.x[i] / cell)},${Math.floor(graph.y[i] / cell)}`;
    const b = buckets.get(key);
    if (b) b.push(i);
    else buckets.set(key, [i]);
  }
  const node = new Int32Array(particles.n).fill(-1);
  for (let i = 0; i < particles.n; i++) {
    const gx = Math.floor(particles.px[i] / cell);
    const gy = Math.floor(particles.py[i] / cell);
    let best = -1;
    let bd = cell * cell * 4;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const b = buckets.get(`${gx + dx},${gy + dy}`);
        if (!b) continue;
        for (const j of b) {
          const ddx = graph.x[j] - particles.px[i];
          const ddy = graph.y[j] - particles.py[i];
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < bd) {
            bd = d2;
            best = j;
          }
        }
      }
    }
    node[i] = best;
  }

  const pulses: Pulse[] = [];
  for (let i = 0; i < motion.pulses; i++) {
    const s = `${seed}/pulse${i}`;
    const life =
      motion.lifeMin + random(`${s}l`) * (motion.lifeMax - motion.lifeMin);
    const origin = Math.floor(random(`${s}o`) * graph.n);
    const speed = motion.spread / life;
    pulses.push({
      start: Math.round((i * DURATION) / motion.pulses),
      life,
      speed,
      dist: dijkstra(graph, origin, motion.spread * 1.25),
    });
  }

  return {
    graph,
    node,
    pulses,
    decay: motion.decay,
    spread: motion.spread,
    gain: motion.gain,
  };
};

/** Fade-in / fade-out envelope over a pulse's lifetime. */
const envelope = (t: number, life: number) => {
  if (t < 0 || t > life) return 0;
  const inn = Math.min(1, t / 6);
  const out = Math.min(1, (life - t) / 14);
  return inn * out;
};

/**
 * Per-particle brightness contributed by every live pulse. Each pulse is also
 * evaluated one loop earlier and one loop later, so a pulse that starts near
 * frame 590 carries across the seam and the loop closes exactly.
 */
export const evalPulses = (
  field: Field,
  particles: ParticleSet,
  f: number,
  out: Float32Array,
): number => {
  out.fill(0);
  let activity = 0;

  for (const p of field.pulses) {
    for (const wrap of [-DURATION, 0, DURATION]) {
      const t = f - p.start - wrap;
      const env = envelope(t, p.life);
      if (env <= 0) continue;
      activity += env;

      const radius = p.speed * t;
      const decayDist = p.speed * field.decay;
      for (let i = 0; i < particles.n; i++) {
        const nd = field.node[i];
        if (nd < 0) continue;
        const d = p.dist[nd];
        if (!isFinite(d)) continue;
        const delta = radius - d;
        if (delta < 0 || delta > decayDist) continue;
        const front = 1 - delta / decayDist;
        // branches fade as they spread away from the origin
        const reach = Math.exp(-d / (field.spread * 0.55));
        const b = front * front * reach * env * field.gain;
        if (b > out[i]) out[i] = b;
      }
    }
  }
  return Math.min(1, activity / 3.2);
};
