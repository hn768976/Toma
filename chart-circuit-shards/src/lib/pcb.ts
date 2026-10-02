import * as THREE from 'three';
import { Rng } from './rng';

/**
 * Seeded PCB-style router. Traces travel in bundles of parallel tracks, bend
 * only by 45 degrees (mitred so spacing stays constant), split into
 * sub-bundles, and grow until they would collide with something already
 * routed (checked on an occupancy grid, optionally toroidal so the result
 * tiles seamlessly). Ends get round pads or small vias.
 *
 * Runs once at module/setup time from a fixed seed: same output every time.
 */

export type V2 = [number, number];
export const DIRS: V2[] = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return [Math.round(Math.cos(a) * 1e9) / 1e9, Math.round(Math.sin(a) * 1e9) / 1e9];
});
const perp = (d: number): V2 => {
  const v = DIRS[d];
  return [-v[1], v[0]];
};
export const wrapDir = (d: number) => ((d % 8) + 8) % 8;

export type Trace = {
  pts: V2[];
  width: number;
  bright: number;
  tone: number;
  padStart: 0 | 1 | 2; // 0 none, 1 pad, 2 via
  padEnd: 0 | 1 | 2;
  loop: boolean;
  group: number;
  /** distance from the origin feature (chip) at the start, for brightness falloff */
  seed: number;
};

export class Occupancy {
  nx: number;
  ny: number;
  data: Int32Array;
  constructor(
    public x0: number,
    public y0: number,
    public w: number,
    public h: number,
    public cell: number,
    public wrap: boolean,
  ) {
    this.nx = Math.ceil(w / cell);
    this.ny = Math.ceil(h / cell);
    this.data = new Int32Array(this.nx * this.ny).fill(-1);
  }
  private idx(ix: number, iy: number) {
    if (this.wrap) {
      ix = ((ix % this.nx) + this.nx) % this.nx;
      iy = ((iy % this.ny) + this.ny) % this.ny;
    } else if (ix < 0 || iy < 0 || ix >= this.nx || iy >= this.ny) return -1;
    return iy * this.nx + ix;
  }
  /** true if a disc of radius r at (x,y) holds nothing but `self` */
  free(x: number, y: number, r: number, self: number) {
    const cx = (x - this.x0) / this.cell;
    const cy = (y - this.y0) / this.cell;
    const rc = r / this.cell;
    const r2 = rc * rc;
    for (let iy = Math.floor(cy - rc); iy <= Math.ceil(cy + rc); iy++) {
      for (let ix = Math.floor(cx - rc); ix <= Math.ceil(cx + rc); ix++) {
        const dx = ix + 0.5 - cx;
        const dy = iy + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = this.idx(ix, iy);
        if (i < 0) return false;
        const v = this.data[i];
        if (v !== -1 && v !== self) return false;
      }
    }
    return true;
  }
  mark(x: number, y: number, r: number, id: number) {
    const cx = (x - this.x0) / this.cell;
    const cy = (y - this.y0) / this.cell;
    const rc = r / this.cell;
    const r2 = rc * rc;
    for (let iy = Math.floor(cy - rc); iy <= Math.ceil(cy + rc); iy++) {
      for (let ix = Math.floor(cx - rc); ix <= Math.ceil(cx + rc); ix++) {
        const dx = ix + 0.5 - cx;
        const dy = iy + 0.5 - cy;
        if (dx * dx + dy * dy > r2) continue;
        const i = this.idx(ix, iy);
        if (i >= 0 && this.data[i] === -1) this.data[i] = id;
      }
    }
  }
  /** largest fraction (0..1) of segment a->b that is free (skipping the first `skip` units) */
  freeFraction(a: V2, b: V2, r: number, self: number, skip: number) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-9) return 1;
    const step = this.cell * 0.5;
    const n = Math.ceil(len / step);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (t * len < skip) continue;
      if (!this.free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r, self)) {
        return Math.max(0, (i - 1) / n);
      }
    }
    return 1;
  }
  markSeg(a: V2, b: V2, r: number, id: number) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.mark(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r, id);
    }
  }
}

export type GrowOpts = {
  spacing: number;
  minRun: number; // in multiples of spacing
  maxRun: number;
  turnProb: number;
  splitProb: number;
  peelProb: number;
  maxSegments: number;
  /** weight for heading in direction d (0 = forbidden); `at` = bundle centre */
  dirWeight: (d: number, from: number, at: V2) => number;
  traceWidth: () => number;
  bright: (t: Trace) => number;
  tone: () => number;
  endPad: () => 0 | 1 | 2;
  padRadius: number;
};

type Member = { trace: Trace; off: number };
type Bundle = { c: V2; d: number; members: Member[]; segs: number };

export class Router {
  traces: Trace[] = [];
  occ: Occupancy;
  private groupId = 0;
  constructor(
    occ: Occupancy,
    public rng: Rng,
  ) {
    this.occ = occ;
  }

  private clear(o: GrowOpts) {
    return o.spacing * 0.3;
  }

  newTrace(start: V2, o: GrowOpts, padStart: 0 | 1 | 2, group: number): Trace {
    const t: Trace = {
      pts: [start],
      width: o.traceWidth(),
      bright: 1,
      tone: o.tone(),
      padStart,
      padEnd: 0,
      loop: false,
      group,
      seed: this.rng.f(),
    };
    this.traces.push(t);
    return t;
  }

  /** Grow a bundle of `k` parallel traces from centre `c` heading `d`. */
  growBundle(c: V2, d: number, k: number, o: GrowOpts, padStart: 0 | 1 | 2) {
    const group = this.groupId++;
    const members: Member[] = [];
    for (let i = 0; i < k; i++) {
      const off = (i - (k - 1) / 2) * o.spacing;
      const p = perp(d);
      const start: V2 = [c[0] + p[0] * off, c[1] + p[1] * off];
      const id = this.traces.length;
      if (!this.occ.free(start[0], start[1], this.clear(o) + o.spacing * 0.2, id)) {
        // Starting point already taken: drop the bundle entirely.
        this.traces.length -= members.length;
        return 0;
      }
      members.push({ trace: this.newTrace(start, o, padStart, group), off });
    }
    const queue: Bundle[] = [{ c, d, members, segs: 0 }];
    let made = 0;
    while (queue.length) {
      made += this.runBundle(queue.shift()!, o, queue);
    }
    for (const m of members) m.trace.bright = o.bright(m.trace);
    return made;
  }

  private pickDir(d: number, o: GrowOpts, at: V2) {
    const cands = [wrapDir(d - 1), wrapDir(d + 1)];
    const w = cands.map((x) => o.dirWeight(x, d, at));
    const sum = w[0] + w[1];
    if (sum <= 0) return d;
    return this.rng.f() * sum < w[0] ? cands[0] : cands[1];
  }

  private idOf(t: Trace) {
    return this.traces.indexOf(t);
  }

  private runBundle(b: Bundle, o: GrowOpts, queue: Bundle[]) {
    const r = this.clear(o);
    let { c, d, members } = b;
    let segs = b.segs;
    const ids = new Map<Trace, number>();
    for (const m of members) ids.set(m.trace, this.idOf(m.trace));
    while (members.length && segs < o.maxSegments) {
      const run = this.rng.int(o.minRun, o.maxRun) * o.spacing;
      const dv = DIRS[d];
      // how far can every member go straight?
      let frac = 1;
      for (const m of members) {
        const last = m.trace.pts[m.trace.pts.length - 1];
        const end: V2 = [last[0] + dv[0] * run, last[1] + dv[1] * run];
        frac = Math.min(frac, this.occ.freeFraction(last, end, r, ids.get(m.trace)!, r * 2.2));
      }
      const len = run * frac;
      const blocked = frac < 1;
      if (len < o.spacing * 1.2) break;

      // plan the next headings (decided now so this vertex can be mitred)
      const sorted = [...members].sort((a, b2) => a.off - b2.off);
      let groups: { ms: Member[]; nd: number }[] = [{ ms: sorted, nd: d }];
      if (!blocked) {
        if (sorted.length >= 2 && this.rng.chance(o.splitProb)) {
          const cut = this.rng.int(1, sorted.length - 1);
          const right = sorted.slice(0, cut); // negative offsets = right side
          const left = sorted.slice(cut);
          const turnLeft = this.rng.chance(0.5);
          const ndL = turnLeft ? wrapDir(d + 1) : d;
          const ndR = turnLeft ? d : wrapDir(d - 1);
          groups = [];
          if (o.dirWeight(ndL, d, c) > 0.05) groups.push({ ms: left, nd: ndL });
          else groups.push({ ms: left, nd: d });
          if (o.dirWeight(ndR, d, c) > 0.05) groups.push({ ms: right, nd: ndR });
          else groups.push({ ms: right, nd: d });
          if (groups[0].nd === groups[1].nd) groups = [{ ms: sorted, nd: groups[0].nd }];
        } else if (this.rng.chance(o.turnProb)) {
          groups = [{ ms: sorted, nd: this.pickDir(d, o, c) }];
        }
      }

      const cEnd: V2 = [c[0] + dv[0] * len, c[1] + dv[1] * len];
      const p1 = perp(d);
      for (const g of groups) {
        const gm = g.ms.reduce((s, m) => s + m.off, 0) / g.ms.length;
        const p2 = perp(g.nd);
        let mx = p1[0] + p2[0];
        let my = p1[1] + p2[1];
        const ml = Math.hypot(mx, my);
        mx /= ml;
        my /= ml;
        const k = 1 / (mx * p2[0] + my * p2[1]);
        for (const m of g.ms) {
          // offsets relative to the group's own centre line after a split
          const rel = m.off - gm;
          const base: V2 = [cEnd[0] + p1[0] * gm, cEnd[1] + p1[1] * gm];
          const v: V2 = [base[0] + mx * k * rel, base[1] + my * k * rel];
          const last = m.trace.pts[m.trace.pts.length - 1];
          this.occ.markSeg(last, v, r, ids.get(m.trace)!);
          m.trace.pts.push(v);
        }
      }
      segs++;
      if (blocked) break;

      // occasionally an outer trace peels off and ends in a pad
      if (members.length > 1 && this.rng.chance(o.peelProb)) {
        const outer = this.rng.chance(0.5) ? sorted[0] : sorted[sorted.length - 1];
        outer.trace.padEnd = o.endPad();
        members = members.filter((m) => m !== outer);
        groups = groups.map((g) => ({ ...g, ms: g.ms.filter((m) => m !== outer) })).filter((g) => g.ms.length);
      }

      // continue with the first group; queue the second
      const first = groups[0];
      for (let gi = 1; gi < groups.length; gi++) {
        const g = groups[gi];
        const gm = g.ms.reduce((s, m) => s + m.off, 0) / g.ms.length;
        queue.push({
          c: [cEnd[0] + p1[0] * gm, cEnd[1] + p1[1] * gm],
          d: g.nd,
          members: g.ms.map((m) => ({ trace: m.trace, off: m.off - gm })),
          segs,
        });
      }
      const gm0 = first.ms.reduce((s, m) => s + m.off, 0) / first.ms.length;
      c = [cEnd[0] + p1[0] * gm0, cEnd[1] + p1[1] * gm0];
      members = first.ms.map((m) => ({ trace: m.trace, off: m.off - gm0 }));
      d = first.nd;
    }
    // terminate: staggered ends with pads
    const sorted = [...members].sort((a, b2) => a.off - b2.off);
    sorted.forEach((m, i) => {
      const t = m.trace;
      if (t.pts.length < 2) return;
      if (i % 2 === 1) {
        const a = t.pts[t.pts.length - 2];
        const e = t.pts[t.pts.length - 1];
        const L = Math.hypot(e[0] - a[0], e[1] - a[1]);
        if (L < 1e-6) return;
        const cut = Math.min(L * 0.6, o.spacing * 1.4);
        t.pts[t.pts.length - 1] = [e[0] + ((a[0] - e[0]) / L) * cut, e[1] + ((a[1] - e[1]) / L) * cut];
      }
      t.padEnd = o.endPad();
      const e = t.pts[t.pts.length - 1];
      if (t.padEnd) this.occ.mark(e[0], e[1], o.padRadius, ids.get(t) ?? -1);
    });
    return members.length;
  }

  /** Remove traces that never grew. */
  prune(minLen: number) {
    this.traces = this.traces.filter((t) => polyLength(t.pts) >= minLen);
  }
}

export const polyLength = (pts: V2[]) => {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
};

/** Arc-length sampler for a polyline. */
export class PathSampler {
  cum: Float64Array;
  length: number;
  constructor(public pts: V2[]) {
    this.cum = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++)
      this.cum[i] = this.cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    this.length = this.cum[pts.length - 1];
  }
  at(s: number, out: V2): V2 {
    const L = Math.min(Math.max(s, 0), this.length);
    let lo = 1;
    let hi = this.pts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] < L) lo = mid + 1;
      else hi = mid;
    }
    const a = this.pts[lo - 1];
    const b = this.pts[lo];
    const seg = this.cum[lo] - this.cum[lo - 1];
    const t = seg > 0 ? (L - this.cum[lo - 1]) / seg : 0;
    out[0] = a[0] + (b[0] - a[0]) * t;
    out[1] = a[1] + (b[1] - a[1]) * t;
    return out;
  }
}

// ----------------------------------------------------------------------------
// Geometry: flat ribbons for traces + quads for pads/vias, on the y=height
// plane. 2D (x, y) maps to world (x, height, -y).

export type PadSpec = { ring: number; inner: number; via: number; viaInner: number };

export type SquareDot = { p: V2; r: number; bright: number; tone: number };

export const buildTraceGeometry = (traces: Trace[], pads: PadSpec, height: number, squares: SquareDot[] = []) => {
  const pos: number[] = [];
  const uv: number[] = [];
  const info: number[] = []; // kind, bright, tone, seed
  const idx: number[] = [];
  const pushV = (x: number, y: number, u: number, v: number, kind: number, t: Trace) => {
    pos.push(x, height, -y);
    uv.push(u, v);
    info.push(kind, t.bright, t.tone, t.seed);
    return pos.length / 3 - 1;
  };
  const trim = (pts: V2[], atStart: boolean, by: number): V2[] => {
    if (by <= 0 || pts.length < 2) return pts;
    const out = pts.slice();
    const [i0, i1] = atStart ? [0, 1] : [out.length - 1, out.length - 2];
    const a = out[i0];
    const b = out[i1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-9) return out;
    const k = Math.min(by, L * 0.5) / L;
    out[i0] = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    return out;
  };
  for (const t of traces) {
    const pr = (k: 0 | 1 | 2) => (k === 1 ? pads.ring * pads.inner : k === 2 ? pads.via * pads.viaInner : 0);
    let pts = trim(t.pts, true, pr(t.padStart));
    pts = trim(pts, false, pr(t.padEnd));
    const n = pts.length;
    if (n < 2) continue;
    const hw = t.width / 2;
    let s = 0;
    let prev = -1;
    for (let i = 0; i < n; i++) {
      // mitre normal
      let nx = 0;
      let ny = 0;
      const seg = (j: number) => {
        const dx = pts[j + 1][0] - pts[j][0];
        const dy = pts[j + 1][1] - pts[j][1];
        const l = Math.hypot(dx, dy) || 1;
        return [-dy / l, dx / l];
      };
      if (i === 0) [nx, ny] = seg(0);
      else if (i === n - 1) [nx, ny] = seg(n - 2);
      else {
        const a = seg(i - 1);
        const b = seg(i);
        nx = a[0] + b[0];
        ny = a[1] + b[1];
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const k = 1 / Math.max(0.5, nx * b[0] + ny * b[1]);
        nx *= k;
        ny *= k;
      }
      if (i > 0) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      const a = pushV(pts[i][0] + nx * hw, pts[i][1] + ny * hw, -1, s, 0, t);
      pushV(pts[i][0] - nx * hw, pts[i][1] - ny * hw, 1, s, 0, t);
      if (prev >= 0) idx.push(prev, prev + 1, a, prev + 1, a + 1, a);
      prev = a;
    }
    const pad = (p: V2, kind: 0 | 1 | 2) => {
      if (!kind) return;
      const R = kind === 1 ? pads.ring : pads.via;
      const k = kind === 1 ? 1 : 2;
      const b = pushV(p[0] - R, p[1] - R, -1, -1, k, t);
      pushV(p[0] + R, p[1] - R, 1, -1, k, t);
      pushV(p[0] + R, p[1] + R, 1, 1, k, t);
      pushV(p[0] - R, p[1] + R, -1, 1, k, t);
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    };
    pad(t.pts[0], t.padStart);
    pad(t.pts[t.pts.length - 1], t.padEnd);
  }
  for (const q of squares) {
    const t = { bright: q.bright, tone: q.tone, seed: 0 } as Trace;
    const R = q.r;
    const b = pushV(q.p[0] - R, q.p[1] - R, -1, -1, 3, t);
    pushV(q.p[0] + R, q.p[1] - R, 1, -1, 3, t);
    pushV(q.p[0] + R, q.p[1] + R, 1, 1, 3, t);
    pushV(q.p[0] - R, q.p[1] + R, -1, 1, 3, t);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  for (const v of pos) if (!Number.isFinite(v)) throw new Error('buildTraceGeometry: non-finite vertex');
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aUv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(info, 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
};
